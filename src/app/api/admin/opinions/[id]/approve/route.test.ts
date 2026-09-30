import { describe, expect, it } from "vitest";

import { hashSessionToken } from "../../../../../../server/auth/crypto";
import { InMemoryTripRepository } from "../../../../../../server/repository/memory";

import { createApproveOpinionHandler } from "./handler";

const now = new Date("2026-08-28T00:00:00.000Z");

async function pendingOpinion() {
  const repository = new InMemoryTripRepository({
    participants: [
      { id: "daekyeom", name: "정대겸", birthYear: 1993, departureCity: "부산", role: "admin", codeSalt: "salt", codeHash: "hash", createdAt: now },
      { id: "gyuyeol", name: "이규열", birthYear: 1998, departureCity: "인천", role: "contributor", codeSalt: "salt", codeHash: "hash", createdAt: now },
    ],
    sessions: [
      { id: "admin-session", participantId: "daekyeom", tokenHash: hashSessionToken("admin-token"), createdAt: now, expiresAt: new Date("2026-10-13T14:59:59.000Z") },
      { id: "contributor-session", participantId: "gyuyeol", tokenHash: hashSessionToken("contributor-token"), createdAt: now, expiresAt: new Date("2026-10-13T14:59:59.000Z") },
    ],
  });
  return { repository, opinion: await repository.createOpinion({ participantId: "gyuyeol", targetDay: 1, body: "원문" }) };
}

function approveRequest(token: string) {
  return new Request("https://example.test/api/admin/opinions/id/approve", { method: "POST", headers: { cookie: `jt_session=${token}` } });
}

describe("POST /api/admin/opinions/[id]/approve", () => {
  it("requires an admin and makes a duplicate pending-only transition a conflict", async () => {
    const { repository, opinion } = await pendingOpinion();
    const handler = createApproveOpinionHandler({ repository, now: () => now });
    const context = { params: Promise.resolve({ id: opinion.id }) };

    const contributor = await handler(approveRequest("contributor-token"), context);
    const approved = await handler(approveRequest("admin-token"), context);
    const repeated = await handler(approveRequest("admin-token"), context);

    expect(contributor.status).toBe(403);
    await expect(contributor.json()).resolves.toEqual({ error: "forbidden" });
    expect(approved.status).toBe(200);
    await expect(approved.json()).resolves.toMatchObject({ opinion: { id: opinion.id, status: "approved" } });
    expect(repeated.status).toBe(409);
    await expect(repeated.json()).resolves.toEqual({ error: "conflict" });
  });
});
