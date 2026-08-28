import { describe, expect, it } from "vitest";

import { buildDayLayers, buildRouteLines, FULL_ROUTE_LINES } from "./placeholder-routes";

describe("placeholder route geometry", () => {
  it("starts the flight curves at the literal PUS and ICN airport coordinates", () => {
    expect(FULL_ROUTE_LINES.find(({ key }) => key === "pus-kix")?.path[0]).toEqual({ lat: 35.1796, lng: 128.9382 });
    expect(FULL_ROUTE_LINES.find(({ key }) => key === "icn-kix")?.path[0]).toEqual({ lat: 37.4602, lng: 126.4407 });
  });

  it("keeps the complete trip visible with four labeled dashed rail placeholders", () => {
    expect(FULL_ROUTE_LINES.map(({ key }) => key)).toEqual([
      "pus-kix",
      "icn-kix",
      "kix-kyoto",
      "kyoto-odawara",
      "odawara-hakone",
      "odawara-tokyo",
      "tokyo-narita",
    ]);
    expect(FULL_ROUTE_LINES.filter(({ kind }) => kind === "rail").map(({ dashed, label }) => ({ dashed, label }))).toEqual([
      { dashed: true, label: "경로 확정 전" },
      { dashed: true, label: "경로 확정 전" },
      { dashed: true, label: "경로 확정 전" },
      { dashed: true, label: "경로 확정 전" },
    ]);
  });

  it("authors curved flight paths and the Odawara-Hakone connector locally", () => {
    const flights = FULL_ROUTE_LINES.filter(({ kind }) => kind === "flight");
    const connector = FULL_ROUTE_LINES.find(({ key }) => key === "odawara-hakone");

    expect(flights).toHaveLength(2);
    expect(flights.every(({ path }) => path.length > 2)).toBe(true);
    expect(connector).toMatchObject({ kind: "connector", dashed: true });
    expect(connector?.path).toHaveLength(2);
  });

  it("provides Odawara and Hakone pins after the Day 2 rail stage", () => {
    const layers = buildDayLayers(2);

    expect(layers.pins.map(({ key }) => key)).toEqual(["odawara", "hakone"]);
    expect(layers.stages.map((stage) => stage.lineKeys?.[0] ?? stage.pinKey)).toEqual([
      "kyoto-odawara",
      "odawara",
      "hakone",
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
      path: [{ lat: 35.01, lng: 135.76 }, { lat: 35.25, lng: 139.15 }],
      dashed: false,
      label: "철도 이동",
      googleDerived: true,
    });
    expect(lines.filter(({ kind, dashed }) => kind === "rail" && dashed)).toHaveLength(3);
    expect(lines.find(({ key }) => key === "odawara-hakone")).toMatchObject({ kind: "connector", dashed: true });
    expect(buildDayLayers(2, lines).lines[0]).toMatchObject({ key: "kyoto-odawara", googleDerived: true });
  });
});
