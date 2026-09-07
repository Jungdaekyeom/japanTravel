import { describe, expect, it } from "vitest";

import { getDay, TRIP_DEFINITION } from "./definition";

describe("TRIP_DEFINITION", () => {
  it("defines the 2026 October 2–6 trip and its four participants", () => {
    expect(TRIP_DEFINITION.startDate).toBe("2026-10-02");
    expect(TRIP_DEFINITION.endDate).toBe("2026-10-06");
    expect(TRIP_DEFINITION.participants).toEqual([
      { id: "daekyeom", name: "정대겸", birthYear: 1993, departureCity: "부산", role: "admin" },
      { id: "gyuyeol", name: "이규열", birthYear: 1998, departureCity: "인천", role: "contributor" },
      { id: "junsu", name: "박준수", birthYear: 1998, departureCity: "인천", role: "contributor" },
      { id: "gyujun", name: "한규준", birthYear: 1998, departureCity: "인천", role: "contributor" },
    ]);
  });

  it("defines each of the five fixed daily itineraries", () => {
    expect(TRIP_DEFINITION.days).toEqual([
      { day: 1, date: "2026-10-02", title: "간사이국제공항에서 교토역", summary: "부산·김포에서 KIX 도착 후 교토역 이동, 교토 명소 방문", overnight: "교토" },
      { day: 2, date: "2026-10-03", title: "교토역에서 하코네유모토역", summary: "교토역에서 오다와라역을 거쳐 하코네유모토역 이동", overnight: "하코네" },
      { day: 3, date: "2026-10-04", title: "하코네유모토역에서 우에노", summary: "하코네유모토역에서 오다와라역을 거쳐 JR 도카이도 본선·우쓰노미야선 직결로 우에노 이동", overnight: "도쿄" },
      { day: 4, date: "2026-10-05", title: "도쿄 관광", summary: "아키하바라·센소지·긴자 관광", overnight: "도쿄" },
      { day: 5, date: "2026-10-06", title: "우에노역에서 나리타국제공항", summary: "우에노역에서 나리타국제공항 이동 후 귀국", overnight: null },
    ]);
  });

  it("finds a day by its one-based day number", () => {
    expect(getDay(3)).toEqual(TRIP_DEFINITION.days[2]);
  });

  it("defines the four rail segments eligible for route confirmation", () => {
    expect(TRIP_DEFINITION.railSegments).toEqual([
      { key: "kix-kyoto", from: "kix", to: "kyoto" },
      { key: "kyoto-odawara", from: "kyoto", to: "odawara" },
      { key: "odawara-tokyo", from: "odawara", to: "tokyo" },
      { key: "tokyo-narita", from: "ueno", to: "nrt", naritaRailChoices: ["skyliner"] },
    ]);
  });

  it("defines the airport and city coordinates used by the map", () => {
    expect(TRIP_DEFINITION.places).toEqual({
      mandeok: { name: "만덕터널 인근", latitude: 35.215263, longitude: 129.028309 },
      suwon: { name: "수원시청", latitude: 37.2634787, longitude: 127.0287097 },
      icheon: { name: "이천시청", latitude: 37.2723484, longitude: 127.4350167 },
      busan: { name: "김해국제공항", latitude: 35.1796, longitude: 128.9382 },
      incheon: { name: "인천국제공항", latitude: 37.4602, longitude: 126.4407 },
      gimpo: { name: "김포국제공항", latitude: 37.5655255, longitude: 126.801378 },
      kix: { name: "간사이국제공항", latitude: 34.4347, longitude: 135.244 },
      kyoto: { name: "교토역", latitude: 34.985849, longitude: 135.758767 },
      kiyomizu: { name: "기요미즈데라", latitude: 34.994856, longitude: 135.785046 },
      kinkaku: { name: "금각사", latitude: 35.03937, longitude: 135.72924 },
      ginkaku: { name: "은각사", latitude: 35.027, longitude: 135.7982 },
      odawara: { name: "오다와라역", latitude: 35.25626, longitude: 139.15582 },
      hakone: { name: "하코네유모토역", latitude: 35.23367, longitude: 139.10332 },
      tokyo: { name: "도쿄역", latitude: 35.68124, longitude: 139.76712 },
      ueno: { name: "우에노역", latitude: 35.71377, longitude: 139.77725 },
      shinjuku: { name: "신주쿠", latitude: 35.6909, longitude: 139.7003 },
      shibuya: { name: "시부야", latitude: 35.658, longitude: 139.7016 },
      akihabara: { name: "아키하바라", latitude: 35.6984, longitude: 139.7731 },
      sensoji: { name: "센소지", latitude: 35.7148, longitude: 139.7967 },
      ginza: { name: "긴자", latitude: 35.6719, longitude: 139.7659 },
      nrt: { name: "나리타국제공항", latitude: 35.772, longitude: 140.3929 },
    });
  });
});
