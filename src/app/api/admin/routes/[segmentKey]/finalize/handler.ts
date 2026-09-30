import { NextResponse } from "next/server";

import { getViewer } from "../../../../../../server/auth/session";
import type { TripRepository } from "../../../../../../server/repository/types";
import { createGoogleRoutesClient, type GoogleRoutesClient } from "../../../../../../server/routes/google-routes";
import {
  RouteFinalizationError,
  finalizeRailRoute,
  finalizeRailRouteInputSchema,
  routeSegmentKeySchema,
} from "../../../../../../server/routes/service";

type RouteContext = { params: Promise<{ segmentKey: string }> };
type FinalizeDependencies = { repository: TripRepository; client: GoogleRoutesClient; now?: () => Date };

function errorResponse(error: unknown) {
  if (error instanceof RouteFinalizationError) {
    const status = error.code === "forbidden" ? 403
      : error.code === "invalid_request" || error.code === "invalid_departure_date" ? 400
        : error.code === "not_open" ? 409
          : 410;
    const message = error.code === "invalid_departure_date"
      ? "출발 시각은 해당 철도 구간의 여행 날짜와 일치해야 합니다."
      : undefined;
    return NextResponse.json({ error: error.code, ...(message ? { message } : {}) }, { status });
  }
  return NextResponse.json({
    error: "route_unavailable",
    message: "철도 경로를 확정하지 못했습니다. 기존 경로를 유지합니다.",
  }, { status: 502 });
}

export function createFinalizeRailRouteHandler({ repository, client, now = () => new Date() }: FinalizeDependencies) {
  return async function finalize(request: Request, context: RouteContext) {
    const requestTime = now();
    try {
      const viewer = await getViewer(request, repository, requestTime);
      if (viewer.role !== "admin") throw new RouteFinalizationError("forbidden");
      const params = routeSegmentKeySchema.safeParse((await context.params).segmentKey);
      let json: unknown;
      try { json = await request.json(); }
      catch { throw new RouteFinalizationError("invalid_request"); }
      const input = finalizeRailRouteInputSchema.safeParse(json);
      if (!params.success || !input.success) throw new RouteFinalizationError("invalid_request");
      const route = await finalizeRailRoute(params.data, input.data, requestTime, { repository, client, viewer });
      return NextResponse.json({ route: { segmentKey: route.segmentKey, status: route.status } });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function POST(request: Request, context: RouteContext) {
  const [{ getTripRepository }, { getGoogleRoutesEnv }] = await Promise.all([
    import("../../../../../../server/repository"),
    import("../../../../../../server/env"),
  ]);
  const env = getGoogleRoutesEnv();
  const client = createGoogleRoutesClient({
    apiKey: env.GOOGLE_ROUTES_API_KEY,
    placeIds: {
      KIX: env.GOOGLE_PLACE_ID_KIX,
      KYOTO_STATION: env.GOOGLE_PLACE_ID_KYOTO_STATION,
      ODAWARA_STATION: env.GOOGLE_PLACE_ID_ODAWARA_STATION,
      TOKYO_STATION: env.GOOGLE_PLACE_ID_TOKYO_STATION,
      KEISEI_UENO_STATION: env.GOOGLE_PLACE_ID_KEISEI_UENO_STATION,
      NARITA_AIRPORT: env.GOOGLE_PLACE_ID_NARITA_AIRPORT,
    },
  });
  return createFinalizeRailRouteHandler({ repository: getTripRepository(), client })(request, context);
}
