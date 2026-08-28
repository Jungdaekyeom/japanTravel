import { z } from "zod";
import { NextResponse } from "next/server";

import { hashIpAddress, verifyParticipantCode } from "../../../../server/auth/crypto";
import { reserveLoginAttempt } from "../../../../server/auth/rate-limit";
import { issueSession } from "../../../../server/auth/session";
import { getClientIp, setSessionCookie } from "../../../../server/http";
import type { TripRepository } from "../../../../server/repository/types";

export const runtime = "nodejs";

const unlockSchema = z.object({ code: z.string().regex(/^\d{6}$/) });

type UnlockDependencies = {
  repository: TripRepository;
  pepper: string;
  now?: () => Date;
};

function invalidCode() {
  return NextResponse.json({ error: "invalid_code" }, { status: 401 });
}

function unavailable() {
  return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
}

export function createUnlockHandler({ repository, pepper, now = () => new Date() }: UnlockDependencies) {
  return async function unlock(request: Request) {
    const attemptedAt = now();
    const ipHash = hashIpAddress(getClientIp(request), pepper);
    let reservationId: string | null;
    try {
      reservationId = await reserveLoginAttempt(repository, ipHash, attemptedAt);
    } catch {
      return unavailable();
    }
    if (!reservationId) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    try {
      const body = await request.json().catch(() => null);
      const parsed = unlockSchema.safeParse(body);
      if (!parsed.success) {
        await repository.finalizeLoginAttempt(reservationId);
        return invalidCode();
      }

      const credentials = await repository.listParticipantCredentials();
      const matches = await Promise.all(
        credentials.map(async (participant) => ({
          participant,
          valid: await verifyParticipantCode(parsed.data.code, participant.codeSalt, participant.codeHash, pepper),
        })),
      );
      const matched = matches.find(({ valid }) => valid)?.participant;
      if (!matched) {
        await repository.finalizeLoginAttempt(reservationId);
        return invalidCode();
      }

      await repository.releaseLoginAttempt(reservationId);
      reservationId = null;
      const issued = issueSession(matched.id, attemptedAt);
      await repository.createSession(issued.session);
      const response = NextResponse.json({ role: matched.role });
      setSessionCookie(response, issued.token);
      return response;
    } catch {
      try {
        if (reservationId) await repository.releaseLoginAttempt(reservationId);
      } catch {}
      return unavailable();
    }
  };
}

export async function POST(request: Request) {
  const [{ getServerEnv }, { getTripRepository }] = await Promise.all([
    import("../../../../server/env"),
    import("../../../../server/repository"),
  ]);
  return createUnlockHandler({ repository: getTripRepository(), pepper: getServerEnv().SESSION_PEPPER })(request);
}
