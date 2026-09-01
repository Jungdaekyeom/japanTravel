import { describe, expect, it } from "vitest";

import { InMemoryTripRepository } from "../../../server/repository/memory";

import { createTripHandler } from "./route";

describe("GET /api/trip", () => {
  it("returns the shared trip without a token or role fields", async () => {
    const response = await createTripHandler({
      repository: new InMemoryTripRepository(),
      now: () => new Date("2026-09-10T00:00:00.000Z"),
    })();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.travelers).toHaveLength(4);
    expect(payload.trip.startDate).toBe("2026-10-02");
    expect(JSON.stringify(payload)).not.toMatch(/role|session|opinion|invite/i);
  });

  it("returns 503 when route storage is unavailable", async () => {
    const repository = new InMemoryTripRepository();
    repository.listRouteGeometry = async () => { throw new Error("offline"); };
    const response = await createTripHandler({ repository })();
    expect(response.status).toBe(503);
  });
});
