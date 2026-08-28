import { describe, expect, it } from "vitest";

import { decodePolyline, encodePolyline } from "./polyline";

describe("Google encoded polyline", () => {
  it("decodes and re-encodes the standard known fixture", () => {
    const coordinates = [
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ] as const;

    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual(coordinates);
    expect(encodePolyline(coordinates)).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  });

  it("rejects truncated, empty, and out-of-range geometry", () => {
    expect(() => decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq")).toThrow("Invalid encoded polyline");
    expect(() => decodePolyline("")).toThrow("Invalid encoded polyline");
    expect(() => encodePolyline([[91, 135]])).toThrow("Invalid coordinate");
  });
});
