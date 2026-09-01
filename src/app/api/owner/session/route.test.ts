import { describe, expect, it } from "vitest";

import { hashSessionToken } from "../../../../server/auth/crypto";
import { InMemoryTripRepository } from "../../../../server/repository/memory";

const bearerToken = "b".repeat(43);

async function handler(repository: InMemoryTripRepository) {
  const route = await import("./route").catch(() => ({ createDeleteOwnerSessionHandler: undefined }));
  expect(route.createDeleteOwnerSessionHandler).toBeTypeOf("function");
  return route.createDeleteOwnerSessionHandler!({ repository });
}

describe("DELETE /api/owner/session", () => {
  it("deletes only an exact bearer token and never clears a cookie", async () => {
    const repository = new InMemoryTripRepository({ sessions: [{
      id: "owner-session",
      participantId: "daekyeom",
      tokenHash: hashSessionToken(bearerToken),
      createdAt: new Date("2026-08-31T00:00:00.000Z"),
      expiresAt: new Date("2026-10-13T14:59:59.000Z"),
    }] });
    const remove = await handler(repository);

    const response = await remove(new Request("https://example.test/api/owner/session", {
      method: "DELETE",
      headers: { authorization: `Bearer ${bearerToken}`, cookie: "jt_session=legacy" },
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toBeNull();
    await expect(repository.findSessionByTokenHash(hashSessionToken(bearerToken))).resolves.toBeNull();
  });

  it.each([undefined, "Bearer short", `bearer ${bearerToken}`, `Bearer  ${bearerToken}`])("is an idempotent 204 for missing or malformed Authorization: %s", async (authorization) => {
    const repository = new InMemoryTripRepository();
    repository.deleteSessionByTokenHash = async () => { throw new Error("must not delete"); };
    const remove = await handler(repository);
    const headers = authorization ? { authorization } : undefined;

    const response = await remove(new Request("https://example.test/api/owner/session", { method: "DELETE", headers }));

    expect(response.status).toBe(204);
  });

  it("returns 503 when deleting the hashed bearer session fails", async () => {
    const repository = new InMemoryTripRepository();
    repository.deleteSessionByTokenHash = async () => { throw new Error("database unavailable"); };
    const remove = await handler(repository);

    const response = await remove(new Request("https://example.test/api/owner/session", {
      method: "DELETE",
      headers: { authorization: `Bearer ${bearerToken}` },
    }));

    expect(response.status).toBe(503);
  });
});
