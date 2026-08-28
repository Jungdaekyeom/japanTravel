import { describe, expect, it } from "vitest";

import { hashSessionToken } from "../../../../../../server/auth/crypto";
import { InMemoryTripRepository } from "../../../../../../server/repository/memory";

import { createRejectOpinionHandler } from "./route";

const now = new Date("2026-08-28T00:00:00.000Z");

async function pendingOpinion() {
  const repository = new InMemoryTripRepository({
    participants: [{ id: "daekyeom", name: "정대겸", birthYear: 1993, departureCity: "부산", role: "admin", codeSalt: "salt", codeHash: "hash", createdAt: now }],
    sessions: [{ id: "admin-session", participantId: "daekyeom", tokenHash: hashSessionToken("admin-token"), createdAt: now, expiresAt: new Date("2026-10-13T14:59:59.000Z") }],
  });
  return { repository, opinion: await repository.createOpinion({ participantId: "gyuyeol", targetDay: 1, body: "원문" }) };
}

function rejectRequest(body: unknown) {
  return new Request("https://example.test/api/admin/opinions/id/reject", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "jt_session=admin-token" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/opinions/[id]/reject", () => {
  it("validates the public rejection fields and rejects duplicate reviews with a conflict", async () => {
    const { repository, opinion } = await pendingOpinion();
    const handler = createRejectOpinionHandler({ repository, now: () => now });
    const context = { params: Promise.resolve({ id: opinion.id }) };

    const invalid = await handler(rejectRequest({ category: "unknown", publicSummary: "요약", reason: "사유" }), context);
    const rejected = await handler(rejectRequest({ category: "schedule", publicSummary: "  요약  ", reason: "  사유  " }), context);
    const repeated = await handler(rejectRequest({ category: "schedule", publicSummary: "요약", reason: "사유" }), context);

    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({ error: "invalid_request" });
    expect(rejected.status).toBe(200);
    await expect(rejected.json()).resolves.toMatchObject({ opinion: { id: opinion.id, status: "rejected", publicSummary: "요약", rejectionReason: "사유" } });
    expect(repeated.status).toBe(409);
    await expect(repeated.json()).resolves.toEqual({ error: "conflict" });
  });
});
