import { PUBLIC_TRIP_DEFINITION, type DayNumber, type PlaceKey, type PublicRailRoute, type PublicGroundRoute } from "../../trip/public";
import { GROUND_ROUTES, GROUND_ROUTE_KEYS, type GroundKind, type GroundRouteKey, type GroundRoutePlan } from "../../trip/ground-routes";
import type { TravelerId } from "../../trip/travelers";
import type { PlaybackStage } from "./animation";

export type Coordinate = { lat: number; lng: number };
type TravelerScope = readonly TravelerId[] | null;
export type MapLine = {
  key: string;
  routeKey?: GroundRouteKey;
  verifiedAt?: string;
  kind: "car" | "flight" | "rail" | "connector" | "bus" | "walk";
  color: string;
  outlineColor?: string;
  pinKeys: readonly [PlaceKey, PlaceKey];
  path: readonly Coordinate[];
  dashed: boolean;
  label?: "경로 확정 전" | "경로 확인 중" | "철도 이동";
  transportLabel?: string;
  googleDerived?: true;
  travelerIds: TravelerScope;
};
export type MapPin = { key: PlaceKey; label?: string; position: Coordinate; travelerIds: TravelerScope };
export type DayLayers = { lines: readonly MapLine[]; pins: readonly MapPin[]; stages: readonly PlaybackStage[] };
const CAMERA_SETTLE_MS = 1000;
export type RouteSchedule = { departureAt: string | null; arrivalAt: string | null };

export const ROUTE_SCHEDULES = {
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
  place("keiseiUeno"),
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



// Naver driving snapshots, 2026-09-07. Original road vertices simplified offline within 20 m.
// Sources and live-time caveats are recorded in docs/SESSION_HANDOFF.md; no runtime routing.
const SUWON_GMP_PATH = [
  place("suwon"),
  { lat: 37.2634578, lng: 127.028239 },
  { lat: 37.2630784, lng: 127.0278241 },
  { lat: 37.2629083, lng: 127.0283383 },
  { lat: 37.2626922, lng: 127.0281772 },
  { lat: 37.2637494, lng: 127.0236369 },
  { lat: 37.2603908, lng: 127.0222867 },
  { lat: 37.2626755, lng: 127.013797 },
  { lat: 37.2638129, lng: 127.0065639 },
  { lat: 37.2641304, lng: 127.0020935 },
  { lat: 37.2585801, lng: 126.9857658 },
  { lat: 37.2581116, lng: 126.9820768 },
  { lat: 37.2586739, lng: 126.9773208 },
  { lat: 37.2609288, lng: 126.9685302 },
  { lat: 37.2618424, lng: 126.9512566 },
  { lat: 37.2621311, lng: 126.9497568 },
  { lat: 37.2627999, lng: 126.9487742 },
  { lat: 37.2654578, lng: 126.9487119 },
  { lat: 37.2786785, lng: 126.9504722 },
  { lat: 37.2814447, lng: 126.9512057 },
  { lat: 37.2821381, lng: 126.9510562 },
  { lat: 37.2840284, lng: 126.9497215 },
  { lat: 37.2890266, lng: 126.9489473 },
  { lat: 37.2923964, lng: 126.9476828 },
  { lat: 37.2948871, lng: 126.9456021 },
  { lat: 37.2999432, lng: 126.9376193 },
  { lat: 37.3016347, lng: 126.9358228 },
  { lat: 37.3043425, lng: 126.9337624 },
  { lat: 37.3072172, lng: 126.9324748 },
  { lat: 37.3196009, lng: 126.9288412 },
  { lat: 37.3333332, lng: 126.9219292 },
  { lat: 37.3375574, lng: 126.9190453 },
  { lat: 37.3509081, lng: 126.9049857 },
  { lat: 37.3671979, lng: 126.8857815 },
  { lat: 37.3717306, lng: 126.8817532 },
  { lat: 37.3802534, lng: 126.8758075 },
  { lat: 37.3861342, lng: 126.8693944 },
  { lat: 37.3884569, lng: 126.8673619 },
  { lat: 37.3914708, lng: 126.8654545 },
  { lat: 37.3945408, lng: 126.8640899 },
  { lat: 37.4118962, lng: 126.8575169 },
  { lat: 37.4133352, lng: 126.85776 },
  { lat: 37.4145068, lng: 126.8593852 },
  { lat: 37.4147839, lng: 126.8664784 },
  { lat: 37.4155264, lng: 126.8691413 },
  { lat: 37.4166661, lng: 126.8714156 },
  { lat: 37.4237948, lng: 126.8792187 },
  { lat: 37.4302914, lng: 126.8888222 },
  { lat: 37.4326583, lng: 126.8914332 },
  { lat: 37.4357653, lng: 126.8940588 },
  { lat: 37.4368043, lng: 126.8955854 },
  { lat: 37.4405964, lng: 126.897367 },
  { lat: 37.4420725, lng: 126.8976525 },
  { lat: 37.4527501, lng: 126.8929212 },
  { lat: 37.4563708, lng: 126.8909754 },
  { lat: 37.4724495, lng: 126.8775397 },
  { lat: 37.4765683, lng: 126.8747313 },
  { lat: 37.4812841, lng: 126.8723349 },
  { lat: 37.4874118, lng: 126.8701774 },
  { lat: 37.4930903, lng: 126.8691739 },
  { lat: 37.4930432, lng: 126.8681053 },
  { lat: 37.4925995, lng: 126.8677368 },
  { lat: 37.4941426, lng: 126.8537417 },
  { lat: 37.4944654, lng: 126.8524436 },
  { lat: 37.4954063, lng: 126.8510983 },
  { lat: 37.4999992, lng: 126.8474395 },
  { lat: 37.5216034, lng: 126.8373596 },
  { lat: 37.5359572, lng: 126.8283859 },
  { lat: 37.5440879, lng: 126.8221786 },
  { lat: 37.5470081, lng: 126.8210666 },
  { lat: 37.5492578, lng: 126.8196367 },
  { lat: 37.5579649, lng: 126.808642 },
  { lat: 37.561735, lng: 126.8072303 },
  { lat: 37.5623103, lng: 126.8028318 },
  { lat: 37.5629422, lng: 126.801765 },
  { lat: 37.5643406, lng: 126.8016908 },
  { lat: 37.5656095, lng: 126.8033321 },
  { lat: 37.5658661, lng: 126.8043556 },
  { lat: 37.5665528, lng: 126.8043436 },
  { lat: 37.5668178, lng: 126.8037251 },
  { lat: 37.5666444, lng: 126.802916 },
  { lat: 37.5654784, lng: 126.8014333 },
  place("gimpo"),
] as const;



const DAEKYEOM = ["daekyeom"] as const;
const CAPITAL_TRAVELERS = ["gyuyeol", "junsu", "gyujun"] as const;
const ICHEON_TRAVELERS = ["gyuyeol", "junsu"] as const;
const GYUJUN = ["gyujun"] as const;

const fallbackGroundPaths: Partial<Record<GroundRouteKey, readonly { kind: GroundKind; path: readonly Coordinate[] }[]>> = {
  "mandeok-pus": [{ kind: "car", path: MANDEOK_PUS_PATH }],
  "suwon-gmp": [{ kind: "car", path: SUWON_GMP_PATH }],
  "kyoto-kiyomizu": [{ kind: "bus", path: KYOTO_KIYOMIZU_BUS_PATH }, { kind: "walk", path: KYOTO_KIYOMIZU_WALK_PATH }],
  "kiyomizu-ginkaku": [{ kind: "walk", path: KIYOMIZU_GION_WALK_PATH }, { kind: "bus", path: GION_GINKAKU_BUS_PATH }, { kind: "walk", path: GINKAKU_ARRIVAL_WALK_PATH }],
  "ginkaku-kinkaku": [{ kind: "walk", path: GINKAKU_DEPARTURE_WALK_PATH }, { kind: "bus", path: GINKAKU_KINKAKU_BUS_PATH }, { kind: "walk", path: KINKAKU_ARRIVAL_WALK_PATH }],
  "kinkaku-kyoto": [{ kind: "walk", path: KINKAKU_DEPARTURE_WALK_PATH }, { kind: "bus", path: KINKAKU_KYOTO_BUS_PATH }],
};

function groundLines(key: GroundRouteKey, verified?: PublicGroundRoute): MapLine[] {
  const plan: GroundRoutePlan = GROUND_ROUTES[key];
  const steps = verified?.steps.map(({ kind, geometry }) => ({ kind, path: geometry.map(([lat, lng]) => ({ lat, lng })) }))
    ?? fallbackGroundPaths[key]
    ?? [{ kind: plan.kind, path: [place(plan.from), place(plan.to)] }];
  return steps.map(({ kind, path }, index) => ({
    key: steps.length === 1 ? key : `${key}-step-${index}`,
    routeKey: key,
    kind,
    color: kind === "walk" ? "#4A0DF0" : plan.color,
    pinKeys: [plan.from, plan.to],
    path,
    dashed: !verified,
    label: verified ? undefined : "경로 확인 중",
    transportLabel: kind === "walk" ? "도보" : plan.label,
    travelerIds: plan.travelerIds ?? null,
    ...(verified ? { googleDerived: true, verifiedAt: verified.verifiedAt } : {}),
  }));
}

const rail = (key: string, pinKeys: readonly [PlaceKey, PlaceKey], path: readonly Coordinate[], transportLabel: string, color: string, outlineColor: string): MapLine => ({
  key, kind: "rail", color, outlineColor, pinKeys, path, dashed: true, label: "경로 확정 전", transportLabel, travelerIds: null,
});

const transportLines: readonly MapLine[] = [
  { key: "pus-kix", kind: "flight", color: "#2563EB", pinKeys: ["busan", "kix"], path: curve(place("busan"), place("kix"), 1.1), dashed: false, travelerIds: DAEKYEOM, transportLabel: "에어부산" },
  { key: "gmp-kix", kind: "flight", color: "#2563EB", pinKeys: ["gimpo", "kix"], path: curve(place("gimpo"), place("kix"), 1.45), dashed: false, travelerIds: GYUJUN, transportLabel: "대한항공" },
  rail("kix-kyoto", ["kix", "kyoto"], KIX_KYOTO_PATH, "JR 하루카", "#005DCF", "#16427B"),
  rail("kyoto-odawara", ["kyoto", "odawara"], KYOTO_ODAWARA_PATH, "Hikari 646 · 도카이도 신칸센", "#004DA1", "#0D355F"),
  rail("odawara-tokyo", ["odawara", "ueno"], ODAWARA_UENO_PATH, "JR 도카이도선 · 우에노도쿄라인", "#F18016", "#995A22"),
  rail("tokyo-narita", ["keiseiUeno", "nrt"], UENO_NARITA_PATH, "게이세이 스카이라이너", "#1B4786", "#1D3053"),
  { key: "nrt-pus", kind: "flight", color: "#2563EB", pinKeys: ["nrt", "busan"], path: curve(place("nrt"), place("busan"), 1.1), dashed: false, travelerIds: DAEKYEOM, transportLabel: "진에어" },
  { key: "nrt-icn", kind: "flight", color: "#2563EB", pinKeys: ["nrt", "incheon2"], path: curve(place("nrt"), place("incheon2"), 1.45), dashed: false, travelerIds: CAPITAL_TRAVELERS, transportLabel: "아시아나" },
];

export const FULL_ROUTE_LINES: readonly MapLine[] = [
  ...GROUND_ROUTE_KEYS.flatMap((key) => groundLines(key)),
  ...transportLines,
];

export function buildRouteLines(routes: readonly PublicRailRoute[], groundRoutes: readonly PublicGroundRoute[] = []) {
  const finalized = new Map(routes.map((route) => [route.segmentKey, route]));
  const ground = new Map(groundRoutes.map((route) => [route.segmentKey, route]));
  return [
    ...GROUND_ROUTE_KEYS.flatMap((key) => groundLines(key, ground.get(key))),
    ...transportLines.map((line): MapLine => {
      const route = line.kind === "rail" ? finalized.get(line.key as PublicRailRoute["segmentKey"]) : undefined;
      if (!route) return line;
      return { ...line, path: route.geometry.map(([lat, lng]) => ({ lat, lng })), dashed: false, label: "철도 이동", googleDerived: true };
    }),
  ];
}

const hiddenLabels = new Set(["mandeok", "suwon", "icheon"]);
const pinTravelers: Partial<Record<PlaceKey, TravelerScope>> = {
  mandeok: DAEKYEOM, busan: DAEKYEOM, suwon: GYUJUN, gimpo: GYUJUN,
  icheon: ICHEON_TRAVELERS, icheonTerminal: ICHEON_TRAVELERS,
  incheon: ICHEON_TRAVELERS, incheon2: CAPITAL_TRAVELERS,
};
export const FULL_ROUTE_PINS: readonly MapPin[] = [...new Set(FULL_ROUTE_LINES.flatMap((line) => line.pinKeys))].map((key) => ({
  key, position: place(key), travelerIds: pinTravelers[key] ?? null,
  ...(hiddenLabels.has(key) ? {} : { label: PUBLIC_TRIP_DEFINITION.places[key].name }),
}));

export function buildDayLayers(
  day: DayNumber,
  routeLines: readonly MapLine[] = FULL_ROUTE_LINES,
  _schedules: Readonly<Partial<Record<string, RouteSchedule>>> = ROUTE_SCHEDULES,
  selectedTravelerId: TravelerId | null = null,
): DayLayers {
  const selectedLines: MapLine[] = [];
  const stages: PlaybackStage[] = [];
  const byRoute = (key: string) => routeLines.filter((line) => (line.routeKey ?? line.key) === key && visibleTo(line.travelerIds, selectedTravelerId));
  const focus = (...keys: PlaceKey[]) => {
    const valid = keys.filter((key) => visibleTo(pinTravelers[key] ?? null, selectedTravelerId));
    if (valid.length) stages.push({ durationMs: CAMERA_SETTLE_MS, focusPinKeys: valid });
  };
  const move = (...keys: string[]) => {
    const active = keys.flatMap(byRoute);
    if (!active.length) return;
    for (const line of active) if (!selectedLines.includes(line)) selectedLines.push(line);
    stages.push({ durationMs: 1, lineKeys: active.map((line) => line.key), sequential: true });
  };
  const journey = (key: string) => {
    const active = byRoute(key);
    if (!active.length) return;
    focus(...active[0].pinKeys);
    move(key);
  };
  switch (day) {
    case 1:
      journey("icheon-terminal");
      journey("terminal-icn");
      journey("mandeok-pus");
      journey("suwon-gmp");
      if (byRoute("pus-kix").length || byRoute("gmp-kix").length) {
        focus("busan", "gimpo", "kix");
        const flights = [...byRoute("pus-kix"), ...byRoute("gmp-kix")];
        selectedLines.push(...flights);
        stages.push({
          durationMs: 1, lineKeys: flights.map((line) => line.key),
          // Preserve departure order/overlap; visual durations come from distance, not a simulated wall clock.
          lineTimings: flights.length === 2 ? { "gmp-kix": { delayMs: 45 / 95 } } : undefined,
        });
      }
      journey("kix-kyoto");
      focus("kyoto", "kiyomizu", "ginkaku", "kinkaku");
      move("kyoto-kiyomizu");
      move("kiyomizu-ginkaku");
      move("ginkaku-kinkaku");
      move("kinkaku-kyoto");
      journey("kyoto-hotel");
      break;
    case 2:
      journey("hotel-kyoto");
      journey("kyoto-odawara");
      journey("odawara-ryuguden");
      break;
    case 3:
      journey("ryuguden-odawara");
      journey("odawara-tokyo");
      journey("ueno-aima");
      focus("aima", "tenkai");
      move("aima-tenkai");
      stages.push({ durationMs: 450, pinKey: "tenkai" });
      move("tenkai-aima");
      break;
    case 4:
      journey("aima-ueno");
      journey("ueno-nakameguro");
      journey("nakameguro-roastery");
      focus("roastery", "nakameguro", "roppongi", "shinjuku");
      move("roastery-nakameguro", "nakameguro-roppongi", "roppongi-shinjuku");
      focus("shinjuku", "iwamotocho", "akihabara");
      move("shinjuku-iwamotocho", "iwamotocho-akihabara");
      journey("akihabara-ginza");
      journey("ginza-ueno");
      journey("ueno-aima");
      break;
    case 5:
      journey("aima-keisei");
      journey("tokyo-narita");
      if (byRoute("nrt-icn").length) {
        focus("nrt", "busan", "incheon2");
        move("nrt-icn");
        focus("incheon2", "suwon", "icheonTerminal");
        const homebound = [...byRoute("icn2-suwon"), ...byRoute("icn2-terminal")];
        selectedLines.push(...homebound);
        stages.push({ durationMs: 1, lineKeys: homebound.map((line) => line.key) });
        journey("terminal-icheon");
      }
      if (byRoute("nrt-pus").length) {
        focus("nrt", "busan", "incheon2");
        move("nrt-pus");
        journey("pus-mandeok");
      }
      break;
  }
  const pinKeys = new Set(selectedLines.flatMap((line) => line.pinKeys));
  const selectedPins = FULL_ROUTE_PINS.filter((pin) => pinKeys.has(pin.key) && visibleTo(pin.travelerIds, selectedTravelerId));
  return { lines: selectedLines, pins: selectedPins, stages };
}

function visibleTo(travelerIds: TravelerScope, selectedTravelerId: TravelerId | null) {
  return selectedTravelerId === null || travelerIds === null || travelerIds.includes(selectedTravelerId);
}
