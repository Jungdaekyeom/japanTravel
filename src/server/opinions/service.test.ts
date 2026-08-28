import { describe, expect, it } from "vitest";

import { InMemoryTripRepository } from "../repository/memory";

import {
  acceptRejection,
  approveOpinion,
  rejectOpinion,
  submitOpinion,
} from "./service";

const now = new Date("2026-08-28T00:00:00.000Z");
const contributor = { id: "gyuyeol", role: "contributor" as const };
const otherContributor = { id: "junsu", role: "contributor" as const };
const admin = { id: "daekyeom", role: "admin" as const };
const observer = { role: "observer" as const };

describe("opinion service", () => {
  it("accepts submissions only from the three designated contributors", async () => {
    const repository = new InMemoryTripRepository();

    await expect(submitOpinion(repository, observer, { targetDay: 1, body: "제안" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(submitOpinion(repository, admin, { targetDay: 1, body: "제안" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(submitOpinion(repository, { id: "unlisted", role: "contributor" }, { targetDay: 1, body: "제안" })).rejects.toMatchObject({ code: "forbidden" });

    await expect(submitOpinion(repository, contributor, { targetDay: 1, body: "제안" })).resolves.toMatchObject({ participantId: "gyuyeol", status: "pending" });
  });

  it("blocks further submissions until the author accepts a rejection", async () => {
    const repository = new InMemoryTripRepository();
    const opinion = await submitOpinion(repository, contributor, { targetDay: 1, body: "첫 제안" });
    await rejectOpinion(repository, admin, opinion.id, {
      category: "schedule_impossible",
      publicSummary: "시간이 부족합니다",
      reason: "이동 시간을 확보해야 합니다.",
    }, () => now);

    await expect(submitOpinion(repository, contributor, { targetDay: 2, body: "새 제안" })).rejects.toMatchObject({ code: "conflict" });
    await acceptRejection(repository, contributor, opinion.id, () => now);
    await expect(submitOpinion(repository, contributor, { targetDay: 2, body: "새 제안" })).resolves.toMatchObject({ status: "pending" });
  });

  it("lets only the rejected opinion author accept it and makes retries idempotent", async () => {
    const repository = new InMemoryTripRepository();
    const opinion = await submitOpinion(repository, contributor, { targetDay: null, body: "첫 제안" });
    await rejectOpinion(repository, admin, opinion.id, {
      category: "distance_over_50km",
      publicSummary: "예산을 넘습니다",
      reason: "현재 예산으로는 진행하기 어렵습니다.",
    }, () => now);

    await expect(acceptRejection(repository, otherContributor, opinion.id, () => now)).rejects.toMatchObject({ code: "not_found" });
    await expect(acceptRejection(repository, contributor, opinion.id, () => now)).resolves.toMatchObject({ rejectionAcceptedAt: now });
    await expect(acceptRejection(repository, contributor, opinion.id, () => now)).resolves.toMatchObject({ rejectionAcceptedAt: now });
  });

  it("allows only an admin to review a pending opinion and rejects racing duplicate reviews", async () => {
    const repository = new InMemoryTripRepository();
    const opinion = await submitOpinion(repository, contributor, { targetDay: 3, body: "첫 제안" });

    await expect(approveOpinion(repository, contributor, opinion.id, () => now)).rejects.toMatchObject({ code: "forbidden" });
    const outcomes = await Promise.allSettled([
      approveOpinion(repository, admin, opinion.id, () => now),
      rejectOpinion(repository, admin, opinion.id, {
        category: "purpose_conflict",
        publicSummary: "실행이 어렵습니다",
        reason: "현지 운영 조건을 충족하기 어렵습니다.",
      }, () => now),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    await expect(repository.listOpinions()).resolves.toMatchObject([{ status: expect.stringMatching(/approved|rejected/) }]);
  });
});
