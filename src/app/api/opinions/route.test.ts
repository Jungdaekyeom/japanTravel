import { describe, expect, it } from "vitest";

import { hashSessionToken } from "../../../server/auth/crypto";
import { InMemoryTripRepository } from "../../../server/repository/memory";

import { createSubmitOpinionHandler } from "./route";

const now = new Date("2026-08-28T00:00:00.000Z");

function repository() {
  return new InMemoryTripRepository({
    participants: [
      { id: "daekyeom", name: "정대겸", birthYear: 1993, departureCity: "부산", role: "admin", codeSalt: "salt", codeHash: "hash", createdAt: now },
      { id: "gyuyeol", name: "이규열", birthYear: 1998, departureCity: "인천", role: "contributor", codeSalt: "salt", codeHash: "hash", createdAt: now },
    ],
    sessions: [{ id: "contributor-session", participantId: "gyuyeol", tokenHash: hashSessionToken("contributor-token"), createdAt: now, expiresAt: new Date("2026-10-13T14:59:59.000Z") }],
  });
}

function submitRequest(body: unknown, token?: string) {
  return new Request("https://example.test/api/opinions", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { cookie: `jt_session=${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

describe("POST /api/opinions", () => {
  it("rejects observers and malformed requests without creating an opinion", async () => {
    const store = repository();
    const handler = createSubmitOpinionHandler({ repository: store });

    const observer = await handler(submitRequest({ targetDay: 1, body: "제안" }));
    const invalid = await handler(submitRequest({ targetDay: 6, body: "제안" }, "contributor-token"));

    expect(observer.status).toBe(403);
    await expect(observer.json()).resolves.toEqual({ error: "forbidden" });
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({ error: "invalid_request" });
    await expect(store.listOpinions()).resolves.toEqual([]);
  });

  it("creates a trimmed pending opinion for an authenticated contributor", async () => {
    const handler = createSubmitOpinionHandler({ repository: repository() });

    const response = await handler(submitRequest({ targetDay: null, body: "  전체 일정 제안  " }, "contributor-token"));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      opinion: { participantId: "gyuyeol", targetDay: null, body: "전체 일정 제안", status: "pending" },
    });
  });
});
