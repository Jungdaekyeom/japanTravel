import { describe, expect, it } from "vitest";

import { hashSessionToken } from "../../../../server/auth/crypto";
import { InMemoryTripRepository } from "../../../../server/repository/memory";
import type { OpinionRecord } from "../../../../server/repository/types";

const now = new Date("2026-09-07T00:00:00.000Z");
const ownerToken = "d".repeat(43);
const contributorToken = "c".repeat(43);

function participant(id: string, role: "admin" | "contributor") {
  return {
    id,
    name: id === "daekyeom" ? "정대겸" : "이규열",
    birthYear: role === "admin" ? 1993 : 1998,
    departureCity: role === "admin" ? "부산" as const : "인천" as const,
    role,
    codeSalt: "salt",
    codeHash: "hash",
    createdAt: now,
  };
}

function session(id: string, participantId: string, token: string, expiresAt = new Date("2026-10-13T14:59:59.000Z")) {
  return { id, participantId, tokenHash: hashSessionToken(token), createdAt: now, expiresAt };
}

function opinion(id: string, createdAt: string, status: OpinionRecord["status"] = "pending"): OpinionRecord {
  const reviewed = status === "pending" ? null : now;
  return {
    id,
    participantId: "gyuyeol",
    targetDay: 2,
    body: `${id} 제안`,
    status,
    reviewedBy: reviewed ? "daekyeom" : null,
    reviewedAt: reviewed,
    rejectionCategory: null,
    publicSummary: null,
    rejectionReason: null,
    rejectionAcceptedAt: null,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  };
}

function request(authorization?: string, cookie?: string) {
  return new Request("https://example.test/api/owner/dashboard", {
    headers: {
      ...(authorization ? { authorization } : {}),
      ...(cookie ? { cookie } : {}),
    },
  });
}

async function handler(repository: InMemoryTripRepository) {
  const route = await import("./handler").catch(() => ({ createOwnerDashboardHandler: undefined }));
  expect(route.createOwnerDashboardHandler).toBeTypeOf("function");
  return route.createOwnerDashboardHandler!({ repository, now: () => now });
}

describe("GET /api/owner/dashboard", () => {
  it("returns pending opinions newest-first with stable ties and four fixed rail segments", async () => {
    const repository = new InMemoryTripRepository({
      participants: [participant("daekyeom", "admin"), participant("gyuyeol", "contributor")],
      sessions: [session("owner-session", "daekyeom", ownerToken)],
      opinions: [
        opinion("same-second", "2026-08-30T00:00:00.000Z"),
        opinion("approved", "2026-08-31T00:00:00.000Z", "approved"),
        opinion("newest", "2026-08-31T01:00:00.000Z"),
        opinion("same-first", "2026-08-30T00:00:00.000Z"),
      ],
      routeGeometry: [{
        segmentKey: "kix-kyoto",
        status: "finalized",
        encodedPolyline: "??_ibE_ibE",
        departureTime: "2026-10-02T09:30:00+09:00",
        naritaRailChoice: null,
        createdAt: now,
        expiresAt: new Date("2026-10-06T15:00:00.000Z"),
      }],
    });
    const dashboard = await handler(repository);

    const response = await dashboard(request(`Bearer ${ownerToken}`));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.finalizationOpensAt).toBe("2026-09-06T15:00:00.000Z");
    expect(payload.finalizationClosesAt).toBe("2026-10-06T15:00:00.000Z");
    expect(payload.pendingOpinions.map((item: { id: string }) => item.id)).toEqual(["newest", "same-first", "same-second"]);
    expect(payload.pendingOpinions[0]).toMatchObject({
      participantId: "gyuyeol",
      authorName: "이규열",
      targetDay: 2,
      body: "newest 제안",
      status: "pending",
      createdAt: "2026-08-31T01:00:00.000Z",
    });
    expect(payload.railSegments).toEqual([
      {
        key: "kix-kyoto",
        title: "KIX → 교토",
        tripDate: "2026-10-02",
        finalized: true,
        departureTime: "2026-10-02T09:30:00+09:00",
        expiresAt: "2026-10-06T15:00:00.000Z",
        naritaRailChoice: null,
        canFinalize: true,
      },
      { key: "kyoto-odawara", title: "교토 → 오다와라", tripDate: "2026-10-03", finalized: false, departureTime: null, expiresAt: null, naritaRailChoice: null, canFinalize: true },
      { key: "odawara-tokyo", title: "오다와라 → 도쿄", tripDate: "2026-10-04", finalized: false, departureTime: null, expiresAt: null, naritaRailChoice: null, canFinalize: true },
      { key: "tokyo-narita", title: "우에노 → 나리타", tripDate: "2026-10-06", finalized: false, departureTime: null, expiresAt: null, naritaRailChoice: null, canFinalize: true },
    ]);
  });

  it.each([
    ["missing bearer", undefined, `jt_session=${ownerToken}`],
    ["malformed bearer", "Bearer short", `jt_session=${ownerToken}`],
    ["expired bearer", `Bearer ${ownerToken}`, undefined],
  ])("returns 401 for %s", async (_case, authorization, cookie) => {
    const expiresAt = _case === "expired bearer" ? new Date("2026-09-06T00:00:00.000Z") : new Date("2026-10-13T14:59:59.000Z");
    const repository = new InMemoryTripRepository({
      participants: [participant("daekyeom", "admin")],
      sessions: [session("owner-session", "daekyeom", ownerToken, expiresAt)],
    });
    const dashboard = await handler(repository);

    const response = await dashboard(request(authorization, cookie));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 403 for an authenticated non-owner", async () => {
    const repository = new InMemoryTripRepository({
      participants: [participant("gyuyeol", "contributor")],
      sessions: [session("contributor-session", "gyuyeol", contributorToken)],
    });
    const dashboard = await handler(repository);

    const response = await dashboard(request(`Bearer ${contributorToken}`));

    expect(response.status).toBe(403);
  });

  it("returns 503 when repository authentication or dashboard reads fail", async () => {
    const authenticationFailure = new InMemoryTripRepository();
    authenticationFailure.findSessionByTokenHash = async () => { throw new Error("database unavailable"); };
    const readFailure = new InMemoryTripRepository({
      participants: [participant("daekyeom", "admin")],
      sessions: [session("owner-session", "daekyeom", ownerToken)],
    });
    readFailure.listOpinions = async () => { throw new Error("database unavailable"); };

    const responses = await Promise.all([
      (await handler(authenticationFailure))(request(`Bearer ${ownerToken}`)),
      (await handler(readFailure))(request(`Bearer ${ownerToken}`)),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([503, 503]);
  });
});
