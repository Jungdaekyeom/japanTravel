import { NextResponse } from "next/server";
import { z } from "zod";

import { hashIpAddress, hashSessionToken } from "../../../../server/auth/crypto";
import { reserveLoginAttempt } from "../../../../server/auth/rate-limit";
import { getViewer, issueClaimedSession } from "../../../../server/auth/session";
import { getClientIp, setSessionCookie } from "../../../../server/http";
import type { TripRepository } from "../../../../server/repository/types";

export const runtime = "nodejs";

const claimSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

type ClaimDependencies = {
  repository: TripRepository;
  pepper: string;
  now?: () => Date;
};

function invalidLink() {
  return NextResponse.json({ error: "invalid_link" }, { status: 401 });
}

function unavailable() {
  return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
}

export function createClaimHandler({ repository, pepper, now = () => new Date() }: ClaimDependencies) {
  return async function claim(request: Request) {
    const attemptedAt = now();
    try {
      const viewer = await getViewer(request, repository, attemptedAt);
      if (viewer.role !== "observer") return NextResponse.json({ role: viewer.role });
    } catch {
      return unavailable();
    }

    const ipHash = hashIpAddress(getClientIp(request), pepper);
    let reservationId: string | null;
    try {
      reservationId = await reserveLoginAttempt(repository, ipHash, attemptedAt);
    } catch {
      return unavailable();
    }
    if (!reservationId) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

    try {
      const parsed = claimSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) {
        await repository.finalizeLoginAttempt(reservationId);
        return invalidLink();
      }

      const issued = issueClaimedSession(attemptedAt);
      const claimed = await repository.claimPersonalToken(hashSessionToken(parsed.data.token), issued.session);
      if (!claimed) {
        await repository.finalizeLoginAttempt(reservationId);
        return invalidLink();
      }

      try { await repository.releaseLoginAttempt(reservationId); } catch {}
      reservationId = null;
      const response = NextResponse.json({ role: claimed.role });
      setSessionCookie(response, issued.token);
      return response;
    } catch {
      try { if (reservationId) await repository.releaseLoginAttempt(reservationId); } catch {}
      return unavailable();
    }
  };
}

export async function POST(request: Request) {
  const [{ getSessionEnv }, { getTripRepository }] = await Promise.all([
    import("../../../../server/env"),
    import("../../../../server/repository"),
  ]);
  return createClaimHandler({ repository: getTripRepository(), pepper: getSessionEnv().SESSION_PEPPER })(request);
}
