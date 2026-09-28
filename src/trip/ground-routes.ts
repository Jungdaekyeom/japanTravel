import { PUBLIC_TRIP_DEFINITION, type DayNumber, type PlaceKey } from "./public";
import type { TravelerId } from "./travelers";

export type GroundKind = "car" | "bus" | "walk" | "rail" | "connector";
export type GroundRoutePlan = {
  from: PlaceKey;
  to: PlaceKey;
  day: DayNumber;
  mode: "DRIVE" | "WALK" | "TRANSIT";
  kind: GroundKind;
  label: string;
  color: string;
  travelerIds?: readonly TravelerId[];
  departureTime?: string;
  arrivalTime?: string;
  requiredLine?: string;
};

const walk = { mode: "WALK", kind: "walk", label: "도보", color: "#4A0DF0" } as const;
const bus = { mode: "TRANSIT", kind: "bus", label: "버스", color: "#F4430A" } as const;
const car = { mode: "DRIVE", kind: "car", label: "차량", color: "#00B84A" } as const;
const subway = { mode: "TRANSIT", kind: "rail" } as const;
const hibiya = { ...subway, label: "도쿄 메트로 히비야선", color: "#9CAEB7", requiredLine: "Hibiya|日比谷|히비야" };
const icheon = ["gyuyeol", "junsu"] as const;

// Transit times without a booking are search anchors, not promised departures.
// Each direction is queried independently; a road or rail polyline is never reversed to manufacture a return service.
export const GROUND_ROUTES = {
  "icheon-terminal": { ...car, from: "icheon", to: "icheonTerminal", day: 1, kind: "connector", label: "터미널 이동 · 수단 미정", travelerIds: icheon },
  "terminal-icn": { ...bus, from: "icheonTerminal", to: "incheon", day: 1, travelerIds: icheon, departureTime: "2026-10-02T04:40:00+09:00", requiredLine: "8829" },
  "mandeok-pus": { ...car, from: "mandeok", to: "busan", day: 1, travelerIds: ["daekyeom"], departureTime: "2026-10-02T06:00:00+09:00" },
  "suwon-gmp": { ...car, from: "suwon", to: "gimpo", day: 1, travelerIds: ["gyujun"], departureTime: "2026-10-02T06:45:00+09:00" },
  "kyoto-kiyomizu": { ...bus, from: "kyoto", to: "kiyomizu", day: 1, departureTime: "2026-10-02T13:30:00+09:00" },
  "kiyomizu-ginkaku": { ...bus, from: "kiyomizu", to: "ginkaku", day: 1, departureTime: "2026-10-02T15:00:00+09:00" },
  "ginkaku-kinkaku": { ...bus, from: "ginkaku", to: "kinkaku", day: 1, departureTime: "2026-10-02T16:00:00+09:00" },
  "kinkaku-kyoto": { ...bus, from: "kinkaku", to: "kyoto", day: 1, departureTime: "2026-10-02T17:00:00+09:00" },
  "kyoto-hotel": { ...walk, from: "kyoto", to: "nono", day: 1 },
  "hotel-kyoto": { ...walk, from: "nono", to: "kyoto", day: 2 },
  "odawara-ryuguden": { ...bus, mode: "DRIVE", label: "무료 셔틀버스 · 예상 경로", from: "odawara", to: "ryuguden", day: 2, departureTime: "2026-10-03T14:00:00+09:00" },
  "ryuguden-odawara": { ...bus, mode: "DRIVE", label: "무료 셔틀버스 · 예상 경로", from: "ryuguden", to: "odawara", day: 3, departureTime: "2026-10-04T10:30:00+09:00" },
  "ueno-aima": { ...walk, from: "ueno", to: "aima", day: 3 },
  "aima-tenkai": { ...walk, from: "aima", to: "tenkai", day: 3 },
  "tenkai-aima": { ...walk, from: "tenkai", to: "aima", day: 3 },
  "aima-ueno": { ...walk, from: "aima", to: "ueno", day: 4 },
  "ueno-nakameguro": { ...hibiya, from: "ueno", to: "nakameguro", day: 4, departureTime: "2026-10-05T07:00:00+09:00" },
  "nakameguro-roastery": { ...walk, from: "nakameguro", to: "roastery", day: 4 },
  "roastery-nakameguro": { ...walk, from: "roastery", to: "nakameguro", day: 4 },
  "nakameguro-roppongi": { ...hibiya, from: "nakameguro", to: "roppongi", day: 4, departureTime: "2026-10-05T10:00:00+09:00" },
  "roppongi-shinjuku": { ...subway, label: "都営 도에이 오에도선", color: "#B6007A", requiredLine: "Oedo|Ōedo|大江戸|오에도", from: "roppongi", to: "shinjuku", day: 4, departureTime: "2026-10-05T10:20:00+09:00" },
  "shinjuku-iwamotocho": { ...subway, label: "都営 도에이 신주쿠선", color: "#6CBB5A", requiredLine: "Shinjuku|新宿線|신주쿠선", from: "shinjuku", to: "iwamotocho", day: 4, departureTime: "2026-10-05T13:00:00+09:00" },
  "iwamotocho-akihabara": { ...walk, from: "iwamotocho", to: "akihabara", day: 4 },
  "akihabara-ginza": { ...hibiya, from: "akihabara", to: "ginza", day: 4, departureTime: "2026-10-05T17:30:00+09:00" },
  "ginza-ueno": { ...subway, label: "도쿄 메트로 긴자선", color: "#F39700", requiredLine: "Ginza|銀座|긴자", from: "ginza", to: "ueno", day: 4, departureTime: "2026-10-05T20:30:00+09:00" },
  "aima-keisei": { ...walk, from: "aima", to: "keiseiUeno", day: 5 },
  "icn2-suwon": { ...car, from: "incheon2", to: "suwon", day: 5, travelerIds: ["gyujun"], departureTime: "2026-10-06T16:30:00+09:00" },
  "icn2-terminal": { ...bus, from: "incheon2", to: "icheonTerminal", day: 5, travelerIds: icheon, departureTime: "2026-10-06T16:30:00+09:00", requiredLine: "8829" },
  "terminal-icheon": { ...car, kind: "connector", label: "터미널에서 귀가 · 수단 미정", from: "icheonTerminal", to: "icheon", day: 5, travelerIds: icheon },
  "pus-mandeok": { ...bus, label: "307번 버스", from: "busan", to: "mandeok", day: 5, travelerIds: ["daekyeom"], departureTime: "2026-10-06T20:15:00+09:00", requiredLine: "307" },
} as const satisfies Record<string, GroundRoutePlan>;

export type GroundRouteKey = keyof typeof GROUND_ROUTES;
export const GROUND_ROUTE_KEYS = Object.keys(GROUND_ROUTES) as GroundRouteKey[];

export function routePoint(key: PlaceKey) {
  const { latitude: lat, longitude: lng } = PUBLIC_TRIP_DEFINITION.places[key];
  return { lat, lng };
}
