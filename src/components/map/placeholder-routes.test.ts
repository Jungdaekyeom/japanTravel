import { describe, expect, it } from "vitest";

import { buildDayLayers, FULL_ROUTE_LINES } from "./placeholder-routes";

describe("placeholder route geometry", () => {
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
});
