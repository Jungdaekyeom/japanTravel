// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { GoogleTripMap } from "./GoogleTripMap";
import type { TravelerId } from "../../trip/travelers";
import { buildDayLayers, FULL_ROUTE_LINES } from "./placeholder-routes";

const animations: Array<{ stopped: boolean; complete: () => void; update: (value: number) => void }> = [];
vi.mock("./frame-animation", () => ({
  animateFrame: (_from: number, _to: number, options: { onUpdate: (value: number) => void; onComplete: () => void }) => {
    const item = {
      stopped: false,
      update: options.onUpdate,
      complete: () => { options.onUpdate(1); options.onComplete(); },
    };
    animations.push(item);
    return { stop: () => { item.stopped = true; } };
  },
}));

class FakeMap {
  static instances: FakeMap[] = [];
  static size = { width: 390, height: 844 };
  static automaticTiles = true;
  listeners = new Set<() => void>();
  addListener = (_event: string, callback: () => void) => {
    this.listeners.add(callback);
    return { remove: () => this.listeners.delete(callback) };
  };
  loadTiles() { this.listeners.forEach((listener) => listener()); }
  center: google.maps.LatLngLiteral;
  zoom: number;
  moveCamera = vi.fn((camera: { center: google.maps.LatLngLiteral; zoom: number }) => {
    this.center = camera.center;
    this.zoom = camera.zoom;
    if (FakeMap.automaticTiles) this.loadTiles();
  });
  fitBounds = vi.fn();
  setCenter = vi.fn();
  getCenter = () => ({ toJSON: () => this.center });
  getZoom = () => this.zoom;
  getDiv = () => this.element;
  constructor(readonly element: HTMLElement, readonly options: Record<string, unknown>) {
    this.center = options.center as google.maps.LatLngLiteral;
    this.zoom = options.zoom as number;
    Object.defineProperties(element, {
      clientWidth: { get: () => FakeMap.size.width },
      clientHeight: { get: () => FakeMap.size.height },
    });
    FakeMap.instances.push(this);
  }
}

class FakePolyline {
  static instances: FakePolyline[] = [];
  map: unknown;
  path: unknown;
  constructor(readonly options: Record<string, unknown>) {
    this.map = options.map;
    this.path = options.path;
    FakePolyline.instances.push(this);
  }
  setMap(map: unknown) { this.map = map; }
  setPath(path: unknown) { this.path = path; }
}

class FakeMarker {
  static instances: FakeMarker[] = [];
  map: unknown;
  constructor(readonly options: Record<string, unknown>) {
    this.map = options.map;
    FakeMarker.instances.push(this);
  }
}

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  element?: Element;
  observe = vi.fn((element: Element) => { this.element = element; });
  disconnect = vi.fn();
  constructor(readonly callback: ResizeObserverCallback) { FakeResizeObserver.instances.push(this); }
  resize(width: number, height: number) {
    FakeMap.size = { width, height };
    this.callback([{ contentRect: { width, height }, target: this.element } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

function pending() {
  return animations.filter((item) => !item.stopped);
}

function completeNext() {
  const item = pending().at(-1);
  if (!item) return;
  item.stopped = true;
  item.complete();
}

function cameraForAll(width = FakeMap.size.width, height = FakeMap.size.height) {
  const points = FULL_ROUTE_LINES.flatMap((line) => line.path);
  const east = Math.max(...points.map((point) => point.lng));
  const west = Math.min(...points.map((point) => point.lng));
  const north = Math.max(...points.map((point) => point.lat));
  const south = Math.min(...points.map((point) => point.lat));
  const mercatorY = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360));
  const zoom = Math.min(16,
    Math.log2((width - 108) / 256 / ((east - west) / 360)),
    Math.log2((height - 108) / 256 / ((mercatorY(north) - mercatorY(south)) / (Math.PI * 2))),
  );
  const centerY = (mercatorY(north) + mercatorY(south)) / 2;
  return {
    center: { lat: (2 * Math.atan(Math.exp(centerY)) - Math.PI / 2) * 180 / Math.PI, lng: (east + west) / 2 },
    zoom,
  };
}

beforeAll(() => {
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "browser-key";
  process.env.NEXT_PUBLIC_GOOGLE_MAP_ID = "test-map";
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  (window as unknown as { google: unknown }).google = { maps: { importLibrary: vi.fn(async (name: string) =>
    name === "maps" ? { Map: FakeMap, Polyline: FakePolyline } : { AdvancedMarkerElement: FakeMarker },
  ) } };
});

afterEach(() => {
  cleanup();
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "browser-key";
  animations.length = 0;
  FakeMap.instances = [];
  FakeMap.size = { width: 390, height: 844 };
  FakeMap.automaticTiles = true;
  FakePolyline.instances = [];
  FakeMarker.instances = [];
  FakeResizeObserver.instances = [];
});

afterAll(() => {
  Reflect.deleteProperty(process.env, "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
  Reflect.deleteProperty(process.env, "NEXT_PUBLIC_GOOGLE_MAP_ID");
  Reflect.deleteProperty(globalThis, "ResizeObserver");
  delete (window as unknown as { google?: unknown }).google;
});

describe("GoogleTripMap", () => {
  it("renders the full route in the actual map viewport and refits on resize", async () => {
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={null} playbackRequest={0} reducedMotion={false} onPlaybackComplete={vi.fn()} />);
    await waitFor(() => expect(FakeMap.instances[0]?.moveCamera).toHaveBeenCalled());
    const map = FakeMap.instances[0];
    expect(map.options).toMatchObject({ mapId: "test-map", renderingType: "VECTOR", tilt: 0, keyboardShortcuts: false, isFractionalZoomEnabled: true });
    expect(map.moveCamera).toHaveBeenLastCalledWith(cameraForAll());
    expect(FakePolyline.instances.filter((line) => line.options.zIndex === 1)).toHaveLength(FULL_ROUTE_LINES.length);
    FakeResizeObserver.instances[0].resize(844, 390);
    expect(map.moveCamera).toHaveBeenLastCalledWith(cameraForAll(844, 390));
  });

  it("keeps the schedule panel closed and shows the revised Day 1 plan", async () => {
    const onComplete = vi.fn();
    render(<GoogleTripMap selectedTravelerId="junsu" selectedDay={1} playbackRequest={1} reducedMotion onPlaybackComplete={onComplete} />);
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(1));
    const schedule = screen.getByText("1일차 · 10월 2일 예정 일정").closest("details");
    expect(schedule).not.toHaveAttribute("open");
    expect(schedule).toHaveTextContent("04:40 출발 · 이규열·박준수 · 버스 → 인천 T1");
    expect(screen.queryByText(/GMP→KIX/)).not.toBeInTheDocument();
    const selected = FakePolyline.instances.filter((line) => line.options.zIndex === 3);
    expect(selected).toHaveLength(buildDayLayers(1, FULL_ROUTE_LINES, undefined, "junsu").lines.length);
  });

  it("draws the Day 4 subway-and-walk itinerary and exposes its legend", async () => {
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={4} playbackRequest={1} reducedMotion onPlaybackComplete={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText("4일차 교통편")).toBeInTheDocument());
    expect(screen.getByText("도쿄 메트로 히비야선")).toBeInTheDocument();
    expect(screen.getByText("都営 도에이 오에도선")).toBeInTheDocument();
    expect(screen.getByText("都営 도에이 신주쿠선")).toBeInTheDocument();
    expect(screen.getByText("도쿄 메트로 긴자선")).toBeInTheDocument();
    expect(FakePolyline.instances.filter((line) => line.options.zIndex === 3).length).toBeGreaterThan(5);
  });

  it.each([null, "daekyeom", "gyujun", "gyuyeol", "junsu"] as (TravelerId | null)[])("uses the initial MAX camera for Day 5, including traveler %s", async (traveler) => {
    render(<GoogleTripMap selectedTravelerId={traveler} selectedDay={5} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);
    await waitFor(() => expect(pending()).toHaveLength(1));
    for (let stage = 0; stage < 4; stage += 1) act(() => completeNext());
    act(() => pending().at(-1)?.update(1));
    expect(FakeMap.instances[0].moveCamera).toHaveBeenLastCalledWith(cameraForAll());
  });

  it("preserves the growing route on resize and on unchanged route data refresh", async () => {
    const onComplete = vi.fn();
    const props = { selectedTravelerId: null, selectedDay: 2 as const, playbackRequest: 1, reducedMotion: false, onPlaybackComplete: onComplete };
    const { rerender } = render(<GoogleTripMap {...props} railRoutes={[]} />);
    await waitFor(() => expect(pending()).toHaveLength(1));
    act(() => completeNext());
    act(() => pending().at(-1)?.update(0.4));
    const line = FakePolyline.instances.find((item) => item.options.zIndex === 3)!;
    const before = JSON.stringify(line.path);
    const old = pending().at(-1)!;
    act(() => FakeResizeObserver.instances[0].resize(844, 390));
    expect(old.stopped).toBe(true);
    expect(JSON.stringify(line.path)).toBe(before);
    const count = animations.length;
    rerender(<GoogleTripMap {...props} railRoutes={[]} />);
    expect(animations).toHaveLength(count);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it.each([1, 2, 3, 4, 5] as const)("finishes day %s without a mid-playback fitBounds jump", async (day) => {
    const onComplete = vi.fn();
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={day} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onComplete} />);
    await waitFor(() => expect(pending()).toHaveLength(1));
    const stages = buildDayLayers(day).stages;
    for (let index = 0; index < stages.length; index++) act(() => completeNext());
    expect(onComplete).toHaveBeenCalledExactlyOnceWith(day);
    expect(FakeMap.instances[0].fitBounds).not.toHaveBeenCalled();
  });

  it("cancels stale playback when the selected traveler changes", async () => {
    const onComplete = vi.fn();
    const { rerender } = render(<GoogleTripMap selectedTravelerId="daekyeom" selectedDay={1} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onComplete} />);
    await waitFor(() => expect(pending()).toHaveLength(1));
    const old = pending()[0];
    rerender(<GoogleTripMap selectedTravelerId="gyujun" selectedDay={1} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onComplete} />);
    await waitFor(() => expect(old.stopped).toBe(true));
    expect(FakeMarker.instances.filter((marker) => marker.map !== null).map((marker) => (marker.options.content as HTMLElement).dataset.pinKey))
      .toEqual(expect.arrayContaining(["suwon", "gimpo", "kix"]));
  });

  it("falls back to a static itinerary when map configuration is missing", () => {
    Reflect.deleteProperty(process.env, "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={3} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);
    expect(screen.getByRole("region", { name: "정적 여행 일정" })).toHaveTextContent("hotel aima");
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "browser-key";
  });

  it("renders verified ground geometry solid while provisional paths stay dashed", async () => {
    render(<GoogleTripMap
      railRoutes={[]}
      groundRoutes={[{
        segmentKey: "mandeok-pus",
        verifiedAt: "2026-09-28T00:00:00.000Z",
        steps: [{ kind: "car", geometry: [[35.215263, 129.028309], [35.1796, 128.9382]] }],
      }]}
      selectedTravelerId={null}
      selectedDay={null}
      playbackRequest={0}
      reducedMotion={false}
      onPlaybackComplete={vi.fn()}
    />);
    await waitFor(() => expect(FakePolyline.instances.length).toBeGreaterThan(0));
    const solid = FakePolyline.instances.find((line) => JSON.stringify(line.path) === JSON.stringify([
      { lat: 35.215263, lng: 129.028309 },
      { lat: 35.1796, lng: 128.9382 },
    ]));
    expect(solid?.options.icons).toBeUndefined();
    expect(FakePolyline.instances.some((line) => line.options.icons !== undefined)).toBe(true);
  });

  it("makes a growing provisional route distinguishable from its background", async () => {
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={2} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);
    await waitFor(() => expect(pending()).toHaveLength(1));
    const background = FakePolyline.instances.find((line) => line.options.zIndex === 1)!;
    const foreground = FakePolyline.instances.find((line) => line.options.zIndex === 3)!;
    const baseIcons = background.options.icons as google.maps.IconSequence[];
    const activeIcons = foreground.options.icons as google.maps.IconSequence[];
    expect(activeIcons[0].icon!.strokeOpacity).toBeGreaterThan(baseIcons[0].icon!.strokeOpacity!);
    expect(activeIcons.some((icon) => icon.offset === "100%")).toBe(true);
    expect((foreground.path as unknown[]).length).toBe(1);
    act(() => completeNext());
    act(() => pending().at(-1)?.update(0.5));
    expect((foreground.path as unknown[]).length).toBeGreaterThan(1);
  });

  it("starts movement after visible map tiles load", async () => {
    FakeMap.automaticTiles = false;
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={2} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);
    await waitFor(() => expect(pending()).toHaveLength(1));
    act(() => completeNext());
    expect(pending()).toHaveLength(0);
    await act(async () => FakeMap.instances[0].loadTiles());
    expect(pending()).toHaveLength(1);
  });

  it("anchors markers at the dot and keeps the label out of their layout width", async () => {
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={4} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);
    await waitFor(() => expect(pending()).toHaveLength(1));
    for (const marker of FakeMarker.instances) {
      expect(marker.options).toMatchObject({ anchorLeft: "-50%", anchorTop: "-50%" });
    }
  });
});
