import { PUBLIC_TRIP_DEFINITION, type DayNumber, type PlaceKey, type PublicRailRoute } from "../../trip/public";
import type { PlaybackStage } from "./animation";

export type Coordinate = { lat: number; lng: number };
export type MapLine = {
  key: string;
  kind: "car" | "flight" | "rail" | "connector";
  color: string;
  outlineColor?: string;
  pinKeys: readonly [PlaceKey, PlaceKey];
  path: readonly Coordinate[];
  dashed: boolean;
  label?: "경로 확정 전" | "철도 이동";
  transportLabel?: string;
  googleDerived?: true;
};
export type MapPin = { key: string; label: string; position: Coordinate };
export type DayLayers = { lines: readonly MapLine[]; pins: readonly MapPin[]; stages: readonly PlaybackStage[] };
const CAMERA_SETTLE_MS = 1000;
export type RouteSchedule = { departureAt: string | null; arrivalAt: string | null };

export const ROUTE_SCHEDULES = {
  "pus-kix": { departureAt: null, arrivalAt: null },
  "icn-kix": { departureAt: null, arrivalAt: null },
  "kyoto-odawara": { departureAt: null, arrivalAt: null },
  "tokyo-narita": { departureAt: null, arrivalAt: null },
  "nrt-pus": { departureAt: null, arrivalAt: null },
  "nrt-icn": { departureAt: null, arrivalAt: null },
} as const satisfies Record<string, RouteSchedule>;

function place(key: PlaceKey): Coordinate {
  const value = PUBLIC_TRIP_DEFINITION.places[key];
  return { lat: value.latitude, lng: value.longitude };
}

function curve(from: Coordinate, to: Coordinate, latitudeLift: number) {
  const control = { lat: (from.lat + to.lat) / 2 + latitudeLift, lng: (from.lng + to.lng) / 2 };
  return [0, 0.2, 0.4, 0.6, 0.8, 1].map((time) => {
    const remaining = 1 - time;
    return {
      lat: remaining * remaining * from.lat + 2 * remaining * time * control.lat + time * time * to.lat,
      lng: remaining * remaining * from.lng + 2 * remaining * time * control.lng + time * time * to.lng,
    };
  });
}

const KIX_KYOTO_PATH = [
  place("kix"),
  { lat: 34.4215, lng: 135.2700 },
  { lat: 34.4107, lng: 135.3000 },
  { lat: 34.3904, lng: 135.3314 },
  { lat: 34.4494, lng: 135.3858 },
  { lat: 34.4871, lng: 135.4235 },
  { lat: 34.5319, lng: 135.4582 },
  { lat: 34.6466, lng: 135.5133 },
  { lat: 34.7025, lng: 135.4959 },
  { lat: 34.7336, lng: 135.5001 },
  { lat: 34.8519, lng: 135.6173 },
  place("kyoto"),
] as const;

const KYOTO_ODAWARA_PATH = [
  place("kyoto"),
  { lat: 35.3147, lng: 136.2907 },
  { lat: 35.3157, lng: 136.6857 },
  { lat: 35.1709, lng: 136.8815 },
  { lat: 34.9690, lng: 137.0608 },
  { lat: 34.7627, lng: 137.3820 },
  { lat: 34.7038, lng: 137.7347 },
  { lat: 34.7690, lng: 138.0157 },
  { lat: 34.9717, lng: 138.3889 },
  { lat: 35.1420, lng: 138.6632 },
  { lat: 35.1264, lng: 138.9107 },
  { lat: 35.1033, lng: 139.0777 },
  place("odawara"),
] as const;

const ODAWARA_HAKONE_PATH = [
  place("odawara"),
  { lat: 35.2519, lng: 139.1510 },
  { lat: 35.2457, lng: 139.1455 },
  { lat: 35.2478, lng: 139.1262 },
  { lat: 35.2416, lng: 139.1201 },
  place("hakone"),
] as const;

const TOKYO_UENO_EXTENSION = [
  place("tokyo"),
  { lat: 35.6984, lng: 139.7731 },
  place("ueno"),
] as const;

const ODAWARA_UENO_PATH = [
  place("odawara"),
  { lat: 35.2818, lng: 139.2140 },
  { lat: 35.3276, lng: 139.3490 },
  { lat: 35.3306, lng: 139.4070 },
  { lat: 35.3389, lng: 139.4868 },
  { lat: 35.3535, lng: 139.5311 },
  { lat: 35.4000, lng: 139.5340 },
  { lat: 35.4658, lng: 139.6223 },
  { lat: 35.5314, lng: 139.6969 },
  { lat: 35.6285, lng: 139.7388 },
  ...TOKYO_UENO_EXTENSION,
] as const;

const UENO_NARITA_PATH = [
  place("ueno"),
  { lat: 35.7278, lng: 139.7709 },
  { lat: 35.7454, lng: 139.8560 },
  { lat: 35.7509, lng: 139.8667 },
  { lat: 35.7709, lng: 139.9436 },
  { lat: 35.7793, lng: 139.9988 },
  { lat: 35.8002, lng: 140.1164 },
  { lat: 35.7871, lng: 140.2030 },
  { lat: 35.8015, lng: 140.2915 },
  { lat: 35.7730, lng: 140.3874 },
  place("nrt"),
] as const;

const MANDEOK_PUS_PATH = [
  place("mandeok"),
  { lat: 35.2134, lng: 129.0070 },
  { lat: 35.2146, lng: 128.9899 },
  { lat: 35.2117, lng: 128.9760 },
  { lat: 35.2015, lng: 128.9655 },
  { lat: 35.1873, lng: 128.9630 },
  place("busan"),
] as const;

const SUWON_ICN_PATH = [
  place("suwon"),
  { lat: 37.2668, lng: 126.9590 },
  { lat: 37.3100, lng: 126.7900 },
  { lat: 37.3650, lng: 126.7000 },
  { lat: 37.3910, lng: 126.6320 },
  { lat: 37.4130, lng: 126.5660 },
  { lat: 37.4420, lng: 126.4810 },
  place("incheon"),
] as const;

const ICHEON_ICN_PATH = [
  place("icheon"),
  { lat: 37.2760, lng: 127.3500 },
  { lat: 37.2930, lng: 127.1900 },
  { lat: 37.2860, lng: 127.0500 },
  ...SUWON_ICN_PATH.slice(1),
] as const;

const rail = (key: string, pinKeys: readonly [PlaceKey, PlaceKey], path: readonly Coordinate[], transportLabel: string, color: string, outlineColor: string): MapLine => ({ key, kind: "rail", color, outlineColor, pinKeys, path, dashed: true, label: "경로 확정 전", transportLabel });

export const FULL_ROUTE_LINES: readonly MapLine[] = [
  { key: "mandeok-pus", kind: "car", color: "#00B84A", outlineColor: "#007A32", pinKeys: ["mandeok", "busan"], path: MANDEOK_PUS_PATH, dashed: false },
  { key: "suwon-icn", kind: "car", color: "#00B84A", outlineColor: "#007A32", pinKeys: ["suwon", "incheon"], path: SUWON_ICN_PATH, dashed: false },
  { key: "icheon-icn", kind: "car", color: "#00B84A", outlineColor: "#007A32", pinKeys: ["icheon", "incheon"], path: ICHEON_ICN_PATH, dashed: false },
  { key: "pus-kix", kind: "flight", color: "#2563EB", pinKeys: ["busan", "kix"], path: curve(place("busan"), place("kix"), 1.1), dashed: false },
  { key: "icn-kix", kind: "flight", color: "#2563EB", pinKeys: ["incheon", "kix"], path: curve(place("incheon"), place("kix"), 1.45), dashed: false },
  rail("kix-kyoto", ["kix", "kyoto"], KIX_KYOTO_PATH, "JR 하루카", "#005DCF", "#16427B"),
  rail("kyoto-odawara", ["kyoto", "odawara"], KYOTO_ODAWARA_PATH, "도카이도 신칸센", "#004DA1", "#0D355F"),
  { key: "odawara-hakone", kind: "connector", color: "#E85216", outlineColor: "#8B4222", pinKeys: ["odawara", "hakone"], path: ODAWARA_HAKONE_PATH, dashed: true, transportLabel: "하코네 등산선" },
  { key: "hakone-odawara", kind: "connector", color: "#E85216", outlineColor: "#8B4222", pinKeys: ["hakone", "odawara"], path: [...ODAWARA_HAKONE_PATH].reverse(), dashed: true, transportLabel: "하코네 등산선" },
  rail("odawara-tokyo", ["odawara", "ueno"], ODAWARA_UENO_PATH, "도카이도 본선", "#F18016", "#995A22"),
  rail("tokyo-narita", ["ueno", "nrt"], UENO_NARITA_PATH, "게이세이 스카이라이너", "#1B4786", "#1D3053"),
  { key: "nrt-pus", kind: "flight", color: "#2563EB", pinKeys: ["nrt", "busan"], path: curve(place("nrt"), place("busan"), 1.1), dashed: false },
  { key: "nrt-icn", kind: "flight", color: "#2563EB", pinKeys: ["nrt", "incheon"], path: curve(place("nrt"), place("incheon"), 1.45), dashed: false },
  { key: "pus-mandeok", kind: "car", color: "#00B84A", outlineColor: "#007A32", pinKeys: ["busan", "mandeok"], path: [...MANDEOK_PUS_PATH].reverse(), dashed: false },
  { key: "icn-suwon", kind: "car", color: "#00B84A", outlineColor: "#007A32", pinKeys: ["incheon", "suwon"], path: [...SUWON_ICN_PATH].reverse(), dashed: false },
  { key: "icn-icheon", kind: "car", color: "#00B84A", outlineColor: "#007A32", pinKeys: ["incheon", "icheon"], path: [...ICHEON_ICN_PATH].reverse(), dashed: false },
];

export function buildRouteLines(routes: readonly PublicRailRoute[]) {
  const finalized = new Map(routes.map((route) => [route.segmentKey, route]));
  return FULL_ROUTE_LINES.map((line): MapLine => {
    const route = line.kind === "rail" ? finalized.get(line.key as PublicRailRoute["segmentKey"]) : undefined;
    if (!route) return line;
    const path = route.geometry.map(([lat, lng]) => ({ lat, lng }));
    return {
      ...line,
      path: line.key === "odawara-tokyo" ? [...path, ...TOKYO_UENO_EXTENSION.slice(1)] : path,
      dashed: false,
      label: "철도 이동",
      googleDerived: true,
    };
  });
}

const pins: Record<string, MapPin> = {
  mandeok: { key: "mandeok", label: "정대겸 · 만덕", position: place("mandeok") },
  suwon: { key: "suwon", label: "한규준 · 수원역", position: place("suwon") },
  icheon: { key: "icheon", label: "이규열·박준수 · 이천역", position: place("icheon") },
  busan: { key: "busan", label: "PUS · 부산 출발", position: place("busan") },
  incheon: { key: "incheon", label: "ICN · 인천 출발", position: place("incheon") },
  kix: { key: "kix", label: "간사이국제공항", position: place("kix") },
  kyoto: { key: "kyoto", label: "교토역", position: place("kyoto") },
  kiyomizu: { key: "kiyomizu", label: "기요미즈데라", position: place("kiyomizu") },
  kinkaku: { key: "kinkaku", label: "금각사", position: place("kinkaku") },
  ginkaku: { key: "ginkaku", label: "은각사", position: place("ginkaku") },
  odawara: { key: "odawara", label: "오다와라역", position: place("odawara") },
  hakone: { key: "hakone", label: "하코네유모토역", position: place("hakone") },
  tokyo: { key: "tokyo", label: "도쿄역", position: place("tokyo") },
  ueno: { key: "ueno", label: "우에노역", position: place("ueno") },
  shinjuku: { key: "shinjuku", label: "신주쿠", position: place("shinjuku") },
  shibuya: { key: "shibuya", label: "시부야", position: place("shibuya") },
  akihabara: { key: "akihabara", label: "아키하바라", position: place("akihabara") },
  sensoji: { key: "sensoji", label: "센소지", position: place("sensoji") },
  ginza: { key: "ginza", label: "긴자", position: place("ginza") },
  nrt: { key: "nrt", label: "나리타국제공항", position: place("nrt") },
};

export const FULL_ROUTE_PINS = Object.values(pins);

function lines(...keys: string[]) {
  return keys.map((key) => FULL_ROUTE_LINES.find((line) => line.key === key) as MapLine);
}

function dayPins(...keys: string[]) {
  return keys.map((key) => pins[key]);
}

const days: Record<DayNumber, DayLayers> = {
  1: {
    lines: lines("mandeok-pus", "suwon-icn", "icheon-icn", "pus-kix", "icn-kix", "kix-kyoto"),
    pins: dayPins("mandeok", "suwon", "icheon", "busan", "incheon", "kix", "kyoto", "kiyomizu", "kinkaku", "ginkaku"),
    stages: [
      { durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["mandeok", "suwon", "icheon", "busan", "incheon"] },
      { durationMs: 1400, lineKeys: ["mandeok-pus", "suwon-icn", "icheon-icn"] },
      { durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["busan", "incheon", "kix"] },
      { durationMs: 2400, lineKeys: ["pus-kix", "icn-kix"] },
      { durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["kix", "kyoto"] },
      { durationMs: 1200, lineKeys: ["kix-kyoto"] },
      { durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["kyoto", "kiyomizu", "kinkaku", "ginkaku"] },
      { durationMs: 450, pinKey: "kiyomizu" },
      { durationMs: 450, pinKey: "kinkaku" },
      { durationMs: 450, pinKey: "ginkaku" },
      { durationMs: 450, pinKey: "kyoto" },
    ],
  },
  2: {
    lines: lines("kyoto-odawara", "odawara-hakone"),
    pins: dayPins("kyoto", "odawara", "hakone"),
    stages: [
      { durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["kyoto", "odawara"] },
      { durationMs: 1400, lineKeys: ["kyoto-odawara"] },
      { durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["odawara", "hakone"] },
      { durationMs: 1000, lineKeys: ["odawara-hakone"] },
    ],
  },
  3: {
    lines: lines("hakone-odawara", "odawara-tokyo"),
    pins: dayPins("hakone", "odawara", "ueno", "shinjuku", "shibuya"),
    stages: [
      { durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["hakone", "odawara"] },
      { durationMs: 1000, lineKeys: ["hakone-odawara"] },
      { durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["odawara", "ueno"] },
      { durationMs: 1400, lineKeys: ["odawara-tokyo"] },
      { durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["ueno", "shinjuku", "shibuya"] },
      { durationMs: 450, pinKey: "ueno" },
      { durationMs: 450, pinKey: "shinjuku" },
      { durationMs: 450, pinKey: "shibuya" },
    ],
  },
  4: {
    lines: [],
    pins: dayPins("akihabara", "sensoji", "ginza"),
    stages: [
      { durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["akihabara", "sensoji", "ginza"] },
      { durationMs: 450, pinKey: "akihabara" },
      { durationMs: 450, pinKey: "sensoji" },
      { durationMs: 450, pinKey: "ginza" },
    ],
  },
  5: {
    lines: lines("tokyo-narita", "nrt-pus", "nrt-icn", "pus-mandeok", "icn-suwon", "icn-icheon"),
    pins: dayPins("ueno", "nrt", "busan", "incheon", "mandeok", "suwon", "icheon"),
    stages: [
      { durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["ueno", "nrt"] },
      { durationMs: 1400, lineKeys: ["tokyo-narita"] },
      { durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["nrt", "busan", "incheon"] },
      { durationMs: 2400, lineKeys: ["nrt-pus", "nrt-icn"] },
      { durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["busan", "incheon", "mandeok", "suwon", "icheon"] },
      { durationMs: 1400, lineKeys: ["pus-mandeok", "icn-suwon", "icn-icheon"] },
    ],
  },
};

function stageTiming(stage: PlaybackStage, schedules: Readonly<Partial<Record<string, RouteSchedule>>>) {
  const scheduledKeys = (stage.lineKeys ?? []).filter((key) => key in schedules);
  const entries = scheduledKeys.flatMap((key) => {
    const schedule = schedules[key];
    const departure = Date.parse(schedule?.departureAt ?? "");
    const arrival = Date.parse(schedule?.arrivalAt ?? "");
    return Number.isFinite(departure) && arrival > departure ? [{ key, departure, arrival }] : [];
  });
  if (entries.length === 0 || entries.length !== scheduledKeys.length) return undefined;

  const firstDeparture = Math.min(...entries.map(({ departure }) => departure));
  const finalArrival = Math.max(...entries.map(({ arrival }) => arrival));
  const total = finalArrival - firstDeparture;
  return Object.fromEntries(entries.map(({ key, departure, arrival }) => [key, {
    delayMs: Math.round((departure - firstDeparture) / total * stage.durationMs),
    durationMs: Math.round((arrival - departure) / total * stage.durationMs),
  }]));
}

export function buildDayLayers(
  day: DayNumber,
  routeLines: readonly MapLine[] = FULL_ROUTE_LINES,
  schedules: Readonly<Partial<Record<string, RouteSchedule>>> = ROUTE_SCHEDULES,
): DayLayers {
  const replacements = new Map(routeLines.map((line) => [line.key, line]));
  return {
    ...days[day],
    lines: days[day].lines.map((line) => replacements.get(line.key) ?? line),
    stages: days[day].stages.map((stage) => {
      const lineTimings = stageTiming(stage, schedules);
      return lineTimings ? { ...stage, lineTimings } : stage;
    }),
  };
}
