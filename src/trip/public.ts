import type { PublicTraveler, TravelerId } from "./travelers";
import type { GroundKind, GroundRouteKey } from "./ground-routes";

export const DAY_OPTIONS = [1, 2, 3, 4, 5] as const;
export type DayNumber = typeof DAY_OPTIONS[number];

export type ScheduleEntry = { time: string; text: string; travelerIds?: readonly TravelerId[]; note?: string };
// All times are planned, UTC+09:00. Playback has its own screen-distance clock.
export const TRIP_SCHEDULE: Record<DayNumber, readonly ScheduleEntry[]> = {
  1: [
    { time: "04:40 이전", text: "이규열·박준수 · 이천터미널 이동", travelerIds: ["gyuyeol", "junsu"] },
    { time: "04:40 출발", text: "이규열·박준수 · 버스 → 인천 T1", travelerIds: ["gyuyeol", "junsu"], note: "공항 도착 시각 미확인" },
    { time: "06:00–07:00", text: "정대겸 · 차량 → PUS", travelerIds: ["daekyeom"] },
    { time: "06:45–07:45", text: "한규준 · 차량 → GMP", travelerIds: ["gyujun"] },
    { time: "08:30–10:05", text: "정대겸 · 에어부산 PUS → KIX", travelerIds: ["daekyeom"] },
    { time: "09:15–10:55", text: "한규준 · 대한항공 GMP → KIX", travelerIds: ["gyujun"] },
    { time: "09:15–10:55 예정", text: "이규열·박준수 · 대한항공 → KIX", travelerIds: ["gyuyeol", "junsu"], note: "출발 공항 확인 중 · 인천 T1행 버스와 항공권의 연결 확인 필요" },
    { time: "합류 후", text: "JR 하루카 → 교토역" },
    { time: "오후", text: "버스·도보 · 기요미즈데라 → 은각사 → 금각사 → 교토역", note: "방문 후보 · 도착 시각과 운영시간에 따라 생략 가능" },
    { time: "숙박", text: "온야도 노노 교토 시치조 천연온천" },
  ],
  2: [
    { time: "10:33–12:38", text: "Hikari 646 · 교토 → 오다와라" },
    { time: "12:38 이후", text: "오다와라역 주변 점심" },
    { time: "14:00–15:00 예정", text: "서쪽 출구 무료 셔틀버스 → 류구덴", note: "사전 예약 필요 · 지도는 예상 도로 경로" },
    { time: "숙박", text: "龍宮殿 · Ryuguden" },
  ],
  3: [
    { time: "10:30편–11:30 예정", text: "류구덴 무료 셔틀버스 → 오다와라", note: "류구덴 승차 시각·장소와 예약 확인 필요" },
    { time: "11:30 이후", text: "오다와라역 주변 점심" },
    { time: "약 13:00–14:30", text: "JR 도카이도선·우에노도쿄라인 → 우에노", note: "열차 선택에 따라 시각 변경" },
    { time: "15:00–16:00", text: "hotel aima 체크인·휴식" },
    { time: "18:30–20:30", text: "텐카이 우에노역점 · 이자카야 + 세이카 생일파티" },
    { time: "20:30 이후", text: "도보로 hotel aima 귀가" },
  ],
  4: [
    { time: "아침 일찍", text: "히비야선 → 나카메구로 · 스타벅스 리저브 로스터리 도쿄" },
    { time: "이후", text: "히비야선·오에도선 → 신주쿠" },
    { time: "오후", text: "도에이 신주쿠선 → 이와모토초 · 도보 → 아키하바라" },
    { time: "저녁", text: "히비야선 → 긴자 · 긴자선 → 우에노·호텔" },
    { time: "교통", text: "Tokyo Subway Ticket · 도쿄 메트로 + 도에이", note: "역 접근은 도보 · JR·스카이라이너는 패스 대상 아님" },
  ],
  5: [
    { time: "10:00", text: "hotel aima 체크아웃 → 게이세이우에노역" },
    { time: "11:00까지", text: "스카이라이너 → 나리타공항", note: "11시 도착 가능한 열차 선택" },
    { time: "12:50–15:25", text: "이규열·박준수·한규준 · 아시아나 NRT → ICN T2", travelerIds: ["gyuyeol", "junsu", "gyujun"] },
    { time: "입국 후", text: "이규열·박준수 · 버스 → 이천터미널 → 귀가", travelerIds: ["gyuyeol", "junsu"] },
    { time: "입국 후", text: "한규준 · 수원 방면 차량 귀가 예정", travelerIds: ["gyujun"], note: "출국은 GMP, 귀국은 ICN T2 · 차량 픽업 계획 확인 필요" },
    { time: "17:10–19:15", text: "정대겸 · 진에어 NRT → PUS", travelerIds: ["daekyeom"] },
    { time: "입국 후", text: "정대겸 · 307번 버스 → 만덕 인근 → 귀가", travelerIds: ["daekyeom"], note: "하차 정류장·수하물 반입 규정 확인 필요" },
  ],
};

export const REJECTION_CATEGORIES = [
  "distance_over_50km",
  "schedule_impossible",
  "unsafe_or_illegal",
  "purpose_conflict",
  "other",
] as const;
export type RejectionCategory = typeof REJECTION_CATEGORIES[number];
export const REJECTION_CATEGORY_OPTIONS: readonly { value: RejectionCategory; label: string }[] = [
  { value: "distance_over_50km", label: "기준지 50km 초과" },
  { value: "schedule_impossible", label: "일정상 불가능" },
  { value: "unsafe_or_illegal", label: "위법·안전 문제" },
  { value: "purpose_conflict", label: "여행 목적 저해" },
  { value: "other", label: "기타" },
];

export type ViewerRole = "observer" | "contributor" | "admin";
export type OpinionStatus = "pending" | "approved" | "rejected";
export type ItineraryDay = {
  day: DayNumber;
  date: string;
  title: string;
  summary: string;
  overnight: "교토" | "하코네" | "도쿄" | null;
};
export type PlaceKey = "mandeok" | "suwon" | "icheon" | "icheonTerminal" | "busan" | "incheon" | "incheon2" | "gimpo" | "kix" | "kyoto" | "nono" | "kiyomizu" | "kinkaku" | "ginkaku" | "odawara" | "hakone" | "ryuguden" | "tokyo" | "ueno" | "keiseiUeno" | "aima" | "tenkai" | "nakameguro" | "roastery" | "roppongi" | "iwamotocho" | "shinjuku" | "shibuya" | "akihabara" | "sensoji" | "ginza" | "nrt";
export type Place = { name: string; latitude: number; longitude: number };
export type RailSegment = {
  key: "kix-kyoto" | "kyoto-odawara" | "odawara-tokyo" | "tokyo-narita";
  from: PlaceKey;
  to: PlaceKey;
  naritaRailChoices?: readonly ["skyliner"];
};
export type PublicRailRoute = {
  segmentKey: RailSegment["key"];
  status: "finalized";
  label: "철도 이동";
  geometry: readonly (readonly [latitude: number, longitude: number])[];
};
export type PublicGroundRoute = {
  segmentKey: GroundRouteKey;
  verifiedAt: string;
  steps: readonly { kind: GroundKind; geometry: readonly (readonly [number, number])[] }[];
};
export type PublicTripDefinition = {
  startDate: string;
  endDate: string;
  days: readonly ItineraryDay[];
  railSegments: readonly RailSegment[];
  places: Record<PlaceKey, Place>;
};

export const PUBLIC_TRIP_DEFINITION = {
  startDate: "2026-10-02",
  endDate: "2026-10-06",
  days: [
    { day: 1, date: "2026-10-02", title: "KIX에서 교토·온야도 노노", summary: "KIX 합류 → 하루카 → 교토 버스·도보 관광 → 온야도 노노", overnight: "교토" },
    { day: 2, date: "2026-10-03", title: "교토에서 류구덴", summary: "Hikari 646 10:33 → 오다와라 점심 → 14:00 셔틀 → 류구덴", overnight: "하코네" },
    { day: 3, date: "2026-10-04", title: "류구덴에서 우에노", summary: "셔틀·JR → hotel aima → 18:30 텐카이·세이카 생일파티", overnight: "도쿄" },
    { day: 4, date: "2026-10-05", title: "도쿄 지하철 관광", summary: "나카메구로 로스터리 → 신주쿠 → 아키하바라 → 긴자", overnight: "도쿄" },
    { day: 5, date: "2026-10-06", title: "나리타에서 각자 귀국", summary: "10:00 체크아웃·스카이라이너 → 아시아나 12:50 / 진에어 17:10", overnight: null },
  ],
  railSegments: [
    { key: "kix-kyoto", from: "kix", to: "kyoto" },
    { key: "kyoto-odawara", from: "kyoto", to: "odawara" },
    { key: "odawara-tokyo", from: "odawara", to: "ueno" },
    { key: "tokyo-narita", from: "ueno", to: "nrt", naritaRailChoices: ["skyliner"] },
  ],
  places: {
    mandeok: { name: "만덕터널 인근", latitude: 35.215263, longitude: 129.028309 },
    suwon: { name: "수원시청", latitude: 37.2634787, longitude: 127.0287097 },
    icheon: { name: "이천시청", latitude: 37.2723484, longitude: 127.4350167 },
    icheonTerminal: { name: "이천터미널", latitude: 37.27908, longitude: 127.44561 },
    busan: { name: "김해국제공항", latitude: 35.1796, longitude: 128.9382 },
    incheon: { name: "인천공항 T1", latitude: 37.4602, longitude: 126.4407 },
    incheon2: { name: "인천공항 T2", latitude: 37.4688, longitude: 126.4330 },
    gimpo: { name: "김포국제공항", latitude: 37.5655255, longitude: 126.801378 },
    kix: { name: "간사이국제공항", latitude: 34.4347, longitude: 135.244 },
    kyoto: { name: "교토역", latitude: 34.985849, longitude: 135.758767 },
    nono: { name: "온야도 노노 교토 시치조", latitude: 34.98844, longitude: 135.76343 },
    kiyomizu: { name: "기요미즈데라", latitude: 34.994856, longitude: 135.785046 },
    kinkaku: { name: "금각사", latitude: 35.03937, longitude: 135.72924 },
    ginkaku: { name: "은각사", latitude: 35.027, longitude: 135.7982 },
    odawara: { name: "오다와라역", latitude: 35.25626, longitude: 139.15582 },
    hakone: { name: "하코네유모토역", latitude: 35.23367, longitude: 139.10332 },
    ryuguden: { name: "류구덴", latitude: 35.20931, longitude: 139.00189 },
    tokyo: { name: "도쿄역", latitude: 35.68124, longitude: 139.76712 },
    ueno: { name: "우에노역", latitude: 35.71377, longitude: 139.77725 },
    keiseiUeno: { name: "게이세이우에노역", latitude: 35.71118, longitude: 139.77458 },
    aima: { name: "hotel aima", latitude: 35.710537, longitude: 139.77739 },
    tenkai: { name: "텐카이 우에노역점", latitude: 35.71097, longitude: 139.77504 },
    nakameguro: { name: "나카메구로역", latitude: 35.6443, longitude: 139.6991 },
    roastery: { name: "스타벅스 리저브 로스터리 도쿄", latitude: 35.64916, longitude: 139.69289 },
    roppongi: { name: "롯폰기역", latitude: 35.66283, longitude: 139.73145 },
    iwamotocho: { name: "이와모토초역", latitude: 35.69550, longitude: 139.77589 },
    shinjuku: { name: "신주쿠", latitude: 35.6909, longitude: 139.7003 },
    shibuya: { name: "시부야", latitude: 35.658, longitude: 139.7016 },
    akihabara: { name: "아키하바라", latitude: 35.6984, longitude: 139.7731 },
    sensoji: { name: "센소지", latitude: 35.7148, longitude: 139.7967 },
    ginza: { name: "긴자", latitude: 35.6719, longitude: 139.7659 },
    nrt: { name: "나리타국제공항", latitude: 35.772, longitude: 140.3929 },
  },
} as const satisfies PublicTripDefinition;

export type PublicTrip = typeof PUBLIC_TRIP_DEFINITION;
export type SharedTripPayload = {
  trip: PublicTrip;
  travelers: readonly PublicTraveler[];
  railRoutes: PublicRailRoute[];
  groundRoutes?: PublicGroundRoute[];
};
export type PublicRejection = { authorName: string; publicSummary: string; reason: string; accepted: boolean };
export type OwnOpinion = { id: string; targetDay: DayNumber | null; body: string; status: OpinionStatus; accepted: boolean };
export type ReviewOpinion = {
  id: string;
  participantId: string;
  authorName: string;
  targetDay: DayNumber | null;
  body: string;
  status: OpinionStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionCategory: RejectionCategory | null;
  publicSummary: string | null;
  rejectionReason: string | null;
  rejectionAcceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PublicPayload = { trip: PublicTrip; railRoutes: PublicRailRoute[]; publicRejections: PublicRejection[] };
export type ObserverPayload = PublicPayload & { role: "observer" };
export type ContributorPayload = PublicPayload & { role: "contributor"; displayName: string; ownOpinions: OwnOpinion[] };
export type AdminPayload = PublicPayload & { role: "admin"; displayName: string; reviewQueue: ReviewOpinion[] };
export type TripPayload = ObserverPayload | ContributorPayload | AdminPayload;
