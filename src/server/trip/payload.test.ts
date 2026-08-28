import { describe, expect, it } from "vitest";

import type { OpinionRecord, RouteGeometryRecord } from "../repository/types";

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
  it("publishes only active finalized rail coordinates with the generic label", () => {
    const now = new Date("2026-09-10T00:00:00.000Z");
    const route = (overrides: Partial<RouteGeometryRecord>): RouteGeometryRecord => ({
      segmentKey: "kix-kyoto",
      status: "finalized",
      encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
      departureTime: "2026-10-02T01:00:00.000Z",
      naritaRailChoice: null,
      createdAt: new Date("2026-09-07T00:00:00.000Z"),
      expiresAt: new Date("2026-10-06T15:00:00.000Z"),
      ...overrides,
    });

    const payload = buildTripPayload({ role: "observer" }, [], [
      route({}),
      route({ segmentKey: "kyoto-odawara", expiresAt: now }),
      route({ segmentKey: "odawara-tokyo", status: "placeholder" }),
      route({ segmentKey: "tokyo-narita", encodedPolyline: "_" }),
    ], now);

    expect(payload.railRoutes).toEqual([{
      segmentKey: "kix-kyoto",
      status: "finalized",
      label: "철도 이동",
      geometry: [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]],
    }]);
    const serialized = JSON.stringify(payload.railRoutes);
    expect(serialized).not.toContain("encodedPolyline");
    expect(serialized).not.toContain("departureTime");
    expect(serialized).not.toContain("naritaRailChoice");
    expect(serialized).not.toContain("Haruka");
  });

  it("drops non-drawable and bounded-limit violations read from the route cache", () => {
    const now = new Date("2026-09-10T00:00:00.000Z");
    const route = (segmentKey: RouteGeometryRecord["segmentKey"], encodedPolyline: string): RouteGeometryRecord => ({
      segmentKey,
      status: "finalized",
      encodedPolyline,
      departureTime: "2026-10-02T01:00:00.000Z",
      naritaRailChoice: null,
      createdAt: new Date("2026-09-07T00:00:00.000Z"),
      expiresAt: new Date("2026-10-06T15:00:00.000Z"),
    });

    const payload = buildTripPayload({ role: "observer" }, [], [
      route("kix-kyoto", "??"),
      route("kyoto-odawara", "????"),
      route("odawara-tokyo", "A?".repeat(50_001)),
      route("tokyo-narita", "A?".repeat(10_001)),
    ], now);

    expect(payload.railRoutes).toEqual([]);
  });

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
    expect(payload.displayName).toBe("이규열");
    expect(payload.ownOpinions).toEqual([expect.objectContaining({ id: "own", body: "내 비공개 원문", status: "rejected", accepted: false })]);
    expect(payload.publicRejections).toEqual(expect.arrayContaining([expect.objectContaining({ authorName: "박준수", publicSummary: "일정 조정 필요" })]));
    expect(JSON.stringify(payload.ownOpinions)).not.toContain("다른 사람 비공개 원문");
  });

  it("gives an admin the complete review queue without participant credentials or session data", () => {
    const payload = buildTripPayload({ id: "daekyeom", role: "admin" }, [
      rejectedOpinion({ id: "review", body: "검토할 원문" }),
    ]);

    if (payload.role !== "admin") throw new Error("expected admin payload");
    expect(payload.displayName).toBe("정대겸");
    expect(payload.reviewQueue).toEqual([expect.objectContaining({
      id: "review",
      participantId: "gyuyeol",
      authorName: "이규열",
      body: "검토할 원문",
      status: "rejected",
      rejectionCategory: "schedule",
    })]);
    expect(JSON.stringify(payload)).not.toContain("birthYear");
    expect(JSON.stringify(payload)).not.toContain("codeHash");
    expect(JSON.stringify(payload)).not.toContain("tokenHash");
  });
});
