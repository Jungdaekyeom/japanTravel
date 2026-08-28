import { describe, expect, it } from "vitest";

import {
  MAX_ENCODED_POLYLINE_LENGTH,
  MAX_POLYLINE_POINTS,
  decodePolyline,
  encodePolyline,
} from "./polyline";

const ENCODED_LIMIT = 100_000;
const POINT_LIMIT = 10_000;

describe("Google encoded polyline", () => {
  it("publishes conservative encoded and decoded limits", () => {
    expect(MAX_ENCODED_POLYLINE_LENGTH).toBe(ENCODED_LIMIT);
    expect(MAX_POLYLINE_POINTS).toBe(POINT_LIMIT);
  });

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

  it.each([
    ["a one-point path", "??"],
    ["a duplicate-only path", "????"],
  ])("rejects %s as non-drawable", (_case, encoded) => {
    expect(() => decodePolyline(encoded)).toThrow("Invalid encoded polyline");
  });

  it("rejects one-point and duplicate-only coordinate inputs", () => {
    expect(() => encodePolyline([[0, 0]])).toThrow("Invalid coordinate");
    expect(() => encodePolyline([[0, 0], [0, 0]])).toThrow("Invalid coordinate");
  });

  it("rejects oversized encoded input and excessive decoded points", () => {
    expect(() => decodePolyline("A?".repeat(ENCODED_LIMIT / 2 + 1))).toThrow("Invalid encoded polyline");
    expect(() => decodePolyline("A?".repeat(POINT_LIMIT + 1))).toThrow("Invalid encoded polyline");
  });

  it("rejects excessive coordinate input and output beyond the encoded limit", () => {
    const excessivePoints = Array.from({ length: POINT_LIMIT + 1 }, (_, index) => [index / 1e5, 0] as const);
    const excessiveEncoding = Array.from({ length: POINT_LIMIT }, (_, index) => index % 2 === 0
      ? [90, 180] as const
      : [-90, -180] as const);

    expect(() => encodePolyline(excessivePoints)).toThrow("Invalid coordinate");
    expect(() => encodePolyline(excessiveEncoding)).toThrow("Invalid coordinate");
  });

  it.each([
    ["a noncanonical zero varint", "_??A?"],
    ["a varint continuing at shift 30", "______??A?"],
  ])("rejects %s", (_case, encoded) => {
    expect(() => decodePolyline(encoded)).toThrow("Invalid encoded polyline");
  });
});
