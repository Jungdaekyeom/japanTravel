import { departureAt } from "./time";

describe("departureAt", () => {
  it("combines a fixed trip date and local HH:mm into Japan time", () => {
    expect(departureAt("2026-10-06", "07:30")).toBe("2026-10-06T07:30:00+09:00");
  });

  it("rejects malformed local times", () => {
    expect(() => departureAt("2026-10-06", "7:30")).toThrow("HH:mm");
    expect(() => departureAt("2026-10-06", "24:00")).toThrow("HH:mm");
  });
});
