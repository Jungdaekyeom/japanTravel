import { describe, expect, it } from "vitest";

import type { OpinionRecord } from "../repository/types";

import { buildTripPayload } from "./payload";

function rejectedOpinion(overrides: Partial<OpinionRecord>): OpinionRecord {
  return {
    id: "opinion-1",
    participantId: "gyuyeol",
    targetDay: 1,
    body: "원문 제안",
    status: "rejected",
    reviewedBy: "daekyeom",
    reviewedAt: new Date("2026-08-28T00:00:00.000Z"),
    rejectionCategory: "schedule",
    publicSummary: "일정 조정 필요",
    rejectionReason: "이동 시간이 부족합니다.",
    rejectionAcceptedAt: null,
    createdAt: new Date("2026-08-27T00:00:00.000Z"),
    updatedAt: new Date("2026-08-28T00:00:00.000Z"),
    ...overrides,
  };
}

describe("buildTripPayload", () => {
  it("gives an observer fixed trip data and only each author's latest rejected opinion", () => {
    const payload = buildTripPayload({ role: "observer" }, [
      rejectedOpinion({ id: "old", body: "오래된 원문", publicSummary: "이전 요약", reviewedAt: new Date("2026-08-26T00:00:00.000Z") }),
      rejectedOpinion({ id: "new", body: "최신 원문", publicSummary: "최신 요약", rejectionAcceptedAt: new Date("2026-08-28T01:00:00.000Z") }),
      rejectedOpinion({ id: "junsu", participantId: "junsu", body: "박준수 원문", publicSummary: "다른 작성자 요약", rejectionReason: "다른 사유" }),
      {
        ...rejectedOpinion({ id: "pending", body: "대기 원문" }),
        status: "pending" as const,
        reviewedBy: null,
        reviewedAt: null,
        rejectionCategory: null,
        publicSummary: null,
        rejectionReason: null,
      },
    ]);

    expect(payload.role).toBe("observer");
    expect(payload.trip).toMatchObject({ startDate: "2026-10-02", endDate: "2026-10-06" });
    expect(payload.trip.days).toContainEqual(expect.objectContaining({ day: 1 }));
    expect(payload.publicRejections).toEqual(expect.arrayContaining([
      expect.objectContaining({ authorName: "이규열", publicSummary: "최신 요약", reason: "이동 시간이 부족합니다.", accepted: true }),
      expect.objectContaining({ authorName: "박준수", publicSummary: "다른 작성자 요약", reason: "다른 사유", accepted: false }),
    ]));
    expect(JSON.stringify(payload)).not.toContain("원문");
    expect(JSON.stringify(payload)).not.toContain("1998");
    expect(JSON.stringify(payload)).not.toContain("rejectionCategory");
  });

  it("gives a contributor only their own private bodies and statuses alongside the public view", () => {
    const own = rejectedOpinion({ id: "own", body: "내 비공개 원문" });
    const another = rejectedOpinion({ id: "another", participantId: "junsu", body: "다른 사람 비공개 원문" });

    const payload = buildTripPayload({ id: "gyuyeol", role: "contributor" }, [own, another]);

    if (payload.role !== "contributor") throw new Error("expected contributor payload");
    expect(payload.ownOpinions).toEqual([expect.objectContaining({ id: "own", body: "내 비공개 원문", status: "rejected", accepted: false })]);
    expect(payload.publicRejections).toEqual(expect.arrayContaining([expect.objectContaining({ authorName: "박준수", publicSummary: "일정 조정 필요" })]));
    expect(JSON.stringify(payload.ownOpinions)).not.toContain("다른 사람 비공개 원문");
  });

  it("gives an admin the complete review queue without participant credentials or session data", () => {
    const payload = buildTripPayload({ id: "daekyeom", role: "admin" }, [
      rejectedOpinion({ id: "review", body: "검토할 원문" }),
    ]);

    if (payload.role !== "admin") throw new Error("expected admin payload");
    expect(payload.reviewQueue).toEqual([expect.objectContaining({
      id: "review",
      participantId: "gyuyeol",
      body: "검토할 원문",
      status: "rejected",
      rejectionCategory: "schedule",
    })]);
    expect(JSON.stringify(payload)).not.toContain("birthYear");
    expect(JSON.stringify(payload)).not.toContain("codeHash");
    expect(JSON.stringify(payload)).not.toContain("tokenHash");
  });
});
