import { describe, expect, it } from "vitest";

import { buildDayLayers, buildRouteLines, FULL_ROUTE_LINES } from "./placeholder-routes";

describe("placeholder route geometry", () => {
  it("starts the flight curves at the literal PUS and ICN airport coordinates", () => {
    expect(FULL_ROUTE_LINES.find(({ key }) => key === "pus-kix")?.path[0]).toEqual({ lat: 35.1796, lng: 128.9382 });
    expect(FULL_ROUTE_LINES.find(({ key }) => key === "icn-kix")?.path[0]).toEqual({ lat: 37.4602, lng: 126.4407 });
  });

  it("keeps the complete trip visible with the four backend rail placeholders and one local rail placeholder", () => {
    expect(FULL_ROUTE_LINES.map(({ key }) => key)).toEqual([
      "pus-kix",
      "icn-kix",
      "kix-kyoto",
      "kyoto-odawara",
      "odawara-hakone",
      "hakone-odawara",
      "odawara-tokyo",
      "tokyo-ueno",
      "tokyo-narita",
      "nrt-pus",
      "nrt-icn",
    ]);
    expect(FULL_ROUTE_LINES.filter(({ kind }) => kind === "rail").map(({ dashed, label }) => ({ dashed, label }))).toEqual([
      { dashed: true, label: "경로 확정 전" },
      { dashed: true, label: "경로 확정 전" },
      { dashed: true, label: "경로 확정 전" },
      { dashed: true, label: "경로 확정 전" },
      { dashed: true, label: "경로 확정 전" },
    ]);
  });

  it("authors curved flight paths and the Odawara-Hakone connector locally", () => {
    const flights = FULL_ROUTE_LINES.filter(({ kind }) => kind === "flight");
    const connector = FULL_ROUTE_LINES.find(({ key }) => key === "odawara-hakone");

    expect(flights).toHaveLength(4);
    expect(flights.every(({ path }) => path.length > 2)).toBe(true);
    expect(connector).toMatchObject({ kind: "connector", dashed: true });
    expect(connector?.path).toHaveLength(2);
  });

  it("names each planned train while retaining the route-confirmation status label", () => {
    expect(FULL_ROUTE_LINES.filter(({ kind }) => kind === "rail").map(({ key, transportLabel, label }) => ({ key, transportLabel, label }))).toEqual([
      { key: "kix-kyoto", transportLabel: "JR 하루카", label: "경로 확정 전" },
      { key: "kyoto-odawara", transportLabel: "신칸센", label: "경로 확정 전" },
      { key: "odawara-tokyo", transportLabel: "도카이도 본선", label: "경로 확정 전" },
      { key: "tokyo-ueno", transportLabel: "야마노테선", label: "경로 확정 전" },
      { key: "tokyo-narita", transportLabel: "Keisei Skyliner", label: "경로 확정 전" },
    ]);
  });

  it("uses each operator route color instead of one generic selected-line color", () => {
    expect(Object.fromEntries(FULL_ROUTE_LINES.map(({ key, color }) => [key, color]))).toEqual({
      "pus-kix": "#2563EB",
      "icn-kix": "#2563EB",
      "kix-kyoto": "#59CAF5",
      "kyoto-odawara": "#084EA2",
      "odawara-hakone": "#F49D19",
      "hakone-odawara": "#F49D19",
      "odawara-tokyo": "#F68B1E",
      "tokyo-ueno": "#80C342",
      "tokyo-narita": "#1D2B6E",
      "nrt-pus": "#2563EB",
      "nrt-icn": "#2563EB",
    });
  });

  it("provides Odawara and Hakone pins after the Day 2 rail stage", () => {
    const layers = buildDayLayers(2);

    expect(layers.pins.map(({ key }) => key)).toEqual(["kyoto", "odawara", "hakone"]);
    expect(layers.stages.map((stage) => stage.lineKeys?.[0] ?? stage.pinKey)).toEqual([
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
      color: "#084EA2",
      pinKeys: ["kyoto", "odawara"],
      path: [{ lat: 35.01, lng: 135.76 }, { lat: 35.25, lng: 139.15 }],
      dashed: false,
      label: "철도 이동",
      transportLabel: "신칸센",
      googleDerived: true,
    });
    expect(lines.filter(({ kind, dashed }) => kind === "rail" && dashed)).toHaveLength(4);
    expect(lines.find(({ key }) => key === "odawara-hakone")).toMatchObject({ kind: "connector", dashed: true });
    expect(buildDayLayers(2, lines).lines[0]).toMatchObject({ key: "kyoto-odawara", googleDerived: true });
  });
});
