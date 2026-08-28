import type { DayNumber, TripDefinition } from "./types";

export const TRIP_DEFINITION = {
  startDate: "2026-10-02",
  endDate: "2026-10-06",
  participants: [
    { id: "daekyeom", name: "정대겸", birthYear: 1993, departureCity: "부산", role: "admin" },
    { id: "gyuyeol", name: "이규열", birthYear: 1998, departureCity: "인천", role: "contributor" },
    { id: "junsu", name: "박준수", birthYear: 1998, departureCity: "인천", role: "contributor" },
    { id: "gyujun", name: "한규준", birthYear: 1998, departureCity: "인천", role: "contributor" },
  ],
  days: [
    { day: 1, date: "2026-10-02", title: "간사이국제공항에서 교토", summary: "부산·인천에서 KIX 도착 후 하루카로 교토 이동", overnight: "교토" },
    { day: 2, date: "2026-10-03", title: "교토에서 하코네", summary: "신칸센으로 오다와라 이동 후 하코네 권역 방문", overnight: "하코네" },
    { day: 3, date: "2026-10-04", title: "하코네에서 도쿄", summary: "오다와라에서 신칸센으로 도쿄 이동", overnight: "도쿄" },
    { day: 4, date: "2026-10-05", title: "도쿄 관광", summary: "도쿄 관광", overnight: "도쿄" },
    { day: 5, date: "2026-10-06", title: "도쿄에서 나리타국제공항", summary: "철도로 나리타국제공항 이동 후 귀국", overnight: null },
  ],
  railSegments: [
    { key: "kix-kyoto", from: "kix", to: "kyoto" },
    { key: "kyoto-odawara", from: "kyoto", to: "odawara" },
    { key: "odawara-tokyo", from: "odawara", to: "tokyo" },
    { key: "tokyo-narita", from: "tokyo", to: "nrt", naritaRailChoices: ["skyliner", "nex"] },
  ],
  places: {
    busan: { name: "부산", latitude: 35.1796, longitude: 129.0756 },
    incheon: { name: "인천", latitude: 37.4563, longitude: 126.7052 },
    kix: { name: "간사이국제공항", latitude: 34.4347, longitude: 135.244 },
    kyoto: { name: "교토", latitude: 35.0116, longitude: 135.7681 },
    odawara: { name: "오다와라", latitude: 35.2551, longitude: 139.1596 },
    hakone: { name: "하코네", latitude: 35.2324, longitude: 139.1069 },
    tokyo: { name: "도쿄", latitude: 35.6762, longitude: 139.6503 },
    nrt: { name: "나리타국제공항", latitude: 35.772, longitude: 140.3929 },
  },
} as const satisfies TripDefinition;

export function getDay(day: DayNumber) {
  return TRIP_DEFINITION.days[day - 1];
}
