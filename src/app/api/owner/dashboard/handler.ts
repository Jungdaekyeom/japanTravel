import { NextResponse } from "next/server";

import { TRIP_DEFINITION } from "../../../../trip/definition";
import { getBearerToken, getViewer } from "../../../../server/auth/session";
import type { OpinionRecord, RouteGeometryRecord, RouteSegmentKey, TripRepository } from "../../../../server/repository/types";
import {
  FINALIZATION_CLOSES_AT,
  FINALIZATION_OPENS_AT,
  ROUTE_SEGMENT_KEYS,
  ROUTE_TRIP_DATES,
} from "../../../../server/routes/service";

type OwnerDashboardDependencies = { repository: TripRepository; now?: () => Date };

const titles: Record<RouteSegmentKey, string> = {
  "kix-kyoto": "KIX → 교토",
  "kyoto-odawara": "교토 → 오다와라",
  "odawara-tokyo": "오다와라 → 도쿄",
  "tokyo-narita": "우에노 → 나리타",
};
const participantNames = new Map<string, string>(TRIP_DEFINITION.participants.map((participant) => [participant.id, participant.name]));

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function pendingOpinions(opinions: readonly OpinionRecord[]) {
  return opinions
    .filter((opinion) => opinion.status === "pending")
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || left.id.localeCompare(right.id))
    .map((opinion) => ({
      id: opinion.id,
      participantId: opinion.participantId,
      authorName: participantNames.get(opinion.participantId) ?? opinion.participantId,
      targetDay: opinion.targetDay,
      body: opinion.body,
      status: opinion.status,
      reviewedBy: opinion.reviewedBy,
      reviewedAt: opinion.reviewedAt?.toISOString() ?? null,
      rejectionCategory: opinion.rejectionCategory,
      publicSummary: opinion.publicSummary,
      rejectionReason: opinion.rejectionReason,
      rejectionAcceptedAt: opinion.rejectionAcceptedAt?.toISOString() ?? null,
      createdAt: opinion.createdAt.toISOString(),
      updatedAt: opinion.updatedAt.toISOString(),
    }));
}

function railSegments(routes: readonly RouteGeometryRecord[], now: Date) {
  const active = new Map(routes.filter((route) => route.status === "finalized").map((route) => [route.segmentKey, route]));
  const canFinalize = now >= FINALIZATION_OPENS_AT && now < FINALIZATION_CLOSES_AT;
  return ROUTE_SEGMENT_KEYS.map((key) => {
    const route = active.get(key);
    return {
      key,
      title: titles[key],
      tripDate: ROUTE_TRIP_DATES[key],
      finalized: Boolean(route),
      departureTime: route?.departureTime ?? null,
      expiresAt: route?.expiresAt.toISOString() ?? null,
      naritaRailChoice: route?.naritaRailChoice === "skyliner" ? "skyliner" as const : null,
      canFinalize,
    };
  });
}

export function createOwnerDashboardHandler({ repository, now = () => new Date() }: OwnerDashboardDependencies) {
  return async function dashboard(request: Request) {
    if (!getBearerToken(request)) return json({ error: "unauthorized" }, 401);
    const requestTime = now();
    try {
      const viewer = await getViewer(request, repository, requestTime);
      if (viewer.role === "observer") return json({ error: "unauthorized" }, 401);
      if (viewer.role !== "admin" || viewer.id !== "daekyeom") return json({ error: "forbidden" }, 403);
      const [opinions, routes] = await Promise.all([
        repository.listOpinions(),
        repository.listRouteGeometry(requestTime),
      ]);
      return json({
        pendingOpinions: pendingOpinions(opinions),
        railSegments: railSegments(routes, requestTime),
        finalizationOpensAt: FINALIZATION_OPENS_AT.toISOString(),
        finalizationClosesAt: FINALIZATION_CLOSES_AT.toISOString(),
      });
    } catch {
      return json({ error: "service_unavailable" }, 503);
    }
  };
}

export async function GET(request: Request) {
  const { getTripRepository } = await import("../../../../server/repository");
  return createOwnerDashboardHandler({ repository: getTripRepository() })(request);
}
