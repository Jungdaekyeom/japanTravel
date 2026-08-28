import { describe, expect, it } from "vitest";

import { InMemoryTripRepository } from "../../../../server/repository/memory";

import { createTripHandler } from "./route";

describe("GET /api/trip/[inviteToken]", () => {
  it("uses a non-revealing not-found response for a wrong invite token", async () => {
    const response = await createTripHandler({ repository: new InMemoryTripRepository(), inviteToken: "private-invite-token" })(
      new Request("https://example.test/api/trip/wrong-token"),
      { params: Promise.resolve({ inviteToken: "wrong-token" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
  });

  it("returns the filtered observer payload for a matching token without echoing the token", async () => {
    const response = await createTripHandler({ repository: new InMemoryTripRepository(), inviteToken: "private-invite-token" })(
      new Request("https://example.test/api/trip/private-invite-token"),
      { params: Promise.resolve({ inviteToken: "private-invite-token" }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ role: "observer", trip: { startDate: "2026-10-02" }, publicRejections: [] });
    expect(JSON.stringify(payload)).not.toContain("private-invite-token");
  });
});
