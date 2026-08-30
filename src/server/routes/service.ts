import { z } from "zod";

import type { Viewer } from "../../trip/types";
import type { RouteGeometryRecord, RouteSegmentKey, TripRepository } from "../repository/types";
import type { GoogleRoutesClient } from "./google-routes";
import { decodePolyline } from "./polyline";

export const ROUTE_SEGMENT_KEYS = ["kix-kyoto", "kyoto-odawara", "odawara-tokyo", "tokyo-narita"] as const;
export const routeSegmentKeySchema = z.enum(ROUTE_SEGMENT_KEYS);
export const finalizeRailRouteInputSchema = z.object({
  departureTime: z.iso.datetime({ offset: true }),
  naritaRailChoice: z.enum(["skyliner"]).optional(),
}).strict();

const FINALIZATION_OPENS_AT = new Date("2026-09-06T15:00:00.000Z");
const CACHE_HARD_EXPIRY = new Date("2026-10-06T15:00:00.000Z");
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ROUTE_TRIP_DATES: Record<RouteSegmentKey, string> = {
  "kix-kyoto": "2026-10-02",
  "kyoto-odawara": "2026-10-03",
  "odawara-tokyo": "2026-10-04",
  "tokyo-narita": "2026-10-06",
};
const tokyoDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type RouteFinalizationErrorCode = "forbidden" | "invalid_request" | "invalid_departure_date" | "not_open" | "expired_window";

export class RouteFinalizationError extends Error {
  constructor(readonly code: RouteFinalizationErrorCode) {
    super(code);
    this.name = "RouteFinalizationError";
  }
}

export function routeGeometryExpiry(createdAt: Date) {
  return new Date(Math.min(createdAt.getTime() + THIRTY_DAYS_MS, CACHE_HARD_EXPIRY.getTime()));
}

function tokyoCalendarDate(value: string) {
  const parts = tokyoDateFormatter.formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function finalizeRailRoute(
  segmentKey: unknown,
  input: unknown,
  now: Date,
  { repository, client, viewer }: { repository: TripRepository; client: GoogleRoutesClient; viewer: Viewer },
): Promise<RouteGeometryRecord> {
  if (viewer.role !== "admin") throw new RouteFinalizationError("forbidden");
  const parsedSegment = routeSegmentKeySchema.safeParse(segmentKey);
  const parsedInput = finalizeRailRouteInputSchema.safeParse(input);
  if (!parsedSegment.success || !parsedInput.success) throw new RouteFinalizationError("invalid_request");
  const isNarita = parsedSegment.data === "tokyo-narita";
  if (isNarita !== (parsedInput.data.naritaRailChoice !== undefined)) throw new RouteFinalizationError("invalid_request");
  if (tokyoCalendarDate(parsedInput.data.departureTime) !== ROUTE_TRIP_DATES[parsedSegment.data]) {
    throw new RouteFinalizationError("invalid_departure_date");
  }
  if (now < FINALIZATION_OPENS_AT) throw new RouteFinalizationError("not_open");

  const expiresAt = routeGeometryExpiry(now);
  if (expiresAt <= now) throw new RouteFinalizationError("expired_window");
  const naritaRailChoice = parsedInput.data.naritaRailChoice ?? null;
  const encodedPolyline = await client.computeRailRoute({
    segmentKey: parsedSegment.data,
    departureTime: parsedInput.data.departureTime,
    naritaRailChoice,
  });
  decodePolyline(encodedPolyline);

  const record: RouteGeometryRecord = {
    segmentKey: parsedSegment.data,
    status: "finalized",
    encodedPolyline,
    departureTime: parsedInput.data.departureTime,
    naritaRailChoice,
    createdAt: new Date(now),
    expiresAt,
  };
  await repository.upsertRouteGeometry(record);
  return record;
}
