// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  document.head.innerHTML = "";
  delete (window as unknown as { google?: unknown }).google;
  delete (window as unknown as { __japanTravelGoogleMapsReady?: unknown }).__japanTravelGoogleMapsReady;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadGoogleMaps", () => {
  it("injects the direct async weekly script once with Korean/Japan/referrer settings and imports maps plus marker", async () => {
    const { loadGoogleMaps } = await import("./map-script");
    const first = loadGoogleMaps("browser-key");
    const second = loadGoogleMaps("browser-key");
    const settlement = vi.fn();
    void first.then(settlement, settlement);
    const scripts = document.querySelectorAll<HTMLScriptElement>("script[data-google-maps-script]");

    expect(scripts).toHaveLength(1);
    const url = new URL(scripts[0].src);
    expect(url.origin + url.pathname).toBe("https://maps.googleapis.com/maps/api/js");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      key: "browser-key",
      loading: "async",
      v: "weekly",
      language: "ko",
      region: "JP",
      auth_referrer_policy: "origin",
      callback: "__japanTravelGoogleMapsReady",
    });

    scripts[0].dispatchEvent(new Event("load"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settlement).not.toHaveBeenCalled();

    const mapsLibrary = { Map: class {}, Polyline: class {}, LatLngBounds: class {} };
    const markerLibrary = { AdvancedMarkerElement: class {} };
    const importLibrary = vi.fn(async (name: string) => name === "maps" ? mapsLibrary : markerLibrary);
    (window as unknown as { google: unknown }).google = { maps: { importLibrary } };
    (window as unknown as { __japanTravelGoogleMapsReady: () => void }).__japanTravelGoogleMapsReady();

    await expect(first).resolves.toEqual({ maps: mapsLibrary, marker: markerLibrary });
    await expect(second).resolves.toEqual({ maps: mapsLibrary, marker: markerLibrary });
    expect(importLibrary.mock.calls.map(([name]) => name)).toEqual(["maps", "marker"]);
    expect((window as unknown as { __japanTravelGoogleMapsReady?: unknown }).__japanTravelGoogleMapsReady).toBeUndefined();
  });

  it("removes a failed script so a retry can insert a fresh one", async () => {
    const { loadGoogleMaps } = await import("./map-script");
    const failed = loadGoogleMaps("browser-key");
    document.querySelector<HTMLScriptElement>("script[data-google-maps-script]")?.dispatchEvent(new Event("error"));
    await expect(failed).rejects.toThrow("Google Maps 스크립트를 불러오지 못했습니다.");
    expect(document.querySelector("script[data-google-maps-script]")).toBeNull();
    expect((window as unknown as { __japanTravelGoogleMapsReady?: unknown }).__japanTravelGoogleMapsReady).toBeUndefined();

    void loadGoogleMaps("browser-key");
    expect(document.querySelectorAll("script[data-google-maps-script]")).toHaveLength(1);
  });
});
