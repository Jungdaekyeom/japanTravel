import type { PublicTraveler } from "./travelers";

export const DAY_OPTIONS = [1, 2, 3, 4, 5] as const;
export type DayNumber = typeof DAY_OPTIONS[number];

// 2026-10-02, UTC+09:00 in both Korea and Japan. Planned times, not live flight data.
export const DAY1_SCHEDULES = {
  "mandeok-pus": { departureMinute: 360, arrivalMinute: 420 },
  "suwon-gmp": { departureMinute: 405, arrivalMinute: 465 },
  "icheon-gmp": { departureMinute: 375, arrivalMinute: 465 },
  "pus-kix": { departureMinute: 510, arrivalMinute: 605 },
  "gmp-kix": { departureMinute: 555, arrivalMinute: 655 },
} as const;

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
export type PlaceKey = "mandeok" | "suwon" | "icheon" | "busan" | "incheon" | "gimpo" | "kix" | "kyoto" | "kiyomizu" | "kinkaku" | "ginkaku" | "odawara" | "hakone" | "tokyo" | "ueno" | "shinjuku" | "shibuya" | "akihabara" | "sensoji" | "ginza" | "nrt";
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
    { day: 1, date: "2026-10-02", title: "간사이국제공항에서 교토역", summary: "부산·김포에서 KIX 도착 후 교토역 이동, 교토 명소 방문", overnight: "교토" },
    { day: 2, date: "2026-10-03", title: "교토역에서 하코네유모토역", summary: "교토역에서 오다와라역을 거쳐 하코네유모토역 이동", overnight: "하코네" },
    { day: 3, date: "2026-10-04", title: "하코네유모토역에서 우에노", summary: "하코네유모토역에서 오다와라역을 거쳐 JR 도카이도 본선·우쓰노미야선 직결로 우에노 이동", overnight: "도쿄" },
    { day: 4, date: "2026-10-05", title: "도쿄 관광", summary: "아키하바라·센소지·긴자 관광", overnight: "도쿄" },
    { day: 5, date: "2026-10-06", title: "우에노역에서 나리타국제공항", summary: "우에노역에서 나리타국제공항 이동 후 귀국", overnight: null },
  ],
  railSegments: [
    { key: "kix-kyoto", from: "kix", to: "kyoto" },
    { key: "kyoto-odawara", from: "kyoto", to: "odawara" },
    { key: "odawara-tokyo", from: "odawara", to: "tokyo" },
    { key: "tokyo-narita", from: "ueno", to: "nrt", naritaRailChoices: ["skyliner"] },
  ],
  places: {
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
  },
} as const satisfies PublicTripDefinition;

export type PublicTrip = typeof PUBLIC_TRIP_DEFINITION;
export type SharedTripPayload = {
  trip: PublicTrip;
  travelers: readonly PublicTraveler[];
  railRoutes: PublicRailRoute[];
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
