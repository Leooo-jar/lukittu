import prisma from '@/lib/database/prisma';
import { createSession } from '@/lib/utils/auth';
import { generateKeyPair } from '@/lib/utils/crypto';
import { logger } from '@/lib/utils/logger';
import { Provider } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');

    if (!code || typeof code !== 'string') {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    const formattedUrl = 'https://github.com/login/oauth/access_token';

    const accessTokenRes = await fetch(formattedUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID!,
        client_secret: process.env.GITHUB_CLIENT_SECRET!,
        redirect_uri: process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI!,
        code,
      }),
    });

    if (!accessTokenRes.ok) {
      return NextResponse.redirect(
        new URL('/auth/login?error=server_error&provider=github', request.url),
      );
    }

    const accessTokenData = (await accessTokenRes.json()) as any;

    if (!accessTokenData?.access_token) {
      return NextResponse.redirect(
        new URL('/auth/login?error=server_error&provider=github', request.url),
      );
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: 'Bearer ' + accessTokenData.access_token,
        Accept: 'application/json; charset=utf-8',
        'Accept-Encoding': 'application/json; charset=utf-8',
      },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(
        new URL('/auth/login?error=server_error&provider=github', request.url),
      );
    }

    const user = (await userRes.json()) as any;

    if (!user?.id || !user?.email) {
      return NextResponse.redirect(
        new URL('/auth/login?error=server_error&provider=github', request.url),
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (existingUser) {
      if (existingUser.provider !== Provider.GITHUB) {
        return NextResponse.redirect(
          new URL(
            `/auth/login?error=wrong_provider&provider=${existingUser.provider.toLowerCase()}`,
            request.url,
          ),
        );
      }

      const createdSession = await createSession(existingUser.id, true);

      if (!createdSession) {
        return NextResponse.redirect(
          new URL(
            '/auth/login?error=server_error&provider=github',
            request.url,
          ),
        );
      }

      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    const newUser = await prisma.$transaction(async (prisma) => {
      const newUser = await prisma.user.create({
        data: {
          email: user.email,
          fullName: user.name,
          provider: Provider.GITHUB,
          emailVerified: true,
        },
      });

      const { privateKey, publicKey } = generateKeyPair();

      await prisma.team.create({
        data: {
          name: 'My first team',
          ownerId: newUser.id,
          privateKeyRsa: privateKey,
          publicKeyRsa: publicKey,
          users: {
            connect: {
              id: newUser.id,
            },
          },
        },
      });

      return newUser;
    });

    const createdSession = await createSession(newUser.id, true);

    if (!createdSession) {
      return NextResponse.redirect(
        new URL('/auth/login?error=server_error&provider=github', request.url),
      );
    }

    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    logger.error("Error occurred in 'auth/oauth/github' route", error);
    return NextResponse.redirect(
      new URL('/auth/login?error=server_error&provider=github', request.url),
    );
  }
}
