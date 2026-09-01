"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { DayNumber, PublicRailRoute } from "../../trip/public";
import type { TravelerId } from "../../trip/travelers";
import { createRoutePlayback, pathAtProgress } from "./animation";
import { loadGoogleMaps, type GoogleMapsLibraries } from "./map-script";
import { buildDayLayers, buildRouteLines, FULL_ROUTE_PINS, ROUTE_SCHEDULES, type Coordinate, type MapLine } from "./placeholder-routes";
import { StaticItinerary } from "./StaticItinerary";
import styles from "./GoogleTripMap.module.css";

type GoogleTripMapProps = {
  railRoutes?: readonly PublicRailRoute[];
  selectedTravelerId: TravelerId | null;
  selectedDay: DayNumber | null;
  playbackRequest: number;
  reducedMotion: boolean;
  onPlaybackComplete: (day: DayNumber) => void;
};

const EMPTY_RAIL_ROUTES: readonly PublicRailRoute[] = [];
const OVERVIEW_LABEL_KEYS = new Set(["busan", "incheon", "kix", "nrt"]);
const DEFAULT_CAMERA = { center: { lat: 35.62, lng: 137.34 }, zoom: 5 } as const;
const CAMERA_PADDING = 54;

type CameraFrame = { center: google.maps.LatLngLiteral; zoom: number };

export function GoogleTripMap({ railRoutes = EMPTY_RAIL_ROUTES, selectedTravelerId, selectedDay, playbackRequest, reducedMotion, onPlaybackComplete }: GoogleTripMapProps) {
  const [retryKey, setRetryKey] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const libraries = useRef<GoogleMapsLibraries | null>(null);
  const baseLines = useRef<google.maps.Polyline[]>([]);
  const selectedLines = useRef(new Map<string, google.maps.Polyline[]>());
  const markers = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const markerContent = useRef(new Map<string, HTMLElement>());
  const playback = useRef<ReturnType<typeof createRoutePlayback> | null>(null);
  const completedRequest = useRef<string | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || (process.env.NODE_ENV === "production" ? undefined : "DEMO_MAP_ID");
  const configured = Boolean(apiKey && mapId);
  const routeLines = useRouteLines(railRoutes);
  const showOverview = selectedDay === null && playbackRequest === 0;
  const visibleRouteLines = useMemo(() => selectedDay ? buildDayLayers(selectedDay, routeLines, ROUTE_SCHEDULES, selectedTravelerId).lines : routeLines, [routeLines, selectedDay, selectedTravelerId]);

  useEffect(() => {
    if (!configured || !apiKey || !mapId) return;
    let active = true;
    const currentSelectedLines = selectedLines.current;
    const currentMarkerContent = markerContent.current;
    setLoadState("loading");

    void loadGoogleMaps(apiKey).then((loaded) => {
      if (!active || !mapElement.current) return;
      libraries.current = loaded;
      const nextMap = new loaded.maps.Map(mapElement.current, {
        mapId,
        center: DEFAULT_CAMERA.center,
        zoom: DEFAULT_CAMERA.zoom,
        minZoom: 4,
        disableDefaultUI: true,
        clickableIcons: false,
        gestureHandling: "greedy",
        keyboardShortcuts: true,
      });
      map.current = nextMap;
      markers.current = FULL_ROUTE_PINS.map((pin) => {
        const content = document.createElement("div");
        content.className = styles.marker;
        content.dataset.pinKey = pin.key;
        content.dataset.labelVisible = String(OVERVIEW_LABEL_KEYS.has(pin.key));
        const dot = document.createElement("span");
        dot.className = styles.markerDot;
        dot.setAttribute("aria-hidden", "true");
        const label = document.createElement("span");
        label.className = styles.markerLabel;
        label.textContent = pin.label;
        content.append(dot, label);
        markerContent.current.set(pin.key, content);
        return new loaded.marker.AdvancedMarkerElement({ map: nextMap, position: pin.position, title: pin.label, content });
      });
      setLoadState("ready");
    }).catch(() => {
      if (active) setLoadState("error");
    });

    return () => {
      active = false;
      playback.current?.cancel();
      baseLines.current.forEach((line) => line.setMap(null));
      currentSelectedLines.forEach((lines) => lines.forEach((line) => line.setMap(null)));
      markers.current.forEach((marker) => { marker.map = null; });
      baseLines.current = [];
      currentSelectedLines.clear();
      markers.current = [];
      currentMarkerContent.clear();
      map.current = null;
      libraries.current = null;
    };
  }, [apiKey, configured, mapId, retryKey]);

  useEffect(() => {
    if (loadState !== "ready" || !map.current || !libraries.current) return;
    const currentMap = map.current;
    const loaded = libraries.current;
    const currentBaseLines = visibleRouteLines.flatMap((line) => createPolylineLayers(loaded, currentMap, line, false, [...line.path]));
    baseLines.current = currentBaseLines;
    if (showOverview) fitFullRoute(currentMap, routeLines);

    return () => {
      currentBaseLines.forEach((line) => line.setMap(null));
      if (baseLines.current === currentBaseLines) baseLines.current = [];
    };
  }, [loadState, routeLines, showOverview, visibleRouteLines]);

  const requestKey = selectedDay && playbackRequest > 0 ? `${selectedTravelerId ?? "all"}:${selectedDay}:${playbackRequest}` : null;

  useEffect(() => {
    if ((configured && loadState !== "error") || !selectedDay || playbackRequest === 0) return;
    if (completedRequest.current === requestKey) return;
    completedRequest.current = requestKey;
    onPlaybackComplete(selectedDay);
  }, [configured, loadState, onPlaybackComplete, playbackRequest, requestKey, selectedDay]);

  useEffect(() => {
    if (loadState !== "ready" || !selectedDay || playbackRequest === 0 || !map.current || !libraries.current) return;
    const currentMap = map.current;
    const loaded = libraries.current;
    const layers = buildDayLayers(selectedDay, routeLines, ROUTE_SCHEDULES, selectedTravelerId);
    const lineLabelKeys = (keys: readonly string[] = [], endpoint?: 0 | 1) => layers.lines
      .filter((line) => keys.includes(line.key))
      .flatMap((line) => endpoint === undefined ? line.pinKeys : [line.pinKeys[endpoint]]);
    const stageLabelKeys = (stage: (typeof layers.stages)[number] | undefined, endpoint?: 0 | 1) => {
      if (!stage) return [];
      if (stage.pinKey) return [stage.pinKey];
      if (stage.focusPinKeys) return [...stage.focusPinKeys];
      return lineLabelKeys(stage.lineKeys, endpoint);
    };
    const terminalStages = layers.stages.filter((stage) => stage.pinKey || stage.lineKeys?.length);
    const terminalLabelKeys = [...new Set([
      ...stageLabelKeys(terminalStages[0], 0),
      ...stageLabelKeys(terminalStages.at(-1), 1),
    ])];
    const showLabels = (keys: Iterable<string>) => {
      const visible = new Set(keys);
      markerContent.current.forEach((content, key) => {
        content.dataset.labelVisible = String(visible.has(key));
      });
    };
    const alreadyCompleted = completedRequest.current === requestKey;
    playback.current?.cancel();
    selectedLines.current.forEach((lines) => lines.forEach((line) => line.setMap(null)));
    selectedLines.current.clear();

    for (const line of layers.lines) {
      selectedLines.current.set(line.key, createPolylineLayers(
        loaded,
        currentMap,
        line,
        true,
        pathAtProgress(line.path, alreadyCompleted ? 1 : 0),
      ));
    }
    const selectedPinKeys = new Set(layers.pins.map((pin) => pin.key));
    markers.current.forEach((marker, index) => {
      marker.map = selectedPinKeys.has(FULL_ROUTE_PINS[index].key) ? currentMap : null;
    });
    markerContent.current.forEach((content, key) => {
      content.dataset.selected = String(selectedPinKeys.has(key));
    });
    showLabels(stageLabelKeys(layers.stages[0]));
    const initialFocusPinKeys = reducedMotion ? undefined : layers.stages[0]?.focusPinKeys;
    let focusedPinKey = "";
    let cameraTransition: { from: CameraFrame; to: CameraFrame } | null = null;
    if (alreadyCompleted || !initialFocusPinKeys) fitDay(currentMap, selectedDay, routeLines, selectedTravelerId);

    const clearSelection = () => {
      selectedLines.current.forEach((lines) => lines.forEach((line) => line.setMap(null)));
      selectedLines.current.clear();
      markers.current.forEach((marker) => { marker.map = currentMap; });
      markerContent.current.forEach((content) => {
        content.dataset.active = "false";
        content.dataset.selected = "false";
      });
      showLabels(OVERVIEW_LABEL_KEYS);
    };
    if (alreadyCompleted) {
      showLabels(terminalLabelKeys);
      return clearSelection;
    }

    const routePlayback = createRoutePlayback({
      stages: layers.stages,
      reducedMotion,
      onUpdate(state) {
        showLabels(state.completed
          ? terminalLabelKeys
          : state.currentPinKey
            ? [state.currentPinKey]
            : state.focusPinKeys ?? lineLabelKeys(Object.entries(state.progress).filter(([, progress]) => progress < 1).map(([key]) => key)));
        const nextFocusPinKey = state.focusPinKeys?.join(":") ?? "";
        if (state.focusPinKeys && nextFocusPinKey !== focusedPinKey) {
          focusedPinKey = nextFocusPinKey;
          cameraTransition = {
            from: {
              center: currentMap.getCenter()?.toJSON() ?? DEFAULT_CAMERA.center,
              zoom: currentMap.getZoom() ?? DEFAULT_CAMERA.zoom,
            },
            to: cameraForPins(currentMap, selectedDay, state.focusPinKeys),
          };
        }
        if (cameraTransition && state.focusProgress !== undefined) {
          moveCamera(currentMap, cameraTransition, state.focusProgress);
        }
        for (const line of layers.lines) {
          const progress = state.completed ? 1 : (state.progress[line.key] ?? 0);
          selectedLines.current.get(line.key)?.forEach((polyline) => polyline.setPath(pathAtProgress(line.path, progress)));
        }
        markerContent.current.forEach((content, key) => {
          content.dataset.active = String(key === state.currentPinKey);
        });
      },
      onComplete: () => {
        completedRequest.current = requestKey;
        onPlaybackComplete(selectedDay);
      },
    });
    playback.current = routePlayback;
    routePlayback.play();
    return () => {
      routePlayback.cancel();
      clearSelection();
    };
  }, [loadState, onPlaybackComplete, playbackRequest, reducedMotion, requestKey, routeLines, selectedDay, selectedTravelerId]);

  if (!configured || loadState === "error") {
    const message = !configured
      ? retryAttempt > 0
        ? `지도 설정을 다시 확인했습니다. API 키와 지도 ID를 확인해 주세요. (${retryAttempt}회)`
        : "지도 설정이 없어 정적 일정을 표시합니다."
      : "지도를 불러올 수 없어 정적 일정을 표시합니다.";
    return <StaticItinerary selectedDay={selectedDay} message={message} onRetry={() => {
      setRetryAttempt((attempt) => attempt + 1);
      if (configured) {
        setLoadState("loading");
        setRetryKey((key) => key + 1);
      }
    }} />;
  }
  return (
    <section className={styles.frame} aria-label="여행 경로 지도">
      <div ref={mapElement} className={styles.map} />
      {loadState === "loading" && <p className={styles.mapLoading} role="status">지도 불러오는 중…</p>}
      {loadState === "ready" && visibleRouteLines.some((line) => line.googleDerived) && <p className={styles.googleAttribution}>Powered by Google, ©2026 Google</p>}
    </section>
  );
}

function useRouteLines(railRoutes: readonly PublicRailRoute[]) {
  const key = useMemo(() => JSON.stringify(
    [...railRoutes]
      .sort((left, right) => left.segmentKey.localeCompare(right.segmentKey))
      .map(({ segmentKey, geometry }) => [segmentKey, geometry]),
  ), [railRoutes]);
  const [snapshot, setSnapshot] = useState(() => ({ key, lines: buildRouteLines(railRoutes) }));

  useEffect(() => {
    setSnapshot((current) => current.key === key ? current : { key, lines: buildRouteLines(railRoutes) });
  }, [key, railRoutes]);

  return snapshot.lines;
}

function dashIcon(color: string) {
  return [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: color, scale: 3 }, offset: "0", repeat: "12px" }];
}

function polylineStyle(line: MapLine, selected: boolean): google.maps.PolylineOptions {
  const color = line.color;
  const dashed = line.dashed && !selected;
  return {
    strokeColor: color,
    strokeOpacity: dashed ? 0 : selected ? 0.95 : 0.62,
    strokeWeight: selected ? 3.5 : 2,
    icons: dashed ? dashIcon(color) : undefined,
  };
}

function createPolylineLayers(
  loaded: GoogleMapsLibraries,
  map: google.maps.Map,
  line: MapLine,
  selected: boolean,
  path: readonly Coordinate[],
) {
  const zIndex = selected ? 3 : 1;
  const layers: google.maps.Polyline[] = [];
  if (selected && line.outlineColor) {
    layers.push(new loaded.maps.Polyline({
      ...polylineStyle(line, true),
      strokeColor: line.outlineColor,
      strokeWeight: 6,
      map,
      path: [...path],
      zIndex: zIndex - 1,
    }));
  }
  layers.push(new loaded.maps.Polyline({
    ...polylineStyle(line, selected),
    map,
    path: [...path],
    zIndex,
  }));
  return layers;
}

function bounds(points: readonly { lat: number; lng: number }[]): google.maps.LatLngBoundsLiteral {
  return points.reduce((value, point) => ({
    east: Math.max(value.east, point.lng),
    north: Math.max(value.north, point.lat),
    south: Math.min(value.south, point.lat),
    west: Math.min(value.west, point.lng),
  }), { east: -180, north: -90, south: 90, west: 180 });
}

function fitFullRoute(map: google.maps.Map, routeLines: readonly MapLine[]) {
  map.fitBounds(bounds(routeLines.flatMap((line) => line.path)), CAMERA_PADDING);
}

function fitDay(map: google.maps.Map, day: DayNumber, routeLines: readonly MapLine[], selectedTravelerId: TravelerId | null) {
  const layers = buildDayLayers(day, routeLines, ROUTE_SCHEDULES, selectedTravelerId);
  const nextBounds = bounds([...layers.lines.flatMap((line) => line.path), ...layers.pins.map((pin) => pin.position)]);
  map.fitBounds(nextBounds, CAMERA_PADDING);
  map.setCenter(centerOf(nextBounds));
}

function cameraForPins(map: google.maps.Map, day: DayNumber, pinKeys: readonly string[]): CameraFrame {
  const selectedPins = FULL_ROUTE_PINS.filter((pin) => pinKeys.includes(pin.key));
  const nextBounds = bounds(selectedPins.map((pin) => pin.position));
  const element = map.getDiv();
  const padding = day === 5 && pinKeys.length === 2 && pinKeys[0] === "ueno" && pinKeys[1] === "nrt" ? 48 : CAMERA_PADDING;
  const width = Math.max(1, (element.clientWidth || window.innerWidth) - padding * 2);
  const height = Math.max(1, (element.clientHeight || window.innerHeight) - padding * 2);
  const longitudeFraction = Math.max(Number.EPSILON, (nextBounds.east - nextBounds.west) / 360);
  const latitudeFraction = Math.max(Number.EPSILON, (mercatorY(nextBounds.north) - mercatorY(nextBounds.south)) / (Math.PI * 2));
  const zoom = Math.max(4, Math.min(16,
    Math.log2(width / 256 / longitudeFraction),
    Math.log2(height / 256 / latitudeFraction),
  ));
  const centerY = (mercatorY(nextBounds.north) + mercatorY(nextBounds.south)) / 2;
  return {
    center: {
      lat: (2 * Math.atan(Math.exp(centerY)) - Math.PI / 2) * 180 / Math.PI,
      lng: (nextBounds.east + nextBounds.west) / 2,
    },
    zoom,
  };
}

function centerOf(value: google.maps.LatLngBoundsLiteral): google.maps.LatLngLiteral {
  return { lat: (value.north + value.south) / 2, lng: (value.east + value.west) / 2 };
}

function mercatorY(latitude: number) {
  const radians = latitude * Math.PI / 180;
  return Math.log(Math.tan(Math.PI / 4 + radians / 2));
}

function moveCamera(map: google.maps.Map, transition: { from: CameraFrame; to: CameraFrame }, progress: number) {
  const eased = progress * progress * (3 - 2 * progress);
  map.moveCamera({
    center: {
      lat: transition.from.center.lat + (transition.to.center.lat - transition.from.center.lat) * eased,
      lng: transition.from.center.lng + (transition.to.center.lng - transition.from.center.lng) * eased,
    },
    zoom: transition.from.zoom + (transition.to.zoom - transition.from.zoom) * eased,
  });
}
