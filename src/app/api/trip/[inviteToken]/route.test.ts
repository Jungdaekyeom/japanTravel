import { describe, expect, it } from "vitest";

import { InMemoryTripRepository } from "../../../../server/repository/memory";

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
      encodedPolyline: "??_ibE_ibE",
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
});
