import { describe, expect, it } from "vitest";
import { pathAtProgress, projectedPathLength, visualStages } from "./animation";

describe("shared screen-space speed", () => {
  const short = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }];
  const long = [{ lat: 0, lng: 0 }, { lat: 0, lng: 2 }];

  it("uses the same pixels per second for paths of different length", () => {
    const stages = visualStages([
      { durationMs: 1000, focusPinKeys: ["a", "b"] },
      { durationMs: 1, lineKeys: ["car", "flight"] },
    ], [{ key: "car", path: short }, { key: "flight", path: long }], () => 8);
    expect(stages[0].durationMs).toBe(1000);
    expect(stages[1].lineTimings?.car?.durationMs).toBeCloseTo(758.5185, 3);
    expect(stages[1].lineTimings?.flight?.durationMs).toBeCloseTo(1517.037, 3);
    expect(projectedPathLength(short, 8)).toBeCloseTo(182.04444, 4);
  });

  it("travels equal projected distances instead of equal latitude degrees", () => {
    const path = [{ lat: 0, lng: 0 }, { lat: 60, lng: 0 }];
    const midway = pathAtProgress(path, 0.5).at(-1)!;
    expect(midway.lat).toBeCloseTo(35.2643897, 5);
  });
});
