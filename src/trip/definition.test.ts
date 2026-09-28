import { describe, expect, it } from "vitest";

import { getDay, TRIP_DEFINITION } from "./definition";

describe("TRIP_DEFINITION", () => {
  it("defines the 2026 October 2–6 trip and its four participants", () => {
    expect(TRIP_DEFINITION.startDate).toBe("2026-10-02");
    expect(TRIP_DEFINITION.endDate).toBe("2026-10-06");
    expect(TRIP_DEFINITION.participants.map(({ id }) => id)).toEqual(["daekyeom", "gyuyeol", "junsu", "gyujun"]);
  });

  it("defines all five revised overnight itineraries", () => {
    expect(TRIP_DEFINITION.days).toHaveLength(5);
    expect(TRIP_DEFINITION.days.map(({ date }) => date)).toEqual([
      "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06",
    ]);
    expect(TRIP_DEFINITION.days.map(({ overnight }) => overnight)).toEqual(["교토", "하코네", "도쿄", "도쿄", null]);
    expect(TRIP_DEFINITION.days[1]).toMatchObject({ title: "교토에서 류구덴", summary: expect.stringContaining("Hikari 646") });
    expect(TRIP_DEFINITION.days[3]).toMatchObject({ title: "도쿄 지하철 관광", summary: expect.stringContaining("나카메구로") });
  });

  it("finds a day by its one-based number", () => {
    expect(getDay(3)).toEqual(TRIP_DEFINITION.days[2]);
  });

  it("routes Odawara rail directly to Ueno and keeps Skyliner", () => {
    expect(TRIP_DEFINITION.railSegments).toEqual(expect.arrayContaining([
      { key: "odawara-tokyo", from: "odawara", to: "ueno" },
      { key: "tokyo-narita", from: "ueno", to: "nrt", naritaRailChoices: ["skyliner"] },
    ]));
  });

  it("defines the revised hotels, terminals, and airport terminals", () => {
    expect(TRIP_DEFINITION.places).toMatchObject({
      icheonTerminal: { name: "이천터미널" },
      incheon: { name: "인천공항 T1" },
      incheon2: { name: "인천공항 T2" },
      nono: { name: "온야도 노노 교토 시치조" },
      ryuguden: { name: "류구덴" },
      aima: { name: "hotel aima" },
      tenkai: { name: "텐카이 우에노역점" },
      roastery: { name: "스타벅스 리저브 로스터리 도쿄" },
    });
  });
});
