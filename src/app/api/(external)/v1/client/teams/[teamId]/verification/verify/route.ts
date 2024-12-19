import { logger } from '@/lib/logging/logger';
import { loggedResponse } from '@/lib/logging/request-log';
import { getCloudflareVisitorData } from '@/lib/providers/cloudflare';
import { getIp } from '@/lib/utils/header-helpers';
import { VerifyLicenseSchema } from '@/lib/validation/licenses/verify-license-schema';
import { handleVerify } from '@/lib/verification/verify';
import { HttpStatus } from '@/types/http-status';
import { RequestStatus, RequestType } from '@prisma/client';
import { NextRequest } from 'next/server';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ teamId: string }> },
) {
  const params = await props.params;
  const requestTime = new Date();
  const teamId = params.teamId;

  const loggedResponseBase = {
    body: null,
    request,
    requestTime,
    type: RequestType.VERIFY,
  };

  const geoData = await getCloudflareVisitorData();
  const ipAddress = await getIp();

  try {
    const body = (await request.json()) as VerifyLicenseSchema;

    const result = await handleVerify({
      teamId,
      ipAddress,
      geoData,
      payload: body,
    });

    return loggedResponse({
      ...loggedResponseBase,
      ...result,
    });
  } catch (error) {
    logger.error(
      "Error occurred in '(external)/v1/client/teams/[teamId]/verification/verify' route",
      error,
    );

    if (error instanceof SyntaxError) {
      return loggedResponse({
        ...loggedResponseBase,
        status: RequestStatus.BAD_REQUEST,
        response: {
          data: null,
          result: {
            timestamp: new Date(),
            valid: false,
            details: 'Invalid JSON payload',
          },
        },
        httpStatus: HttpStatus.BAD_REQUEST,
      });
    }

    return loggedResponse({
      ...loggedResponseBase,
      status: RequestStatus.INTERNAL_SERVER_ERROR,
      response: {
        data: null,
        result: {
          timestamp: new Date(),
          valid: false,
          details: 'Internal server error',
        },
      },
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}
