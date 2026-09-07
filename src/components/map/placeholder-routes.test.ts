import { describe, expect, it } from "vitest";

import { PUBLIC_TRIP_DEFINITION } from "../../trip/public";
import { buildDayLayers, buildRouteLines, FULL_ROUTE_LINES, ROUTE_SCHEDULES } from "./placeholder-routes";

const KYOTO_LOOP_LINE_KEYS = [
  "kyoto-kiyomizu-bus",
  "kyoto-kiyomizu-walk",
  "kiyomizu-ginkaku-walk-start",
  "kiyomizu-ginkaku-bus",
  "kiyomizu-ginkaku-walk-end",
  "ginkaku-kinkaku-walk-start",
  "ginkaku-kinkaku-bus",
  "ginkaku-kinkaku-walk-end",
  "kinkaku-kyoto-walk",
  "kinkaku-kyoto-bus",
] as const;

describe("placeholder route geometry", () => {
  it("uses Gimpo only on departure day and runs the entire morning on one clock", () => {
    const departure = buildDayLayers(1);
    expect(departure.lines.slice(0, 5).map(({ key }) => key)).toEqual([
      "mandeok-pus", "suwon-gmp", "icheon-gmp", "pus-kix", "gmp-kix",
    ]);
    expect(departure.pins.map(({ key }) => key)).toContain("gimpo");
    expect(departure.pins.map(({ key }) => key)).not.toContain("incheon");
    expect(departure.stages[1]).toMatchObject({
      durationMs: 13600,
      lineTimings: {
        "mandeok-pus": { delayMs: 0, durationMs: 4000 },
        "icheon-gmp": { delayMs: 1000, durationMs: 6000 },
        "suwon-gmp": { delayMs: 3000, durationMs: 4000 },
        "pus-kix": { delayMs: 7800, durationMs: 3800 },
        "gmp-kix": { delayMs: 9600, durationMs: 4000 },
      },
      clock: [
        { elapsedMs: 0, minuteOfDay: 360 },
        { elapsedMs: 7000, minuteOfDay: 465 },
        { elapsedMs: 7800, minuteOfDay: 510 },
        { elapsedMs: 13600, minuteOfDay: 655 },
      ],
    });
    expect(departure.stages.reduce((total, stage) => total + stage.durationMs, 0)).toBe(22600);
    expect(buildDayLayers(5).lines.map(({ key }) => key)).toEqual([
      "tokyo-narita", "nrt-pus", "nrt-icn", "pus-mandeok", "icn-suwon", "icn-icheon",
    ]);
  });

  it("starts the outbound flight curves at PUS and the GMP international terminal", () => {
    expect(FULL_ROUTE_LINES.find(({ key }) => key === "pus-kix")?.path[0]).toEqual({ lat: 35.1796, lng: 128.9382 });
    expect(FULL_ROUTE_LINES.find(({ key }) => key === "gmp-kix")?.path[0]).toEqual({ lat: 37.5655255, lng: 126.801378 });
  });

  it("keeps the complete trip visible with the five screenshot-traced rail journeys", () => {
    expect(FULL_ROUTE_LINES.map(({ key }) => key)).toEqual([
      "mandeok-pus",
      "suwon-gmp",
      "icheon-gmp",
      "pus-kix",
      "gmp-kix",
      "kix-kyoto",
      ...KYOTO_LOOP_LINE_KEYS,
      "kyoto-odawara",
      "odawara-hakone",
      "hakone-odawara",
      "odawara-tokyo",
      "tokyo-narita",
      "nrt-pus",
      "nrt-icn",
      "pus-mandeok",
      "icn-suwon",
      "icn-icheon",
    ]);
    expect(FULL_ROUTE_LINES.filter(({ kind }) => kind === "rail").map(({ dashed, label }) => ({ dashed, label }))).toEqual([
      { dashed: true, label: "경로 확정 전" },
      { dashed: true, label: "경로 확정 전" },
      { dashed: true, label: "경로 확정 전" },
      { dashed: true, label: "경로 확정 전" },
    ]);
  });

  it("keeps green car routes and preserves the separate ICN return endpoints", () => {
    const route = (key: string) => FULL_ROUTE_LINES.find((line) => line.key === key)!;

    expect(["mandeok-pus", "suwon-gmp", "icheon-gmp"].map((key) => ({
      key,
      kind: route(key).kind,
      color: route(key).color,
      outlineColor: route(key).outlineColor,
    }))).toEqual([
      { key: "mandeok-pus", kind: "car", color: "#00B84A", outlineColor: "#007A32" },
      { key: "suwon-gmp", kind: "car", color: "#00B84A", outlineColor: "#007A32" },
      { key: "icheon-gmp", kind: "car", color: "#00B84A", outlineColor: "#007A32" },
    ]);
    expect(route("pus-mandeok").path).toEqual([...route("mandeok-pus").path].reverse());
    for (const key of ["icn-suwon", "icn-icheon"]) {
      expect(route(key).path[0]).toEqual({ lat: 37.4602, lng: 126.4407 });
      expect(route(key).path.length).toBeGreaterThan(20);
    }
    expect(route("icn-suwon").path.at(-1)).toEqual({ lat: 37.2634787, lng: 127.0287097 });
    expect(route("icn-icheon").path.at(-1)).toEqual({ lat: 37.2723484, lng: 127.4350167 });
  });

  it("preserves the previously traced PUS and ICN return road corridors", () => {
    const route = (key: string) => FULL_ROUTE_LINES.find((line) => line.key === key)!;

    expect(route("mandeok-pus").path).toEqual(expect.arrayContaining([
      { lat: 35.210587, lng: 128.983969 },
      { lat: 35.169234, lng: 128.959683 },
    ]));
    expect(route("icn-suwon").path).toEqual(expect.arrayContaining([
      { lat: 37.258112, lng: 126.982077 },
      { lat: 37.389497, lng: 126.673031 },
      { lat: 37.499715, lng: 126.47605 },
    ]));
    expect(route("icn-icheon").path).toEqual(expect.arrayContaining([
      { lat: 37.428312, lng: 127.122183 },
      { lat: 37.392666, lng: 127.015687 },
      { lat: 37.389497, lng: 126.673031 },
    ]));
  });

  it("follows the verified GMP road approach instead of a straight connector or the ICN bridge", () => {
    for (const key of ["suwon-gmp", "icheon-gmp"]) {
      const route = FULL_ROUTE_LINES.find((line) => line.key === key)!;
      expect(route.dashed).toBe(false);
      expect(route.label).toBeUndefined();
      expect(route.path.length).toBeGreaterThan(20);
      expect(Math.max(...route.path.map(({ lat }) => lat))).toBeGreaterThan(key === "icheon-gmp" ? 37.59 : 37.566);
      expect(Math.min(...route.path.map(({ lng }) => lng))).toBeGreaterThan(126.75);
      expect(route.path.at(-1)).toEqual({ lat: 37.5655255, lng: 126.801378 });
    }
  });

  it("animates the current Google bus-and-walk loop from Kyoto Station and back", () => {
    const route = (key: string) => {
      const line = FULL_ROUTE_LINES.find((candidate) => candidate.key === key);
      expect(line, key).toBeDefined();
      return line!;
    };
    const loop = KYOTO_LOOP_LINE_KEYS.map(route);

    expect(loop.map(({ key, kind, transportLabel }) => ({ key, kind, transportLabel }))).toEqual([
      { key: "kyoto-kiyomizu-bus", kind: "bus", transportLabel: "교토 시버스 106·206" },
      { key: "kyoto-kiyomizu-walk", kind: "walk", transportLabel: "도보" },
      { key: "kiyomizu-ginkaku-walk-start", kind: "walk", transportLabel: "도보" },
      { key: "kiyomizu-ginkaku-bus", kind: "bus", transportLabel: "교토 시버스 203" },
      { key: "kiyomizu-ginkaku-walk-end", kind: "walk", transportLabel: "도보" },
      { key: "ginkaku-kinkaku-walk-start", kind: "walk", transportLabel: "도보" },
      { key: "ginkaku-kinkaku-bus", kind: "bus", transportLabel: "교토 시버스 204" },
      { key: "ginkaku-kinkaku-walk-end", kind: "walk", transportLabel: "도보" },
      { key: "kinkaku-kyoto-walk", kind: "walk", transportLabel: "도보" },
      { key: "kinkaku-kyoto-bus", kind: "bus", transportLabel: "교토 시버스 205" },
    ]);
    expect([...new Set(loop.filter(({ kind }) => kind === "bus").map(({ color, outlineColor }) => `${color}:${outlineColor}`))]).toEqual(["#F4430A:#BE5127"]);
    expect([...new Set(loop.filter(({ kind }) => kind === "walk").map(({ color, outlineColor }) => `${color}:${outlineColor}`))]).toEqual(["#4A0DF0:#180096"]);
    expect(loop.every(({ googleDerived }) => googleDerived)).toBe(true);

    for (const [left, right] of [[0, 1], [2, 3], [3, 4], [5, 6], [6, 7], [8, 9]] as const) {
      expect(loop[left].path.at(-1), `${loop[left].key} -> ${loop[right].key}`).toEqual(loop[right].path[0]);
    }
    expect(loop[0].path[0]).toEqual({ lat: PUBLIC_TRIP_DEFINITION.places.kyoto.latitude, lng: PUBLIC_TRIP_DEFINITION.places.kyoto.longitude });
    expect(loop.at(-1)?.path.at(-1)).toEqual({ lat: PUBLIC_TRIP_DEFINITION.places.kyoto.latitude, lng: PUBLIC_TRIP_DEFINITION.places.kyoto.longitude });

    expect(buildDayLayers(1).stages.slice(-5)).toEqual([
      { durationMs: 1000, focusPinKeys: ["kyoto", "kiyomizu", "ginkaku", "kinkaku"] },
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
    ]);
  });

  it("plays domestic car journeys before outbound flights and after return flights", () => {
    const day1 = buildDayLayers(1);
    const day5 = buildDayLayers(5);

    expect(day1.lines.map(({ key }) => key)).toEqual([
      "mandeok-pus", "suwon-gmp", "icheon-gmp", "pus-kix", "gmp-kix", "kix-kyoto",
      ...KYOTO_LOOP_LINE_KEYS,
    ]);
    expect(day1.pins.map(({ key }) => key)).toEqual([
      "mandeok", "suwon", "icheon", "busan", "gimpo", "kix", "kyoto", "kiyomizu", "kinkaku", "ginkaku",
    ]);
    expect(day1.stages.slice(0, 3)).toEqual([
      { durationMs: 1000, focusPinKeys: ["mandeok", "busan"] },
      expect.objectContaining({ durationMs: 13600, lineKeys: ["mandeok-pus", "suwon-gmp", "icheon-gmp", "pus-kix", "gmp-kix"] }),
      { durationMs: 1000, focusPinKeys: ["kix", "kyoto"] },
    ]);

    expect(day5.lines.map(({ key }) => key)).toEqual([
      "tokyo-narita", "nrt-pus", "nrt-icn", "pus-mandeok", "icn-suwon", "icn-icheon",
    ]);
    expect(day5.stages.at(-1)?.lineKeys).toEqual(["pus-mandeok", "icn-suwon", "icn-icheon"]);
  });

  it.each([
    ["daekyeom", ["mandeok-pus", "pus-kix", "kix-kyoto", ...KYOTO_LOOP_LINE_KEYS], ["tokyo-narita", "nrt-pus", "pus-mandeok"]],
    ["gyuyeol", ["icheon-gmp", "gmp-kix", "kix-kyoto", ...KYOTO_LOOP_LINE_KEYS], ["tokyo-narita", "nrt-icn", "icn-icheon"]],
    ["junsu", ["icheon-gmp", "gmp-kix", "kix-kyoto", ...KYOTO_LOOP_LINE_KEYS], ["tokyo-narita", "nrt-icn", "icn-icheon"]],
    ["gyujun", ["suwon-gmp", "gmp-kix", "kix-kyoto", ...KYOTO_LOOP_LINE_KEYS], ["tokyo-narita", "nrt-icn", "icn-suwon"]],
  ] as const)("filters day 1 and 5 for %s", (travelerId, day1Keys, day5Keys) => {
    expect(buildDayLayers(1, FULL_ROUTE_LINES, ROUTE_SCHEDULES, travelerId).lines.map(({ key }) => key)).toEqual(day1Keys);
    expect(buildDayLayers(5, FULL_ROUTE_LINES, ROUTE_SCHEDULES, travelerId).lines.map(({ key }) => key)).toEqual(day5Keys);
  });

  it("returns identical shared layers for every traveler on days 2 through 4", () => {
    for (const day of [2, 3, 4] as const) {
      const expected = buildDayLayers(day, FULL_ROUTE_LINES, ROUTE_SCHEDULES, "daekyeom");
      for (const travelerId of ["gyuyeol", "junsu", "gyujun"] as const) {
        expect(buildDayLayers(day, FULL_ROUTE_LINES, ROUTE_SCHEDULES, travelerId)).toEqual(expected);
      }
    }
  });

  it("keeps selected traveler stages within their visible lines and pins", () => {
    const layers = buildDayLayers(1, FULL_ROUTE_LINES, ROUTE_SCHEDULES, "daekyeom");
    const lineKeys = new Set(layers.lines.map(({ key }) => key));
    const pinKeys = new Set(layers.pins.map(({ key }) => key));

    expect(layers.stages.flatMap(({ lineKeys = [] }) => lineKeys).every((key) => lineKeys.has(key))).toBe(true);
    expect(layers.stages.flatMap(({ focusPinKeys = [] }) => focusPinKeys).every((key) => pinKeys.has(key))).toBe(true);
    expect(layers.pins.map(({ key }) => key)).not.toEqual(expect.arrayContaining(["suwon", "icheon", "incheon"]));
    expect(layers.stages).toEqual(expect.arrayContaining([
      { durationMs: 1000, focusPinKeys: ["mandeok", "busan"] },
      expect.objectContaining({ durationMs: 13600, lineKeys: ["mandeok-pus", "pus-kix"] }),
    ]));
    expect(layers.stages.flatMap(({ focusPinKeys = [] }) => focusPinKeys)).not.toEqual(expect.arrayContaining(["suwon", "icheon", "incheon"]));
    expect(layers.stages.flatMap(({ cameraCues = [] }) => cameraCues).flatMap(({ focusPinKeys }) => focusPinKeys)).not.toEqual(expect.arrayContaining(["suwon", "icheon", "gimpo"]));
    expect(layers.stages[1].lineTimings).toEqual({
      "mandeok-pus": { delayMs: 0, durationMs: 4000 },
      "pus-kix": { delayMs: 7800, durationMs: 3800 },
    });
  });

  it.each([
    ["gyujun", ["suwon", "gimpo"], "suwon-gmp", 3000, 4000],
    ["gyuyeol", ["icheon", "gimpo"], "icheon-gmp", 1000, 6000],
    ["junsu", ["icheon", "gimpo"], "icheon-gmp", 1000, 6000],
  ] as const)("starts %s at their own drive without changing the shared departure clock", (id, keys, line, delayMs, durationMs) => {
    const layers = buildDayLayers(1, FULL_ROUTE_LINES, ROUTE_SCHEDULES, id);
    expect(layers.stages[0]).toEqual({ durationMs: 1000, focusPinKeys: keys });
    expect(layers.stages[1].cameraCues?.[0]).toEqual({ atMs: 0, durationMs: 0, focusPinKeys: keys });
    expect(layers.stages[1].lineTimings).toEqual({
      [line]: { delayMs, durationMs },
      "gmp-kix": { delayMs: 9600, durationMs: 4000 },
    });
    expect(layers.stages.flatMap(({ cameraCues = [] }) => cameraCues).every((cue) => cue.focusPinKeys.every((key) => layers.pins.some((pin) => pin.key === key)))).toBe(true);
  });

  it("preserves entered flight-time compression on days without a shared clock", () => {
    const layers = buildDayLayers(5, FULL_ROUTE_LINES, {
      "nrt-pus": { departureAt: "2026-10-06T09:00:00+09:00", arrivalAt: "2026-10-06T10:30:00+09:00" },
      "nrt-icn": { departureAt: "2026-10-06T10:00:00+09:00", arrivalAt: "2026-10-06T11:30:00+09:00" },
    });
    const flightStage = layers.stages.find((stage) => stage.lineKeys?.includes("nrt-pus"));

    expect(flightStage?.lineTimings).toEqual({
      "nrt-pus": { delayMs: 0, durationMs: 1440 },
      "nrt-icn": { delayMs: 960, durationMs: 1440 },
    });
  });

  it("authors curved flight paths and the Odawara-Hakone connector locally", () => {
    const flights = FULL_ROUTE_LINES.filter(({ kind }) => kind === "flight");
    const connector = FULL_ROUTE_LINES.find(({ key }) => key === "odawara-hakone");

    expect(flights).toHaveLength(4);
    expect(flights.every(({ path }) => path.length > 2)).toBe(true);
    expect(connector).toMatchObject({ kind: "connector", dashed: true, transportLabel: "하코네 등산선" });
    expect(connector?.path.length).toBeGreaterThan(4);
  });

  it("names each planned train while retaining the route-confirmation status label", () => {
    expect(FULL_ROUTE_LINES.filter(({ kind }) => kind === "rail").map(({ key, transportLabel, label }) => ({ key, transportLabel, label }))).toEqual([
      { key: "kix-kyoto", transportLabel: "JR 하루카", label: "경로 확정 전" },
      { key: "kyoto-odawara", transportLabel: "도카이도 신칸센", label: "경로 확정 전" },
      { key: "odawara-tokyo", transportLabel: "JR 도카이도 본선 · 우쓰노미야선 직결", label: "경로 확정 전" },
      { key: "tokyo-narita", transportLabel: "게이세이 스카이라이너", label: "경로 확정 전" },
    ]);
  });

  it("uses the selected core and outline colors sampled from each Google screenshot", () => {
    expect(Object.fromEntries(FULL_ROUTE_LINES.filter(({ kind }) => kind === "rail" || kind === "connector").map(({ key, color, outlineColor }) => [key, { color, outlineColor }]))).toEqual({
      "kix-kyoto": { color: "#005DCF", outlineColor: "#16427B" },
      "kyoto-odawara": { color: "#004DA1", outlineColor: "#0D355F" },
      "odawara-hakone": { color: "#E85216", outlineColor: "#8B4222" },
      "hakone-odawara": { color: "#E85216", outlineColor: "#8B4222" },
      "odawara-tokyo": { color: "#F18016", outlineColor: "#995A22" },
      "tokyo-narita": { color: "#1B4786", outlineColor: "#1D3053" },
    });
  });

  it("traces the selected rail corridors and keeps every journey on its literal endpoints", () => {
    const route = (key: string) => FULL_ROUTE_LINES.find((line) => line.key === key)!;

    expect(route("kix-kyoto").path).toEqual(expect.arrayContaining([
      { lat: 34.3904, lng: 135.3314 },
      { lat: 34.6466, lng: 135.5133 },
      { lat: 34.8519, lng: 135.6173 },
    ]));
    expect(route("kyoto-odawara").path).toEqual(expect.arrayContaining([
      { lat: 35.3147, lng: 136.2907 },
      { lat: 35.1709, lng: 136.8815 },
      { lat: 34.7038, lng: 137.7347 },
      { lat: 34.9717, lng: 138.3889 },
      { lat: 35.1264, lng: 138.9107 },
    ]));
    expect(route("hakone-odawara").path).toEqual([...route("odawara-hakone").path].reverse());
    expect(route("odawara-tokyo")).toMatchObject({ pinKeys: ["odawara", "ueno"] });
    expect(route("odawara-tokyo").path).toEqual(expect.arrayContaining([
      { lat: 35.4658, lng: 139.6223 },
      { lat: 35.68124, lng: 139.76712 },
      { lat: 35.6984, lng: 139.7731 },
    ]));
    expect(route("tokyo-narita").path).toEqual(expect.arrayContaining([
      { lat: 35.7278, lng: 139.7709 },
      { lat: 35.7793, lng: 139.9988 },
      { lat: 35.8015, lng: 140.2915 },
    ]));

    for (const key of ["kix-kyoto", "kyoto-odawara", "odawara-hakone", "odawara-tokyo", "tokyo-narita"]) {
      const line = route(key);
      const [from, to] = line.pinKeys;
      expect(line.path[0]).toEqual({ lat: PUBLIC_TRIP_DEFINITION.places[from].latitude, lng: PUBLIC_TRIP_DEFINITION.places[from].longitude });
      expect(line.path.at(-1)).toEqual({ lat: PUBLIC_TRIP_DEFINITION.places[to].latitude, lng: PUBLIC_TRIP_DEFINITION.places[to].longitude });
      expect(line.path.length).toBeGreaterThan(5);
    }
  });

  it("provides Odawara and Hakone pins after the Day 2 rail stage", () => {
    const layers = buildDayLayers(2);

    expect(layers.pins.map(({ key }) => key)).toEqual(["kyoto", "odawara", "hakone"]);
    expect(layers.stages.flatMap((stage) => stage.lineKeys ?? [])).toEqual([
      "kyoto-odawara",
      "odawara-hakone",
    ]);
  });

  it("replaces only the matching rail placeholder with final Google geometry", () => {
    const lines = buildRouteLines([{
      segmentKey: "kyoto-odawara",
      status: "finalized",
      label: "철도 이동",
      geometry: [[35.01, 135.76], [35.25, 139.15]],
    }]);

    expect(lines.find(({ key }) => key === "kyoto-odawara")).toEqual({
      key: "kyoto-odawara",
      kind: "rail",
      color: "#004DA1",
      outlineColor: "#0D355F",
      pinKeys: ["kyoto", "odawara"],
      path: [{ lat: 35.01, lng: 135.76 }, { lat: 35.25, lng: 139.15 }],
      dashed: false,
      label: "철도 이동",
      transportLabel: "도카이도 신칸센",
      googleDerived: true,
      travelerIds: null,
    });
    expect(lines.filter(({ kind, dashed }) => kind === "rail" && dashed)).toHaveLength(3);
    expect(lines.find(({ key }) => key === "odawara-hakone")).toMatchObject({ kind: "connector", dashed: true });
    expect(buildDayLayers(2, lines).lines[0]).toMatchObject({ key: "kyoto-odawara", googleDerived: true });
  });
});
