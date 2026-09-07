import { DAY1_SCHEDULES, PUBLIC_TRIP_DEFINITION, type DayNumber, type PlaceKey, type PublicRailRoute } from "../../trip/public";
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
  "kyoto-odawara": { departureAt: null, arrivalAt: null },
  "tokyo-narita": { departureAt: null, arrivalAt: null },
  "nrt-pus": { departureAt: null, arrivalAt: null },
  "nrt-icn": { departureAt: null, arrivalAt: null },
} as const satisfies Record<string, RouteSchedule>;

const MORNING_CLOCK = [
  { elapsedMs: 0, minuteOfDay: DAY1_SCHEDULES["mandeok-pus"].departureMinute },
  { elapsedMs: 7000, minuteOfDay: DAY1_SCHEDULES["suwon-gmp"].arrivalMinute },
  { elapsedMs: 7800, minuteOfDay: DAY1_SCHEDULES["pus-kix"].departureMinute },
  { elapsedMs: 13600, minuteOfDay: DAY1_SCHEDULES["gmp-kix"].arrivalMinute },
] as const;

function morningElapsed(minute: number) {
  const endIndex = MORNING_CLOCK.findIndex((point) => point.minuteOfDay >= minute);
  if (endIndex <= 0) return endIndex === 0 ? 0 : MORNING_CLOCK.at(-1)!.elapsedMs;
  const from = MORNING_CLOCK[endIndex - 1];
  const to = MORNING_CLOCK[endIndex];
  return Math.round(from.elapsedMs + (minute - from.minuteOfDay) / (to.minuteOfDay - from.minuteOfDay) * (to.elapsedMs - from.elapsedMs));
}

const MORNING_LINE_TIMINGS = Object.fromEntries(Object.entries(DAY1_SCHEDULES).map(([key, schedule]) => {
  const delayMs = morningElapsed(schedule.departureMinute);
  return [key, { delayMs, durationMs: morningElapsed(schedule.arrivalMinute) - delayMs }];
}));

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

const ICHEON_GMP_PATH = [
  place("icheon"),
  { lat: 37.272376, lng: 127.434766 },
  { lat: 37.2724126, lng: 127.4340858 },
  { lat: 37.2730058, lng: 127.434268 },
  { lat: 37.2734111, lng: 127.433645 },
  { lat: 37.2741341, lng: 127.4336974 },
  { lat: 37.2740841, lng: 127.4345547 },
  { lat: 37.2763676, lng: 127.434996 },
  { lat: 37.2769837, lng: 127.4359362 },
  { lat: 37.2766335, lng: 127.4366742 },
  { lat: 37.2787831, lng: 127.4346115 },
  { lat: 37.291966, lng: 127.425387 },
  { lat: 37.2930583, lng: 127.4235492 },
  { lat: 37.2939681, lng: 127.4199412 },
  { lat: 37.2962211, lng: 127.4206135 },
  { lat: 37.2986162, lng: 127.4219887 },
  { lat: 37.3003183, lng: 127.4252727 },
  { lat: 37.3019163, lng: 127.4264864 },
  { lat: 37.3030665, lng: 127.4264999 },
  { lat: 37.3042983, lng: 127.4272503 },
  { lat: 37.3040188, lng: 127.4316479 },
  { lat: 37.3022096, lng: 127.4380396 },
  { lat: 37.3069464, lng: 127.4379285 },
  { lat: 37.3105949, lng: 127.4372743 },
  { lat: 37.312964, lng: 127.4376617 },
  { lat: 37.3141162, lng: 127.4348529 },
  { lat: 37.321471, lng: 127.4205385 },
  { lat: 37.3230678, lng: 127.4184995 },
  { lat: 37.3408072, lng: 127.4008314 },
  { lat: 37.3458566, lng: 127.3923784 },
  { lat: 37.3512586, lng: 127.3855825 },
  { lat: 37.3553763, lng: 127.3768319 },
  { lat: 37.358598, lng: 127.3710383 },
  { lat: 37.3610951, lng: 127.3640439 },
  { lat: 37.3653262, lng: 127.3549147 },
  { lat: 37.3701771, lng: 127.3392531 },
  { lat: 37.3713133, lng: 127.3324392 },
  { lat: 37.3723173, lng: 127.3159744 },
  { lat: 37.3734723, lng: 127.3104926 },
  { lat: 37.3754293, lng: 127.3055248 },
  { lat: 37.378906, lng: 127.2996626 },
  { lat: 37.3803866, lng: 127.296252 },
  { lat: 37.3826283, lng: 127.2870376 },
  { lat: 37.3906829, lng: 127.2614632 },
  { lat: 37.3913937, lng: 127.2572946 },
  { lat: 37.3926027, lng: 127.2420416 },
  { lat: 37.3956766, lng: 127.2304328 },
  { lat: 37.3969899, lng: 127.2222596 },
  { lat: 37.3979677, lng: 127.2194722 },
  { lat: 37.4013771, lng: 127.2136181 },
  { lat: 37.4024128, lng: 127.2103036 },
  { lat: 37.4027837, lng: 127.206838 },
  { lat: 37.4025976, lng: 127.1959455 },
  { lat: 37.4032966, lng: 127.1915893 },
  { lat: 37.4044384, lng: 127.1883994 },
  { lat: 37.4096555, lng: 127.1776373 },
  { lat: 37.4111314, lng: 127.1731708 },
  { lat: 37.4126777, lng: 127.1662167 },
  { lat: 37.4140615, lng: 127.1627933 },
  { lat: 37.4170091, lng: 127.1584145 },
  { lat: 37.423716, lng: 127.1518504 },
  { lat: 37.4253185, lng: 127.1484455 },
  { lat: 37.4261293, lng: 127.1432167 },
  { lat: 37.4260179, lng: 127.1406391 },
  { lat: 37.4219964, lng: 127.1305569 },
  { lat: 37.4215494, lng: 127.128266 },
  { lat: 37.4224784, lng: 127.1121937 },
  { lat: 37.4223468, lng: 127.1018918 },
  { lat: 37.4242317, lng: 127.098993 },
  { lat: 37.4316376, lng: 127.0823899 },
  { lat: 37.4331996, lng: 127.0803364 },
  { lat: 37.4353577, lng: 127.0783745 },
  { lat: 37.4378215, lng: 127.0769646 },
  { lat: 37.4403753, lng: 127.0762573 },
  { lat: 37.4434649, lng: 127.0761687 },
  { lat: 37.4501329, lng: 127.0781039 },
  { lat: 37.4519994, lng: 127.0782789 },
  { lat: 37.4544435, lng: 127.0776636 },
  { lat: 37.4587505, lng: 127.0752298 },
  { lat: 37.4595939, lng: 127.0751527 },
  { lat: 37.4597077, lng: 127.0759673 },
  { lat: 37.4593333, lng: 127.0761357 },
  { lat: 37.4590051, lng: 127.0758379 },
  { lat: 37.4579742, lng: 127.0731594 },
  { lat: 37.4555589, lng: 127.065843 },
  { lat: 37.4555921, lng: 127.0638449 },
  { lat: 37.4631296, lng: 127.0462072 },
  { lat: 37.465827, lng: 127.0430552 },
  { lat: 37.4648287, lng: 127.0413209 },
  { lat: 37.4653137, lng: 127.0385622 },
  { lat: 37.4739607, lng: 127.0301536 },
  { lat: 37.4763366, lng: 127.0287578 },
  { lat: 37.5114137, lng: 127.0155544 },
  { lat: 37.5134354, lng: 127.0153331 },
  { lat: 37.5156994, lng: 127.0157315 },
  { lat: 37.5183023, lng: 127.0169934 },
  { lat: 37.5200495, lng: 127.0184148 },
  { lat: 37.522042, lng: 127.0178588 },
  { lat: 37.5234805, lng: 127.0167518 },
  { lat: 37.5246998, lng: 127.0177998 },
  { lat: 37.5249654, lng: 127.0177143 },
  { lat: 37.5241499, lng: 127.0160118 },
  { lat: 37.5190535, lng: 127.0109524 },
  { lat: 37.5138505, lng: 127.0047923 },
  { lat: 37.5122325, lng: 127.0024245 },
  { lat: 37.5069419, lng: 126.9915005 },
  { lat: 37.5061659, lng: 126.9892248 },
  { lat: 37.5050752, lng: 126.9838252 },
  { lat: 37.5050583, lng: 126.9770991 },
  { lat: 37.5054896, lng: 126.9749758 },
  { lat: 37.5072411, lng: 126.9719743 },
  { lat: 37.509683, lng: 126.9657871 },
  { lat: 37.5135575, lng: 126.9583739 },
  { lat: 37.515945, lng: 126.9507162 },
  { lat: 37.5175697, lng: 126.9469678 },
  { lat: 37.5175567, lng: 126.9441955 },
  { lat: 37.5153726, lng: 126.9318459 },
  { lat: 37.5154401, lng: 126.9279008 },
  { lat: 37.5161851, lng: 126.9241077 },
  { lat: 37.518525, lng: 126.9180401 },
  { lat: 37.5202791, lng: 126.9158718 },
  { lat: 37.5263964, lng: 126.9114737 },
  { lat: 37.5319077, lng: 126.9095867 },
  { lat: 37.5343409, lng: 126.9078618 },
  { lat: 37.5387074, lng: 126.9013256 },
  { lat: 37.5442742, lng: 126.89165 },
  { lat: 37.5474138, lng: 126.8894125 },
  { lat: 37.5508993, lng: 126.8842115 },
  { lat: 37.5516334, lng: 126.8827291 },
  { lat: 37.553111, lng: 126.8776325 },
  { lat: 37.5539242, lng: 126.8759615 },
  { lat: 37.5608491, lng: 126.8671367 },
  { lat: 37.5762578, lng: 126.8404995 },
  { lat: 37.5833332, lng: 126.8220291 },
  { lat: 37.5893665, lng: 126.8100121 },
  { lat: 37.5906865, lng: 126.8067027 },
  { lat: 37.5932709, lng: 126.8029191 },
  { lat: 37.5934167, lng: 126.8021317 },
  { lat: 37.5931137, lng: 126.8008817 },
  { lat: 37.5923149, lng: 126.7997791 },
  { lat: 37.5900371, lng: 126.7996079 },
  { lat: 37.586386, lng: 126.7973655 },
  { lat: 37.5846414, lng: 126.7969866 },
  { lat: 37.582224, lng: 126.7975858 },
  { lat: 37.5742825, lng: 126.8029365 },
  { lat: 37.5713997, lng: 126.8039542 },
  { lat: 37.5707259, lng: 126.8037148 },
  { lat: 37.5684828, lng: 126.8043743 },
  { lat: 37.5678151, lng: 126.8042616 },
  { lat: 37.5654784, lng: 126.8014333 },
  place("gimpo"),
] as const;

const DAEKYEOM = ["daekyeom"] as const;
const CAPITAL_TRAVELERS = ["gyuyeol", "junsu", "gyujun"] as const;
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
  { key: "suwon-gmp", kind: "car", color: "#00B84A", outlineColor: "#007A32", pinKeys: ["suwon", "gimpo"], path: SUWON_GMP_PATH, dashed: false, travelerIds: GYUJUN },
  { key: "icheon-gmp", kind: "car", color: "#00B84A", outlineColor: "#007A32", pinKeys: ["icheon", "gimpo"], path: ICHEON_GMP_PATH, dashed: false, travelerIds: ICHEON_TRAVELERS },
  { key: "pus-kix", kind: "flight", color: "#2563EB", pinKeys: ["busan", "kix"], path: curve(place("busan"), place("kix"), 1.1), dashed: false, travelerIds: DAEKYEOM },
  { key: "gmp-kix", kind: "flight", color: "#2563EB", pinKeys: ["gimpo", "kix"], path: curve(place("gimpo"), place("kix"), 1.45), dashed: false, travelerIds: CAPITAL_TRAVELERS },
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
  { key: "nrt-icn", kind: "flight", color: "#2563EB", pinKeys: ["nrt", "incheon"], path: curve(place("nrt"), place("incheon"), 1.45), dashed: false, travelerIds: CAPITAL_TRAVELERS },
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
  incheon: { key: "incheon", label: "인천국제공항", position: place("incheon"), travelerIds: CAPITAL_TRAVELERS },
  gimpo: { key: "gimpo", label: "김포국제공항", position: place("gimpo"), travelerIds: CAPITAL_TRAVELERS },
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
      "mandeok-pus", "suwon-gmp", "icheon-gmp", "pus-kix", "gmp-kix", "kix-kyoto",
      "kyoto-kiyomizu-bus", "kyoto-kiyomizu-walk",
      "kiyomizu-ginkaku-walk-start", "kiyomizu-ginkaku-bus", "kiyomizu-ginkaku-walk-end",
      "ginkaku-kinkaku-walk-start", "ginkaku-kinkaku-bus", "ginkaku-kinkaku-walk-end",
      "kinkaku-kyoto-walk", "kinkaku-kyoto-bus",
    ),
    pins: dayPins("mandeok", "suwon", "icheon", "busan", "gimpo", "kix", "kyoto", "kiyomizu", "kinkaku", "ginkaku"),
    stages: [
      { durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["mandeok", "busan"] },
      {
        durationMs: 13600,
        lineKeys: Object.keys(DAY1_SCHEDULES),
        lineTimings: MORNING_LINE_TIMINGS,
        clock: MORNING_CLOCK,
        cameraCues: [
          { atMs: 0, durationMs: 0, focusPinKeys: ["mandeok", "busan"] },
          { atMs: 4000, durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["suwon", "icheon", "gimpo"] },
          { atMs: 6800, durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["gimpo"] },
          { atMs: 9600, durationMs: CAMERA_SETTLE_MS, focusPinKeys: ["busan", "gimpo", "kix"] },
        ],
      },
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
  if (stage.clock) return undefined;
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
    const cameraCues = stage.cameraCues?.flatMap((cue) => {
      const focusPinKeys = cue.focusPinKeys.filter((key) => pinKeys.has(key));
      return focusPinKeys.length ? [{ ...cue, focusPinKeys }] : [];
    });
    if (stage.lineKeys && nextLineKeys?.length === 0) return [];
    if (stage.focusPinKeys && nextFocusPinKeys?.length === 0) return [];
    if (stage.pinKey && !pinKeys.has(stage.pinKey)) return [];
    const filtered = {
      ...stage,
      ...(nextLineKeys ? { lineKeys: nextLineKeys } : {}),
      ...(nextFocusPinKeys ? { focusPinKeys: nextFocusPinKeys } : {}),
      ...(cameraCues ? { cameraCues } : {}),
      ...(stage.lineTimings ? { lineTimings: Object.fromEntries(Object.entries(stage.lineTimings).filter(([key]) => lineKeys.has(key))) } : {}),
    };
    const lineTimings = stageTiming(filtered, schedules);
    return [lineTimings ? { ...filtered, lineTimings } : filtered];
  });
  // A traveler filter removes the PUS intro; start at that traveler's own drive instead.
  if (day === 1 && stages[0]?.clock) {
    const drive = selectedLines.find((line) => line.kind === "car");
    if (drive) {
      stages[0] = {
        ...stages[0],
        cameraCues: [{ atMs: 0, durationMs: 0, focusPinKeys: drive.pinKeys }, ...stages[0].cameraCues ?? []],
      };
      stages.unshift({ durationMs: CAMERA_SETTLE_MS, focusPinKeys: [...drive.pinKeys] });
    }
  }
  return { lines: selectedLines, pins: selectedPins, stages };
}

function visibleTo(travelerIds: TravelerScope, selectedTravelerId: TravelerId | null) {
  return selectedTravelerId === null || travelerIds === null || travelerIds.includes(selectedTravelerId);
}
