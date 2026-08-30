// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { GoogleTripMap } from "./GoogleTripMap";

const finalRailRoute = {
  segmentKey: "kix-kyoto" as const,
  status: "finalized" as const,
  label: "철도 이동" as const,
  geometry: [[34.44, 135.25], [35.01, 135.77]] as const,
};

class FakeBounds {
  points: unknown[] = [];
  extend(point: unknown) { this.points.push(point); return this; }
}

class FakeMap {
  static instances: FakeMap[] = [];
  fitBounds = vi.fn();
  constructor(readonly element: HTMLElement, readonly options: Record<string, unknown>) { FakeMap.instances.push(this); }
}

class FakePolyline {
  static instances: FakePolyline[] = [];
  path: unknown;
  map: unknown;
  constructor(readonly options: Record<string, unknown>) {
    this.path = options.path;
    this.map = options.map;
    FakePolyline.instances.push(this);
  }
  setPath(path: unknown) { this.path = path; }
  setMap(map: unknown) { this.map = map; }
  setOptions(options: Record<string, unknown>) { Object.assign(this.options, options); }
}

class FakeAdvancedMarkerElement {
  static instances: FakeAdvancedMarkerElement[] = [];
  map: unknown;
  constructor(readonly options: Record<string, unknown>) {
    this.map = options.map;
    FakeAdvancedMarkerElement.instances.push(this);
  }
}

const mapsLibrary = { Map: FakeMap, Polyline: FakePolyline, LatLngBounds: FakeBounds };
const markerLibrary = { AdvancedMarkerElement: FakeAdvancedMarkerElement };

function installGoogleBoundary() {
  const importLibrary = vi.fn(async (name: string) => name === "maps" ? mapsLibrary : markerLibrary);
  (window as unknown as { google: unknown }).google = { maps: { importLibrary } };
  return importLibrary;
}

function installFrames() {
  let nextId = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = ++nextId;
    callbacks.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => callbacks.delete(id));
  return {
    pending: () => callbacks.size,
    step(time: number) {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback(time));
    },
  };
}

beforeAll(() => {
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "browser-key";
  process.env.NEXT_PUBLIC_GOOGLE_MAP_ID = "test-map-id";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  FakeMap.instances = [];
  FakePolyline.instances = [];
  FakeAdvancedMarkerElement.instances = [];
});

afterAll(() => {
  Reflect.deleteProperty(process.env, "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
  Reflect.deleteProperty(process.env, "NEXT_PUBLIC_GOOGLE_MAP_ID");
  delete (window as unknown as { google?: unknown }).google;
});

describe("GoogleTripMap", () => {
  it("recovers a selected-day script failure with the final overlay and no duplicate completion or replay", async () => {
    const frames = installFrames();
    const onPlaybackComplete = vi.fn();
    delete (window as unknown as { google?: unknown }).google;
    render(<GoogleTripMap railRoutes={[finalRailRoute]} selectedDay={3} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);
    const script = document.querySelector<HTMLScriptElement>("script[data-google-maps-script]");
    expect(script).not.toBeNull();
    expect(screen.queryByText("Powered by Google, ©2026 Google")).not.toBeInTheDocument();
    script?.dispatchEvent(new Event("error"));

    expect(await screen.findByRole("region", { name: "정적 여행 일정" })).toBeInTheDocument();
    await waitFor(() => expect(onPlaybackComplete).toHaveBeenCalledTimes(1));
    installGoogleBoundary();
    fireEvent.click(screen.getByRole("button", { name: "지도 다시 불러오기" }));

    await waitFor(() => expect(screen.getByLabelText("여행 경로 지도")).toBeInTheDocument());
    await waitFor(() => expect(FakeMap.instances).toHaveLength(1));
    expect(onPlaybackComplete).toHaveBeenCalledTimes(1);
    expect(frames.pending()).toBe(0);
    await waitFor(() => {
      const selected = FakePolyline.instances.find(({ options }) => options.zIndex === 3);
      expect((selected?.path as Array<{ lat: number; lng: number }> | undefined)?.at(-1)).toEqual({ lat: 35.25626, lng: 139.15582 });
    });
  });

  it("cancels the previous live playback and overlay before starting only the newly selected day", async () => {
    const frames = installFrames();
    installGoogleBoundary();
    const onPlaybackComplete = vi.fn();
    const { rerender } = render(<GoogleTripMap selectedDay={1} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);

    await waitFor(() => expect(frames.pending()).toBe(1));
    const firstSelection = FakePolyline.instances.filter(({ options }) => options.zIndex === 3);
    expect(firstSelection.map(({ options }) => options.path).length).toBeGreaterThan(0);
    frames.step(0);

    rerender(<GoogleTripMap selectedDay={2} playbackRequest={2} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);
    await waitFor(() => expect(frames.pending()).toBe(1));
    expect(firstSelection.every(({ map }) => map === null)).toBe(true);

    frames.step(0);
    frames.step(1400);
    frames.step(1850);
    frames.step(2400);

    expect(onPlaybackComplete).toHaveBeenCalledTimes(1);
    expect(onPlaybackComplete).toHaveBeenCalledWith(2);
    expect(FakePolyline.instances.filter(({ options, map }) => options.zIndex === 3 && map !== null).map(({ options }) => options.path)).toHaveLength(2);
  });

  it("keeps the map and active playback when polling returns equivalent rail geometry", async () => {
    const frames = installFrames();
    installGoogleBoundary();
    const onPlaybackComplete = vi.fn();
    const { rerender } = render(<GoogleTripMap railRoutes={[finalRailRoute]} selectedDay={3} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);

    await waitFor(() => expect(frames.pending()).toBe(1));
    frames.step(0);
    frames.step(700);
    const selectedLine = FakePolyline.instances.find(({ options }) => options.zIndex === 3);
    const baseLineCount = FakePolyline.instances.filter(({ options }) => options.zIndex === 1).length;

    const equivalentRoute = {
      ...finalRailRoute,
      geometry: finalRailRoute.geometry.map(([latitude, longitude]) => [latitude, longitude] as const),
    };
    rerender(<GoogleTripMap railRoutes={[equivalentRoute]} selectedDay={3} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);
    await act(async () => {});

    expect(FakeMap.instances).toHaveLength(1);
    expect(FakePolyline.instances.filter(({ options }) => options.zIndex === 1)).toHaveLength(baseLineCount);
    expect(selectedLine?.map).toBe(FakeMap.instances[0]);
    expect(FakePolyline.instances.filter(({ options }) => options.zIndex === 3 && options.map === FakeMap.instances[0])).toHaveLength(3);
    expect(frames.pending()).toBe(1);

    for (const time of [1000, 2400, 3400, 3850, 4300, 4750]) frames.step(time);
    expect(onPlaybackComplete).toHaveBeenCalledOnce();
  });

  it("updates changed base rail geometry without recreating the map", async () => {
    installGoogleBoundary();
    const { rerender } = render(<GoogleTripMap railRoutes={[finalRailRoute]} selectedDay={null} playbackRequest={0} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(FakeMap.instances).toHaveLength(1));
    const originalBaseLines = FakePolyline.instances.filter(({ options }) => options.zIndex === 1);
    const changedGeometry = [{ lat: 34.44, lng: 135.25 }, { lat: 34.8, lng: 135.5 }, { lat: 35.1, lng: 135.8 }];
    rerender(<GoogleTripMap railRoutes={[{ ...finalRailRoute, geometry: changedGeometry.map(({ lat, lng }) => [lat, lng] as const) }]} selectedDay={null} playbackRequest={0} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => {
      expect(FakePolyline.instances.some(({ options, path, map }) => options.zIndex === 1 && map !== null && JSON.stringify(path) === JSON.stringify(changedGeometry))).toBe(true);
    });
    expect(FakeMap.instances).toHaveLength(1);
    expect(originalBaseLines.every(({ map }) => map === null)).toBe(true);
    expect(screen.getByText("Powered by Google, ©2026 Google")).toBeInTheDocument();
  });

  it("loads a muted map with a map ID, Advanced Markers, full route, and four textual rail placeholders", async () => {
    const importLibrary = installGoogleBoundary();
    render(<GoogleTripMap selectedDay={null} playbackRequest={0} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(FakeMap.instances).toHaveLength(1));
    expect(FakeMap.instances[0].options).toMatchObject({ mapId: "test-map-id", disableDefaultUI: true });
    expect(importLibrary.mock.calls.map(([name]) => name)).toEqual([]);
    await waitFor(() => expect(FakePolyline.instances.some(({ options }) => options.zIndex === 1)).toBe(true));
    expect(FakeAdvancedMarkerElement.instances.length).toBeGreaterThanOrEqual(16);
    expect(screen.getAllByText(/경로 확정 전$/)).toHaveLength(5);
    expect(screen.getByText("전체 경로")).toBeInTheDocument();
  });

  it("shows only the trip edge labels before a day is selected", async () => {
    installGoogleBoundary();
    render(<GoogleTripMap selectedDay={null} playbackRequest={0} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(FakeAdvancedMarkerElement.instances.length).toBeGreaterThanOrEqual(16));
    expect(FakeAdvancedMarkerElement.instances.flatMap(({ options }) => {
      const content = options.content as HTMLElement;
      return content.dataset.labelVisible === "true" ? [content.textContent] : [];
    })).toEqual(["PUS · 부산 출발", "ICN · 인천 출발", "간사이국제공항", "나리타국제공항"]);
  });

  it("limits horizontal panning to small margins beyond Incheon and Narita", async () => {
    installGoogleBoundary();
    render(<GoogleTripMap selectedDay={null} playbackRequest={0} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(FakeMap.instances).toHaveLength(1));
    const restriction = FakeMap.instances[0].options.restriction as google.maps.MapRestriction;
    const limits = restriction.latLngBounds as google.maps.LatLngBoundsLiteral;

    expect(restriction.strictBounds).toBe(false);
    expect(limits.west).toBeGreaterThanOrEqual(125);
    expect(limits.west).toBeLessThan(126.4407);
    expect(limits.east).toBeGreaterThan(140.3929);
    expect(limits.east).toBeLessThanOrEqual(142);
  });

  it("draws final rail geometry on Google Maps and shows attribution only while it is visible", async () => {
    installGoogleBoundary();
    render(<GoogleTripMap railRoutes={[finalRailRoute]} selectedDay={null} playbackRequest={0} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(FakeMap.instances).toHaveLength(1));
    const finalized = FakePolyline.instances.find(({ options }) => options.zIndex === 1 && options.path === FakePolyline.instances.find(({ path }) => JSON.stringify(path) === JSON.stringify([{ lat: 34.44, lng: 135.25 }, { lat: 35.01, lng: 135.77 }]))?.path);
    expect(finalized?.options.icons).toBeUndefined();
    expect(screen.getByText("Powered by Google, ©2026 Google")).toBeInTheDocument();
    expect(screen.getByText(/철도 이동$/)).toBeInTheDocument();
    expect(screen.getAllByText(/경로 확정 전$/)).toHaveLength(4);
  });

  it("draws selected rail segments with their operator colors", async () => {
    installGoogleBoundary();
    render(<GoogleTripMap selectedDay={3} playbackRequest={1} reducedMotion onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(FakePolyline.instances.filter(({ options }) => options.zIndex === 3)).toHaveLength(3));
    expect(FakePolyline.instances.filter(({ options }) => options.zIndex === 3).map(({ options }) => options.strokeColor)).toEqual([
      "#F49D19",
      "#F68B1E",
      "#80C342",
    ]);
  });

  it("completes one reduced-motion playback per request while retaining the full route", async () => {
    installGoogleBoundary();
    const onPlaybackComplete = vi.fn();
    const { rerender } = render(<GoogleTripMap selectedDay={1} playbackRequest={1} reducedMotion onPlaybackComplete={onPlaybackComplete} />);

    await waitFor(() => expect(onPlaybackComplete).toHaveBeenCalledTimes(1));
    expect(FakePolyline.instances.some(({ options, map }) => options.zIndex === 1 && map !== null)).toBe(true);
    expect(FakeMap.instances[0].fitBounds).toHaveBeenCalled();

    rerender(<GoogleTripMap selectedDay={1} playbackRequest={1} reducedMotion onPlaybackComplete={onPlaybackComplete} />);
    expect(onPlaybackComplete).toHaveBeenCalledTimes(1);
    rerender(<GoogleTripMap selectedDay={1} playbackRequest={2} reducedMotion onPlaybackComplete={onPlaybackComplete} />);
    await waitFor(() => expect(onPlaybackComplete).toHaveBeenCalledTimes(2));
  });

  it("retains Day 4 selection on its three Tokyo pins without adding a route line", async () => {
    installGoogleBoundary();
    const onPlaybackComplete = vi.fn();
    render(<GoogleTripMap selectedDay={4} playbackRequest={1} reducedMotion onPlaybackComplete={onPlaybackComplete} />);

    await waitFor(() => expect(onPlaybackComplete).toHaveBeenCalledOnce());
    expect(FakePolyline.instances.filter(({ options }) => options.zIndex === 3)).toHaveLength(0);
    const visibleLabels = FakeAdvancedMarkerElement.instances.flatMap(({ options }) => {
      const content = options.content as HTMLElement;
      return content.dataset.labelVisible === "true" ? [content.textContent] : [];
    });
    expect(visibleLabels).toEqual(["아키하바라", "긴자"]);
  });

  it("shows only the current segment endpoints while Day 1 plays", async () => {
    const frames = installFrames();
    installGoogleBoundary();
    render(<GoogleTripMap selectedDay={1} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(frames.pending()).toBe(1));
    frames.step(0);
    const visibleLabels = () => FakeAdvancedMarkerElement.instances.flatMap(({ options }) => {
      const content = options.content as HTMLElement;
      return content.dataset.labelVisible === "true" ? [content.textContent] : [];
    });
    expect(visibleLabels()).toEqual(["PUS · 부산 출발", "ICN · 인천 출발", "간사이국제공항"]);

    frames.step(2400);
    expect(visibleLabels()).toEqual(["간사이국제공항", "교토역"]);
  });

  it("fits only KIX and Kyoto Station once during the Day 1 focus stage", async () => {
    const frames = installFrames();
    installGoogleBoundary();
    render(<GoogleTripMap selectedDay={1} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(frames.pending()).toBe(1));
    const map = FakeMap.instances[0];
    const beforeFocus = map.fitBounds.mock.calls.length;
    frames.step(0);
    frames.step(2400);
    expect(map.fitBounds).toHaveBeenCalledTimes(beforeFocus + 1);
    expect(map.fitBounds.mock.calls.at(-1)?.[0]).toEqual({ east: 135.758767, north: 34.985849, south: 34.4347, west: 135.244 });
    frames.step(2500);
    expect(map.fitBounds).toHaveBeenCalledTimes(beforeFocus + 1);
  });

  it("falls back and completes the static selection instead of leaving a blank or pending map when the public key is missing", async () => {
    Reflect.deleteProperty(process.env, "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
    const onPlaybackComplete = vi.fn();
    render(<GoogleTripMap railRoutes={[finalRailRoute]} selectedDay={3} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);

    expect(screen.getByRole("region", { name: "정적 여행 일정" })).toBeInTheDocument();
    expect(screen.getByText("3일차 일정")).toBeInTheDocument();
    expect(screen.getAllByText("경로 확정 전")).toHaveLength(4);
    expect(screen.queryByText("Powered by Google, ©2026 Google")).not.toBeInTheDocument();
    expect(screen.queryByText("철도 이동")).not.toBeInTheDocument();
    await waitFor(() => expect(onPlaybackComplete).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "지도 다시 불러오기" }));
    expect(screen.getByRole("alert")).toHaveTextContent("지도 설정을 다시 확인했습니다");
    expect(onPlaybackComplete).toHaveBeenCalledOnce();
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "browser-key";
  });
});
