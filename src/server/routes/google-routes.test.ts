import { describe, expect, it, vi } from "vitest";

import {
  GOOGLE_ROUTES_FIELD_MASK,
  GOOGLE_ROUTES_TIMEOUT_MS,
  createGoogleRoutesClient,
  type GoogleRoutePlaceIds,
} from "./google-routes";

const placeIds: GoogleRoutePlaceIds = {
  KIX: "place-kix",
  KYOTO_STATION: "place-kyoto",
  ODAWARA_STATION: "place-odawara",
  TOKYO_STATION: "place-tokyo",
  KEISEI_UENO_STATION: "place-keisei-ueno",
  NARITA_AIRPORT: "place-narita",
};

function step(
  type: string,
  encodedPolyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
  name = "Haruka",
  nameShort?: string,
) {
  return {
    travelMode: "TRANSIT",
    polyline: { encodedPolyline },
    transitDetails: { transitLine: { name, ...(nameShort ? { nameShort } : {}), vehicle: { type } } },
  };
}

function response(routes: unknown[], extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ routes, ...extra }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("Google Routes rail client", () => {
  it("sends the exact transit request with server headers and a minimal field mask", async () => {
    const fetch = vi.fn(async (_input: string, _init: RequestInit) => response([{ legs: [{ steps: [step("HEAVY_RAIL")] }] }]));
    const client = createGoogleRoutesClient({ apiKey: "server-route-key", placeIds, fetch });

    await expect(client.computeRailRoute({
      segmentKey: "kix-kyoto",
      departureTime: "2026-10-02T01:00:00.000Z",
      naritaRailChoice: null,
    })).resolves.toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://routes.googleapis.com/directions/v2:computeRoutes");
    expect(init).toEqual({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": "server-route-key",
        "X-Goog-FieldMask": GOOGLE_ROUTES_FIELD_MASK,
      },
      body: JSON.stringify({
        origin: { placeId: "place-kix" },
        destination: { placeId: "place-kyoto" },
        travelMode: "TRANSIT",
        departureTime: "2026-10-02T01:00:00.000Z",
        computeAlternativeRoutes: true,
        languageCode: "ko",
        regionCode: "JP",
        transitPreferences: { allowedTravelModes: ["TRAIN"] },
      }),
      signal: expect.any(AbortSignal),
    });
    expect(GOOGLE_ROUTES_FIELD_MASK).toBe("fallbackInfo,routes.legs.steps.travelMode,routes.legs.steps.polyline.encodedPolyline,routes.legs.steps.transitDetails.transitLine.name,routes.legs.steps.transitDetails.transitLine.nameShort,routes.legs.steps.transitDetails.transitLine.vehicle.type");
    expect(GOOGLE_ROUTES_FIELD_MASK).not.toContain("*");
  });

  it("uses the native abort timeout for the Google fetch boundary", async () => {
    const signal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
    const fetch = vi.fn(async (_input: string, _init: RequestInit) => response([{ legs: [{ steps: [step("RAIL")] }] }]));
    const client = createGoogleRoutesClient({ apiKey: "key", placeIds, fetch });

    try {
      await client.computeRailRoute({
        segmentKey: "kix-kyoto",
        departureTime: "2026-10-02T01:00:00.000Z",
        naritaRailChoice: null,
      });

      expect(GOOGLE_ROUTES_TIMEOUT_MS).toBe(10_000);
      expect(timeout).toHaveBeenCalledWith(10_000);
      expect(fetch.mock.calls[0][1]?.signal).toBe(signal);
    } finally {
      timeout.mockRestore();
    }
  });

  it.each([
    ["skyliner", "place-keisei-ueno"],
    ["nex", "place-tokyo"],
  ] as const)("uses the required %s origin for the Narita segment", async (naritaRailChoice, origin) => {
    const fetch = vi.fn(async (_input: string, _init: RequestInit) => response([{ legs: [{ steps: [step("COMMUTER_TRAIN", undefined, "Keisei Skyliner")] }] }]));
    const client = createGoogleRoutesClient({ apiKey: "key", placeIds, fetch });

    await client.computeRailRoute({
      segmentKey: "tokyo-narita",
      departureTime: "2026-10-06T00:00:00.000Z",
      naritaRailChoice,
    });

    const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(body.origin).toEqual({ placeId: origin });
    expect(body.destination).toEqual({ placeId: "place-narita" });
  });

  it.each([
    ["kix-kyoto", null, "Kansai Airport Line", "JR Airport Express", "HARUKA"],
    ["kyoto-odawara", null, "Sanyo Shinkansen", "Tōkaidō Shinkansen", undefined],
    ["odawara-tokyo", null, "Tokaido Shinkansen", "JR 도카이도 본선", undefined],
    ["tokyo-narita", "skyliner", "Keisei Main Line", "京成スカイライナー", undefined],
  ] as const)("selects only the planned %s rail service", async (segmentKey, naritaRailChoice, wrongName, plannedName, plannedNameShort) => {
    const wrong = step("HEAVY_RAIL", "??_t`B_t`B", wrongName);
    const planned = step("COMMUTER_TRAIN", "??_ibE_ibE", plannedName, plannedNameShort);
    const fetch = vi.fn(async () => response([
      { legs: [{ steps: [wrong] }] },
      { legs: [{ steps: [planned] }] },
    ]));
    const client = createGoogleRoutesClient({ apiKey: "key", placeIds, fetch });

    await expect(client.computeRailRoute({
      segmentKey,
      departureTime: "2026-10-03T00:00:00.000Z",
      naritaRailChoice,
    })).resolves.toBe("??_ibE_ibE");
  });

  it.each([
    ["kix-kyoto", null, "Kansai Airport Line"],
    ["kyoto-odawara", null, "Sanyo Shinkansen"],
    ["odawara-tokyo", null, "Tokaido Shinkansen"],
    ["tokyo-narita", "skyliner", "Keisei Main Line"],
  ] as const)("rejects %s when the planned rail service is absent", async (segmentKey, naritaRailChoice, wrongName) => {
    const fetch = vi.fn(async () => response([{ legs: [{ steps: [step("HEAVY_RAIL", "??_ibE_ibE", wrongName)] }] }]));
    const client = createGoogleRoutesClient({ apiKey: "key", placeIds, fetch });

    await expect(client.computeRailRoute({
      segmentKey,
      departureTime: "2026-10-03T00:00:00.000Z",
      naritaRailChoice,
    })).rejects.toThrow("Google route unavailable");
  });

  it("combines every rail step from the selected route into one valid encoded polyline", async () => {
    const fetch = vi.fn(async () => response([{ legs: [{ steps: [
      step("HEAVY_RAIL", "??_t`B_t`B", "Tokaido Main Line"),
      { travelMode: "WALK", polyline: { encodedPolyline: "ignored" } },
      step("LONG_DISTANCE_TRAIN", "_t`B_t`B_t`B_t`B", "Tokaido Line"),
    ] }] }]));
    const client = createGoogleRoutesClient({ apiKey: "key", placeIds, fetch });

    await expect(client.computeRailRoute({
      segmentKey: "odawara-tokyo",
      departureTime: "2026-10-04T00:00:00.000Z",
      naritaRailChoice: null,
    })).resolves.toBe("??_t`B_t`B_t`B_t`B");
  });

  it.each([
    ["fallback metadata", [{ legs: [{ steps: [step("RAIL")] }] }], { fallbackInfo: { reason: "SERVER_ERROR" } }],
    ["empty routes", [], {}],
    ["malformed rail polyline", [{ legs: [{ steps: [step("RAIL", "_")] }] }], {}],
    ["one-point rail polyline", [{ legs: [{ steps: [step("RAIL", "??")] }] }], {}],
    ["duplicate-only rail polyline", [{ legs: [{ steps: [step("RAIL", "????")] }] }], {}],
    ["oversized rail polyline", [{ legs: [{ steps: [step("RAIL", "A?".repeat(50_001))] }] }], {}],
    ["excessive rail points", [{ legs: [{ steps: [step("RAIL", "A?".repeat(10_001))] }] }], {}],
    ["no rail step", [{ legs: [{ steps: [step("BUS", "??")] }] }], {}],
  ])("rejects %s", async (_case, routes, extra) => {
    const fetch = vi.fn(async () => response(routes as unknown[], extra as Record<string, unknown>));
    const client = createGoogleRoutesClient({ apiKey: "key", placeIds, fetch });

    await expect(client.computeRailRoute({
      segmentKey: "kix-kyoto",
      departureTime: "2026-10-02T00:00:00.000Z",
      naritaRailChoice: null,
    })).rejects.toThrow("Google route unavailable");
  });

  it("rejects a non-success response without exposing its body", async () => {
    const fetch = vi.fn(async () => new Response("private upstream detail", { status: 500 }));
    const client = createGoogleRoutesClient({ apiKey: "key", placeIds, fetch });

    await expect(client.computeRailRoute({
      segmentKey: "kix-kyoto",
      departureTime: "2026-10-02T00:00:00.000Z",
      naritaRailChoice: null,
    })).rejects.toThrow("Google route unavailable");
  });
});
