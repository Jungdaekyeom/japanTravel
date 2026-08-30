import { PUBLIC_TRIP_DEFINITION, type DayNumber, type PlaceKey, type PublicRailRoute } from "../../trip/public";
import type { PlaybackStage } from "./animation";

export type Coordinate = { lat: number; lng: number };
export type MapLine = {
  key: string;
  kind: "flight" | "rail" | "connector";
  color: string;
  pinKeys: readonly [PlaceKey, PlaceKey];
  path: readonly Coordinate[];
  dashed: boolean;
  label?: "경로 확정 전" | "철도 이동";
  transportLabel?: string;
  googleDerived?: true;
};
export type MapPin = { key: string; label: string; position: Coordinate };
export type DayLayers = { lines: readonly MapLine[]; pins: readonly MapPin[]; stages: readonly PlaybackStage[] };

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

const rail = (key: string, pinKeys: readonly [PlaceKey, PlaceKey], path: readonly Coordinate[], transportLabel: string, color: string): MapLine => ({ key, kind: "rail", color, pinKeys, path, dashed: true, label: "경로 확정 전", transportLabel });

export const FULL_ROUTE_LINES: readonly MapLine[] = [
  { key: "pus-kix", kind: "flight", color: "#2563EB", pinKeys: ["busan", "kix"], path: curve(place("busan"), place("kix"), 1.1), dashed: false },
  { key: "icn-kix", kind: "flight", color: "#2563EB", pinKeys: ["incheon", "kix"], path: curve(place("incheon"), place("kix"), 1.45), dashed: false },
  rail("kix-kyoto", ["kix", "kyoto"], [place("kix"), { lat: 34.6937, lng: 135.5023 }, place("kyoto")], "JR 하루카", "#59CAF5"),
  rail("kyoto-odawara", ["kyoto", "odawara"], [place("kyoto"), { lat: 35.1709, lng: 136.8815 }, { lat: 35.1032, lng: 138.8599 }, place("odawara")], "신칸센", "#084EA2"),
  { key: "odawara-hakone", kind: "connector", color: "#F49D19", pinKeys: ["odawara", "hakone"], path: [place("odawara"), place("hakone")], dashed: true },
  { key: "hakone-odawara", kind: "connector", color: "#F49D19", pinKeys: ["hakone", "odawara"], path: [place("hakone"), place("odawara")], dashed: true },
  rail("odawara-tokyo", ["odawara", "tokyo"], [place("odawara"), { lat: 35.4437, lng: 139.638 }, place("tokyo")], "도카이도 본선", "#F68B1E"),
  rail("tokyo-ueno", ["tokyo", "ueno"], [place("tokyo"), { lat: 35.6984, lng: 139.7731 }, place("ueno")], "야마노테선", "#80C342"),
  rail("tokyo-narita", ["ueno", "nrt"], [place("ueno"), { lat: 35.7126, lng: 139.773 }, place("nrt")], "Keisei Skyliner", "#1D2B6E"),
  { key: "nrt-pus", kind: "flight", color: "#2563EB", pinKeys: ["nrt", "busan"], path: curve(place("nrt"), place("busan"), 1.1), dashed: false },
  { key: "nrt-icn", kind: "flight", color: "#2563EB", pinKeys: ["nrt", "incheon"], path: curve(place("nrt"), place("incheon"), 1.45), dashed: false },
];

export function buildRouteLines(routes: readonly PublicRailRoute[]) {
  const finalized = new Map(routes.map((route) => [route.segmentKey, route]));
  return FULL_ROUTE_LINES.map((line): MapLine => {
    const route = line.kind === "rail" ? finalized.get(line.key as PublicRailRoute["segmentKey"]) : undefined;
    return route ? {
      ...line,
      path: route.geometry.map(([lat, lng]) => ({ lat, lng })),
      dashed: false,
      label: "철도 이동",
      googleDerived: true,
    } : line;
  });
}

const pins: Record<string, MapPin> = {
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
    lines: lines("pus-kix", "icn-kix", "kix-kyoto"),
    pins: dayPins("busan", "incheon", "kix", "kyoto", "kiyomizu", "kinkaku", "ginkaku"),
    stages: [
      { durationMs: 2400, lineKeys: ["pus-kix", "icn-kix"] },
      { durationMs: 350, focusPinKeys: ["kix", "kyoto"] },
      { durationMs: 1200, lineKeys: ["kix-kyoto"] },
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
      { durationMs: 1400, lineKeys: ["kyoto-odawara"] },
      { durationMs: 1000, lineKeys: ["odawara-hakone"] },
    ],
  },
  3: {
    lines: lines("hakone-odawara", "odawara-tokyo", "tokyo-ueno"),
    pins: dayPins("hakone", "odawara", "tokyo", "ueno", "shinjuku", "shibuya"),
    stages: [
      { durationMs: 1000, lineKeys: ["hakone-odawara"] },
      { durationMs: 1400, lineKeys: ["odawara-tokyo"] },
      { durationMs: 1000, lineKeys: ["tokyo-ueno"] },
      { durationMs: 450, pinKey: "ueno" },
      { durationMs: 450, pinKey: "shinjuku" },
      { durationMs: 450, pinKey: "shibuya" },
    ],
  },
  4: {
    lines: [],
    pins: dayPins("akihabara", "sensoji", "ginza"),
    stages: [
      { durationMs: 450, pinKey: "akihabara" },
      { durationMs: 450, pinKey: "sensoji" },
      { durationMs: 450, pinKey: "ginza" },
    ],
  },
  5: {
    lines: lines("tokyo-narita", "nrt-pus", "nrt-icn"),
    pins: dayPins("ueno", "nrt", "busan", "incheon"),
    stages: [
      { durationMs: 1400, lineKeys: ["tokyo-narita"] },
      { durationMs: 2400, lineKeys: ["nrt-pus", "nrt-icn"] },
    ],
  },
};

export function buildDayLayers(day: DayNumber, routeLines: readonly MapLine[] = FULL_ROUTE_LINES): DayLayers {
  const replacements = new Map(routeLines.map((line) => [line.key, line]));
  return { ...days[day], lines: days[day].lines.map((line) => replacements.get(line.key) ?? line) };
}
