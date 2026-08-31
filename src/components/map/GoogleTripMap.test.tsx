// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({
  animations: [] as Array<{
    stopped: boolean;
    completed: boolean;
    onUpdate?: (value: number) => void;
    onComplete?: () => void;
  }>,
}));

vi.mock("motion/react", () => ({
  animate: (_from: number, _to: number, options: { onUpdate?: (value: number) => void; onComplete?: () => void }) => {
    const animation = { stopped: false, completed: false, onUpdate: options.onUpdate, onComplete: options.onComplete };
    motionState.animations.push(animation);
    return { stop() { animation.stopped = true; } };
  },
}));

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
    Object.defineProperties(element, { clientWidth: { value: 390 }, clientHeight: { value: 844 } });
    FakeMap.instances.push(this);
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
    const motion = installMotion();
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
    const { rerender } = render(<GoogleTripMap selectedDay={1} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);

    await waitFor(() => expect(motion.pending()).toBe(1));
    const firstSelection = FakePolyline.instances.filter(({ options }) => options.zIndex === 3);
    expect(firstSelection.map(({ options }) => options.path).length).toBeGreaterThan(0);
    motion.update(0);
    const map = FakeMap.instances[0];
    const boundsCallsBeforePanelClose = map.fitBounds.mock.calls.length;

    rerender(<GoogleTripMap selectedDay={null} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);
    expect(map.fitBounds).toHaveBeenCalledTimes(boundsCallsBeforePanelClose);

    rerender(<GoogleTripMap selectedDay={2} playbackRequest={2} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);
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
    const { rerender } = render(<GoogleTripMap railRoutes={[finalRailRoute]} selectedDay={3} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);

    await waitFor(() => expect(motion.pending()).toBe(1));
    motion.update(0.7);
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
    expect(FakePolyline.instances.filter(({ options }) => options.zIndex === 3 && options.map === FakeMap.instances[0])).toHaveLength(2);
    expect(motion.pending()).toBe(1);

    for (let index = 0; index < 8; index += 1) motion.complete();
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

  it("loads a map with a map ID, Advanced Markers, and all five supplied rail journeys", async () => {
    const importLibrary = installGoogleBoundary();
    render(<GoogleTripMap selectedDay={null} playbackRequest={0} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(FakeMap.instances).toHaveLength(1));
    expect(FakeMap.instances[0].options).toMatchObject({ mapId: "test-map-id", disableDefaultUI: true });
    expect(importLibrary.mock.calls.map(([name]) => name)).toEqual([]);
    await waitFor(() => expect(FakePolyline.instances.some(({ options }) => options.zIndex === 1)).toBe(true));
    expect(FakeAdvancedMarkerElement.instances.length).toBeGreaterThanOrEqual(16);
    expect(screen.queryByLabelText("경로 상태")).not.toBeInTheDocument();
    expect(screen.queryByText(/경로 확정 전$/)).not.toBeInTheDocument();
    expect(screen.queryByText("하코네 등산선")).not.toBeInTheDocument();
    expect(screen.queryByText("전체 경로")).not.toBeInTheDocument();
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

  it("prevents zooming or panning outside the padded Korea-Japan viewport", async () => {
    installGoogleBoundary();
    render(<GoogleTripMap selectedDay={null} playbackRequest={0} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(FakeMap.instances).toHaveLength(1));
    const restriction = FakeMap.instances[0].options.restriction as google.maps.MapRestriction;
    const limits = restriction.latLngBounds as google.maps.LatLngBoundsLiteral;

    expect(restriction.strictBounds).toBe(true);
    expect(FakeMap.instances[0].options.minZoom).toBe(5);
    expect(limits.south).toBeGreaterThanOrEqual(18);
    expect(limits.north).toBeLessThanOrEqual(55);
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
    expect(screen.queryByLabelText("경로 상태")).not.toBeInTheDocument();
  });

  it("draws the sampled screenshot colors as outlined selected rail segments", async () => {
    installGoogleBoundary();
    render(<GoogleTripMap selectedDay={3} playbackRequest={1} reducedMotion onPlaybackComplete={vi.fn()} />);

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
    render(<GoogleTripMap selectedDay={null} playbackRequest={0} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(FakePolyline.instances.some(({ options }) => options.zIndex === 1)).toBe(true));
    expect(new Set(FakePolyline.instances.filter(({ options }) => options.zIndex === 1).map(({ options }) => options.strokeWeight))).toEqual(new Set([2]));
  });

  it("completes one reduced-motion playback per request while retaining only that day's route and pins", async () => {
    installGoogleBoundary();
    const onPlaybackComplete = vi.fn();
    const { rerender } = render(<GoogleTripMap selectedDay={1} playbackRequest={1} reducedMotion onPlaybackComplete={onPlaybackComplete} />);

    await waitFor(() => expect(onPlaybackComplete).toHaveBeenCalledTimes(1));
    expect(FakePolyline.instances.filter(({ options, map }) => options.zIndex === 1 && map !== null)).toHaveLength(6);
    expect(FakeAdvancedMarkerElement.instances.filter(({ map }) => map !== null).map(({ options }) => options.title)).toEqual([
      "정대겸 · 만덕",
      "한규준 · 수원역",
      "이규열·박준수 · 이천역",
      "PUS · 부산 출발",
      "ICN · 인천 출발",
      "간사이국제공항",
      "교토역",
      "기요미즈데라",
      "금각사",
      "은각사",
    ]);
    expect(screen.queryByText("1일차 선택 경로")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("경로 상태")).not.toBeInTheDocument();
    expect(FakeMap.instances[0].fitBounds).toHaveBeenCalled();

    rerender(<GoogleTripMap selectedDay={1} playbackRequest={1} reducedMotion onPlaybackComplete={onPlaybackComplete} />);
    expect(onPlaybackComplete).toHaveBeenCalledTimes(1);
    rerender(<GoogleTripMap selectedDay={1} playbackRequest={2} reducedMotion onPlaybackComplete={onPlaybackComplete} />);
    await waitFor(() => expect(onPlaybackComplete).toHaveBeenCalledTimes(2));
  });

  it("fits every completed Day 5 endpoint when reduced motion skips the focus stages", async () => {
    installGoogleBoundary();
    render(<GoogleTripMap selectedDay={5} playbackRequest={1} reducedMotion onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(FakePolyline.instances.filter(({ options }) => options.zIndex === 3)).toHaveLength(6));
    expect(FakeMap.instances[0].fitBounds.mock.calls.at(-1)?.[0]).toMatchObject({
      east: 140.3929,
      west: 126.4407,
    });
  });

  it("retains Day 4 selection on its three Tokyo pins without adding a route line", async () => {
    installGoogleBoundary();
    const onPlaybackComplete = vi.fn();
    render(<GoogleTripMap selectedDay={4} playbackRequest={1} reducedMotion onPlaybackComplete={onPlaybackComplete} />);

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

  it("retains only the literal first departure and final arrival labels after Day 2 completes", async () => {
    installGoogleBoundary();
    render(<GoogleTripMap selectedDay={2} playbackRequest={1} reducedMotion onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(FakePolyline.instances.filter(({ options }) => options.zIndex === 3)).toHaveLength(2));
    const visibleLabels = FakeAdvancedMarkerElement.instances.flatMap(({ options }) => {
      const content = options.content as HTMLElement;
      return content.dataset.labelVisible === "true" ? [content.textContent] : [];
    });
    expect(visibleLabels).toEqual(["교토역", "하코네유모토역"]);
  });

  it("shows only the current segment endpoints while Day 1 plays", async () => {
    const motion = installMotion();
    installGoogleBoundary();
    render(<GoogleTripMap selectedDay={1} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(motion.pending()).toBe(1));
    const visibleLabels = () => FakeAdvancedMarkerElement.instances.flatMap(({ options }) => {
      const content = options.content as HTMLElement;
      return content.dataset.labelVisible === "true" ? [content.textContent] : [];
    });
    expect(visibleLabels()).toEqual(["정대겸 · 만덕", "한규준 · 수원역", "이규열·박준수 · 이천역", "PUS · 부산 출발", "ICN · 인천 출발"]);

    motion.complete();
    expect(visibleLabels()).toEqual(["정대겸 · 만덕", "한규준 · 수원역", "이규열·박준수 · 이천역", "PUS · 부산 출발", "ICN · 인천 출발"]);
    motion.complete();
    expect(visibleLabels()).toEqual(["PUS · 부산 출발", "ICN · 인천 출발", "간사이국제공항"]);
    motion.complete();
    motion.complete();
    expect(visibleLabels()).toEqual(["간사이국제공항", "교토역"]);
  });

  it("eases the Day 1 camera from the flight view into KIX and Kyoto without a bounds jump", async () => {
    const motion = installMotion();
    installGoogleBoundary();
    render(<GoogleTripMap selectedDay={1} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(motion.pending()).toBe(1));
    const map = FakeMap.instances[0];
    expect(map.fitBounds).not.toHaveBeenCalled();
    motion.complete();
    motion.complete();
    motion.complete();
    motion.complete();
    motion.update(0.5);
    const midwayToKix = map.moveCamera.mock.calls.at(-1)![0];
    expect(midwayToKix.center.lat).toBeCloseTo(35.329);
    expect(midwayToKix.center.lng).toBeCloseTo(133.172);
    expect(midwayToKix.center.lng).toBeGreaterThan(130.84235);
    expect(midwayToKix.center.lng).toBeLessThan(135.5013835);
    expect(map.fitBounds).not.toHaveBeenCalled();

    motion.complete();
    motion.complete();
    motion.update(0.5);
    const midwayToKyoto = map.moveCamera.mock.calls.at(-1)![0];
    expect(midwayToKyoto.center.lat).toBeCloseTo(34.861);
    expect(midwayToKyoto.center.lng).toBeCloseTo(135.633);
  });

  it("eases between both Day 2 rail camera ranges", async () => {
    const motion = installMotion();
    installGoogleBoundary();
    render(<GoogleTripMap selectedDay={2} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(motion.pending()).toBe(1));
    const map = FakeMap.instances[0];
    motion.update(0.5);
    const midwayToOdawara = map.moveCamera.mock.calls.at(-1)![0];
    expect(midwayToOdawara.center.lat).toBeCloseTo(35.371);
    expect(midwayToOdawara.center.lng).toBeCloseTo(137.399);

    motion.complete();
    motion.complete();
    motion.update(0.5);
    const midwayToHakone = map.moveCamera.mock.calls.at(-1)![0];
    expect(midwayToHakone.center.lat).toBeCloseTo(35.183);
    expect(midwayToHakone.center.lng).toBeCloseTo(138.293);
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it("zooms into Ueno, Shinjuku, and Shibuya after the Day 3 rail arrival", async () => {
    const motion = installMotion();
    installGoogleBoundary();
    render(<GoogleTripMap selectedDay={3} playbackRequest={1} reducedMotion={false} onPlaybackComplete={vi.fn()} />);

    await waitFor(() => expect(motion.pending()).toBe(1));
    const map = FakeMap.instances[0];
    for (let index = 0; index < 4; index += 1) motion.complete();

    motion.update(1);
    expect(map.moveCamera.mock.calls.at(-1)?.[0].center).toEqual({ lat: 35.685885, lng: 139.738775 });
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it("falls back and completes the static selection instead of leaving a blank or pending map when the public key is missing", async () => {
    Reflect.deleteProperty(process.env, "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
    const onPlaybackComplete = vi.fn();
    render(<GoogleTripMap railRoutes={[finalRailRoute]} selectedDay={3} playbackRequest={1} reducedMotion={false} onPlaybackComplete={onPlaybackComplete} />);

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
