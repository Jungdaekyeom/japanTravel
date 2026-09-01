import { describe, expect, it } from "vitest";

import { InMemoryTripRepository } from "./memory";

describe("InMemoryTripRepository", () => {
  it("atomically replaces every owner session when the owner token is claimed once", async () => {
    const createdAt = new Date("2026-08-31T00:00:00.000Z");
    const participant = (id: string, role: "admin" | "contributor") => ({
      id,
      name: id,
      birthYear: 1993,
      departureCity: "부산" as const,
      role,
      codeSalt: "salt",
      codeHash: "hash",
      createdAt,
    });
    const repository = new InMemoryTripRepository({
      participants: [participant("daekyeom", "admin"), participant("gyuyeol", "contributor")],
      sessions: [
        { id: "old-owner-1", participantId: "daekyeom", tokenHash: "old-owner-hash-1", createdAt, expiresAt: new Date("2026-10-01T00:00:00.000Z") },
        { id: "old-owner-2", participantId: "daekyeom", tokenHash: "old-owner-hash-2", createdAt, expiresAt: new Date("2026-10-01T00:00:00.000Z") },
        { id: "contributor", participantId: "gyuyeol", tokenHash: "contributor-hash", createdAt, expiresAt: new Date("2026-10-01T00:00:00.000Z") },
      ],
      claimTokens: [
        { participantId: "daekyeom", tokenHash: "owner-claim-hash", issuedAt: createdAt, consumedAt: null },
        { participantId: "gyuyeol", tokenHash: "contributor-claim-hash", issuedAt: createdAt, consumedAt: null },
      ],
    } as never);
    const session = {
      id: "new-owner",
      tokenHash: "new-owner-hash",
      createdAt,
      expiresAt: new Date("2026-10-13T14:59:59.000Z"),
    };

    expect(repository.claimOwnerToken).toBeTypeOf("function");
    await expect(repository.claimOwnerToken("owner-claim-hash", session)).resolves.toEqual({ participantId: "daekyeom", role: "admin" });
    await expect(repository.claimOwnerToken("owner-claim-hash", { ...session, id: "replay", tokenHash: "replay-hash" })).resolves.toBeNull();
    await expect(repository.claimOwnerToken("contributor-claim-hash", { ...session, id: "wrong", tokenHash: "wrong-hash" })).resolves.toBeNull();
    await expect(repository.findSessionByTokenHash("old-owner-hash-1")).resolves.toBeNull();
    await expect(repository.findSessionByTokenHash("old-owner-hash-2")).resolves.toBeNull();
    await expect(repository.findSessionByTokenHash("new-owner-hash")).resolves.toMatchObject({ participantId: "daekyeom" });
    await expect(repository.findSessionByTokenHash("contributor-hash")).resolves.toMatchObject({ participantId: "gyuyeol" });
  });

  it("atomically consumes a personal token only once", async () => {
    const repository = new InMemoryTripRepository({
      participants: [{
        id: "gyuyeol",
        name: "이규열",
        birthYear: 1998,
        departureCity: "인천",
        role: "contributor",
        codeSalt: "legacy-salt",
        codeHash: "legacy-hash",
        createdAt: new Date("2026-08-28T00:00:00.000Z"),
      }],
      claimTokens: [{
        participantId: "gyuyeol",
        tokenHash: "claim-hash",
        issuedAt: new Date("2026-08-30T00:00:00.000Z"),
        consumedAt: null,
      }],
    } as never);
    const firstSession = {
      id: "session-1",
      participantId: "gyuyeol",
      tokenHash: "session-hash-1",
      createdAt: new Date("2026-08-30T00:00:00.000Z"),
      expiresAt: new Date("2026-10-13T14:59:59.000Z"),
    };
    const secondSession = { ...firstSession, id: "session-2", tokenHash: "session-hash-2" };

    await expect((repository as never as { claimPersonalToken(hash: string, session: typeof firstSession): Promise<unknown> })
      .claimPersonalToken("claim-hash", firstSession)).resolves.toEqual({ participantId: "gyuyeol", role: "contributor" });
    await expect((repository as never as { claimPersonalToken(hash: string, session: typeof secondSession): Promise<unknown> })
      .claimPersonalToken("claim-hash", secondSession)).resolves.toBeNull();
    await expect(repository.findSessionByTokenHash("session-hash-1")).resolves.toEqual(firstSession);
    await expect(repository.findSessionByTokenHash("session-hash-2")).resolves.toBeNull();
  });

  it("does not consume a personal token when session insertion fails", async () => {
    const createdAt = new Date("2026-08-30T00:00:00.000Z");
    const repository = new InMemoryTripRepository({
      participants: [{
        id: "gyuyeol",
        name: "이규열",
        birthYear: 1998,
        departureCity: "인천",
        role: "contributor",
        codeSalt: "legacy-salt",
        codeHash: "legacy-hash",
        createdAt,
      }],
      sessions: [{
        id: "existing-session",
        participantId: "gyuyeol",
        tokenHash: "duplicate-session-hash",
        createdAt,
        expiresAt: new Date("2026-10-13T14:59:59.000Z"),
      }],
      claimTokens: [{ participantId: "gyuyeol", tokenHash: "claim-hash", issuedAt: createdAt, consumedAt: null }],
    } as never);

    await expect(repository.claimPersonalToken("claim-hash", {
      id: "failed-session",
      tokenHash: "duplicate-session-hash",
      createdAt,
      expiresAt: new Date("2026-10-13T14:59:59.000Z"),
    })).rejects.toThrow("Session token hash already exists");
    await expect(repository.claimPersonalToken("claim-hash", {
      id: "retry-session",
      tokenHash: "new-session-hash",
      createdAt,
      expiresAt: new Date("2026-10-13T14:59:59.000Z"),
    })).resolves.toEqual({ participantId: "gyuyeol", role: "contributor" });
  });

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
          encodedPolyline: "??_ibE_ibE",
          departureTime: "09:00",
          naritaRailChoice: null,
          createdAt: new Date("2026-08-28T00:00:00.000Z"),
          expiresAt: new Date("2026-08-29T00:00:00.000Z"),
        },
        {
          segmentKey: "kyoto-odawara",
          status: "finalized",
          encodedPolyline: "??_ibE_ibE",
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
        encodedPolyline: "??_ibE_ibE",
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
        rejectionCategory: "schedule_impossible",
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
