import { regex } from '@/lib/constants/regex';
import prisma from '@/lib/database/prisma';
import { getSession } from '@/lib/utils/auth';
import { getLanguage } from '@/lib/utils/header-helpers';
import { logger } from '@/lib/utils/logger';
import { ErrorResponse } from '@/types/common-api-types';
import { HttpStatus } from '@/types/http-status';
import { getTranslations } from 'next-intl/server';
import { NextRequest, NextResponse } from 'next/server';

type ISessionsSignOutSuccessResponse = {
  success: boolean;
};

export type ISessionsSignOutResponse =
  | ErrorResponse
  | ISessionsSignOutSuccessResponse;

export async function DELETE(
  _: NextRequest,
  { params }: { params: { slug: string } },
): Promise<NextResponse<ISessionsSignOutResponse>> {
  const t = await getTranslations({ locale: getLanguage() });

  try {
    const id = params.slug;

    if (!id || !regex.uuidV4.test(id)) {
      return NextResponse.json(
        {
          message: t('validation.bad_request'),
        },
        { status: HttpStatus.BAD_REQUEST },
      );
    }

    const session = await getSession({
      user: {
        include: {
          sessions: true,
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        {
          message: t('validation.unauthorized'),
        },
        { status: HttpStatus.UNAUTHORIZED },
      );
    }

    const sessionToLogout = session.user.sessions.find((s) => s.id === id);

    if (!sessionToLogout) {
      return NextResponse.json(
        {
          message: t('validation.invalid_session'),
        },
        { status: HttpStatus.NOT_FOUND },
      );
    }

    await prisma.session.delete({
      where: {
        userId: session.user.id,
        id,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    logger.error("Error occurred in 'sessions/[slug]' route", error);
    return NextResponse.json(
      {
        message: t('general.server_error'),
      },
      { status: HttpStatus.INTERNAL_SERVER_ERROR },
    );
  }
}
