import type { RouteSegmentKey } from "../repository/types";
import { decodePolyline, encodePolyline, type PolylineCoordinate } from "./polyline";

export const GOOGLE_ROUTES_FIELD_MASK = "fallbackInfo,routes.legs.steps.travelMode,routes.legs.steps.polyline.encodedPolyline,routes.legs.steps.transitDetails.transitLine.vehicle.type";
export const GOOGLE_ROUTES_TIMEOUT_MS = 10_000;

export type GoogleRoutePlaceIds = {
  KIX: string;
  KYOTO_STATION: string;
  ODAWARA_STATION: string;
  TOKYO_STATION: string;
  KEISEI_UENO_STATION: string;
  NARITA_AIRPORT: string;
};

export type ComputeRailRouteInput = {
  segmentKey: RouteSegmentKey;
  departureTime: string;
  naritaRailChoice: "skyliner" | "nex" | null;
};

export type GoogleRoutesClient = {
  computeRailRoute(input: ComputeRailRouteInput): Promise<string>;
};

type GoogleFetch = (input: string, init: RequestInit) => Promise<Response>;

const railVehicleTypes = new Set([
  "COMMUTER_TRAIN",
  "HEAVY_RAIL",
  "HIGH_SPEED_TRAIN",
  "LONG_DISTANCE_TRAIN",
  "METRO_RAIL",
  "MONORAIL",
  "RAIL",
  "SUBWAY",
  "TRAM",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function nested(value: unknown, ...keys: string[]) {
  let current: unknown = value;
  for (const key of keys) {
    const currentRecord = record(current);
    if (!currentRecord) return undefined;
    current = currentRecord[key];
  }
  return current;
}

function railSteps(route: unknown) {
  const legs = nested(route, "legs");
  if (!Array.isArray(legs)) return [];
  return legs.flatMap((leg) => {
    const steps = nested(leg, "steps");
    return Array.isArray(steps) ? steps : [];
  }).filter((step) => {
    const type = nested(step, "transitDetails", "transitLine", "vehicle", "type");
    return nested(step, "travelMode") === "TRANSIT" && typeof type === "string" && railVehicleTypes.has(type);
  });
}

function selectedPolyline(payload: unknown) {
  const root = record(payload);
  if (!root || "fallbackInfo" in root || !Array.isArray(root.routes)) throw new Error("Google route unavailable");

  for (const route of root.routes) {
    const steps = railSteps(route);
    if (steps.length === 0) continue;
    const combined: PolylineCoordinate[] = [];
    for (const step of steps) {
      const encoded = nested(step, "polyline", "encodedPolyline");
      if (typeof encoded !== "string") throw new Error("Google route unavailable");
      const path = decodePolyline(encoded);
      if (combined.length > 0 && path.length > 0) {
        const previous = combined.at(-1);
        if (previous?.[0] === path[0][0] && previous[1] === path[0][1]) path.shift();
      }
      combined.push(...path);
    }
    return encodePolyline(combined);
  }

  throw new Error("Google route unavailable");
}

function endpoints(input: ComputeRailRouteInput, placeIds: GoogleRoutePlaceIds) {
  switch (input.segmentKey) {
    case "kix-kyoto": return [placeIds.KIX, placeIds.KYOTO_STATION] as const;
    case "kyoto-odawara": return [placeIds.KYOTO_STATION, placeIds.ODAWARA_STATION] as const;
    case "odawara-tokyo": return [placeIds.ODAWARA_STATION, placeIds.TOKYO_STATION] as const;
    case "tokyo-narita": return [input.naritaRailChoice === "skyliner" ? placeIds.KEISEI_UENO_STATION : placeIds.TOKYO_STATION, placeIds.NARITA_AIRPORT] as const;
  }
}

export function createGoogleRoutesClient({
  apiKey,
  placeIds,
  fetch: request = fetch,
}: {
  apiKey: string;
  placeIds: GoogleRoutePlaceIds;
  fetch?: GoogleFetch;
}): GoogleRoutesClient {
  return {
    async computeRailRoute(input) {
      const [origin, destination] = endpoints(input, placeIds);
      try {
        const response = await request("https://routes.googleapis.com/directions/v2:computeRoutes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": GOOGLE_ROUTES_FIELD_MASK,
          },
          body: JSON.stringify({
            origin: { placeId: origin },
            destination: { placeId: destination },
            travelMode: "TRANSIT",
            departureTime: input.departureTime,
            computeAlternativeRoutes: true,
            languageCode: "ko",
            regionCode: "JP",
            transitPreferences: { allowedTravelModes: ["TRAIN"] },
          }),
          signal: AbortSignal.timeout(GOOGLE_ROUTES_TIMEOUT_MS),
        });
        if (!response.ok) throw new Error("Google route unavailable");
        return selectedPolyline(await response.json());
      } catch {
        throw new Error("Google route unavailable");
      }
    },
  };
}
