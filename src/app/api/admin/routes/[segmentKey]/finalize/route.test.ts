import { describe, expect, it, vi } from "vitest";

import { hashSessionToken } from "../../../../../../server/auth/crypto";
import { InMemoryTripRepository } from "../../../../../../server/repository/memory";
import type { GoogleRoutesClient } from "../../../../../../server/routes/google-routes";

import { createFinalizeRailRouteHandler } from "./route";

const now = new Date("2026-09-06T15:00:00.000Z");
const departureTime = "2026-10-02T01:00:00.000Z";

function setup() {
  const repository = new InMemoryTripRepository({
    participants: [
      { id: "daekyeom", name: "정대겸", birthYear: 1993, departureCity: "부산", role: "admin", codeSalt: "salt", codeHash: "hash", createdAt: now },
      { id: "gyuyeol", name: "이규열", birthYear: 1998, departureCity: "인천", role: "contributor", codeSalt: "salt", codeHash: "hash", createdAt: now },
    ],
    sessions: [
      { id: "admin", participantId: "daekyeom", tokenHash: hashSessionToken("admin-token"), createdAt: now, expiresAt: new Date("2026-10-13T14:59:59.000Z") },
      { id: "contributor", participantId: "gyuyeol", tokenHash: hashSessionToken("contributor-token"), createdAt: now, expiresAt: new Date("2026-10-13T14:59:59.000Z") },
    ],
  });
  const client: GoogleRoutesClient = {
    computeRailRoute: vi.fn(async () => "_p~iF~ps|U_ulLnnqC_mqNvxq`@"),
  };
  return { repository, client };
}

function request(token: string, body: unknown) {
  return new Request("https://example.test/api/admin/routes/kix-kyoto/finalize", {
    method: "POST",
    headers: { cookie: `jt_session=${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/routes/[segmentKey]/finalize", () => {
  it("forbids a non-admin without calling Google", async () => {
    const { repository, client } = setup();
    const response = await createFinalizeRailRouteHandler({ repository, client, now: () => now })(
      request("contributor-token", { departureTime }),
      { params: Promise.resolve({ segmentKey: "kix-kyoto" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "forbidden" });
    expect(client.computeRailRoute).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown segment", "odawara-hakone", { departureTime }],
    ["non-RFC3339 time", "kix-kyoto", { departureTime: "2026-10-02 10:00" }],
    ["missing Narita choice", "tokyo-narita", { departureTime }],
    ["unexpected Narita choice", "kix-kyoto", { departureTime, naritaRailChoice: "nex" }],
    ["unknown field", "kix-kyoto", { departureTime, rawResponse: true }],
  ])("returns 400 for %s", async (_case, segmentKey, body) => {
    const { repository, client } = setup();
    const response = await createFinalizeRailRouteHandler({ repository, client, now: () => now })(
      request("admin-token", body),
      { params: Promise.resolve({ segmentKey }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_request" });
    expect(client.computeRailRoute).not.toHaveBeenCalled();
  });

  it("keeps the date gate server-authoritative", async () => {
    const { repository, client } = setup();
    const response = await createFinalizeRailRouteHandler({
      repository,
      client,
      now: () => new Date(now.getTime() - 1),
    })(request("admin-token", { departureTime }), { params: Promise.resolve({ segmentKey: "kix-kyoto" }) });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: "not_open" });
    expect(client.computeRailRoute).not.toHaveBeenCalled();
  });

  it("returns only a public status after a successful race-safe upsert", async () => {
    const { repository, client } = setup();
    const response = await createFinalizeRailRouteHandler({ repository, client, now: () => now })(
      request("admin-token", { departureTime, naritaRailChoice: "skyliner" }),
      { params: Promise.resolve({ segmentKey: "tokyo-narita" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ route: { segmentKey: "tokyo-narita", status: "finalized" } });
    await expect(repository.findRouteGeometry("tokyo-narita", now)).resolves.toMatchObject({
      encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
      naritaRailChoice: "skyliner",
    });
  });

  it("masks an upstream failure and leaves the cache untouched", async () => {
    const { repository } = setup();
    const client: GoogleRoutesClient = { computeRailRoute: vi.fn(async () => { throw new Error("secret Google detail"); }) };
    const response = await createFinalizeRailRouteHandler({ repository, client, now: () => now })(
      request("admin-token", { departureTime }),
      { params: Promise.resolve({ segmentKey: "kix-kyoto" }) },
    );

    expect(response.status).toBe(502);
    const payload = await response.json();
    expect(payload).toEqual({ error: "route_unavailable", message: "철도 경로를 확정하지 못했습니다. 기존 경로를 유지합니다." });
    expect(JSON.stringify(payload)).not.toContain("secret Google detail");
    await expect(repository.listRouteGeometry(now)).resolves.toEqual([]);
  });
});
