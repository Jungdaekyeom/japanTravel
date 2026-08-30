import { describe, expect, it, vi } from "vitest";

import { InMemoryTripRepository } from "../repository/memory";
import type { GoogleRoutesClient } from "./google-routes";
import {
  RouteFinalizationError,
  finalizeRailRoute,
  routeGeometryExpiry,
} from "./service";

const admin = { id: "daekyeom", role: "admin" as const };
const opensAt = new Date("2026-09-06T15:00:00.000Z");
const departureTime = "2026-10-02T01:00:00.000Z";
const naritaDepartureTime = "2026-10-06T01:00:00.000Z";
const odawaraDepartureTime = "2026-10-04T01:00:00.000Z";
const encodedPolyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

function client(result: string | Error = encodedPolyline): GoogleRoutesClient {
  return {
    computeRailRoute: vi.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    }),
  };
}

function errorCode(error: unknown) {
  return error instanceof RouteFinalizationError ? error.code : "unexpected";
}

describe("finalizeRailRoute", () => {
  it("blocks before 2026-09-07 00:00 JST without a Google request or cache write", async () => {
    const repository = new InMemoryTripRepository();
    const routes = client();

    await expect(finalizeRailRoute("kix-kyoto", { departureTime }, new Date(opensAt.getTime() - 1), {
      repository,
      client: routes,
      viewer: admin,
    })).rejects.toSatisfy((error) => errorCode(error) === "not_open");
    expect(routes.computeRailRoute).not.toHaveBeenCalled();
    await expect(repository.listRouteGeometry(opensAt)).resolves.toEqual([]);
  });

  it.each([
    ["non-admin", "kix-kyoto", { departureTime }, { role: "observer" as const }, "forbidden"],
    ["unknown segment", "odawara-hakone", { departureTime }, admin, "invalid_request"],
    ["invalid RFC3339", "kix-kyoto", { departureTime: "2026-10-02 10:00" }, admin, "invalid_request"],
    ["missing Narita choice", "tokyo-narita", { departureTime }, admin, "invalid_request"],
    ["legacy N'EX Narita choice", "tokyo-narita", { departureTime: naritaDepartureTime, naritaRailChoice: "nex" }, admin, "invalid_request"],
    ["choice on another segment", "kix-kyoto", { departureTime, naritaRailChoice: "nex" }, admin, "invalid_request"],
  ])("rejects %s at the server boundary", async (_case, segmentKey, input, viewer, code) => {
    const routes = client();
    await expect(finalizeRailRoute(segmentKey, input, opensAt, {
      repository: new InMemoryTripRepository(),
      client: routes,
      viewer,
    })).rejects.toSatisfy((error) => errorCode(error) === code);
    expect(routes.computeRailRoute).not.toHaveBeenCalled();
  });

  it.each([
    ["kix-kyoto", "2026-10-02T15:00:00.000Z", undefined],
    ["kyoto-odawara", "2026-10-02T14:59:59.000Z", undefined],
    ["odawara-tokyo", "2026-10-03T14:59:59.000Z", undefined],
    ["tokyo-narita", "2026-10-05T14:59:59.000Z", "skyliner"],
  ])("rejects a %s departure outside its Asia/Tokyo trip day without calling Google", async (segmentKey, invalidDepartureTime, naritaRailChoice) => {
    const routes = client();

    await expect(finalizeRailRoute(segmentKey, {
      departureTime: invalidDepartureTime,
      ...(naritaRailChoice ? { naritaRailChoice } : {}),
    }, opensAt, {
      repository: new InMemoryTripRepository(),
      client: routes,
      viewer: admin,
    })).rejects.toSatisfy((error) => errorCode(error) === "invalid_departure_date");
    expect(routes.computeRailRoute).not.toHaveBeenCalled();
  });

  it("converts an offset RFC3339 instant to the Asia/Tokyo calendar date", async () => {
    const routes = client();
    const offsetDepartureTime = "2026-10-01T16:00:00.000-07:00";

    await finalizeRailRoute("kix-kyoto", { departureTime: offsetDepartureTime }, opensAt, {
      repository: new InMemoryTripRepository(),
      client: routes,
      viewer: admin,
    });

    expect(routes.computeRailRoute).toHaveBeenCalledWith({
      segmentKey: "kix-kyoto",
      departureTime: offsetDepartureTime,
      naritaRailChoice: null,
    });
  });

  it("stores one encoded polyline with the fixed Skyliner choice and capped expiry", async () => {
    const repository = new InMemoryTripRepository();
    const routes = client();

    const record = await finalizeRailRoute("tokyo-narita", { departureTime: naritaDepartureTime, naritaRailChoice: "skyliner" }, opensAt, {
      repository,
      client: routes,
      viewer: admin,
    });

    expect(routes.computeRailRoute).toHaveBeenCalledWith({
      segmentKey: "tokyo-narita",
      departureTime: naritaDepartureTime,
      naritaRailChoice: "skyliner",
    });
    expect(record).toEqual({
      segmentKey: "tokyo-narita",
      status: "finalized",
      encodedPolyline,
      departureTime: naritaDepartureTime,
      naritaRailChoice: "skyliner",
      createdAt: opensAt,
      expiresAt: new Date("2026-10-06T15:00:00.000Z"),
    });
    await expect(repository.findRouteGeometry("tokyo-narita", opensAt)).resolves.toEqual(record);
  });

  it("uses createdAt plus 30 days when it is earlier than the hard cap", () => {
    expect(routeGeometryExpiry(new Date("2026-08-28T00:00:00.000Z"))).toEqual(new Date("2026-09-27T00:00:00.000Z"));
    expect(routeGeometryExpiry(opensAt)).toEqual(new Date("2026-10-06T15:00:00.000Z"));
  });

  it("leaves an existing cache record unchanged when Google fails", async () => {
    const existing = {
      segmentKey: "kix-kyoto" as const,
      status: "finalized" as const,
      encodedPolyline: "??_ibE_ibE",
      departureTime: "2026-10-02T00:00:00.000Z",
      naritaRailChoice: null,
      createdAt: opensAt,
      expiresAt: new Date("2026-10-06T15:00:00.000Z"),
    };
    const repository = new InMemoryTripRepository({ routeGeometry: [existing] });

    await expect(finalizeRailRoute("kix-kyoto", { departureTime }, opensAt, {
      repository,
      client: client(new Error("private upstream failure")),
      viewer: admin,
    })).rejects.toThrow("private upstream failure");
    await expect(repository.findRouteGeometry("kix-kyoto", opensAt)).resolves.toEqual(existing);
  });

  it.each([
    ["one point", "??"],
    ["duplicate points", "????"],
    ["oversized encoding", "A?".repeat(50_001)],
    ["excessive points", "A?".repeat(10_001)],
  ])("does not cache %s returned by the Google boundary", async (_case, invalidPolyline) => {
    const repository = new InMemoryTripRepository();

    await expect(finalizeRailRoute("kix-kyoto", { departureTime }, opensAt, {
      repository,
      client: client(invalidPolyline),
      viewer: admin,
    })).rejects.toThrow("Invalid encoded polyline");
    await expect(repository.listRouteGeometry(opensAt)).resolves.toEqual([]);
  });

  it("keeps one valid row when concurrent finalizations target the same segment", async () => {
    const repository = new InMemoryTripRepository();
    await Promise.all([
      finalizeRailRoute("odawara-tokyo", { departureTime: odawaraDepartureTime }, opensAt, { repository, client: client("??_ibE_ibE"), viewer: admin }),
      finalizeRailRoute("odawara-tokyo", { departureTime: odawaraDepartureTime }, opensAt, { repository, client: client(encodedPolyline), viewer: admin }),
    ]);

    const records = await repository.listRouteGeometry(opensAt);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ segmentKey: "odawara-tokyo", status: "finalized" });
  });
});
