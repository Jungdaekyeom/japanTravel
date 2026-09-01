import { PUBLIC_TRIP_DEFINITION, type DayNumber, type PlaceKey, type PublicRailRoute } from "../../trip/public";
import type { TravelerId } from "../../trip/travelers";
import type { PlaybackStage } from "./animation";

export type Coordinate = { lat: number; lng: number };
type TravelerScope = readonly TravelerId[] | null;
export type MapLine = {
  key: string;
  kind: "car" | "flight" | "rail" | "connector" | "bus" | "walk";
  color: string;
  outlineColor?: string;
  pinKeys: readonly [PlaceKey, PlaceKey];
  path: readonly Coordinate[];
  dashed: boolean;
  label?: "경로 확정 전" | "철도 이동";
  transportLabel?: string;
  googleDerived?: true;
  travelerIds: TravelerScope;
};
export type MapPin = { key: string; label?: string; position: Coordinate; travelerIds: TravelerScope };
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

const KYOTO_EKI_MAE = { lat: 34.986749, lng: 135.759158 };
const KIYOMIZU_MICHI = { lat: 34.997131, lng: 135.776828 };
const GION = { lat: 35.004565, lng: 135.777447 };
const GINKAKU_ARRIVAL = { lat: 35.026875, lng: 135.791730 };
const GINKAKU_DEPARTURE = { lat: 35.027973, lng: 135.790665 };
const KINKAKU_ARRIVAL = { lat: 35.039443, lng: 135.733350 };
const KINKAKU_DEPARTURE = { lat: 35.038642, lng: 135.733339 };

const KYOTO_KIYOMIZU_BUS_PATH = [
  place("kyoto"),
  KYOTO_EKI_MAE,
  { lat: 34.990154, lng: 135.759431 },
  { lat: 34.990240, lng: 135.766800 },
  { lat: 34.990230, lng: 135.775770 },
  KIYOMIZU_MICHI,
] as const;

const KYOTO_KIYOMIZU_WALK_PATH = [
  KIYOMIZU_MICHI,
  { lat: 34.997374, lng: 135.779312 },
  { lat: 34.996938, lng: 135.781547 },
  { lat: 34.995884, lng: 135.782751 },
  place("kiyomizu"),
] as const;

const KIYOMIZU_GION_WALK_PATH = [
  place("kiyomizu"),
  { lat: 34.996197, lng: 135.782581 },
  { lat: 34.998235, lng: 135.781252 },
  { lat: 35.000852, lng: 135.780208 },
  { lat: 35.002067, lng: 135.778144 },
  GION,
] as const;

const GION_GINKAKU_BUS_PATH = [
  GION,
  { lat: 35.010746, lng: 135.777209 },
  { lat: 35.017385, lng: 135.777591 },
  { lat: 35.020863, lng: 135.780642 },
  { lat: 35.021240, lng: 135.789650 },
  GINKAKU_ARRIVAL,
] as const;

const GINKAKU_ARRIVAL_WALK_PATH = [
  GINKAKU_ARRIVAL,
  { lat: 35.027463, lng: 135.793333 },
  { lat: 35.027697, lng: 135.796209 },
  place("ginkaku"),
] as const;

const GINKAKU_DEPARTURE_WALK_PATH = [
  place("ginkaku"),
  { lat: 35.027697, lng: 135.796209 },
  { lat: 35.027538, lng: 135.793145 },
  GINKAKU_DEPARTURE,
] as const;

const GINKAKU_KINKAKU_BUS_PATH = [
  GINKAKU_DEPARTURE,
  { lat: 35.034680, lng: 135.791072 },
  { lat: 35.041572, lng: 135.790145 },
  { lat: 35.045270, lng: 135.783085 },
  { lat: 35.044466, lng: 135.765124 },
  { lat: 35.044284, lng: 135.748830 },
  { lat: 35.041271, lng: 135.740207 },
  KINKAKU_ARRIVAL,
] as const;

const KINKAKU_ARRIVAL_WALK_PATH = [
  KINKAKU_ARRIVAL,
  { lat: 35.039625, lng: 135.731790 },
  place("kinkaku"),
] as const;

const KINKAKU_DEPARTURE_WALK_PATH = [
  place("kinkaku"),
  { lat: 35.039286, lng: 135.731638 },
  KINKAKU_DEPARTURE,
] as const;

const KINKAKU_KYOTO_BUS_PATH = [
  KINKAKU_DEPARTURE,
  { lat: 35.033401, lng: 135.732850 },
  { lat: 35.022881, lng: 135.732518 },
  { lat: 35.011796, lng: 135.732735 },
  { lat: 35.000123, lng: 135.733064 },
  { lat: 34.990143, lng: 135.733142 },
  { lat: 34.989857, lng: 135.742910 },
  { lat: 34.989452, lng: 135.752982 },
  KYOTO_EKI_MAE,
  place("kyoto"),
] as const;

const MANDEOK_PUS_PATH = [
  place("mandeok"),
  { lat: 35.209244, lng: 128.999829 },
  { lat: 35.204374, lng: 128.993858 },
  { lat: 35.210587, lng: 128.983969 },
  { lat: 35.211812, lng: 128.974049 },
  { lat: 35.204089, lng: 128.974081 },
  { lat: 35.189325, lng: 128.960637 },
  { lat: 35.180308, lng: 128.957887 },
  { lat: 35.169234, lng: 128.959683 },
  { lat: 35.164438, lng: 128.946997 },
  { lat: 35.167772, lng: 128.944855 },
  { lat: 35.162037, lng: 128.941030 },
  { lat: 35.162075, lng: 128.935399 },
  { lat: 35.176786, lng: 128.934474 },
  place("busan"),
] as const;

const SUWON_ICN_PATH = [
  place("suwon"),
  { lat: 37.263749, lng: 127.023637 },
  { lat: 37.260391, lng: 127.022287 },
  { lat: 37.264130, lng: 127.002094 },
  { lat: 37.258112, lng: 126.982077 },
  { lat: 37.262504, lng: 126.949054 },
  { lat: 37.281445, lng: 126.951206 },
  { lat: 37.290540, lng: 126.948568 },
  { lat: 37.304342, lng: 126.933762 },
  { lat: 37.335345, lng: 126.920681 },
  { lat: 37.368902, lng: 126.884159 },
  { lat: 37.393297, lng: 126.866118 },
  { lat: 37.393555, lng: 126.860120 },
  { lat: 37.397698, lng: 126.856619 },
  { lat: 37.389073, lng: 126.818206 },
  { lat: 37.388271, lng: 126.757802 },
  { lat: 37.380789, lng: 126.735472 },
  { lat: 37.380680, lng: 126.724320 },
  { lat: 37.389497, lng: 126.673031 },
  { lat: 37.408849, lng: 126.639275 },
  { lat: 37.404817, lng: 126.595748 },
  { lat: 37.409280, lng: 126.575315 },
  { lat: 37.423808, lng: 126.549620 },
  { lat: 37.470070, lng: 126.513006 },
  { lat: 37.487516, lng: 126.485424 },
  { lat: 37.499715, lng: 126.476050 },
  { lat: 37.493687, lng: 126.418958 },
  { lat: 37.486930, lng: 126.417470 },
  { lat: 37.472807, lng: 126.429547 },
  { lat: 37.468401, lng: 126.429710 },
  { lat: 37.468346, lng: 126.433660 },
  place("incheon"),
] as const;

const ICHEON_ICN_PATH = [
  place("icheon"),
  { lat: 37.276634, lng: 127.436674 },
  { lat: 37.291966, lng: 127.425387 },
  { lat: 37.293968, lng: 127.419941 },
  { lat: 37.304298, lng: 127.427250 },
  { lat: 37.302210, lng: 127.438040 },
  { lat: 37.312964, lng: 127.437662 },
  { lat: 37.322350, lng: 127.419333 },
  { lat: 37.351259, lng: 127.385582 },
  { lat: 37.370177, lng: 127.339253 },
  { lat: 37.372501, lng: 127.314456 },
  { lat: 37.390683, lng: 127.261463 },
  { lat: 37.396990, lng: 127.222260 },
  { lat: 37.402413, lng: 127.210304 },
  { lat: 37.403674, lng: 127.190332 },
  { lat: 37.414858, lng: 127.161356 },
  { lat: 37.425396, lng: 127.151180 },
  { lat: 37.428312, lng: 127.122183 },
  { lat: 37.418508, lng: 127.122986 },
  { lat: 37.409125, lng: 127.115787 },
  { lat: 37.406108, lng: 127.095441 },
  { lat: 37.395927, lng: 127.074064 },
  { lat: 37.392666, lng: 127.015687 },
  { lat: 37.379601, lng: 126.977646 },
  { lat: 37.381942, lng: 126.964387 },
  { lat: 37.377733, lng: 126.953085 },
  { lat: 37.379723, lng: 126.943727 },
  { lat: 37.368574, lng: 126.871572 },
  { lat: 37.374643, lng: 126.858503 },
  { lat: 37.389840, lng: 126.854314 },
  { lat: 37.397358, lng: 126.848904 },
  { lat: 37.388948, lng: 126.817090 },
  { lat: 37.388019, lng: 126.755429 },
  { lat: 37.380199, lng: 126.728871 },
  { lat: 37.389497, lng: 126.673031 },
  { lat: 37.408849, lng: 126.639275 },
  { lat: 37.404855, lng: 126.599028 },
  { lat: 37.407236, lng: 126.580495 },
  { lat: 37.422650, lng: 126.550904 },
  { lat: 37.470070, lng: 126.513006 },
  { lat: 37.487516, lng: 126.485424 },
  { lat: 37.499781, lng: 126.475786 },
  { lat: 37.493687, lng: 126.418958 },
  { lat: 37.486930, lng: 126.417470 },
  { lat: 37.472807, lng: 126.429547 },
  { lat: 37.468401, lng: 126.429710 },
  { lat: 37.468346, lng: 126.433660 },
  place("incheon"),
] as const;

const DAEKYEOM = ["daekyeom"] as const;
const INCHEON_TRAVELERS = ["gyuyeol", "junsu", "gyujun"] as const;
const ICHEON_TRAVELERS = ["gyuyeol", "junsu"] as const;
const GYUJUN = ["gyujun"] as const;

const rail = (key: string, pinKeys: readonly [PlaceKey, PlaceKey], path: readonly Coordinate[], transportLabel: string, color: string, outlineColor: string): MapLine => ({ key, kind: "rail", color, outlineColor, pinKeys, path, dashed: true, label: "경로 확정 전", transportLabel, travelerIds: null });
const kyotoLine = (key: string, kind: "bus" | "walk", pinKeys: readonly [PlaceKey, PlaceKey], path: readonly Coordinate[], transportLabel: string): MapLine => ({
  key,
  kind,
  ...(kind === "bus" ? { color: "#F4430A", outlineColor: "#BE5127" } : { color: "#4A0DF0", outlineColor: "#180096" }),
  pinKeys,
  path,
  dashed: kind === "walk",
  transportLabel,
  googleDerived: true,
  travelerIds: null,
});

export const FULL_ROUTE_LINES: readonly MapLine[] = [
  { key: "mandeok-pus", kind: "car", color: "#00B84A", outlineColor: "#007A32", pinKeys: ["mandeok", "busan"], path: MANDEOK_PUS_PATH, dashed: false, travelerIds: DAEKYEOM },
  { key: "suwon-icn", kind: "car", color: "#00B84A", outlineColor: "#007A32", pinKeys: ["suwon", "incheon"], path: SUWON_ICN_PATH, dashed: false, travelerIds: GYUJUN },
  { key: "icheon-icn", kind: "car", color: "#00B84A", outlineColor: "#007A32", pinKeys: ["icheon", "incheon"], path: ICHEON_ICN_PATH, dashed: false, travelerIds: ICHEON_TRAVELERS },
  { key: "pus-kix", kind: "flight", color: "#2563EB", pinKeys: ["busan", "kix"], path: curve(place("busan"), place("kix"), 1.1), dashed: false, travelerIds: DAEKYEOM },
  { key: "icn-kix", kind: "flight", color: "#2563EB", pinKeys: ["incheon", "kix"], path: curve(place("incheon"), place("kix"), 1.45), dashed: false, travelerIds: INCHEON_TRAVELERS },
  rail("kix-kyoto", ["kix", "kyoto"], KIX_KYOTO_PATH, "JR 하루카", "#005DCF", "#16427B"),
  kyotoLine("kyoto-kiyomizu-bus", "bus", ["kyoto", "kiyomizu"], KYOTO_KIYOMIZU_BUS_PATH, "교토 시버스 106·206"),
  kyotoLine("kyoto-kiyomizu-walk", "walk", ["kyoto", "kiyomizu"], KYOTO_KIYOMIZU_WALK_PATH, "도보"),
  kyotoLine("kiyomizu-ginkaku-walk-start", "walk", ["kiyomizu", "ginkaku"], KIYOMIZU_GION_WALK_PATH, "도보"),
  kyotoLine("kiyomizu-ginkaku-bus", "bus", ["kiyomizu", "ginkaku"], GION_GINKAKU_BUS_PATH, "교토 시버스 203"),
  kyotoLine("kiyomizu-ginkaku-walk-end", "walk", ["kiyomizu", "ginkaku"], GINKAKU_ARRIVAL_WALK_PATH, "도보"),
  kyotoLine("ginkaku-kinkaku-walk-start", "walk", ["ginkaku", "kinkaku"], GINKAKU_DEPARTURE_WALK_PATH, "도보"),
  kyotoLine("ginkaku-kinkaku-bus", "bus", ["ginkaku", "kinkaku"], GINKAKU_KINKAKU_BUS_PATH, "교토 시버스 204"),
  kyotoLine("ginkaku-kinkaku-walk-end", "walk", ["ginkaku", "kinkaku"], KINKAKU_ARRIVAL_WALK_PATH, "도보"),
  kyotoLine("kinkaku-kyoto-walk", "walk", ["kinkaku", "kyoto"], KINKAKU_DEPARTURE_WALK_PATH, "도보"),
  kyotoLine("kinkaku-kyoto-bus", "bus", ["kinkaku", "kyoto"], KINKAKU_KYOTO_BUS_PATH, "교토 시버스 205"),
  rail("kyoto-odawara", ["kyoto", "odawara"], KYOTO_ODAWARA_PATH, "도카이도 신칸센", "#004DA1", "#0D355F"),
  { key: "odawara-hakone", kind: "connector", color: "#E85216", outlineColor: "#8B4222", pinKeys: ["odawara", "hakone"], path: ODAWARA_HAKONE_PATH, dashed: true, transportLabel: "하코네 등산선", travelerIds: null },
  { key: "hakone-odawara", kind: "connector", color: "#E85216", outlineColor: "#8B4222", pinKeys: ["hakone", "odawara"], path: [...ODAWARA_HAKONE_PATH].reverse(), dashed: true, transportLabel: "하코네 등산선", travelerIds: null },
  rail("odawara-tokyo", ["odawara", "ueno"], ODAWARA_UENO_PATH, "JR 도카이도 본선 · 우쓰노미야선 직결", "#F18016", "#995A22"),
  rail("tokyo-narita", ["ueno", "nrt"], UENO_NARITA_PATH, "게이세이 스카이라이너", "#1B4786", "#1D3053"),
  { key: "nrt-pus", kind: "flight", color: "#2563EB", pinKeys: ["nrt", "busan"], path: curve(place("nrt"), place("busan"), 1.1), dashed: false, travelerIds: DAEKYEOM },
  { key: "nrt-icn", kind: "flight", color: "#2563EB", pinKeys: ["nrt", "incheon"], path: curve(place("nrt"), place("incheon"), 1.45), dashed: false, travelerIds: INCHEON_TRAVELERS },
  { key: "pus-mandeok", kind: "car", color: "#00B84A", outlineColor: "#007A32", pinKeys: ["busan", "mandeok"], path: [...MANDEOK_PUS_PATH].reverse(), dashed: false, travelerIds: DAEKYEOM },
  { key: "icn-suwon", kind: "car", color: "#00B84A", outlineColor: "#007A32", pinKeys: ["incheon", "suwon"], path: [...SUWON_ICN_PATH].reverse(), dashed: false, travelerIds: GYUJUN },
  { key: "icn-icheon", kind: "car", color: "#00B84A", outlineColor: "#007A32", pinKeys: ["incheon", "icheon"], path: [...ICHEON_ICN_PATH].reverse(), dashed: false, travelerIds: ICHEON_TRAVELERS },
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
  mandeok: { key: "mandeok", position: place("mandeok"), travelerIds: DAEKYEOM },
  suwon: { key: "suwon", position: place("suwon"), travelerIds: GYUJUN },
  icheon: { key: "icheon", position: place("icheon"), travelerIds: ICHEON_TRAVELERS },
  busan: { key: "busan", label: "김해국제공항", position: place("busan"), travelerIds: DAEKYEOM },
  incheon: { key: "incheon", label: "인천국제공항", position: place("incheon"), travelerIds: INCHEON_TRAVELERS },
  kix: { key: "kix", label: "간사이국제공항", position: place("kix"), travelerIds: null },
  kyoto: { key: "kyoto", label: "교토역", position: place("kyoto"), travelerIds: null },
  kiyomizu: { key: "kiyomizu", label: "기요미즈데라", position: place("kiyomizu"), travelerIds: null },
  kinkaku: { key: "kinkaku", label: "금각사", position: place("kinkaku"), travelerIds: null },
  ginkaku: { key: "ginkaku", label: "은각사", position: place("ginkaku"), travelerIds: null },
  odawara: { key: "odawara", label: "오다와라역", position: place("odawara"), travelerIds: null },
  hakone: { key: "hakone", label: "하코네유모토역", position: place("hakone"), travelerIds: null },
  tokyo: { key: "tokyo", label: "도쿄역", position: place("tokyo"), travelerIds: null },
  ueno: { key: "ueno", label: "우에노역", position: place("ueno"), travelerIds: null },
  shinjuku: { key: "shinjuku", label: "신주쿠", position: place("shinjuku"), travelerIds: null },
  shibuya: { key: "shibuya", label: "시부야", position: place("shibuya"), travelerIds: null },
  akihabara: { key: "akihabara", label: "아키하바라", position: place("akihabara"), travelerIds: null },
  sensoji: { key: "sensoji", label: "센소지", position: place("sensoji"), travelerIds: null },
  ginza: { key: "ginza", label: "긴자", position: place("ginza"), travelerIds: null },
  nrt: { key: "nrt", label: "나리타국제공항", position: place("nrt"), travelerIds: null },
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
    lines: lines(
      "mandeok-pus", "suwon-icn", "icheon-icn", "pus-kix", "icn-kix", "kix-kyoto",
      "kyoto-kiyomizu-bus", "kyoto-kiyomizu-walk",
      "kiyomizu-ginkaku-walk-start", "kiyomizu-ginkaku-bus", "kiyomizu-ginkaku-walk-end",
      "ginkaku-kinkaku-walk-start", "ginkaku-kinkaku-bus", "ginkaku-kinkaku-walk-end",
      "kinkaku-kyoto-walk", "kinkaku-kyoto-bus",
    ),
    pins: dayPins("mandeok", "suwon", "icheon", "busan", "incheon", "kix", "kyoto", "kiyomizu", "kinkaku", "ginkaku"),
    stages: [
      { durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["mandeok", "busan"] },
      { durationMs: 1400, lineKeys: ["mandeok-pus"] },
      { durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["suwon", "icheon", "incheon"] },
      { durationMs: 1400, lineKeys: ["suwon-icn", "icheon-icn"] },
      { durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["busan", "incheon", "kix"] },
      { durationMs: 2400, lineKeys: ["pus-kix", "icn-kix"] },
      { durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["kix", "kyoto"] },
      { durationMs: 1200, lineKeys: ["kix-kyoto"] },
      { durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["kyoto", "kiyomizu", "ginkaku", "kinkaku"] },
      {
        durationMs: 1200,
        lineKeys: ["kyoto-kiyomizu-bus", "kyoto-kiyomizu-walk"],
        lineTimings: {
          "kyoto-kiyomizu-bus": { delayMs: 0, durationMs: 700 },
          "kyoto-kiyomizu-walk": { delayMs: 700, durationMs: 500 },
        },
      },
      {
        durationMs: 1200,
        lineKeys: ["kiyomizu-ginkaku-walk-start", "kiyomizu-ginkaku-bus", "kiyomizu-ginkaku-walk-end"],
        lineTimings: {
          "kiyomizu-ginkaku-walk-start": { delayMs: 0, durationMs: 450 },
          "kiyomizu-ginkaku-bus": { delayMs: 450, durationMs: 500 },
          "kiyomizu-ginkaku-walk-end": { delayMs: 950, durationMs: 250 },
        },
      },
      {
        durationMs: 1200,
        lineKeys: ["ginkaku-kinkaku-walk-start", "ginkaku-kinkaku-bus", "ginkaku-kinkaku-walk-end"],
        lineTimings: {
          "ginkaku-kinkaku-walk-start": { delayMs: 0, durationMs: 150 },
          "ginkaku-kinkaku-bus": { delayMs: 150, durationMs: 900 },
          "ginkaku-kinkaku-walk-end": { delayMs: 1050, durationMs: 150 },
        },
      },
      {
        durationMs: 1200,
        lineKeys: ["kinkaku-kyoto-walk", "kinkaku-kyoto-bus"],
        lineTimings: {
          "kinkaku-kyoto-walk": { delayMs: 0, durationMs: 150 },
          "kinkaku-kyoto-bus": { delayMs: 150, durationMs: 1050 },
        },
      },
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
  selectedTravelerId: TravelerId | null = null,
): DayLayers {
  const replacements = new Map(routeLines.map((line) => [line.key, line]));
  const selectedLines = days[day].lines
    .map((line) => replacements.get(line.key) ?? line)
    .filter((line) => visibleTo(line.travelerIds, selectedTravelerId));
  const selectedPins = days[day].pins.filter((pin) => visibleTo(pin.travelerIds, selectedTravelerId));
  const lineKeys = new Set(selectedLines.map((line) => line.key));
  const pinKeys = new Set(selectedPins.map((pin) => pin.key));
  const stages = days[day].stages.flatMap((stage) => {
    const nextLineKeys = stage.lineKeys?.filter((key) => lineKeys.has(key));
    const nextFocusPinKeys = stage.focusPinKeys?.filter((key) => pinKeys.has(key));
    if (stage.lineKeys && nextLineKeys?.length === 0) return [];
    if (stage.focusPinKeys && nextFocusPinKeys?.length === 0) return [];
    if (stage.pinKey && !pinKeys.has(stage.pinKey)) return [];
    const filtered = {
      ...stage,
      ...(nextLineKeys ? { lineKeys: nextLineKeys } : {}),
      ...(nextFocusPinKeys ? { focusPinKeys: nextFocusPinKeys } : {}),
    };
    const lineTimings = stageTiming(filtered, schedules);
    return [lineTimings ? { ...filtered, lineTimings } : filtered];
  });
  return { lines: selectedLines, pins: selectedPins, stages };
}

function visibleTo(travelerIds: TravelerScope, selectedTravelerId: TravelerId | null) {
  return selectedTravelerId === null || travelerIds === null || travelerIds.includes(selectedTravelerId);
}
