import { describe, expect, it } from "vitest";

import { InMemoryTripRepository } from "./memory";

describe("InMemoryTripRepository", () => {
  it("stores sessions by token hash and removes them on logout", async () => {
    const repository = new InMemoryTripRepository();
    const session = {
      id: "session-1",
      participantId: "gyuyeol",
      tokenHash: "hash-only",
      createdAt: new Date("2026-08-28T00:00:00.000Z"),
      expiresAt: new Date("2026-10-13T14:59:59.000Z"),
    };

    await repository.createSession(session);
    await expect(repository.findSessionByTokenHash("hash-only")).resolves.toEqual(session);
    await repository.deleteSessionByTokenHash("hash-only");
    await expect(repository.findSessionByTokenHash("hash-only")).resolves.toBeNull();
  });

  it("removes only expired route geometries", async () => {
    const repository = new InMemoryTripRepository({
      routeGeometry: [
        {
          segmentKey: "kix-kyoto",
          status: "finalized",
          geometry: [[34.4, 135.2]],
          departureTime: "09:00",
          naritaRailChoice: null,
          createdAt: new Date("2026-08-28T00:00:00.000Z"),
          expiresAt: new Date("2026-08-29T00:00:00.000Z"),
        },
        {
          segmentKey: "kyoto-odawara",
          status: "finalized",
          geometry: [[35, 135]],
          departureTime: "10:00",
          naritaRailChoice: null,
          createdAt: new Date("2026-08-28T00:00:00.000Z"),
          expiresAt: new Date("2026-08-30T00:00:00.000Z"),
        },
      ],
    });

    await repository.deleteExpiredRouteGeometry(new Date("2026-08-29T00:00:00.000Z"));

    await expect(repository.findRouteGeometry("kix-kyoto")).resolves.toBeNull();
    await expect(repository.findRouteGeometry("kyoto-odawara")).resolves.not.toBeNull();
  });
});
