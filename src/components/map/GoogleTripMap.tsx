"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { DayNumber, PublicRailRoute, PublicGroundRoute } from "../../trip/public";
import type { TravelerId } from "../../trip/travelers";
import { createRoutePlayback, pathAtProgress, visualStages } from "./animation";
import { loadGoogleMaps, type GoogleMapsLibraries } from "./map-script";
import { buildDayLayers, buildRouteLines, FULL_ROUTE_PINS, ROUTE_SCHEDULES, type Coordinate, type MapLine } from "./placeholder-routes";
import { DaySchedule, StaticItinerary } from "./StaticItinerary";
import styles from "./GoogleTripMap.module.css";

type GoogleTripMapProps = {
  railRoutes?: readonly PublicRailRoute[];
  groundRoutes?: readonly PublicGroundRoute[];
  selectedTravelerId: TravelerId | null;
  selectedDay: DayNumber | null;
  playbackRequest: number;
  reducedMotion: boolean;
  onPlaybackComplete: (day: DayNumber) => void;
};

const EMPTY_RAIL_ROUTES: readonly PublicRailRoute[] = [];
const EMPTY_GROUND_ROUTES: readonly PublicGroundRoute[] = [];
const OVERVIEW_LABEL_KEYS = new Set(["busan", "incheon", "incheon2", "gimpo", "kix", "nrt"]);
const DEFAULT_CAMERA = { center: { lat: 35.62, lng: 137.34 }, zoom: 5 } as const;
const CAMERA_PADDING = 54;

type CameraFrame = { center: google.maps.LatLngLiteral; zoom: number };

export function GoogleTripMap({ railRoutes = EMPTY_RAIL_ROUTES, groundRoutes = EMPTY_GROUND_ROUTES, selectedTravelerId, selectedDay, playbackRequest, reducedMotion, onPlaybackComplete }: GoogleTripMapProps) {
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
  const resizeMap = useRef<() => void>(() => {});
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || (process.env.NODE_ENV === "production" ? undefined : "DEMO_MAP_ID");
  const configured = Boolean(apiKey && mapId);
  const routeLines = useRouteLines(railRoutes, groundRoutes);
  const showOverview = selectedDay === null && playbackRequest === 0;
  const visibleRouteLines = useMemo(() => selectedDay ? buildDayLayers(selectedDay, routeLines, ROUTE_SCHEDULES, selectedTravelerId).lines : routeLines, [routeLines, selectedDay, selectedTravelerId]);
  const transportLegend = useMemo(() => {
    const entries = new Map<string, MapLine>();
    for (const line of visibleRouteLines) {
      if (line.transportLabel) entries.set(`${line.transportLabel}:${line.color}`, line);
    }
    return [...entries.values()];
  }, [visibleRouteLines]);

  useEffect(() => {
    if (!configured || !apiKey || !mapId) return;
    let active = true;
    let resizeObserver: ResizeObserver | undefined;
    const currentSelectedLines = selectedLines.current;
    const currentMarkerContent = markerContent.current;
    setLoadState("loading");

    void loadGoogleMaps(apiKey).then((loaded) => {
      if (!active || !mapElement.current) return;
      libraries.current = loaded;
      const nextMap = new loaded.maps.Map(mapElement.current, {
        mapId,
        renderingType: "VECTOR",
        tilt: 0,
        center: DEFAULT_CAMERA.center,
        zoom: DEFAULT_CAMERA.zoom,
        disableDefaultUI: true,
        clickableIcons: false,
        gestureHandling: "greedy",
        isFractionalZoomEnabled: true,
        keyboardShortcuts: false,
      });
      map.current = nextMap;
      if (typeof ResizeObserver !== "undefined") {
        let width = mapElement.current.clientWidth;
        let height = mapElement.current.clientHeight;
        resizeObserver = new ResizeObserver(([entry]) => {
          const nextWidth = entry?.contentRect.width ?? mapElement.current?.clientWidth ?? 0;
          const nextHeight = entry?.contentRect.height ?? mapElement.current?.clientHeight ?? 0;
          if (nextWidth === width && nextHeight === height) return;
          width = nextWidth;
          height = nextHeight;
          resizeMap.current();
        });
        resizeObserver.observe(mapElement.current);
      }
      markers.current = FULL_ROUTE_PINS.map((pin) => {
        const content = document.createElement("div");
        content.className = styles.marker;
        content.dataset.pinKey = pin.key;
        content.dataset.hasLabel = String(Boolean(pin.label));
        content.dataset.labelVisible = String(Boolean(pin.label) && OVERVIEW_LABEL_KEYS.has(pin.key));
        const dot = document.createElement("span");
        dot.className = styles.markerDot;
        dot.setAttribute("aria-hidden", "true");
        content.append(dot);
        if (pin.label) {
          const label = document.createElement("span");
          label.className = styles.markerLabel;
          label.textContent = pin.label;
          content.append(label);
        }
        markerContent.current.set(pin.key, content);
        return new loaded.marker.AdvancedMarkerElement({
          map: nextMap,
          position: pin.position,
          ...(pin.label ? { title: pin.label } : {}),
          content,
          anchorLeft: "-50%",
          anchorTop: "-50%",
        });
      });
      setLoadState("ready");
    }).catch(() => {
      if (active) setLoadState("error");
    });

    return () => {
      active = false;
      resizeObserver?.disconnect();
      resizeMap.current = () => {};
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
    const handleResize = () => fitFullRoute(currentMap, routeLines);
    if (showOverview) {
      fitFullRoute(currentMap, routeLines);
      resizeMap.current = handleResize;
    }

    return () => {
      if (resizeMap.current === handleResize) resizeMap.current = () => {};
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
    let visibleLabelKey: string | null = null;
    const showLabels = (keys: Iterable<string>) => {
      const visible = new Set(keys);
      const nextVisibleLabelKey = [...visible].sort().join(":");
      if (nextVisibleLabelKey === visibleLabelKey) return;
      visibleLabelKey = nextVisibleLabelKey;
      markerContent.current.forEach((content, key) => {
        content.dataset.labelVisible = String(content.dataset.hasLabel === "true" && visible.has(key));
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
    const renderedProgress = new Map(layers.lines.map((line) => [line.key, alreadyCompleted ? 1 : 0]));
    const selectedPinKeys = new Set<string>(layers.pins.map((pin) => pin.key));
    markers.current.forEach((marker, index) => {
      marker.map = selectedPinKeys.has(FULL_ROUTE_PINS[index].key) ? currentMap : null;
    });
    markerContent.current.forEach((content, key) => {
      content.dataset.selected = String(selectedPinKeys.has(key));
    });
    showLabels(stageLabelKeys(layers.stages[0]));
    const initialFocusPinKeys = reducedMotion ? undefined : layers.stages[0]?.focusPinKeys;
    let focusedPinKeys: readonly string[] | undefined;
    let activePinKey: string | null | undefined;
    let intendedFocusPinKeys = alreadyCompleted ? undefined : initialFocusPinKeys;
    let focusProgress = intendedFocusPinKeys ? 0 : 1;
    let renderedFocusProgress: number | undefined;
    let transitionStartProgress = 0;
    let cameraTransition: { from: CameraFrame; to: CameraFrame } | null = null;
    let cameraReady = true;
    let cameraWait: { promise: Promise<void>; finish: () => void } | undefined;
    const tilesListener = currentMap.addListener("tilesloaded", () => {
      cameraReady = true;
      cameraWait?.finish();
    });
    const waitForTiles = () => {
      if (cameraReady) return;
      if (cameraWait) return cameraWait.promise;
      let finish!: () => void;
      const promise = new Promise<void>((resolve) => {
        const timer = setTimeout(() => finish(), 2500);
        finish = () => { clearTimeout(timer); cameraReady = true; cameraWait = undefined; resolve(); };
      });
      cameraWait = { promise, finish };
      return promise;
    };
    const handleResize = () => {
      playback.current?.resize(visualStages(layers.stages, layers.lines, (keys) => cameraForPins(currentMap, keys, routeLines).zoom));
      if (!intendedFocusPinKeys) {
        fitDay(currentMap, selectedDay, routeLines, selectedTravelerId);
        return;
      }
      const target = cameraForPins(currentMap, intendedFocusPinKeys, routeLines);
      if (focusProgress >= 1) {
        currentMap.moveCamera(target);
        cameraTransition = { from: target, to: target };
        return;
      }
      cameraTransition = {
        from: currentCamera(currentMap),
        to: target,
      };
      transitionStartProgress = focusProgress;
      renderedFocusProgress = undefined;
    };
    resizeMap.current = handleResize;
    if (alreadyCompleted || !initialFocusPinKeys) fitDay(currentMap, selectedDay, routeLines, selectedTravelerId);

    const clearSelection = () => {
      tilesListener.remove();
      cameraWait?.finish();
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
      return () => {
        if (resizeMap.current === handleResize) resizeMap.current = () => {};
        clearSelection();
      };
    }

    const routePlayback = createRoutePlayback({
      stages: visualStages(layers.stages, layers.lines, (keys) => cameraForPins(currentMap, keys, routeLines).zoom),
      reducedMotion,
      beforeStage: (stage) => stage.lineKeys?.length ? waitForTiles() : undefined,
      onUpdate(state) {
        showLabels(state.completed
          ? terminalLabelKeys
          : state.currentPinKey
            ? [state.currentPinKey]
            : state.focusPinKeys ?? lineLabelKeys(Object.entries(state.progress).filter(([, progress]) => progress < 1).map(([key]) => key)));
        if (state.focusPinKeys && state.focusPinKeys !== focusedPinKeys) {
          focusedPinKeys = state.focusPinKeys;
          intendedFocusPinKeys = state.focusPinKeys;
          focusProgress = state.focusProgress ?? 0;
          renderedFocusProgress = undefined;
          transitionStartProgress = 0;
          cameraTransition = {
            from: currentCamera(currentMap),
            to: cameraForPins(currentMap, state.focusPinKeys, routeLines),
          };
        }
        if (cameraTransition && state.focusProgress !== undefined) {
          focusProgress = state.focusProgress;
          if (renderedFocusProgress !== focusProgress) {
            renderedFocusProgress = focusProgress;
            const remainingProgress = transitionStartProgress >= 1
              ? 1
              : Math.max(0, (focusProgress - transitionStartProgress) / (1 - transitionStartProgress));
            cameraReady = false;
            moveCamera(currentMap, cameraTransition, remainingProgress);
          }
        }
        for (const line of layers.lines) {
          const progress = state.completed ? 1 : (state.progress[line.key] ?? 0);
          if (renderedProgress.get(line.key) === progress) continue;
          renderedProgress.set(line.key, progress);
          const path = pathAtProgress(line.path, progress);
          selectedLines.current.get(line.key)?.forEach((polyline) => polyline.setPath(path));
        }
        if (activePinKey !== state.currentPinKey) {
          activePinKey = state.currentPinKey;
          markerContent.current.forEach((content, key) => {
            content.dataset.active = String(key === state.currentPinKey);
          });
        }
      },
      onComplete: () => {
        completedRequest.current = requestKey;
        onPlaybackComplete(selectedDay);
      },
    });
    playback.current = routePlayback;
    routePlayback.play();
    return () => {
      if (resizeMap.current === handleResize) resizeMap.current = () => {};
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
    return <StaticItinerary selectedDay={selectedDay} selectedTravelerId={selectedTravelerId} message={message} onRetry={() => {
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
      {loadState === "ready" && selectedDay && transportLegend.length > 0 && (
        <ul className={styles.routeLegend} aria-label={`${selectedDay}일차 교통편`}>
          {transportLegend.map((line) => (
            <li key={`${line.transportLabel}:${line.color}`}>
              <span className={styles.routeLegendSwatch} style={{ backgroundColor: line.color }} aria-hidden="true" />
              <span>{line.transportLabel}</span>
            </li>
          ))}
        </ul>
      )}
      {loadState === "ready" && selectedDay && <DaySchedule day={selectedDay} selectedTravelerId={selectedTravelerId} />}
      {loadState === "ready" && selectedDay && visibleRouteLines.some((line) => line.label?.includes("확인") || line.label?.includes("확정 전")) && <p className={styles.routeNotice}>점선: 확인 전 경로 · 일정의 예정 시각 참고</p>}
      {loadState === "ready" && visibleRouteLines.some((line) => line.googleDerived) && <p className={styles.googleAttribution}>Powered by Google, ©2026 Google</p>}
    </section>
  );
}

function useRouteLines(railRoutes: readonly PublicRailRoute[], groundRoutes: readonly PublicGroundRoute[]) {
  const key = useMemo(() => JSON.stringify([
    [...railRoutes]
      .sort((left, right) => left.segmentKey.localeCompare(right.segmentKey))
      .map(({ segmentKey, geometry }) => [segmentKey, geometry]),
    [...groundRoutes].sort((a, b) => a.segmentKey.localeCompare(b.segmentKey)),
  ]), [railRoutes, groundRoutes]);
  const [snapshot, setSnapshot] = useState(() => ({ key, lines: buildRouteLines(railRoutes, groundRoutes) }));

  useEffect(() => {
    setSnapshot((current) => current.key === key ? current : { key, lines: buildRouteLines(railRoutes, groundRoutes) });
  }, [key, railRoutes, groundRoutes]);

  return snapshot.lines;
}

function dashIcon(color: string, selected: boolean): google.maps.IconSequence[] {
  return [{ icon: { path: "M 0,-1 0,1", strokeOpacity: selected ? 1 : 0.2, strokeColor: color, scale: selected ? 2.5 : 1.5 }, offset: "0", repeat: "10px" }];
}

function polylineStyle(line: MapLine, selected: boolean): google.maps.PolylineOptions {
  const color = line.color;
  const dashed = line.dashed;
  const icons: google.maps.IconSequence[] = dashed ? dashIcon(color, selected) : [];
  if (selected) icons.push({
    icon: { path: "M -1,0 a 1,1 0 1,0 2,0 a 1,1 0 1,0 -2,0", fillColor: color, fillOpacity: 1, strokeColor: "#fff", strokeOpacity: 1, strokeWeight: 2, scale: 5 },
    offset: "100%",
  });
  return {
    strokeColor: color,
    strokeOpacity: dashed ? 0 : selected ? 0.95 : 0.2,
    strokeWeight: selected ? 3.5 : 2,
    icons: icons.length ? icons : undefined,
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
  const renderedPath = [...path];
  if (selected && line.outlineColor) {
    layers.push(new loaded.maps.Polyline({
      ...polylineStyle(line, true),
      strokeColor: line.outlineColor,
      strokeWeight: 6,
      icons: [],
      map,
      path: renderedPath,
      zIndex: zIndex - 1,
    }));
  }
  layers.push(new loaded.maps.Polyline({
    ...polylineStyle(line, selected),
    map,
    path: renderedPath,
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
  map.moveCamera(cameraForPoints(map, routeLines.flatMap((line) => line.path), CAMERA_PADDING));
}

function fitDay(map: google.maps.Map, day: DayNumber, routeLines: readonly MapLine[], selectedTravelerId: TravelerId | null) {
  const layers = buildDayLayers(day, routeLines, ROUTE_SCHEDULES, selectedTravelerId);
  const nextBounds = bounds([...layers.lines.flatMap((line) => line.path), ...layers.pins.map((pin) => pin.position)]);
  map.fitBounds(nextBounds, CAMERA_PADDING);
  map.setCenter(centerOf(nextBounds));
}

function cameraForPins(map: google.maps.Map, pinKeys: readonly string[], routeLines: readonly MapLine[]): CameraFrame {
  const points = pinKeys.length === 3 && ["nrt", "busan", "incheon2"].every((key) => pinKeys.includes(key))
    ? routeLines.flatMap((line) => line.path)
    : [
      ...FULL_ROUTE_PINS.filter((pin) => pinKeys.includes(pin.key)).map((pin) => pin.position),
      ...routeLines.filter((line) => line.pinKeys.every((key) => pinKeys.includes(key))).flatMap((line) => line.path),
    ];
  return cameraForPoints(map, points, CAMERA_PADDING);
}

function cameraForPoints(map: google.maps.Map, points: readonly Coordinate[], padding: number): CameraFrame {
  const nextBounds = bounds(points);
  const element = map.getDiv();
  const width = Math.max(1, (element.clientWidth || window.innerWidth) - padding * 2);
  const height = Math.max(1, (element.clientHeight || window.innerHeight) - padding * 2);
  const longitudeFraction = Math.max(Number.EPSILON, (nextBounds.east - nextBounds.west) / 360);
  const latitudeFraction = Math.max(Number.EPSILON, (mercatorY(nextBounds.north) - mercatorY(nextBounds.south)) / (Math.PI * 2));
  const zoom = Math.min(16,
    Math.log2(width / 256 / longitudeFraction),
    Math.log2(height / 256 / latitudeFraction),
  );
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
  const ease = (value: number) => value * value * (3 - 2 * value);
  const travelZoom = Math.min(transition.from.zoom, transition.to.zoom,
    cameraForPoints(map, [transition.from.center, transition.to.center], CAMERA_PADDING).zoom);
  const distant = Math.max(transition.from.zoom, transition.to.zoom) - travelZoom > 2;
  const panProgress = distant ? Math.max(0, Math.min(1, (progress - 0.25) / 0.5)) : progress;
  const eased = ease(panProgress);
  const zoom = distant
    ? progress < 0.5
      ? transition.from.zoom + (travelZoom - transition.from.zoom) * ease(Math.min(1, progress / 0.3))
      : travelZoom + (transition.to.zoom - travelZoom) * ease(Math.max(0, (progress - 0.7) / 0.3))
    : transition.from.zoom + (transition.to.zoom - transition.from.zoom) * ease(progress);
  map.moveCamera({
    center: {
      lat: transition.from.center.lat + (transition.to.center.lat - transition.from.center.lat) * eased,
      lng: transition.from.center.lng + (transition.to.center.lng - transition.from.center.lng) * eased,
    },
    zoom,
  });
}

function currentCamera(map: google.maps.Map): CameraFrame {
  return {
    center: map.getCenter()?.toJSON() ?? DEFAULT_CAMERA.center,
    zoom: map.getZoom() ?? DEFAULT_CAMERA.zoom,
  };
}
