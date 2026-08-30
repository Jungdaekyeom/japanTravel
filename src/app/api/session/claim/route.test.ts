import { describe, expect, it } from "vitest";

import { hashSessionToken } from "../../../../server/auth/crypto";
import { InMemoryTripRepository } from "../../../../server/repository/memory";

import { createClaimHandler } from "./route";

const now = new Date("2026-08-30T00:00:00.000Z");
const claimToken = "a".repeat(43);

function participant(id: string, role: "contributor" | "admin") {
  return {
    id,
    name: id === "daekyeom" ? "정대겸" : "이규열",
    birthYear: role === "admin" ? 1993 : 1998,
    departureCity: role === "admin" ? "부산" as const : "인천" as const,
    role,
    codeSalt: "legacy-salt",
    codeHash: "legacy-hash",
    createdAt: now,
  };
}

function claimRequest(token: string, cookie?: string) {
  return new Request("https://example.test/api/session/claim", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.1",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ token }),
  });
}

describe("POST /api/session/claim", () => {
  it("sets the fixed-expiry session cookie and prevents a second claim", async () => {
    const repository = new InMemoryTripRepository({
      participants: [participant("gyuyeol", "contributor")],
      claimTokens: [{ participantId: "gyuyeol", tokenHash: hashSessionToken(claimToken), issuedAt: now, consumedAt: null }],
    } as never);
    const handler = createClaimHandler({ repository, pepper: "test-pepper-1234", now: () => now });

    const first = await handler(claimRequest(claimToken));
    const cookie = first.headers.get("set-cookie");
    const sessionToken = cookie?.match(/jt_session=([^;]+)/)?.[1];
    const replay = await handler(claimRequest(claimToken));

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ role: "contributor" });
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toContain("Expires=Tue, 13 Oct 2026 14:59:59 GMT");
    expect(sessionToken).toBeTruthy();
    await expect(repository.findSessionByTokenHash(hashSessionToken(sessionToken!))).resolves.toMatchObject({ participantId: "gyuyeol" });
    expect(replay.status).toBe(401);
    await expect(replay.json()).resolves.toEqual({ error: "invalid_link" });
  });

  it("keeps an existing session without consuming the fragment token", async () => {
    const existingSessionToken = "existing-session-token";
    const repository = new InMemoryTripRepository({
      participants: [participant("gyuyeol", "contributor"), participant("daekyeom", "admin")],
      sessions: [{
        id: "existing-session",
        participantId: "gyuyeol",
        tokenHash: hashSessionToken(existingSessionToken),
        createdAt: now,
        expiresAt: new Date("2026-10-13T14:59:59.000Z"),
      }],
      claimTokens: [{ participantId: "daekyeom", tokenHash: hashSessionToken(claimToken), issuedAt: now, consumedAt: null }],
    } as never);
    const handler = createClaimHandler({ repository, pepper: "test-pepper-1234", now: () => now });

    const reopened = await handler(claimRequest(claimToken, `jt_session=${existingSessionToken}`));
    const laterClaim = await handler(claimRequest(claimToken));

    expect(reopened.status).toBe(200);
    await expect(reopened.json()).resolves.toEqual({ role: "contributor" });
    expect(reopened.headers.get("set-cookie")).toBeNull();
    expect(laterClaim.status).toBe(200);
    await expect(laterClaim.json()).resolves.toEqual({ role: "admin" });
  });

  it("returns the same generic response for malformed, unknown, and consumed links", async () => {
    const repository = new InMemoryTripRepository({
      participants: [participant("gyuyeol", "contributor")],
      claimTokens: [{ participantId: "gyuyeol", tokenHash: hashSessionToken(claimToken), issuedAt: now, consumedAt: now }],
    } as never);
    const handler = createClaimHandler({ repository, pepper: "test-pepper-1234", now: () => now });

    const responses = await Promise.all([
      handler(claimRequest("short")),
      handler(claimRequest("b".repeat(43))),
      handler(claimRequest(claimToken)),
    ]);

    expect(responses.map((response) => response.status)).toEqual([401, 401, 401]);
    await Promise.all(responses.map(async (response) => expect(await response.json()).toEqual({ error: "invalid_link" })));
  });
});
