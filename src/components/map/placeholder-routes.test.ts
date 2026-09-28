import { describe, expect, it } from "vitest";

import { GROUND_ROUTE_KEYS } from "../../trip/ground-routes";
import type { TravelerId } from "../../trip/travelers";
import { buildDayLayers, buildRouteLines, FULL_ROUTE_LINES, FULL_ROUTE_PINS } from "./placeholder-routes";

const days = [1, 2, 3, 4, 5] as const;
const travelers: TravelerId[] = ["daekyeom", "gyuyeol", "junsu", "gyujun"];

describe("trip route geometry", () => {
  it("provides every planned ground route and keeps provisional geometry visibly dashed", () => {
    for (const key of GROUND_ROUTE_KEYS) {
      const lines = FULL_ROUTE_LINES.filter((line) => (line.routeKey ?? line.key) === key);
      expect(lines.length, key).toBeGreaterThan(0);
      expect(lines.every((line) => line.path.length >= 2)).toBe(true);
      expect(lines.every((line) => line.dashed)).toBe(true);
    }
  });

  it("builds valid stages for every day and traveler filter", () => {
    for (const day of days) {
      for (const traveler of [null, ...travelers]) {
        const layers = buildDayLayers(day, FULL_ROUTE_LINES, undefined, traveler);
        const lineKeys = new Set(layers.lines.map((line) => line.key));
        const pinKeys = new Set<string>(layers.pins.map((pin) => pin.key));
        expect(lineKeys.size).toBe(layers.lines.length);
        for (const stage of layers.stages) {
          expect(stage.durationMs).toBeGreaterThan(0);
          for (const key of stage.lineKeys ?? []) expect(lineKeys.has(key), `${day}:${traveler}:${key}`).toBe(true);
          if (stage.pinKey) expect(pinKeys.has(stage.pinKey)).toBe(true);
        }
      }
    }
  });

  it("does not invent an outbound flight for the Icheon pair", () => {
    for (const traveler of ["gyuyeol", "junsu"] as const) {
      const lines = buildDayLayers(1, FULL_ROUTE_LINES, undefined, traveler).lines;
      expect(lines.some((line) => line.pinKeys.includes("icheonTerminal"))).toBe(true);
      expect(lines.some((line) => line.pinKeys.includes("incheon"))).toBe(true);
      expect(lines.some((line) => line.kind === "flight")).toBe(false);
    }
    expect(buildDayLayers(1, FULL_ROUTE_LINES, undefined, "gyujun").lines.find((line) => line.kind === "flight")?.key).toBe("gmp-kix");
    expect(buildDayLayers(1, FULL_ROUTE_LINES, undefined, "daekyeom").lines.find((line) => line.kind === "flight")?.key).toBe("pus-kix");
  });

  it("uses T2 for the group return and bus 307 for Daekyeom", () => {
    const group = buildDayLayers(5, FULL_ROUTE_LINES, undefined, "junsu").lines;
    expect(group.find((line) => line.key === "nrt-icn")?.pinKeys).toEqual(["nrt", "incheon2"]);
    expect(group.some((line) => line.pinKeys[0] === "incheon2" && line.kind === "bus")).toBe(true);

    const daekyeom = buildDayLayers(5, FULL_ROUTE_LINES, undefined, "daekyeom").lines;
    expect(daekyeom.map((line) => line.transportLabel)).toEqual(expect.arrayContaining(["진에어", "307번 버스"]));
    expect(daekyeom.some((line) => line.pinKeys.includes("incheon2"))).toBe(false);
  });

  it("keeps origin labels hidden while retaining their pins", () => {
    for (const key of ["mandeok", "suwon", "icheon"] as const) {
      expect(FULL_ROUTE_PINS.find((pin) => pin.key === key)).toMatchObject({ key });
      expect(FULL_ROUTE_PINS.find((pin) => pin.key === key)?.label).toBeUndefined();
    }
  });

  it("replaces only supplied verified snapshots", () => {
    const railGeometry = [[34.4347, 135.244], [34.985849, 135.758767]] as const;
    const groundGeometry = [[35.215263, 129.028309], [35.1796, 128.9382]] as const;
    const lines = buildRouteLines([
      { segmentKey: "kix-kyoto", status: "finalized", label: "철도 이동", geometry: railGeometry },
    ], [{
      segmentKey: "mandeok-pus",
      verifiedAt: "2026-09-28T00:00:00.000Z",
      steps: [{ kind: "car", geometry: groundGeometry }],
    }]);

    expect(lines.find((line) => line.key === "kix-kyoto")).toMatchObject({ dashed: false, googleDerived: true });
    expect(lines.find((line) => line.key === "mandeok-pus")).toMatchObject({ dashed: false, googleDerived: true });
    expect(lines.find((line) => line.key === "suwon-gmp")).toMatchObject({ dashed: true, label: "경로 확인 중" });
  });
});
