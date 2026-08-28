import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getViewer } from "../../../../server/auth/session";
import { buildTripPayload } from "../../../../server/trip/payload";
import type { TripRepository } from "../../../../server/repository/types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ inviteToken: string }> };
type TripDependencies = { repository: TripRepository; inviteToken: string; now?: () => Date };

const paramsSchema = z.object({ inviteToken: z.string().min(1).max(256) }).strict();

function tokenDigest(value: string) {
  return createHash("sha256").update(value).digest();
}

function hasMatchingInviteToken(value: string, expected: string) {
  return timingSafeEqual(tokenDigest(value), tokenDigest(expected));
}

function notFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

export function createTripHandler({ repository, inviteToken, now = () => new Date() }: TripDependencies) {
  return async function trip(request: Request, context: RouteContext) {
    const params = paramsSchema.safeParse(await context.params);
    if (!params.success || !hasMatchingInviteToken(params.data.inviteToken, inviteToken)) return notFound();
    try {
      const requestTime = now();
      const [viewer, opinions, routes] = await Promise.all([
        getViewer(request, repository, requestTime),
        repository.listOpinions(),
        repository.listRouteGeometry(requestTime),
      ]);
      return NextResponse.json(buildTripPayload(viewer, opinions, routes, requestTime));
    } catch {
      return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
    }
  };
}

export async function GET(request: Request, context: RouteContext) {
  const [{ getServerEnv }, { getTripRepository }] = await Promise.all([
    import("../../../../server/env"),
    import("../../../../server/repository"),
  ]);
  const env = getServerEnv();
  return createTripHandler({ repository: getTripRepository(), inviteToken: env.INVITE_TOKEN })(request, context);
}
