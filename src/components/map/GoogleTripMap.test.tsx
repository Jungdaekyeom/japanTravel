// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { DayNumber } from "../../trip/public";

const motionState = vi.hoisted(() => ({
  animations: [] as Array<{
    stopped: boolean;
    completed: boolean;
    onUpdate?: (value: number) => void;
    onComplete?: () => void;
  }>,
}));

vi.mock("./frame-animation", () => ({
  animateFrame: (_from: number, _to: number, options: { onUpdate?: (value: number) => void; onComplete?: () => void }) => {
    const animation = { stopped: false, completed: false, onUpdate: options.onUpdate, onComplete: options.onComplete };
    motionState.animations.push(animation);
    return { stop() { animation.stopped = true; } };
  },
}));

import { GoogleTripMap } from "./GoogleTripMap";
import { FULL_ROUTE_LINES, FULL_ROUTE_PINS } from "./placeholder-routes";

const MAP_DIMENSIONS = [
  [360, 780],
  [393, 852],
  [412, 915],
  [884, 1104],
] as const;
const OVERVIEW_ROUTE_BOUNDS = { east: 140.3929, north: 37.5934167, south: 34.3904, west: 126.41747 };
const AUTHORED_FOCUS_STAGES = [
  { day: 1, stageIndex: 0, keys: ["mandeok", "busan"], padding: 54 },
  { day: 1, stageIndex: 1, keys: ["busan", "gimpo", "kix"], padding: 54 },
  { day: 1, stageIndex: 2, keys: ["kix", "kyoto"], padding: 54 },
  { day: 1, stageIndex: 4, keys: ["kyoto", "kiyomizu", "ginkaku", "kinkaku"], padding: 54 },
  { day: 2, stageIndex: 0, keys: ["kyoto", "odawara"], padding: 54 },
  { day: 2, stageIndex: 2, keys: ["odawara", "hakone"], padding: 54 },
  { day: 3, stageIndex: 0, keys: ["hakone", "odawara"], padding: 54 },
  { day: 3, stageIndex: 2, keys: ["odawara", "ueno"], padding: 54 },
  { day: 3, stageIndex: 4, keys: ["ueno", "shinjuku", "shibuya"], padding: 54 },
  { day: 4, stageIndex: 0, keys: ["akihabara", "sensoji", "ginza"], padding: 54 },
  { day: 5, stageIndex: 0, keys: ["ueno", "nrt"], padding: 54 },
  { day: 5, stageIndex: 2, keys: ["nrt", "busan", "incheon"], padding: 54 },
  { day: 5, stageIndex: 4, keys: ["busan", "incheon", "mandeok", "suwon", "icheon"], padding: 54 },
] as const;

const DAY_RENDER_EXPECTATIONS = [
  {
    day: 1,
    stageLabels: [
      ["김해국제공항"],
      ["김해국제공항"],
      ["간사이국제공항", "교토역"],
      ["간사이국제공항", "교토역"],
      ["교토역", "기요미즈데라", "금각사", "은각사"],
      ["교토역", "기요미즈데라"],
      ["기요미즈데라", "은각사"],
      ["금각사", "은각사"],
      ["교토역", "금각사"],
    ],
    terminalLabels: ["김해국제공항", "김포국제공항", "교토역"],
    lineKeys: [
      "mandeok-pus", "suwon-gmp", "icheon-gmp", "pus-kix", "gmp-kix", "kix-kyoto",
      "kyoto-kiyomizu-bus", "kyoto-kiyomizu-walk",
      "kiyomizu-ginkaku-walk-start", "kiyomizu-ginkaku-bus", "kiyomizu-ginkaku-walk-end",
      "ginkaku-kinkaku-walk-start", "ginkaku-kinkaku-bus", "ginkaku-kinkaku-walk-end",
      "kinkaku-kyoto-walk", "kinkaku-kyoto-bus",
    ],
    pinTitles: ["김해국제공항", "김포국제공항", "간사이국제공항", "교토역", "기요미즈데라", "금각사", "은각사"],
  },
  {
    day: 2,
    stageLabels: [
      ["교토역", "오다와라역"],
      ["교토역", "오다와라역"],
      ["오다와라역", "하코네유모토역"],
      ["오다와라역", "하코네유모토역"],
    ],
    terminalLabels: ["교토역", "하코네유모토역"],
    lineKeys: ["kyoto-odawara", "odawara-hakone"],
    pinTitles: ["교토역", "오다와라역", "하코네유모토역"],
  },
  {
    day: 3,
    stageLabels: [
      ["오다와라역", "하코네유모토역"],
      ["오다와라역", "하코네유모토역"],
      ["오다와라역", "우에노역"],
      ["오다와라역", "우에노역"],
      ["우에노역", "신주쿠", "시부야"],
      ["우에노역"],
      ["신주쿠"],
      ["시부야"],
    ],
    terminalLabels: ["하코네유모토역", "시부야"],
    lineKeys: ["hakone-odawara", "odawara-tokyo"],
    pinTitles: ["오다와라역", "하코네유모토역", "우에노역", "신주쿠", "시부야"],
  },
  {
    day: 4,
    stageLabels: [
      ["아키하바라", "센소지", "긴자"],
      ["아키하바라"],
      ["센소지"],
      ["긴자"],
    ],
    terminalLabels: ["아키하바라", "긴자"],
    lineKeys: [],
    pinTitles: ["아키하바라", "센소지", "긴자"],
  },
  {
    day: 5,
    stageLabels: [
      ["우에노역", "나리타국제공항"],
      ["우에노역", "나리타국제공항"],
      ["김해국제공항", "인천국제공항", "나리타국제공항"],
      ["김해국제공항", "인천국제공항", "나리타국제공항"],
      ["김해국제공항", "인천국제공항"],
      ["김해국제공항", "인천국제공항"],
    ],
    terminalLabels: ["우에노역"],
    lineKeys: ["tokyo-narita", "nrt-pus", "nrt-icn", "pus-mandeok", "icn-suwon", "icn-icheon"],
    pinTitles: ["김해국제공항", "인천국제공항", "우에노역", "나리타국제공항"],
  },
] as const satisfies readonly {
  day: DayNumber;
  stageLabels: readonly (readonly string[])[];
  terminalLabels: readonly string[];
  lineKeys: readonly string[];
  pinTitles: readonly string[];
}[];

const finalRailRoute = {
  segmentKey: "kix-kyoto" as const,
  status: "finalized" as const,
  label: "철도 이동" as const,
  geometry: [[34.44, 135.25], [35.01, 135.77]] as const,
};

class FakeMap {
  static instances: FakeMap[] = [];
  static viewport = { width: 390, height: 844 };
  center: google.maps.LatLngLiteral;
  zoom: number;
  fitBounds = vi.fn();
  setCenter = vi.fn((center: google.maps.LatLngLiteral) => { this.center = center; });
  moveCamera = vi.fn((camera: { center: google.maps.LatLngLiteral; zoom: number }) => {
    this.center = camera.center;
    this.zoom = camera.zoom;
  });
  getCenter = vi.fn(() => ({ toJSON: () => this.center }));
  getZoom = vi.fn(() => this.zoom);
  getDiv = vi.fn(() => this.element);
  constructor(readonly element: HTMLElement, readonly options: Record<string, unknown>) {
    this.center = options.center as google.maps.LatLngLiteral;
    this.zoom = options.zoom as number;
    Object.defineProperties(element, {
      clientWidth: { get: () => FakeMap.viewport.width },
      clientHeight: { get: () => FakeMap.viewport.height },
    });
    FakeMap.instances.push(this);
  }
}

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observe = vi.fn((element: Element) => { this.element = element; });
  disconnect = vi.fn();
  private element?: Element;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  resize(width: number, height: number) {
    FakeMap.viewport = { width, height };
    if (!this.element) throw new Error("ResizeObserver has no observed element");
    this.callback([{ target: this.element, contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
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
  setPath = vi.fn((path: unknown) => { this.path = path; });
  setMap(map: unknown) { this.map = map; }
}

class FakeAdvancedMarkerElement {
  static instances: FakeAdvancedMarkerElement[] = [];
  map: unknown;
  constructor(readonly options: Record<string, unknown>) {
    this.map = options.map;
    FakeAdvancedMarkerElement.instances.push(this);
  }
}

const mapsLibrary = { Map: FakeMap, Polyline: FakePolyline };
const markerLibrary = { AdvancedMarkerElement: FakeAdvancedMarkerElement };

function installGoogleBoundary() {
  const importLibrary = vi.fn(async (name: string) => name === "maps" ? mapsLibrary : markerLibrary);
  (window as unknown as { google: unknown }).google = { maps: { importLibrary } };
  return importLibrary;
}

function installMotion() {
  motionState.animations = [];
  const current = () => motionState.animations.filter(({ stopped, completed }) => !stopped && !completed).at(-1);
  return {
    pending: () => motionState.animations.filter(({ stopped, completed }) => !stopped && !completed).length,
    update(value: number) {
      current()?.onUpdate?.(value);
    },
    complete() {
      const animation = current();
      if (!animation) return;
      animation.onUpdate?.(1);
      animation.completed = true;
      animation.onComplete?.();
    },
  };
}

beforeAll(() => {
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "browser-key";
  process.env.NEXT_PUBLIC_GOOGLE_MAP_ID = "test-map-id";
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  FakeMap.instances = [];
  FakeMap.viewport = { width: 390, height: 844 };
  FakePolyline.instances = [];
  FakeAdvancedMarkerElement.instances = [];
  FakeResizeObserver.instances = [];
});

afterAll(() => {
  Reflect.deleteProperty(process.env, "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
  Reflect.deleteProperty(process.env, "NEXT_PUBLIC_GOOGLE_MAP_ID");
  delete (window as unknown as { google?: unknown }).google;
  Reflect.deleteProperty(globalThis, "ResizeObserver");
});

function expectedFocusCamera(keys: readonly string[], width: number, height: number, padding: number) {
  const points = focusPoints(keys);
  return expectedBoundsCamera({
    north: Math.max(...points.map(({ lat }) => lat)),
    south: Math.min(...points.map(({ lat }) => lat)),
    east: Math.max(...points.map(({ lng }) => lng)),
    west: Math.min(...points.map(({ lng }) => lng)),
  }, width, height, padding);
}

function focusPoints(keys: readonly string[]) {
  const pins = FULL_ROUTE_PINS.filter((pin) => keys.includes(pin.key)).map((pin) => pin.position);
  const paths = FULL_ROUTE_LINES
    .filter((line) => line.pinKeys.every((key) => keys.includes(key)))
    .flatMap((line) => line.path);
  return [...pins, ...paths];
}

function expectedBoundsCamera({ north, south, east, west }: google.maps.LatLngBoundsLiteral, width: number, height: number, padding: number) {
  const longitudeFraction = Math.max(Number.EPSILON, (east - west) / 360);
  const mercatorY = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360));
  const latitudeFraction = Math.max(Number.EPSILON, (mercatorY(north) - mercatorY(south)) / (Math.PI * 2));
  const zoom = Math.min(16,
    Math.log2((width - padding * 2) / 256 / longitudeFraction),
    Math.log2((height - padding * 2) / 256 / latitudeFraction),
  );
  const centerY = (mercatorY(north) + mercatorY(south)) / 2;
  const centerLatitude = (2 * Math.atan(Math.exp(centerY)) - Math.PI / 2) * 180 / Math.PI;
  return { center: { lat: centerLatitude, lng: (east + west) / 2 }, zoom };
}

function project(point: { lat: number; lng: number }, camera: { center: google.maps.LatLngLiteral; zoom: number }, width: number, height: number) {
  const scale = 256 * 2 ** camera.zoom;
  const mercatorY = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360));
  const x = (longitude: number) => (longitude + 180) / 360 * scale;
  const y = (latitude: number) => (1 - mercatorY(latitude) / Math.PI) / 2 * scale;
  return { x: x(point.lng) - x(camera.center.lng) + width / 2, y: y(point.lat) - y(camera.center.lat) + height / 2 };
}

function visibleMarkerLabels() {
  return FakeAdvancedMarkerElement.instances.flatMap(({ options }) => {
    const content = options.content as HTMLElement;
    return content.dataset.labelVisible === "true" ? [content.textContent] : [];
  });
}

function completedSelectedLineKeys() {
  return FakePolyline.instances
    .filter(({ options, map }) => options.zIndex === 3 && map !== null)
    .map(({ path }) => FULL_ROUTE_LINES.find((line) => JSON.stringify(line.path) === JSON.stringify(path))?.key);
}

describe("GoogleTripMap", () => {
  it("recovers a selected-day script failure with the final overlay and no duplicate completion or replay", async () => {
    const motion = installMotion();
    const onPlaybackComplete = vi.fn();
    delete (window as unknown as { google?: unknown }).google;
    render(<GoogleTripMap railRoutes={[finalRailRoute]} selectedTravelerId={null} selectedDay={3} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);
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
    expect(motion.pending()).toBe(0);
    await waitFor(() => {
      const selected = FakePolyline.instances.find(({ options }) => options.zIndex === 3);
      expect((selected?.path as Array<{ lat: number; lng: number }> | undefined)?.at(-1)).toEqual({ lat: 35.25626, lng: 139.15582 });
    });
  });

  it("cancels the previous day without jumping to the overview before the next day starts", async () => {
    const motion = installMotion();
    installGoogleBoundary();
    const onPlaybackComplete = vi.fn();
    const { rerender } = render(<GoogleTripMap selectedTravelerId={null} selectedDay={1} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);

    await waitFor(() => expect(motion.pending()).toBe(1));
    const firstSelection = FakePolyline.instances.filter(({ options }) => options.zIndex === 3);
    expect(firstSelection.map(({ options }) => options.path).length).toBeGreaterThan(0);
    motion.update(0);
    const map = FakeMap.instances[0];
    const boundsCallsBeforePanelClose = map.fitBounds.mock.calls.length;

    rerender(<GoogleTripMap selectedTravelerId={null} selectedDay={null} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);
    expect(map.fitBounds).toHaveBeenCalledTimes(boundsCallsBeforePanelClose);

    rerender(<GoogleTripMap selectedTravelerId={null} selectedDay={2} playbackRequest={2} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);
    await waitFor(() => expect(motion.pending()).toBe(1));
    expect(firstSelection.every(({ map }) => map === null)).toBe(true);

    for (let index = 0; index < 4; index += 1) motion.complete();

    expect(onPlaybackComplete).toHaveBeenCalledTimes(1);
    expect(onPlaybackComplete).toHaveBeenCalledWith(2);
    expect(FakePolyline.instances.filter(({ options, map }) => options.zIndex === 3 && map !== null).map(({ options }) => options.path)).toHaveLength(2);
  });

  it("keeps the map and active playback when polling returns equivalent rail geometry", async () => {
    const motion = installMotion();
    installGoogleBoundary();
    const onPlaybackComplete = vi.fn();
    const { rerender } = render(<GoogleTripMap railRoutes={[finalRailRoute]} selectedTravelerId={null} selectedDay={3} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);

    await waitFor(() => expect(motion.pending()).toBe(1));
    motion.update(0.7);
    const selectedLine = FakePolyline.instances.find(({ options }) => options.zIndex === 3);
    const baseLineCount = FakePolyline.instances.filter(({ options }) => options.zIndex === 1).length;

    const equivalentRoute = {
      ...finalRailRoute,
      geometry: finalRailRoute.geometry.map(([latitude, longitude]) => [latitude, longitude] as const),
    };
    rerender(<GoogleTripMap railRoutes={[equivalentRoute]} selectedTravelerId={null} selectedDay={3} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);
    await act(async () => {});

    expect(FakeMap.instances).toHaveLength(1);
    expect(FakePolyline.instances.filter(({ options }) => options.zIndex === 1)).toHaveLength(baseLineCount);
    expect(selectedLine?.map).toBe(FakeMap.instances[0]);
    expect(FakePolyline.instances.filter(({ options }) => options.zIndex === 3 && options.map === FakeMap.instances[0])).toHaveLength(2);
    expect(motion.pending()).toBe(1);

    for (let index = 0; index < 8; index += 1) motion.complete();
    expect(onPlaybackComplete).toHaveBeenCalledOnce();
  });

  it("updates changed base rail geometry without recreating the map", async () => {
    installGoogleBoundary();
    const { rerender } = render(<GoogleTripMap railRoutes={[finalRailRoute]} selectedTravelerId={null} selectedDay={null} playbackRequest={0} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(FakeMap.instances).toHaveLength(1));
    const originalBaseLines = FakePolyline.instances.filter(({ options }) => options.zIndex === 1);
    const changedGeometry = [{ lat: 34.44, lng: 135.25 }, { lat: 34.8, lng: 135.5 }, { lat: 35.1, lng: 135.8 }];
    rerender(<GoogleTripMap railRoutes={[{ ...finalRailRoute, geometry: changedGeometry.map(({ lat, lng }) => [lat, lng] as const) }]} selectedTravelerId={null} selectedDay={null} playbackRequest={0} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => {
      expect(FakePolyline.instances.some(({ options, path, map }) => options.zIndex === 1 && map !== null && JSON.stringify(path) === JSON.stringify(changedGeometry))).toBe(true);
    });
    expect(FakeMap.instances).toHaveLength(1);
    expect(originalBaseLines.every(({ map }) => map === null)).toBe(true);
    expect(screen.getByText("Powered by Google, ©2026 Google")).toBeInTheDocument();
  });

  it("loads a map with a map ID, Advanced Markers, and all five supplied rail journeys", async () => {
    const importLibrary = installGoogleBoundary();
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={null} playbackRequest={0} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(FakeMap.instances).toHaveLength(1));
    expect(FakeMap.instances[0].options).toMatchObject({ mapId: "test-map-id", disableDefaultUI: true, isFractionalZoomEnabled: true, keyboardShortcuts: false });
    expect(importLibrary.mock.calls.map(([name]) => name)).toEqual([]);
    await waitFor(() => expect(FakePolyline.instances.some(({ options }) => options.zIndex === 1)).toBe(true));
    expect(FakeAdvancedMarkerElement.instances.length).toBeGreaterThanOrEqual(16);
    expect(screen.queryByLabelText("경로 상태")).not.toBeInTheDocument();
    expect(screen.queryByText(/경로 확정 전$/)).not.toBeInTheDocument();
    expect(screen.queryByText("하코네 등산선")).not.toBeInTheDocument();
    expect(screen.queryByText("전체 경로")).not.toBeInTheDocument();
  });

  it.each([
    { day: 1 as const, entries: [["교토 시버스 106·206", "#F4430A"], ["도보", "#4A0DF0"]] },
    { day: 3 as const, entries: [["하코네 등산선", "#E85216"], ["JR 도카이도 본선 · 우쓰노미야선 직결", "#F18016"]] },
  ])("pairs Day $day transport names with their route colors", async ({ day, entries }) => {
    installGoogleBoundary();
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={day} playbackRequest={1} reducedMotion onPlaybackComplete={vi.fn()} />);

    const legend = await screen.findByRole("list", { name: `${day}일차 교통편` });
    for (const [label, color] of entries) {
      const item = within(legend).getByText(label).closest("li");
      expect(item?.querySelector("[aria-hidden=true]")).toHaveStyle({ backgroundColor: color });
    }
  });

  it("shows only the trip edge labels before a day is selected", async () => {
    installGoogleBoundary();
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={null} playbackRequest={0} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(FakeAdvancedMarkerElement.instances.length).toBeGreaterThanOrEqual(16));
    expect(FakeAdvancedMarkerElement.instances.flatMap(({ options }) => {
      const content = options.content as HTMLElement;
      return content.dataset.labelVisible === "true" ? [content.textContent] : [];
    })).toEqual(["김해국제공항", "인천국제공항", "김포국제공항", "간사이국제공항", "나리타국제공항"]);
  });

  it("keeps the three domestic origin markers without exposing their names", async () => {
    installGoogleBoundary();
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={1} playbackRequest={1} reducedMotion onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(FakeAdvancedMarkerElement.instances.length).toBeGreaterThanOrEqual(16));
    const origins = FakeAdvancedMarkerElement.instances.filter(({ options }) =>
      ["mandeok", "suwon", "icheon"].includes((options.content as HTMLElement).dataset.pinKey ?? ""),
    );
    expect(origins).toHaveLength(3);
    expect(origins.map(({ options }) => options.title)).toEqual([undefined, undefined, undefined]);
    expect(origins.map(({ options }) => (options.content as HTMLElement).textContent)).toEqual(["", "", ""]);
    expect(origins.every(({ options }) => (options.content as HTMLElement).querySelector('[aria-hidden="true"]') !== null)).toBe(true);
  });

  it.each(DAY_RENDER_EXPECTATIONS)("renders every normal Day $day stage label boundary and completes exactly once", async ({ day, stageLabels, terminalLabels }) => {
    const motion = installMotion();
    installGoogleBoundary();
    const onPlaybackComplete = vi.fn();
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={day} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);

    await waitFor(() => expect(motion.pending()).toBe(1));
    expect(visibleMarkerLabels()).toEqual(stageLabels[0]);
    for (const expectedLabels of stageLabels.slice(1)) {
      motion.complete();
      expect(visibleMarkerLabels()).toEqual(expectedLabels);
    }
    act(() => motion.complete());

    expect(motionState.animations).toHaveLength(stageLabels.length);
    expect(motion.pending()).toBe(0);
    expect(visibleMarkerLabels()).toEqual(terminalLabels);
    expect(onPlaybackComplete).toHaveBeenCalledOnce();
    expect(onPlaybackComplete).toHaveBeenCalledWith(day);
  });

  it.each(DAY_RENDER_EXPECTATIONS)("finishes and replays reduced-motion Day $day with literal lines, pins, labels, and one fit per request", async ({ day, terminalLabels, lineKeys, pinTitles }) => {
    installMotion();
    installGoogleBoundary();
    const onPlaybackComplete = vi.fn();
    const { rerender } = render(<GoogleTripMap selectedTravelerId={null} selectedDay={day} playbackRequest={1} reducedMotion onPlaybackComplete={onPlaybackComplete} />);

    await waitFor(() => expect(onPlaybackComplete).toHaveBeenCalledTimes(1));
    expect(motionState.animations).toHaveLength(0);
    expect(completedSelectedLineKeys()).toEqual(lineKeys);
    expect(FakeAdvancedMarkerElement.instances.filter(({ map }) => map !== null).flatMap(({ options }) => options.title ? [options.title] : [])).toEqual(pinTitles);
    expect(visibleMarkerLabels()).toEqual(terminalLabels);
    expect(FakeMap.instances[0].fitBounds).toHaveBeenCalledTimes(1);
    expect(FakeMap.instances[0].setCenter).toHaveBeenCalledTimes(1);

    rerender(<GoogleTripMap selectedTravelerId={null} selectedDay={day} playbackRequest={1} reducedMotion onPlaybackComplete={onPlaybackComplete} />);
    expect(onPlaybackComplete).toHaveBeenCalledTimes(1);
    expect(FakeMap.instances[0].fitBounds).toHaveBeenCalledTimes(1);
    rerender(<GoogleTripMap selectedTravelerId={null} selectedDay={day} playbackRequest={2} reducedMotion onPlaybackComplete={onPlaybackComplete} />);

    await waitFor(() => expect(onPlaybackComplete).toHaveBeenCalledTimes(2));
    expect(motionState.animations).toHaveLength(0);
    expect(completedSelectedLineKeys()).toEqual(lineKeys);
    expect(visibleMarkerLabels()).toEqual(terminalLabels);
    expect(FakeMap.instances[0].fitBounds).toHaveBeenCalledTimes(2);
    expect(FakeMap.instances[0].setCenter).toHaveBeenCalledTimes(2);
  });

  it("keeps programmatic camera frames unrestricted and uses the 54px max view", async () => {
    installGoogleBoundary();
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={null} playbackRequest={0} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(FakeMap.instances).toHaveLength(1));
    const map = FakeMap.instances[0];
    expect(map.options.restriction).toBeUndefined();
    expect(map.options.minZoom).toBeUndefined();
    const expected = expectedBoundsCamera(OVERVIEW_ROUTE_BOUNDS, 390, 844, 54);
    expect(map.moveCamera).toHaveBeenLastCalledWith(expected);
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.setCenter).not.toHaveBeenCalled();

    FakeResizeObserver.instances[0].resize(844, 390);
    expect(map.moveCamera).toHaveBeenLastCalledWith(expectedBoundsCamera(OVERVIEW_ROUTE_BOUNDS, 844, 390, 54));
  });

  it("uses the exact initial max-view camera for the Day 5 return flights", async () => {
    installGoogleBoundary();
    const overview = render(<GoogleTripMap selectedTravelerId={null} selectedDay={null} playbackRequest={0} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(FakeMap.instances).toHaveLength(1));
    const overviewCamera = FakeMap.instances[0].moveCamera.mock.calls.at(-1)?.[0];
    expect(overviewCamera).toBeDefined();
    overview.unmount();

    const motion = installMotion();
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={5} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(motion.pending()).toBe(1));
    motion.complete();
    motion.complete();
    motion.update(1);
    expect(FakeMap.instances[1].moveCamera.mock.calls.at(-1)?.[0]).toEqual(overviewCamera);
  });

  it("fits every Day 1 camera cue path and caps the single-airport Gimpo cue", async () => {
    const motion = installMotion();
    installGoogleBoundary();
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={1} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(motion.pending()).toBe(1));
    motion.complete();
    for (const [elapsedMs, keys] of [
      [0, ["mandeok", "busan"]],
      [5000, ["suwon", "icheon", "gimpo"]],
      [7800, ["gimpo"]],
      [10600, ["busan", "gimpo", "kix"]],
    ] as const) {
      motion.update(elapsedMs / 13600);
      const camera = FakeMap.instances[0].moveCamera.mock.calls.at(-1)?.[0];
      if (!camera) throw new Error(`Day 1 cue ${elapsedMs} did not move the camera`);
      expect(camera).toEqual(expectedFocusCamera(keys, 390, 844, 54));
      for (const point of focusPoints(keys)) {
        const screenPoint = project(point, camera, 390, 844);
        expect(screenPoint.x).toBeGreaterThanOrEqual(54 - 0.001);
        expect(screenPoint.x).toBeLessThanOrEqual(390 - 54 + 0.001);
        expect(screenPoint.y).toBeGreaterThanOrEqual(54 - 0.001);
        expect(screenPoint.y).toBeLessThanOrEqual(844 - 54 + 0.001);
      }
    }
    expect(FakeMap.instances[0].moveCamera.mock.calls.at(-2)?.[0].zoom).toBe(16);
  });

  it("does not overwrite user camera changes while a settled cue is held", async () => {
    const motion = installMotion();
    installGoogleBoundary();
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={1} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(motion.pending()).toBe(1));
    motion.complete();
    motion.update(8000 / 13600);
    const map = FakeMap.instances[0];
    const settledMoves = map.moveCamera.mock.calls.length;

    motion.update(8200 / 13600);
    motion.update(9000 / 13600);
    expect(map.moveCamera).toHaveBeenCalledTimes(settledMoves);

    motion.update(9600 / 13600);
    expect(map.moveCamera).toHaveBeenCalledTimes(settledMoves + 1);
  });

  it("starts a repeated-key filtered cue from the current user camera", async () => {
    const motion = installMotion();
    installGoogleBoundary();
    render(<GoogleTripMap selectedTravelerId="gyujun" selectedDay={1} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(motion.pending()).toBe(1));
    motion.complete();
    motion.update(3999 / 13600);
    const map = FakeMap.instances[0];
    const userCamera = { center: { lat: 36.25, lng: 129.5 }, zoom: 7.25 };
    map.center = userCamera.center;
    map.zoom = userCamera.zoom;

    motion.update(4000 / 13600);
    expect(map.moveCamera).toHaveBeenLastCalledWith(userCamera);

    motion.update(4500 / 13600);
    const target = expectedFocusCamera(["suwon", "gimpo"], 390, 844, 54);
    expect(map.moveCamera).toHaveBeenLastCalledWith({
      center: {
        lat: (userCamera.center.lat + target.center.lat) / 2,
        lng: (userCamera.center.lng + target.center.lng) / 2,
      },
      zoom: (userCamera.zoom + target.zoom) / 2,
    });
  });

  it.each(MAP_DIMENSIONS)("fits all 13 authored focus paths in the viewport at %ix%i with literal padding and no motion bounds jump", async (width, height) => {
    FakeMap.viewport = { width, height };
    expect(AUTHORED_FOCUS_STAGES).toHaveLength(13);
    expect(new Set(AUTHORED_FOCUS_STAGES.map(({ padding }) => padding))).toEqual(new Set([54]));

    for (const day of [1, 2, 3, 4, 5] as const) {
      const dayFocuses = AUTHORED_FOCUS_STAGES.filter((focus) => focus.day === day);
      const finalFocusStage = dayFocuses.at(-1)?.stageIndex;
      if (finalFocusStage === undefined) throw new Error(`Day ${day} has no literal focus stage`);
      const motion = installMotion();
      installGoogleBoundary();
      const { unmount } = render(<GoogleTripMap selectedTravelerId={null} selectedDay={day} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

      await waitFor(() => expect(motion.pending()).toBe(1));
      const map = FakeMap.instances.at(-1);
      if (!map) throw new Error(`Day ${day} did not create a map`);
      for (let stageIndex = 0; stageIndex <= finalFocusStage; stageIndex += 1) {
        const focus = dayFocuses.find((candidate) => candidate.stageIndex === stageIndex);
        if (focus) {
          const focusKeys: readonly string[] = focus.keys;
          motion.update(1);
          const camera = map.moveCamera.mock.calls.at(-1)?.[0];
          if (!camera) throw new Error(`Day ${day} focus ${stageIndex} did not move the camera`);
          const expected = focus.day === 5 && focus.stageIndex === 2
            ? expectedBoundsCamera(OVERVIEW_ROUTE_BOUNDS, width, height, focus.padding)
            : expectedFocusCamera(focusKeys, width, height, focus.padding);
          expect(camera.center).toEqual(expected.center);
          expect(camera.zoom).toBeCloseTo(expected.zoom, 8);
          const points = focus.day === 5 && focus.stageIndex === 2
            ? FULL_ROUTE_LINES.flatMap((line) => line.path)
            : focusPoints(focusKeys);
          for (const [pointIndex, point] of points.entries()) {
            const screenPoint = project(point, camera, width, height);
            const context = `Day ${day} stage ${stageIndex} ${focus.keys.join(",")} point ${pointIndex}`;
            expect(screenPoint.x, context).toBeGreaterThanOrEqual(focus.padding - 0.001);
            expect(screenPoint.x, context).toBeLessThanOrEqual(width - focus.padding + 0.001);
            expect(screenPoint.y, context).toBeGreaterThanOrEqual(focus.padding - 0.001);
            expect(screenPoint.y, context).toBeLessThanOrEqual(height - focus.padding + 0.001);
          }
        }
        if (stageIndex < finalFocusStage) motion.complete();
      }
      expect(map.fitBounds).not.toHaveBeenCalled();
      unmount();
    }
  });

  it("draws final rail geometry on Google Maps and shows attribution only while it is visible", async () => {
    installGoogleBoundary();
    render(<GoogleTripMap railRoutes={[finalRailRoute]} selectedTravelerId={null} selectedDay={null} playbackRequest={0} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(FakeMap.instances).toHaveLength(1));
    const finalized = FakePolyline.instances.find(({ options }) => options.zIndex === 1 && options.path === FakePolyline.instances.find(({ path }) => JSON.stringify(path) === JSON.stringify([{ lat: 34.44, lng: 135.25 }, { lat: 35.01, lng: 135.77 }]))?.path);
    expect(finalized?.options.icons).toBeUndefined();
    expect(screen.getByText("Powered by Google, ©2026 Google")).toBeInTheDocument();
    expect(screen.queryByLabelText("경로 상태")).not.toBeInTheDocument();
  });

  it("draws the sampled screenshot colors as outlined selected rail segments", async () => {
    installGoogleBoundary();
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={3} playbackRequest={1} reducedMotion onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(FakePolyline.instances.filter(({ options }) => options.zIndex === 3)).toHaveLength(2));
    expect(FakePolyline.instances.filter(({ options }) => options.zIndex === 3).map(({ options }) => options.strokeColor)).toEqual([
      "#E85216",
      "#F18016",
    ]);
    expect(FakePolyline.instances.filter(({ options }) => options.zIndex === 2).map(({ options }) => [options.strokeColor, options.strokeWeight])).toEqual([
      ["#8B4222", 6],
      ["#995A22", 6],
    ]);
    expect(FakePolyline.instances.filter(({ options }) => options.zIndex === 3).map(({ options }) => options.strokeWeight)).toEqual([3.5, 3.5]);
  });

  it("draws overview route lines at the reduced two-pixel weight", async () => {
    installGoogleBoundary();
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={null} playbackRequest={0} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(FakePolyline.instances.some(({ options }) => options.zIndex === 1)).toBe(true));
    expect(new Set(FakePolyline.instances.filter(({ options }) => options.zIndex === 1).map(({ options }) => options.strokeWeight))).toEqual(new Set([2]));
  });

  it("shows only Daekyeom's Day 1 route, pins, and camera bounds", async () => {
    installGoogleBoundary();
    const onPlaybackComplete = vi.fn();
    render(<GoogleTripMap selectedTravelerId="daekyeom" selectedDay={1} playbackRequest={1} reducedMotion onPlaybackComplete={onPlaybackComplete} />);

    await waitFor(() => expect(onPlaybackComplete).toHaveBeenCalledWith(1));
    const markerKeys = FakeAdvancedMarkerElement.instances.filter(({ map }) => map !== null).map(({ options }) => (options.content as HTMLElement).dataset.pinKey);
    expect(markerKeys).toEqual(expect.arrayContaining(["mandeok", "busan", "kix", "kyoto"]));
    expect(markerKeys).not.toEqual(expect.arrayContaining(["suwon", "icheon", "gimpo"]));
    expect(FakeMap.instances[0].fitBounds.mock.calls.at(-1)?.[0]).toMatchObject({ west: expect.any(Number), east: expect.any(Number) });
    expect((FakeMap.instances[0].fitBounds.mock.calls.at(-1)?.[0] as google.maps.LatLngBoundsLiteral).west).toBeGreaterThan(128);
    expect((FakeMap.instances[0].fitBounds.mock.calls.at(-1)?.[0] as google.maps.LatLngBoundsLiteral).east).toBeLessThan(136);
  });

  it("cancels the prior playback and starts the newly selected traveler's playback", async () => {
    const motion = installMotion();
    installGoogleBoundary();
    const onPlaybackComplete = vi.fn();
    const { rerender } = render(<GoogleTripMap selectedTravelerId="daekyeom" selectedDay={1} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);

    await waitFor(() => expect(motion.pending()).toBe(1));
    const priorPlayback = motionState.animations[0];
    rerender(<GoogleTripMap selectedTravelerId="gyujun" selectedDay={1} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);

    await waitFor(() => expect(motionState.animations).toHaveLength(2));
    expect(priorPlayback.stopped).toBe(true);
    expect(FakeAdvancedMarkerElement.instances.filter(({ map }) => map !== null).map(({ options }) => (options.content as HTMLElement).dataset.pinKey)).toEqual(expect.arrayContaining(["suwon", "gimpo", "kix", "kyoto"]));
    for (let index = 0; index < 9; index += 1) motion.complete();
    expect(onPlaybackComplete).toHaveBeenCalledOnce();
  });

  it("fits every completed Day 5 endpoint when reduced motion skips the focus stages", async () => {
    installGoogleBoundary();
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={5} playbackRequest={1} reducedMotion onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(FakePolyline.instances.filter(({ options }) => options.zIndex === 3)).toHaveLength(6));
    expect(FakeMap.instances[0].fitBounds.mock.calls.at(-1)?.[0]).toMatchObject({
      east: 140.3929,
      west: 126.41747,
    });
  });

  it("retains Day 4 selection on its three Tokyo pins without adding a route line", async () => {
    installGoogleBoundary();
    const onPlaybackComplete = vi.fn();
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={4} playbackRequest={1} reducedMotion onPlaybackComplete={onPlaybackComplete} />);

    await waitFor(() => expect(onPlaybackComplete).toHaveBeenCalledOnce());
    expect(FakePolyline.instances.filter(({ options }) => options.zIndex === 3)).toHaveLength(0);
    expect(FakePolyline.instances.filter(({ options, map }) => options.zIndex === 1 && map !== null)).toHaveLength(0);
    expect(screen.queryByLabelText("경로 상태")).not.toBeInTheDocument();
    expect(FakeMap.instances[0].fitBounds.mock.calls.at(-1)?.[0]).toEqual({ east: 139.7967, north: 35.7148, south: 35.6719, west: 139.7659 });
    expect(FakeMap.instances[0].setCenter).toHaveBeenLastCalledWith({ lat: 35.693349999999995, lng: 139.7813 });
    const visibleLabels = FakeAdvancedMarkerElement.instances.flatMap(({ options }) => {
      const content = options.content as HTMLElement;
      return content.dataset.labelVisible === "true" ? [content.textContent] : [];
    });
    expect(visibleLabels).toEqual(["아키하바라", "긴자"]);
  });

  it("eases the Day 1 camera from the flight view into KIX and Kyoto without a bounds jump", async () => {
    const motion = installMotion();
    installGoogleBoundary();
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={1} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(motion.pending()).toBe(1));
    const map = FakeMap.instances[0];
    expect(map.fitBounds).not.toHaveBeenCalled();
    motion.complete();
    motion.complete();
    motion.update(0.5);
    const midwayToKix = map.moveCamera.mock.calls.at(-1)![0];
    const flightFocus = expectedFocusCamera(["busan", "gimpo", "kix"], 390, 844, 54);
    const kyotoFocus = expectedFocusCamera(["kix", "kyoto"], 390, 844, 54);
    expect(midwayToKix.center.lat).toBeCloseTo((flightFocus.center.lat + kyotoFocus.center.lat) / 2, 8);
    expect(midwayToKix.center.lng).toBeCloseTo((flightFocus.center.lng + kyotoFocus.center.lng) / 2, 8);
    expect(midwayToKix.center.lng).toBeGreaterThan(flightFocus.center.lng);
    expect(midwayToKix.center.lng).toBeLessThan(kyotoFocus.center.lng);
    expect(map.fitBounds).not.toHaveBeenCalled();

    motion.complete();
    motion.complete();
    motion.update(0.5);
    const midwayToKyoto = map.moveCamera.mock.calls.at(-1)![0];
    const sightseeingFocus = expectedFocusCamera(["kyoto", "kiyomizu", "ginkaku", "kinkaku"], 390, 844, 54);
    expect(midwayToKyoto.center.lat).toBeCloseTo((kyotoFocus.center.lat + sightseeingFocus.center.lat) / 2, 8);
    expect(midwayToKyoto.center.lng).toBeCloseTo((kyotoFocus.center.lng + sightseeingFocus.center.lng) / 2, 8);
  });

  it("does not redraw a completed route while a later camera stage animates", async () => {
    const motion = installMotion();
    installGoogleBoundary();
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={1} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(motion.pending()).toBe(1));
    const firstPoint = FULL_ROUTE_LINES.find(({ key }) => key === "mandeok-pus")?.path[0];
    const completedLine = FakePolyline.instances.find(({ options, path }) =>
      options.zIndex === 3 && JSON.stringify(path) === JSON.stringify([firstPoint]),
    );
    expect(completedLine).toBeDefined();

    motion.complete();
    motion.complete();
    const writesAfterRoute = completedLine!.setPath.mock.calls.length;
    motion.update(0.5);

    expect(completedLine!.setPath).toHaveBeenCalledTimes(writesAfterRoute);
  });

  it("shows the planned Day 1 clock phases at exact boundaries, then hides them after the timed stage", async () => {
    const motion = installMotion();
    installGoogleBoundary();
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={1} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(motion.pending()).toBe(1));
    expect(screen.queryByRole("region", { name: "1일차 이동 현황" })).not.toBeInTheDocument();
    act(() => motion.complete());

    const at = (elapsedMs: number, time: string, phases: readonly string[]) => {
      act(() => motion.update(elapsedMs / 13600));
      const status = screen.getByRole("region", { name: "1일차 이동 현황" });
      expect(within(status).getByText(`예정 ${time}`)).toBeInTheDocument();
      expect(within(status).getAllByRole("listitem").map((item) => item.textContent)).toEqual(phases);
    };
    at(0, "06:00", ["정대겸 · 차량 이동", "이규열 · 박준수 · 출발 대기", "한규준 · 출발 대기"]);
    at(4000, "07:00", ["정대겸 · 공항 대기", "이규열 · 박준수 · 차량 이동", "한규준 · 차량 이동"]);
    at(7000, "07:45", ["정대겸 · 공항 대기", "이규열 · 박준수 · 공항 대기", "한규준 · 공항 대기"]);
    at(7800, "08:30", ["정대겸 · 비행 중", "이규열 · 박준수 · 공항 대기", "한규준 · 공항 대기"]);
    at(9600, "09:15", ["정대겸 · 비행 중", "이규열 · 박준수 · 비행 중", "한규준 · 비행 중"]);
    at(11600, "10:05", ["정대겸 · KIX 도착", "이규열 · 박준수 · 비행 중", "한규준 · 비행 중"]);
    at(13600, "10:55", ["정대겸 · KIX 도착", "이규열 · 박준수 · KIX 도착", "한규준 · KIX 도착"]);

    act(() => motion.complete());
    expect(screen.queryByRole("region", { name: "1일차 이동 현황" })).not.toBeInTheDocument();
  });

  it("filters the Day 1 clock status to the selected traveler", async () => {
    const motion = installMotion();
    installGoogleBoundary();
    render(<GoogleTripMap selectedTravelerId="gyuyeol" selectedDay={1} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(motion.pending()).toBe(1));
    act(() => motion.complete());
    const status = screen.getByRole("region", { name: "1일차 이동 현황" });
    expect(within(status).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["이규열 · 출발 대기"]);
  });

  it("shows shared planned times in reduced motion and the offline fallback", async () => {
    installGoogleBoundary();
    const reduced = render(<GoogleTripMap selectedTravelerId={null} selectedDay={1} playbackRequest={1} reducedMotion onPlaybackComplete={vi.fn()} />);

    const schedule = await screen.findByRole("region", { name: "1일차 계획 시간" });
    expect(within(schedule).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "정대겸 · PUS 이동 06:00–07:00 · PUS→KIX 08:30–10:05",
      "이규열 · 박준수 · GMP 이동 06:15–07:45 · GMP→KIX 09:15–10:55",
      "한규준 · GMP 이동 06:45–07:45 · GMP→KIX 09:15–10:55",
    ]);
    reduced.unmount();

    Reflect.deleteProperty(process.env, "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={1} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);
    expect(screen.getByRole("region", { name: "1일차 계획 시간" })).toHaveTextContent("PUS→KIX 08:30–10:05");
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "browser-key";
  });

  it("retargets the active camera on resize without changing route progress or playback and disconnects on unmount", async () => {
    const motion = installMotion();
    installGoogleBoundary();
    const onPlaybackComplete = vi.fn();
    const { unmount } = render(<GoogleTripMap selectedTravelerId={null} selectedDay={1} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);

    await waitFor(() => expect(motion.pending()).toBe(1));
    expect(FakeResizeObserver.instances).toHaveLength(1);
    motion.complete();
    motion.update(10100 / 13600);
    const map = FakeMap.instances[0];
    const cameraBeforeResize = map.moveCamera.mock.calls.at(-1)?.[0];
    if (!cameraBeforeResize) throw new Error("Active camera did not move before resize");
    const pathsBeforeResize = FakePolyline.instances.filter(({ options }) => options.zIndex === 3).map(({ path }) => path);
    const animationsBeforeResize = motionState.animations.length;
    const movesBeforeResize = map.moveCamera.mock.calls.length;

    FakeResizeObserver.instances[0].resize(844, 390);
    expect(motionState.animations).toHaveLength(animationsBeforeResize);
    expect(FakePolyline.instances.filter(({ options }) => options.zIndex === 3).map(({ path }) => path)).toEqual(pathsBeforeResize);
    expect(onPlaybackComplete).not.toHaveBeenCalled();
    motion.update(10350 / 13600);
    expect(map.moveCamera.mock.calls.length).toBeGreaterThan(movesBeforeResize);
    const resizedCamera = map.moveCamera.mock.calls.at(-1)?.[0];
    if (!resizedCamera) throw new Error("Active camera did not retarget after resize");
    const resizedTarget = expectedFocusCamera(["busan", "gimpo", "kix"], 844, 390, 54);
    expect(resizedCamera.center.lat).toBeCloseTo((cameraBeforeResize.center.lat + resizedTarget.center.lat) / 2, 8);
    expect(resizedCamera.center.lng).toBeCloseTo((cameraBeforeResize.center.lng + resizedTarget.center.lng) / 2, 8);
    expect(resizedCamera.zoom).toBeCloseTo((cameraBeforeResize.zoom + resizedTarget.zoom) / 2, 8);

    FakeResizeObserver.instances[0].resize(844, 390);
    expect(map.moveCamera.mock.calls.at(-1)?.[0]).toEqual(resizedCamera);
    unmount();
    expect(FakeResizeObserver.instances[0].disconnect).toHaveBeenCalledOnce();
  });

  it("refits an already-completed day after a resize", async () => {
    installGoogleBoundary();
    const onPlaybackComplete = vi.fn();
    const { rerender } = render(<GoogleTripMap selectedTravelerId={null} selectedDay={5} playbackRequest={1} reducedMotion onPlaybackComplete={onPlaybackComplete} />);

    await waitFor(() => expect(onPlaybackComplete).toHaveBeenCalledOnce());
    rerender(<GoogleTripMap selectedTravelerId={null} selectedDay={5} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);
    const map = FakeMap.instances[0];
    await waitFor(() => expect(map.fitBounds).toHaveBeenCalledTimes(2));
    FakeResizeObserver.instances[0].resize(844, 390);
    expect(map.fitBounds).toHaveBeenCalledTimes(3);
    expect(map.moveCamera).not.toHaveBeenCalled();
  });

  it("reuses one computed path for both selected polyline layers", async () => {
    const motion = installMotion();
    installGoogleBoundary();
    render(<GoogleTripMap selectedTravelerId={null} selectedDay={1} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(motion.pending()).toBe(1));
    motion.complete();
    motion.update(0.25);
    const mandeokLayers = FakePolyline.instances.filter(({ options }) =>
      (options.zIndex === 2 || options.zIndex === 3)
      && JSON.stringify((options.path as unknown[])[0]) === JSON.stringify(FULL_ROUTE_LINES[0].path[0]),
    );
    expect(mandeokLayers).toHaveLength(2);
    expect(mandeokLayers[0].setPath.mock.calls.at(-1)?.[0]).toBe(mandeokLayers[1].setPath.mock.calls.at(-1)?.[0]);
  });

  it("falls back and completes the static selection instead of leaving a blank or pending map when the public key is missing", async () => {
    Reflect.deleteProperty(process.env, "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
    const onPlaybackComplete = vi.fn();
    render(<GoogleTripMap railRoutes={[finalRailRoute]} selectedTravelerId={null} selectedDay={3} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);

    expect(screen.getByRole("region", { name: "정적 여행 일정" })).toBeInTheDocument();
    expect(screen.getByText("3일차 일정")).toBeInTheDocument();
    expect(screen.queryByText("경로 확정 전")).not.toBeInTheDocument();
    expect(screen.queryByText("Powered by Google, ©2026 Google")).not.toBeInTheDocument();
    expect(screen.queryByText("철도 이동")).not.toBeInTheDocument();
    await waitFor(() => expect(onPlaybackComplete).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "지도 다시 불러오기" }));
    expect(screen.getByRole("alert")).toHaveTextContent("지도 설정을 다시 확인했습니다");
    expect(onPlaybackComplete).toHaveBeenCalledOnce();
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "browser-key";
  });
});
