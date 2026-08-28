import { describe, expect, it } from "vitest";

import { hashParticipantCode, hashSessionToken } from "../../../../server/auth/crypto";
import { InMemoryTripRepository } from "../../../../server/repository/memory";

import { createUnlockHandler } from "./route";

const now = new Date("2026-08-28T00:00:00.000Z");

async function repositoryWithCode() {
  const codeSalt = "test-salt";
  return new InMemoryTripRepository({
    participants: [
      {
        id: "gyuyeol",
        name: "이규열",
        birthYear: 1998,
        departureCity: "인천",
        role: "contributor",
        codeSalt,
        codeHash: await hashParticipantCode("123456", codeSalt, "test-pepper"),
        createdAt: now,
      },
    ],
  });
}

function unlockRequest(code: string) {
  return new Request("https://example.test/api/session/unlock", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.1" },
    body: JSON.stringify({ code }),
  });
}

describe("POST /api/session/unlock", () => {
  it("returns the same response for an unknown code and an incorrect known code", async () => {
    const repository = await repositoryWithCode();
    const handler = createUnlockHandler({ repository, pepper: "test-pepper", now: () => now });

    const [unknown, incorrect] = await Promise.all([handler(unlockRequest("654321")), handler(unlockRequest("123457"))]);

    expect(unknown.status).toBe(401);
    expect(incorrect.status).toBe(401);
    await expect(unknown.json()).resolves.toEqual({ error: "invalid_code" });
    await expect(incorrect.json()).resolves.toEqual({ error: "invalid_code" });
  });

  it("sets the fixed-expiry HttpOnly Lax session cookie and stores only its hash", async () => {
    const repository = await repositoryWithCode();
    const handler = createUnlockHandler({ repository, pepper: "test-pepper", now: () => now });

    const response = await handler(unlockRequest("123456"));
    const cookie = response.headers.get("set-cookie");
    const token = cookie?.match(/jt_session=([^;]+)/)?.[1];

    expect(response.status).toBe(200);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toContain("Expires=Tue, 13 Oct 2026 14:59:59 GMT");
    expect(token).toBeTruthy();
    await expect(repository.findSessionByTokenHash(hashSessionToken(token!))).resolves.toMatchObject({
      participantId: "gyuyeol",
      expiresAt: new Date("2026-10-13T14:59:59.000Z"),
    });
  });

  it("releases its reservation and returns a generic 503 when credential lookup fails", async () => {
    const repository = await repositoryWithCode();
    let releases = 0;
    repository.listParticipantCredentials = async () => { throw new Error("database unavailable"); };
    const release = repository.releaseLoginAttempt.bind(repository);
    repository.releaseLoginAttempt = async (reservationId) => { releases++; await release(reservationId); };
    const handler = createUnlockHandler({ repository, pepper: "test-pepper", now: () => now });

    const response = await handler(unlockRequest("123456"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "service_unavailable" });
    expect(releases).toBe(1);
  });
});
