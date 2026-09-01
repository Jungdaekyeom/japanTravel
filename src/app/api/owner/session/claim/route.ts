import { NextResponse } from "next/server";
import { z } from "zod";

import { hashIpAddress, hashOwnerClaimToken } from "../../../../../server/auth/crypto";
import { reserveLoginAttempt } from "../../../../../server/auth/rate-limit";
import { issueClaimedSession } from "../../../../../server/auth/session";
import { getClientIp } from "../../../../../server/http";
import type { TripRepository } from "../../../../../server/repository/types";

export const runtime = "nodejs";

const claimSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();

type OwnerClaimDependencies = {
  repository: TripRepository;
  pepper: string;
  now?: () => Date;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function createOwnerClaimHandler({ repository, pepper, now = () => new Date() }: OwnerClaimDependencies) {
  return async function claim(request: Request) {
    const attemptedAt = now();
    const ipHash = hashIpAddress(getClientIp(request), pepper);
    let reservationId: string | null;
    try {
      reservationId = await reserveLoginAttempt(repository, ipHash, attemptedAt);
    } catch {
      return json({ error: "service_unavailable" }, 503);
    }
    if (!reservationId) return json({ error: "rate_limited" }, 429);

    try {
      const parsed = claimSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) {
        await repository.finalizeLoginAttempt(reservationId);
        return json({ error: "invalid_link" }, 401);
      }

      const issued = issueClaimedSession(attemptedAt);
      const claimed = await repository.claimOwnerToken(hashOwnerClaimToken(parsed.data.token), issued.session);
      if (!claimed || claimed.participantId !== "daekyeom" || claimed.role !== "admin") {
        await repository.finalizeLoginAttempt(reservationId);
        return json({ error: "invalid_link" }, 401);
      }

      try { await repository.releaseLoginAttempt(reservationId); } catch {}
      reservationId = null;
      return json({ accessToken: issued.token, expiresAt: issued.session.expiresAt.toISOString() });
    } catch {
      try { if (reservationId) await repository.releaseLoginAttempt(reservationId); } catch {}
      return json({ error: "service_unavailable" }, 503);
    }
  };
}

export async function POST(request: Request) {
  const [{ getSessionEnv }, { getTripRepository }] = await Promise.all([
    import("../../../../../server/env"),
    import("../../../../../server/repository"),
  ]);
  return createOwnerClaimHandler({ repository: getTripRepository(), pepper: getSessionEnv().SESSION_PEPPER })(request);
}
