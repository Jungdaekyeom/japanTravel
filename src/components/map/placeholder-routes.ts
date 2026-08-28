import { PUBLIC_TRIP_DEFINITION, type DayNumber, type PlaceKey, type PublicRailRoute } from "../../trip/public";
import type { PlaybackStage } from "./animation";

export type Coordinate = { lat: number; lng: number };
export type MapLine = {
  key: string;
  kind: "flight" | "rail" | "connector";
  path: readonly Coordinate[];
  dashed: boolean;
  label?: "경로 확정 전" | "철도 이동";
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

const rail = (key: string, path: readonly Coordinate[]): MapLine => ({ key, kind: "rail", path, dashed: true, label: "경로 확정 전" });

export const FULL_ROUTE_LINES: readonly MapLine[] = [
  { key: "pus-kix", kind: "flight", path: curve(place("busan"), place("kix"), 1.1), dashed: false },
  { key: "icn-kix", kind: "flight", path: curve(place("incheon"), place("kix"), 1.45), dashed: false },
  rail("kix-kyoto", [place("kix"), { lat: 34.6937, lng: 135.5023 }, place("kyoto")]),
  rail("kyoto-odawara", [place("kyoto"), { lat: 35.1709, lng: 136.8815 }, { lat: 35.1032, lng: 138.8599 }, place("odawara")]),
  { key: "odawara-hakone", kind: "connector", path: [place("odawara"), place("hakone")], dashed: true },
  rail("odawara-tokyo", [place("odawara"), { lat: 35.4437, lng: 139.638 }, place("tokyo")]),
  rail("tokyo-narita", [place("tokyo"), { lat: 35.7126, lng: 139.773 }, place("nrt")]),
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
  kyoto: { key: "kyoto", label: "교토", position: place("kyoto") },
  odawara: { key: "odawara", label: "오다와라", position: place("odawara") },
  hakone: { key: "hakone", label: "하코네", position: place("hakone") },
  tokyo: { key: "tokyo", label: "도쿄", position: place("tokyo") },
  asakusa: { key: "asakusa", label: "아사쿠사", position: { lat: 35.7148, lng: 139.7967 } },
  shibuya: { key: "shibuya", label: "시부야", position: { lat: 35.6595, lng: 139.7005 } },
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
    pins: dayPins("busan", "incheon", "kix", "kyoto"),
    stages: [
      { durationMs: 2400, lineKeys: ["pus-kix", "icn-kix"] },
      { durationMs: 1200, lineKeys: ["kix-kyoto"] },
    ],
  },
  2: {
    lines: lines("kyoto-odawara", "odawara-hakone"),
    pins: dayPins("odawara", "hakone"),
    stages: [
      { durationMs: 1400, lineKeys: ["kyoto-odawara"] },
      { durationMs: 450, pinKey: "odawara" },
      { durationMs: 450, pinKey: "hakone" },
    ],
  },
  3: { lines: lines("odawara-tokyo"), pins: dayPins("odawara", "tokyo"), stages: [{ durationMs: 1400, lineKeys: ["odawara-tokyo"] }] },
  4: {
    lines: [],
    pins: dayPins("tokyo", "asakusa", "shibuya"),
    stages: [
      { durationMs: 450, pinKey: "tokyo" },
      { durationMs: 450, pinKey: "asakusa" },
      { durationMs: 450, pinKey: "shibuya" },
    ],
  },
  5: { lines: lines("tokyo-narita"), pins: dayPins("tokyo", "nrt"), stages: [{ durationMs: 1400, lineKeys: ["tokyo-narita"] }] },
};

export function buildDayLayers(day: DayNumber, routeLines: readonly MapLine[] = FULL_ROUTE_LINES): DayLayers {
  const replacements = new Map(routeLines.map((line) => [line.key, line]));
  return { ...days[day], lines: days[day].lines.map((line) => replacements.get(line.key) ?? line) };
}
