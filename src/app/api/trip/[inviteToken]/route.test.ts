import { describe, expect, it } from "vitest";

import { InMemoryTripRepository } from "../../../../server/repository/memory";
import { encodePolyline } from "../../../../server/routes/polyline";

import { createTripHandler } from "./route";

describe("GET /api/trip/[inviteToken]", () => {
  it("uses a non-revealing not-found response for a wrong invite token", async () => {
    const response = await createTripHandler({ repository: new InMemoryTripRepository(), inviteToken: "private-invite-token" })(
      new Request("https://example.test/api/trip/wrong-token"),
      { params: Promise.resolve({ inviteToken: "wrong-token" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
  });

  it("returns the filtered observer payload for a matching token without echoing the token", async () => {
    const now = new Date("2026-09-10T00:00:00.000Z");
    const repository = new InMemoryTripRepository({ routeGeometry: [{
      segmentKey: "odawara-tokyo",
      status: "finalized",
      encodedPolyline: encodePolyline([[35.25626, 139.15582], [35.71377, 139.77725]]),
      departureTime: "2026-10-04T00:00:00.000Z",
      naritaRailChoice: null,
      createdAt: new Date("2026-09-07T00:00:00.000Z"),
      expiresAt: new Date("2026-10-06T15:00:00.000Z"),
    }] });
    const response = await createTripHandler({ repository, inviteToken: "private-invite-token", now: () => now })(
      new Request("https://example.test/api/trip/private-invite-token"),
      { params: Promise.resolve({ inviteToken: "private-invite-token" }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ role: "observer", trip: { startDate: "2026-10-02" }, publicRejections: [] });
    expect(payload.railRoutes).toEqual([expect.objectContaining({ segmentKey: "odawara-tokyo", status: "finalized", label: "철도 이동" })]);
    expect(JSON.stringify(payload)).not.toContain("private-invite-token");
  });

  it("accepts the demo alias only when local development explicitly enables it", async () => {
    const disabledResponse = await createTripHandler({
      repository: new InMemoryTripRepository(),
      inviteToken: "private-invite-token",
    })(
      new Request("https://example.test/api/trip/demo"),
      { params: Promise.resolve({ inviteToken: "demo" }) },
    );
    const response = await createTripHandler({
      repository: new InMemoryTripRepository(),
      inviteToken: "private-invite-token",
      allowDemoInvite: true,
    })(
      new Request("http://localhost:3000/api/trip/demo"),
      { params: Promise.resolve({ inviteToken: "demo" }) },
    );

    expect(disabledResponse.status).toBe(404);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ role: "observer" });
  });
});
