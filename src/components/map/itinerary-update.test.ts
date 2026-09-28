import { describe, expect, it } from "vitest";
import { buildDayLayers } from "./placeholder-routes";

describe("September trip revision", () => {
  it("takes the Icheon pair to the terminal and ICN T1 without inventing a booked flight origin", () => {
    const lines = buildDayLayers(1, undefined, undefined, "junsu").lines;
    expect(lines.some((line) => line.pinKeys.includes("icheonTerminal"))).toBe(true);
    expect(lines.some((line) => line.pinKeys[1] === "incheon")).toBe(true);
    expect(lines.filter((line) => line.kind === "flight")).toEqual([]);
    expect(lines.filter((line) => line.kind === "bus").every((line) => line.transportLabel === "버스")).toBe(true);
  });

  it("reaches Ryuguden by shuttle and returns to the Ueno hotel after the birthday dinner", () => {
    const outward = buildDayLayers(2).lines;
    const returning = buildDayLayers(3).lines;
    expect(outward.some((line) => line.kind === "bus" && line.pinKeys[1] === "ryuguden")).toBe(true);
    expect([...outward, ...returning].some((line) => line.transportLabel?.includes("하코네 등산선"))).toBe(false);
    expect(returning.at(-1)?.pinKeys).toEqual(["tenkai", "aima"]);
  });

  it("connects all day-four stops using only pass-covered subway lines and walks", () => {
    const lines = buildDayLayers(4).lines;
    expect(lines.length).toBeGreaterThan(5);
    expect(lines.every((line) => line.kind === "rail" || line.kind === "walk")).toBe(true);
    expect(lines.flatMap((line) => line.pinKeys)).toEqual(expect.arrayContaining(["roastery", "shinjuku", "akihabara", "ginza"]));
    expect(lines.filter((line) => line.kind === "rail").every((line) => /히비야|오에도|신주쿠선|긴자선/.test(line.transportLabel ?? ""))).toBe(true);
  });

  it("starts capital-region homebound transport at T2 and Daekyeom's at bus 307", () => {
    const lines = buildDayLayers(5).lines;
    expect(lines.find((line) => line.key === "nrt-icn")?.pinKeys).toEqual(["nrt", "incheon2"]);
    expect(lines.some((line) => line.kind === "bus" && line.pinKeys[0] === "incheon2")).toBe(true);
    expect(lines.some((line) => line.kind === "bus" && line.transportLabel === "307번 버스")).toBe(true);
  });
});
