import { describe, expect, it } from "vitest";

import { hashSessionToken } from "../../../../../server/auth/crypto";
import { InMemoryTripRepository } from "../../../../../server/repository/memory";

import { createAcceptRejectionHandler } from "./handler";

const now = new Date("2026-08-28T00:00:00.000Z");

async function rejectedOpinion() {
  const repository = new InMemoryTripRepository({
    participants: [
      { id: "gyuyeol", name: "이규열", birthYear: 1998, departureCity: "인천", role: "contributor", codeSalt: "salt", codeHash: "hash", createdAt: now },
      { id: "junsu", name: "박준수", birthYear: 1998, departureCity: "인천", role: "contributor", codeSalt: "salt", codeHash: "hash", createdAt: now },
    ],
    sessions: [
      { id: "author-session", participantId: "gyuyeol", tokenHash: hashSessionToken("author-token"), createdAt: now, expiresAt: new Date("2026-10-13T14:59:59.000Z") },
      { id: "other-session", participantId: "junsu", tokenHash: hashSessionToken("other-token"), createdAt: now, expiresAt: new Date("2026-10-13T14:59:59.000Z") },
    ],
  });
  const opinion = await repository.createOpinion({ participantId: "gyuyeol", targetDay: 1, body: "원문" });
  await repository.transitionOpinion(opinion.id, "pending", {
    status: "rejected",
    reviewedBy: "daekyeom",
    reviewedAt: now,
    rejectionCategory: "schedule_impossible",
    publicSummary: "요약",
    rejectionReason: "사유",
  });
  return { repository, opinion };
}

function acceptRequest(token: string) {
  return new Request("https://example.test/api/opinions/id/accept-rejection", { method: "POST", headers: { cookie: `jt_session=${token}` } });
}

describe("POST /api/opinions/[id]/accept-rejection", () => {
  it("hides another contributor's rejected opinion and returns the same result for an author retry", async () => {
    const { repository, opinion } = await rejectedOpinion();
    const handler = createAcceptRejectionHandler({ repository, now: () => now });
    const context = { params: Promise.resolve({ id: opinion.id }) };

    const other = await handler(acceptRequest("other-token"), context);
    const accepted = await handler(acceptRequest("author-token"), context);
    const repeated = await handler(acceptRequest("author-token"), context);

    expect(other.status).toBe(404);
    await expect(other.json()).resolves.toEqual({ error: "not_found" });
    expect(accepted.status).toBe(200);
    expect(repeated.status).toBe(200);
    await expect(repeated.json()).resolves.toMatchObject({ opinion: { id: opinion.id, rejectionAcceptedAt: now.toISOString() } });
  });

  it("treats an invalid dynamic opinion id as not found", async () => {
    const { repository } = await rejectedOpinion();
    const response = await createAcceptRejectionHandler({ repository })(acceptRequest("author-token"), { params: Promise.resolve({ id: "not-a-uuid" }) });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
  });
});
