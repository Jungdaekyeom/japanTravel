"use client";

import { useEffect, useRef, useState } from "react";

import type { DayNumber } from "../../trip/types";
import { createRoutePlayback, pathAtProgress } from "./animation";
import { loadGoogleMaps, type GoogleMapsLibraries } from "./map-script";
import { buildDayLayers, FULL_ROUTE_LINES, FULL_ROUTE_PINS, type MapLine } from "./placeholder-routes";
import { StaticItinerary } from "./StaticItinerary";
import styles from "./GoogleTripMap.module.css";

type GoogleTripMapProps = {
  selectedDay: DayNumber | null;
  playbackRequest: number;
  reducedMotion: boolean;
  onPlaybackComplete: (day: DayNumber) => void;
};

export function GoogleTripMap({ selectedDay, playbackRequest, reducedMotion, onPlaybackComplete }: GoogleTripMapProps) {
  const [retryKey, setRetryKey] = useState(0);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const libraries = useRef<GoogleMapsLibraries | null>(null);
  const baseLines = useRef<google.maps.Polyline[]>([]);
  const selectedLines = useRef(new Map<string, google.maps.Polyline>());
  const markers = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const markerContent = useRef(new Map<string, HTMLElement>());
  const playback = useRef<ReturnType<typeof createRoutePlayback> | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || (process.env.NODE_ENV === "production" ? undefined : "DEMO_MAP_ID");
  const configured = Boolean(apiKey && mapId);

  useEffect(() => {
    if (!configured || !apiKey || !mapId) return;
    let active = true;
    setLoadState("loading");

    void loadGoogleMaps(apiKey).then((loaded) => {
      if (!active || !mapElement.current) return;
      libraries.current = loaded;
      const nextMap = new loaded.maps.Map(mapElement.current, {
        mapId,
        center: { lat: 35.62, lng: 137.34 },
        zoom: 5,
        disableDefaultUI: true,
        clickableIcons: false,
        gestureHandling: "greedy",
        keyboardShortcuts: true,
      });
      map.current = nextMap;
      baseLines.current = FULL_ROUTE_LINES.map((line) => new loaded.maps.Polyline({
        ...polylineStyle(line, false),
        map: nextMap,
        path: [...line.path],
        zIndex: 1,
      }));
      markers.current = FULL_ROUTE_PINS.map((pin) => {
        const content = document.createElement("div");
        content.className = styles.marker;
        content.dataset.pinKey = pin.key;
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
      fitFullRoute(nextMap);
      setLoadState("ready");
    }).catch(() => {
      if (active) setLoadState("error");
    });

    return () => {
      active = false;
      playback.current?.cancel();
      baseLines.current.forEach((line) => line.setMap(null));
      selectedLines.current.forEach((line) => line.setMap(null));
      markers.current.forEach((marker) => { marker.map = null; });
      baseLines.current = [];
      selectedLines.current.clear();
      markers.current = [];
      markerContent.current.clear();
      map.current = null;
      libraries.current = null;
    };
  }, [apiKey, configured, mapId, retryKey]);

  useEffect(() => {
    if ((configured && loadState !== "error") || !selectedDay || playbackRequest === 0) return;
    onPlaybackComplete(selectedDay);
  }, [configured, loadState, onPlaybackComplete, playbackRequest, reducedMotion, selectedDay]);

  useEffect(() => {
    if (loadState !== "ready" || !selectedDay || playbackRequest === 0 || !map.current || !libraries.current) return;
    const currentMap = map.current;
    const loaded = libraries.current;
    const layers = buildDayLayers(selectedDay);
    playback.current?.cancel();
    selectedLines.current.forEach((line) => line.setMap(null));
    selectedLines.current.clear();

    for (const line of layers.lines) {
      selectedLines.current.set(line.key, new loaded.maps.Polyline({
        ...polylineStyle(line, true),
        map: currentMap,
        path: pathAtProgress(line.path, 0),
        zIndex: 3,
      }));
    }
    const selectedPinKeys = new Set(layers.pins.map((pin) => pin.key));
    markerContent.current.forEach((content, key) => {
      content.dataset.selected = String(selectedPinKeys.has(key));
    });
    fitDay(currentMap, selectedDay);

    const routePlayback = createRoutePlayback({
      stages: layers.stages,
      reducedMotion,
      onUpdate(state) {
        for (const line of layers.lines) {
          const progress = state.completed ? 1 : (state.progress[line.key] ?? 0);
          selectedLines.current.get(line.key)?.setPath(pathAtProgress(line.path, progress));
        }
        markerContent.current.forEach((content, key) => {
          content.dataset.active = String(key === state.currentPinKey);
        });
      },
      onComplete: () => onPlaybackComplete(selectedDay),
    });
    playback.current = routePlayback;
    routePlayback.play();
    return () => {
      routePlayback.cancel();
      selectedLines.current.forEach((line) => line.setMap(null));
      selectedLines.current.clear();
      markerContent.current.forEach((content) => {
        content.dataset.active = "false";
        content.dataset.selected = "false";
      });
    };
  }, [loadState, onPlaybackComplete, playbackRequest, reducedMotion, selectedDay]);

  if (!configured || loadState === "error") {
    const message = !configured && process.env.NODE_ENV === "production"
      ? "지도 설정이 없어 정적 일정을 표시합니다."
      : "지도를 불러올 수 없어 정적 일정을 표시합니다.";
    return <StaticItinerary selectedDay={selectedDay} message={message} onRetry={() => { setLoadState("loading"); setRetryKey((key) => key + 1); }} />;
  }
  return (
    <section className={styles.frame} aria-label="여행 경로 지도">
      <div ref={mapElement} className={styles.map} />
      {loadState === "loading" && <p className={styles.mapLoading} role="status">지도 불러오는 중…</p>}
      <div className={styles.legend} aria-label="경로 상태">
        <strong>{selectedDay ? `${selectedDay}일차 선택 경로` : "전체 경로"}</strong>
        {FULL_ROUTE_LINES.filter((line) => line.kind === "rail").map((line) => <span key={line.key}>경로 확정 전</span>)}
      </div>
    </section>
  );
}

function dashIcon(color: string) {
  return [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: color, scale: 3 }, offset: "0", repeat: "12px" }];
}

function polylineStyle(line: MapLine, selected: boolean): google.maps.PolylineOptions {
  const color = selected ? "#0969da" : line.kind === "flight" ? "#516b7b" : "#727b84";
  return {
    strokeColor: color,
    strokeOpacity: line.dashed ? 0 : selected ? 0.95 : 0.62,
    strokeWeight: selected ? 5 : 3,
    icons: line.dashed ? dashIcon(color) : undefined,
  };
}

function bounds(points: readonly { lat: number; lng: number }[]): google.maps.LatLngBoundsLiteral {
  return points.reduce((value, point) => ({
    east: Math.max(value.east, point.lng),
    north: Math.max(value.north, point.lat),
    south: Math.min(value.south, point.lat),
    west: Math.min(value.west, point.lng),
  }), { east: -180, north: -90, south: 90, west: 180 });
}

function fitFullRoute(map: google.maps.Map) {
  map.fitBounds(bounds(FULL_ROUTE_LINES.flatMap((line) => line.path)), 36);
}

function fitDay(map: google.maps.Map, day: DayNumber) {
  const layers = buildDayLayers(day);
  map.fitBounds(bounds([...layers.lines.flatMap((line) => line.path), ...layers.pins.map((pin) => pin.position)]), 54);
}
