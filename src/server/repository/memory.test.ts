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

    await expect(repository.findRouteGeometry("kix-kyoto", new Date("2026-08-29T00:00:00.000Z"))).resolves.toBeNull();
    await expect(repository.findRouteGeometry("kyoto-odawara", new Date("2026-08-29T00:00:00.000Z"))).resolves.not.toBeNull();
  });

  it("does not expose expired route geometry before cleanup runs", async () => {
    const repository = new InMemoryTripRepository({
      routeGeometry: [{
        segmentKey: "kix-kyoto",
        status: "finalized",
        geometry: [[34.4, 135.2]],
        departureTime: "09:00",
        naritaRailChoice: null,
        createdAt: new Date("2026-08-28T00:00:00.000Z"),
        expiresAt: new Date("2026-08-29T00:00:00.000Z"),
      }],
    });

    await expect(repository.findRouteGeometry("kix-kyoto", new Date("2026-08-29T00:00:00.000Z"))).resolves.toBeNull();
    await expect(repository.listRouteGeometry(new Date("2026-08-29T00:00:00.000Z"))).resolves.toEqual([]);
  });

  it("returns copies and rejects invalid opinion review states", async () => {
    const repository = new InMemoryTripRepository();
    const opinion = await repository.createOpinion({ participantId: "gyuyeol", targetDay: 1, body: "점심 장소 제안" });
    opinion.body = "mutated";

    await expect(repository.listOpinions()).resolves.toMatchObject([{ body: "점심 장소 제안" }]);
    await expect(repository.updateOpinion(opinion.id, { status: "approved" })).rejects.toThrow("Invalid opinion");
  });

  it("atomically blocks a new opinion until the participant accepts a rejection", async () => {
    const repository = new InMemoryTripRepository({
      opinions: [{
        id: "rejected-1",
        participantId: "gyuyeol",
        targetDay: 1,
        body: "기존 제안",
        status: "rejected",
        reviewedBy: "daekyeom",
        reviewedAt: new Date("2026-08-28T00:00:00.000Z"),
        rejectionCategory: "schedule",
        publicSummary: "일정상 어려움",
        rejectionReason: "이동 시간이 부족합니다.",
        rejectionAcceptedAt: null,
        createdAt: new Date("2026-08-28T00:00:00.000Z"),
        updatedAt: new Date("2026-08-28T00:00:00.000Z"),
      }],
    });

    await expect(repository.createOpinionIfNoUnacceptedRejection({ participantId: "gyuyeol", targetDay: 2, body: "새 제안" })).resolves.toBeNull();
    await expect(repository.transitionOpinion("rejected-1", "rejected", { rejectionAcceptedAt: new Date("2026-08-29T00:00:00.000Z") })).resolves.not.toBeNull();
    await expect(repository.createOpinionIfNoUnacceptedRejection({ participantId: "gyuyeol", targetDay: 2, body: "새 제안" })).resolves.toMatchObject({ status: "pending" });
  });
});
