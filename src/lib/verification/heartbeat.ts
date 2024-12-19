import { HttpStatus } from '@/types/http-status';
import { IpLimitPeriod, RequestStatus } from '@prisma/client';
import { regex } from '../constants/regex';
import prisma from '../database/prisma';
import { CloudflareVisitorData } from '../providers/cloudflare';
import { generateHMAC, signChallenge } from '../security/crypto';
import { isRateLimited } from '../security/rate-limiter';
import { licenseHeartbeatSchema } from '../validation/licenses/license-heartbeat-schema';
import { sharedVerificationHandler } from './shared/shared-verification';

interface HandleHeartbeatProps {
  teamId: string;
  ipAddress: string | null;
  geoData: CloudflareVisitorData | null;
  payload: {
    licenseKey: string;
    customerId?: string | undefined;
    productId?: string | undefined;
    challenge?: string | undefined;
    version?: string | undefined;
    deviceIdentifier?: string | undefined;
  };
}

export const handleHeartbeat = async ({
  teamId,
  ipAddress,
  geoData,
  payload,
}: HandleHeartbeatProps) => {
  if (!teamId || !regex.uuidV4.test(teamId)) {
    return {
      status: RequestStatus.BAD_REQUEST,
      response: {
        data: null,
        result: {
          timestamp: new Date(),
          valid: false,
          details: 'Invalid team UUID',
        },
      },
      httpStatus: HttpStatus.BAD_REQUEST,
    };
  }

  const validated = await licenseHeartbeatSchema().safeParseAsync(payload);

  if (!validated.success) {
    return {
      status: RequestStatus.BAD_REQUEST,
      response: {
        data: null,
        result: {
          timestamp: new Date(),
          valid: false,
          details: validated.error.errors[0].message,
        },
      },
      httpStatus: HttpStatus.BAD_REQUEST,
    };
  }

  if (ipAddress) {
    const key = `license-heartbeat:${ipAddress}`;
    const isLimited = await isRateLimited(key, 5, 60); // 5 requests per 1 minute

    if (isLimited) {
      return {
        status: RequestStatus.RATE_LIMIT,
        response: {
          data: null,
          result: {
            timestamp: new Date(),
            valid: false,
            details: 'Rate limited',
          },
        },
        httpStatus: HttpStatus.TOO_MANY_REQUESTS,
      };
    }
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId, deletedAt: null },
    include: {
      keyPair: {
        omit: {
          privateKey: false,
        },
      },
      settings: true,
      blacklist: true,
    },
  });

  const settings = team?.settings;
  const keyPair = team?.keyPair;

  if (!team || !settings || !keyPair) {
    return {
      status: RequestStatus.TEAM_NOT_FOUND,
      response: {
        data: null,
        result: {
          timestamp: new Date(),
          valid: false,
          details: 'Team not found',
        },
      },
      httpStatus: HttpStatus.NOT_FOUND,
    };
  }

  const {
    licenseKey,
    deviceIdentifier,
    customerId,
    productId,
    challenge,
    version,
  } = validated.data;

  const licenseKeyLookup = generateHMAC(`${licenseKey}:${teamId}`);

  const ipLimitPeriodDays =
    settings.ipLimitPeriod === IpLimitPeriod.DAY
      ? 1
      : settings.ipLimitPeriod === IpLimitPeriod.WEEK
        ? 7
        : 30;

  const ipLimitPeriodDate = new Date(
    new Date().getTime() - ipLimitPeriodDays * 24 * 60 * 60 * 1000,
  );

  const license = await prisma.license.findUnique({
    where: {
      team: {
        deletedAt: null,
      },
      teamId_licenseKeyLookup: { teamId, licenseKeyLookup },
    },
    include: {
      customers: true,
      products: {
        include: {
          releases: {
            where: {
              status: 'PUBLISHED',
            },
            include: {
              file: true,
            },
            take: 1,
          },
        },
      },
      devices: true,
      requestLogs: {
        where: {
          createdAt: {
            gte: ipLimitPeriodDate,
          },
        },
      },
    },
  });

  const licenseHasCustomers = Boolean(license?.customers.length);
  const licenseHasProducts = Boolean(license?.products.length);

  const hasStrictProducts = settings.strictProducts || false;
  const hasStrictCustomers = settings.strictCustomers || false;
  const hasStrictReleases = settings.strictReleases || false;

  const matchingCustomer = license?.customers.find(
    (customer) => customer.id === customerId,
  );

  const matchingProduct = license?.products.find(
    (product) => product.id === productId,
  );

  const productHasReleases = (matchingProduct?.releases.length ?? 0) > 0;

  const matchingRelease = matchingProduct?.releases.find(
    (release) => release.version === version,
  );

  const latestRelease = matchingProduct?.releases.find((r) => r.latest);

  const commonBase = {
    teamId,
    customerId: matchingCustomer ? customerId : undefined,
    productId: matchingProduct ? productId : undefined,
    deviceIdentifier,
    licenseKeyLookup: undefined as string | undefined,
    releaseId: undefined as string | undefined,
    releaseFileId: undefined as string | undefined,
  };

  if (!license) {
    return {
      ...commonBase,
      status: RequestStatus.LICENSE_NOT_FOUND,
      response: {
        data: null,
        result: {
          timestamp: new Date(),
          valid: false,
          details: 'License not found',
        },
      },
      httpStatus: HttpStatus.NOT_FOUND,
    };
  }

  commonBase.licenseKeyLookup = licenseKeyLookup;

  const blacklistCheck = await sharedVerificationHandler.checkBlacklist(
    team,
    teamId,
    ipAddress,
    geoData,
    deviceIdentifier,
  );

  if (blacklistCheck) {
    return {
      ...commonBase,
      status: blacklistCheck.status,
      response: {
        data: null,
        result: {
          timestamp: new Date(),
          valid: false,
          details: blacklistCheck.details,
        },
      },
      httpStatus: HttpStatus.FORBIDDEN,
    };
  }

  const strictModeNoCustomerId =
    hasStrictCustomers && licenseHasCustomers && !customerId;
  const noCustomerMatch =
    licenseHasCustomers && customerId && !matchingCustomer;

  if (strictModeNoCustomerId || noCustomerMatch) {
    return {
      ...commonBase,
      status: RequestStatus.CUSTOMER_NOT_FOUND,
      response: {
        data: null,
        result: {
          timestamp: new Date(),
          valid: false,
          details: 'Customer not found',
        },
      },
      httpStatus: HttpStatus.NOT_FOUND,
    };
  }

  const strictModeNoProductId =
    hasStrictProducts && licenseHasProducts && !productId;
  const noProductMatch = licenseHasProducts && productId && !matchingProduct;

  if (strictModeNoProductId || noProductMatch) {
    return {
      ...commonBase,
      status: RequestStatus.PRODUCT_NOT_FOUND,
      response: {
        data: null,
        result: {
          timestamp: new Date(),
          valid: false,
          details: 'Product not found',
        },
      },
      httpStatus: HttpStatus.NOT_FOUND,
    };
  }

  const strictModeNoVersion =
    hasStrictReleases && productHasReleases && !version;
  const noVersionMatch = productHasReleases && version && !matchingRelease;

  if (strictModeNoVersion || noVersionMatch) {
    return {
      ...commonBase,
      status: RequestStatus.RELEASE_NOT_FOUND,
      response: {
        data: null,
        result: {
          timestamp: new Date(),
          valid: false,
          details: 'Release not found with specified version',
        },
      },
      httpStatus: HttpStatus.NOT_FOUND,
    };
  }

  commonBase.releaseId = matchingRelease?.id;

  if (license.suspended) {
    return {
      ...commonBase,
      status: RequestStatus.LICENSE_SUSPENDED,
      response: {
        data: null,
        result: {
          timestamp: new Date(),
          valid: false,
          details: 'License suspended',
        },
      },
      httpStatus: HttpStatus.FORBIDDEN,
    };
  }

  const licenseExpirationCheck =
    await sharedVerificationHandler.checkLicenseExpiration(
      license,
      licenseKeyLookup,
    );

  if (licenseExpirationCheck) {
    return {
      ...commonBase,
      status: licenseExpirationCheck.status,
      response: {
        data: null,
        result: {
          timestamp: new Date(),
          valid: false,
          details: licenseExpirationCheck.details,
        },
      },
      httpStatus: HttpStatus.FORBIDDEN,
    };
  }

  if (license.ipLimit) {
    const existingIps = Array.from(
      new Set(license.requestLogs.map((log) => log.ipAddress).filter(Boolean)),
    );
    const ipLimitReached = existingIps.length >= license.ipLimit;

    // TODO: @KasperiP: Maybe add separate table for storing IP addresses because user's probably want to also remove old IP addresses
    if (!existingIps.includes(ipAddress) && ipLimitReached) {
      return {
        ...commonBase,
        status: RequestStatus.IP_LIMIT_REACHED,
        response: {
          data: null,
          result: {
            timestamp: new Date(),
            valid: false,
            details: 'IP limit reached',
          },
        },
        httpStatus: HttpStatus.FORBIDDEN,
      };
    }
  }

  if (license.seats) {
    const deviceTimeout = settings.deviceTimeout || 60;

    const activeSeats = license.devices.filter(
      (device) =>
        new Date(device.lastBeatAt).getTime() >
        new Date(Date.now() - deviceTimeout * 60 * 1000).getTime(),
    );

    const seatsIncludesClient = activeSeats.some(
      (seat) => seat.deviceIdentifier === deviceIdentifier,
    );

    if (!seatsIncludesClient && activeSeats.length >= license.seats) {
      return {
        ...commonBase,
        status: RequestStatus.MAXIMUM_CONCURRENT_SEATS,
        response: {
          data: null,
          result: {
            timestamp: new Date(),
            valid: false,
            details: 'License seat limit reached',
          },
        },
        httpStatus: HttpStatus.FORBIDDEN,
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.device.upsert({
      where: {
        licenseId_deviceIdentifier: {
          licenseId: license.id,
          deviceIdentifier,
        },
      },
      update: {
        lastBeatAt: new Date(),
        ipAddress,
        country: geoData?.alpha3 || null,
      },
      create: {
        ipAddress,
        teamId: team.id,
        deviceIdentifier,
        lastBeatAt: new Date(),
        licenseId: license.id,
        country: geoData?.alpha3 || null,
      },
    });

    if (matchingRelease || latestRelease) {
      const idToUse = matchingRelease?.id || latestRelease?.id;

      await tx.release.update({
        where: { id: idToUse },
        data: {
          lastSeenAt: new Date(),
        },
      });
    }
  });

  const challengeResponse = challenge
    ? signChallenge(challenge, keyPair.privateKey)
    : undefined;

  return {
    ...commonBase,
    status: RequestStatus.VALID,
    response: {
      data: null,
      result: {
        timestamp: new Date(),
        valid: true,
        details: 'License heartbeat successful',
        challengeResponse,
      },
    },
    httpStatus: HttpStatus.OK,
  };
};
