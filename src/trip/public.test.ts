import { describe, expect, it } from "vitest";

import {
  DAY_OPTIONS,
  PUBLIC_TRIP_DEFINITION,
  REJECTION_CATEGORY_OPTIONS,
} from "./public";

describe("public trip domain boundary", () => {
  it("exposes itinerary constants without participant credentials or roster fields", () => {
    expect(DAY_OPTIONS).toEqual([1, 2, 3, 4, 5]);
    expect(REJECTION_CATEGORY_OPTIONS).toEqual([
      { value: "distance_over_50km", label: "기준지 50km 초과" },
      { value: "schedule_impossible", label: "일정상 불가능" },
      { value: "unsafe_or_illegal", label: "위법·안전 문제" },
      { value: "purpose_conflict", label: "여행 목적 저해" },
      { value: "other", label: "기타" },
    ]);
    expect(PUBLIC_TRIP_DEFINITION).toMatchObject({
      startDate: "2026-10-02",
      endDate: "2026-10-06",
      days: expect.arrayContaining([expect.objectContaining({ day: 1 })]),
    });
    expect(Object.hasOwn(PUBLIC_TRIP_DEFINITION, "participants")).toBe(false);
    expect(JSON.stringify(PUBLIC_TRIP_DEFINITION)).not.toMatch(/birthYear|departureCity|daekyeom|gyuyeol|junsu|gyujun/);
  });
});
