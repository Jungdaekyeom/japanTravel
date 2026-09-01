import { NextResponse } from "next/server";

import type { TripRepository } from "../../../server/repository/types";
import { buildSharedTripPayload } from "../../../server/trip/payload";

export const runtime = "nodejs";

type Dependencies = {
  repository: Pick<TripRepository, "listRouteGeometry">;
  now?: () => Date;
};

export function createTripHandler({ repository, now = () => new Date() }: Dependencies) {
  return async function trip() {
    try {
      const requestTime = now();
      const routes = await repository.listRouteGeometry(requestTime);
      return NextResponse.json(buildSharedTripPayload(routes, requestTime));
    } catch {
      return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
    }
  };
}

export async function GET() {
  const { getTripRepository } = await import("../../../server/repository");
  return createTripHandler({ repository: getTripRepository() })();
}
