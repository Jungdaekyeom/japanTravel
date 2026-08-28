import { describe, expect, it } from "vitest";

import { hashSessionToken } from "../../../server/auth/crypto";
import { InMemoryTripRepository } from "../../../server/repository/memory";

import { createDeleteSessionHandler } from "./route";

describe("DELETE /api/session", () => {
  it("removes the stored hash and clears the HttpOnly session cookie", async () => {
    const repository = new InMemoryTripRepository({
      sessions: [
        {
          id: "session-1",
          participantId: "gyuyeol",
          tokenHash: hashSessionToken("logout-token"),
          createdAt: new Date("2026-08-28T00:00:00.000Z"),
          expiresAt: new Date("2026-10-13T14:59:59.000Z"),
        },
      ],
    });

    const response = await createDeleteSessionHandler({ repository })(
      new Request("https://example.test/api/session", { headers: { cookie: "jt_session=logout-token" } }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    await expect(repository.findSessionByTokenHash(hashSessionToken("logout-token"))).resolves.toBeNull();
  });

  it("clears the cookie even when deleting the server session fails", async () => {
    const repository = new InMemoryTripRepository();
    repository.deleteSessionByTokenHash = async () => { throw new Error("database unavailable"); };

    const response = await createDeleteSessionHandler({ repository })(
      new Request("https://example.test/api/session", { headers: { cookie: "jt_session=logout-token" } }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
