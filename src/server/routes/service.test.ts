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

  it("stores one encoded polyline with the Narita choice and capped expiry", async () => {
    const repository = new InMemoryTripRepository();
    const routes = client();

    const record = await finalizeRailRoute("tokyo-narita", { departureTime, naritaRailChoice: "nex" }, opensAt, {
      repository,
      client: routes,
      viewer: admin,
    });

    expect(routes.computeRailRoute).toHaveBeenCalledWith({
      segmentKey: "tokyo-narita",
      departureTime,
      naritaRailChoice: "nex",
    });
    expect(record).toEqual({
      segmentKey: "tokyo-narita",
      status: "finalized",
      encodedPolyline,
      departureTime,
      naritaRailChoice: "nex",
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

  it("keeps one valid row when concurrent finalizations target the same segment", async () => {
    const repository = new InMemoryTripRepository();
    await Promise.all([
      finalizeRailRoute("odawara-tokyo", { departureTime }, opensAt, { repository, client: client("??_ibE_ibE"), viewer: admin }),
      finalizeRailRoute("odawara-tokyo", { departureTime }, opensAt, { repository, client: client(encodedPolyline), viewer: admin }),
    ]);

    const records = await repository.listRouteGeometry(opensAt);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ segmentKey: "odawara-tokyo", status: "finalized" });
  });
});
