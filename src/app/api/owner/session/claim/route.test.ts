import { createHash } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { hashSessionToken } from "../../../../../server/auth/crypto";
import { InMemoryTripRepository } from "../../../../../server/repository/memory";
import type { TripRepository } from "../../../../../server/repository/types";
import { createClaimHandler as createLegacyClaimHandler } from "../../../session/claim/handler";

const repositoryMock = vi.hoisted(() => ({ current: undefined as TripRepository | undefined }));
vi.mock("../../../../../server/repository", () => ({
  getTripRepository: () => repositoryMock.current,
}));

const now = new Date("2026-08-31T00:00:00.000Z");
const ownerToken = "o".repeat(43);
const ownerClaimHash = (token: string) => createHash("sha256")
  .update(`japan-travel:owner-claim:v1:${token}`)
  .digest("hex");

function participant(id: string, role: "admin" | "contributor") {
  return {
    id,
    name: id,
    birthYear: 1993,
    departureCity: "부산" as const,
    role,
    codeSalt: "salt",
    codeHash: "hash",
    createdAt: now,
  };
}

function request(token: string) {
  return new Request("https://example.test/api/owner/session/claim", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify({ token }),
  });
}

async function handler(dependencies: unknown) {
  const route = await import("./handler").catch(() => ({ createOwnerClaimHandler: undefined }));
  expect(route.createOwnerClaimHandler).toBeTypeOf("function");
  return route.createOwnerClaimHandler!(dependencies as never);
}

afterEach(() => {
  repositoryMock.current = undefined;
  vi.unstubAllEnvs();
});

describe("POST /api/owner/session/claim", () => {
  it("starts without the dormant invite-token environment variable", async () => {
    repositoryMock.current = new InMemoryTripRepository({
      participants: [participant("daekyeom", "admin")],
      claimTokens: [{ participantId: "daekyeom", tokenHash: ownerClaimHash(ownerToken), issuedAt: now, consumedAt: null }],
    } as never);
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_example");
    vi.stubEnv("SESSION_PEPPER", "test-pepper-1234");
    vi.stubEnv("INVITE_TOKEN", "");
    const { POST } = await import("./handler");

    const response = await POST(request(ownerToken));

    expect(response.status).toBe(200);
  });

  it("returns a bearer credential without setting a cookie and prevents replay", async () => {
    const repository = new InMemoryTripRepository({
      participants: [participant("daekyeom", "admin")],
      claimTokens: [{ participantId: "daekyeom", tokenHash: ownerClaimHash(ownerToken), issuedAt: now, consumedAt: null }],
    } as never);
    const claim = await handler({ repository, pepper: "test-pepper-1234", now: () => now });

    const response = await claim(request(ownerToken));
    const payload = await response.json() as { accessToken: string; expiresAt: string };
    const replay = await claim(request(ownerToken));

    expect(response.status).toBe(200);
    expect(payload.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(payload.expiresAt).toBe("2026-10-13T14:59:59.000Z");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    await expect(repository.findSessionByTokenHash(hashSessionToken(payload.accessToken))).resolves.toMatchObject({ participantId: "daekyeom" });
    expect(replay.status).toBe(401);
    await expect(replay.json()).resolves.toEqual({ error: "invalid_link" });
  });

  it("rejects the same raw owner code through the legacy claim endpoint before claiming it once as owner", async () => {
    const repository = new InMemoryTripRepository({
      participants: [participant("daekyeom", "admin")],
      claimTokens: [{ participantId: "daekyeom", tokenHash: ownerClaimHash(ownerToken), issuedAt: now, consumedAt: null }],
    } as never);
    const legacyClaim = createLegacyClaimHandler({ repository, pepper: "test-pepper-1234", now: () => now });
    const ownerClaim = await handler({ repository, pepper: "test-pepper-1234", now: () => now });

    const legacyResponse = await legacyClaim(request(ownerToken));
    const ownerResponse = await ownerClaim(request(ownerToken));
    const replay = await ownerClaim(request(ownerToken));

    expect(legacyResponse.status).toBe(401);
    await expect(legacyResponse.json()).resolves.toEqual({ error: "invalid_link" });
    expect(ownerResponse.status).toBe(200);
    expect(replay.status).toBe(401);
  });

  it("uses the same invalid_link response for malformed, non-owner, and consumed tokens", async () => {
    const repository = new InMemoryTripRepository({
      participants: [participant("gyuyeol", "contributor"), participant("daekyeom", "admin")],
      claimTokens: [
        { participantId: "gyuyeol", tokenHash: hashSessionToken("c".repeat(43)), issuedAt: now, consumedAt: null },
        { participantId: "daekyeom", tokenHash: ownerClaimHash(ownerToken), issuedAt: now, consumedAt: now },
      ],
    } as never);
    const claim = await handler({ repository, pepper: "test-pepper-1234", now: () => now });

    const responses = await Promise.all([
      claim(request("short")),
      claim(request("c".repeat(43))),
      claim(request(ownerToken)),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([401, 401, 401]);
    for (const response of responses) {
      await expect(response.json()).resolves.toEqual({ error: "invalid_link" });
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("returns 429 when the shared IP limit has no reservation", async () => {
    const repository = new InMemoryTripRepository();
    repository.reserveLoginAttempt = async () => null;
    const claim = await handler({ repository, pepper: "test-pepper-1234", now: () => now });

    const response = await claim(request(ownerToken));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "rate_limited" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 503 without leaking storage errors", async () => {
    const repository = new InMemoryTripRepository();
    repository.claimOwnerToken = async () => { throw new Error("private database detail"); };
    const claim = await handler({ repository, pepper: "test-pepper-1234", now: () => now });

    const response = await claim(request(ownerToken));

    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(payload).toEqual({ error: "service_unavailable" });
    expect(JSON.stringify(payload)).not.toContain("private database detail");
  });
});
