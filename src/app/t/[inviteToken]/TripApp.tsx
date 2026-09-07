"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { TripPanel } from "../../../components/TripPanel";
import { GoogleTripMap } from "../../../components/map/GoogleTripMap";
import type { DayNumber, SharedTripPayload } from "../../../trip/public";
import styles from "./TripApp.module.css";

function useMedia(query: string) {
  const [matches, setMatches] = useState<boolean | null>(null);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

function MobileTripApp() {
  const reducedMotion = useMedia("(prefers-reduced-motion: reduce)");
  const [payload, setPayload] = useState<SharedTripPayload | null>(null);
  const [loadError, setLoadError] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelClosing, setPanelClosing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayNumber | null>(null);
  const [playbackRequest, setPlaybackRequest] = useState(0);
  const [completedDay, setCompletedDay] = useState<DayNumber | null>(null);
  const [playingAll, setPlayingAll] = useState(false);
  const [liveStatus, setLiveStatus] = useState("전체 5일 경로 표시 중");
  const closeTimer = useRef<number | null>(null);
  const refreshController = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    refreshController.current?.abort();
    const controller = new AbortController();
    refreshController.current = controller;
    try {
      const response = await fetch("/api/trip", { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("일정을 불러오지 못했습니다.");
      const nextPayload = await response.json() as SharedTripPayload;
      if (controller.signal.aborted) return;
      setPayload(nextPayload);
      setLoadError("");
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : "일정을 불러오지 못했습니다.";
      setLoadError(message);
      throw new Error(message);
    } finally {
      if (refreshController.current === controller) refreshController.current = null;
    }
  }, []);

  useEffect(() => {
    let intervalId: number | undefined;
    const schedule = () => {
      if (intervalId !== undefined) window.clearInterval(intervalId);
      intervalId = document.visibilityState === "visible" ? window.setInterval(() => { void refresh().catch(() => {}); }, 30_000) : undefined;
    };
    const onVisibility = () => {
      schedule();
      if (document.visibilityState === "visible") void refresh().catch(() => {});
    };
    const onFocus = () => { if (document.visibilityState === "visible") void refresh().catch(() => {}); };

    void refresh().catch(() => {});
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      if (intervalId !== undefined) window.clearInterval(intervalId);
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
      refreshController.current?.abort();
      refreshController.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  function finishClose(afterClose?: () => void) {
    setPanelClosing(true);
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setPanelOpen(false);
      setPanelClosing(false);
      closeTimer.current = null;
      afterClose?.();
    }, reducedMotion === true ? 0 : 250);
  }

  function selectDay(day: DayNumber) {
    setPlayingAll(false);
    setLiveStatus(`전원 · ${day}일차 선택됨. 패널 닫는 중`);
    setCompletedDay(null);
    setSelectedDay(null);
    finishClose(() => {
      setSelectedDay(day);
      setPlaybackRequest((request) => request + 1);
      setLiveStatus(`전원 · ${day}일차 경로 재생 중`);
    });
  }

  function selectAllDays() {
    setPlayingAll(true);
    setLiveStatus("전원 전체 일정 선택됨. 패널 닫는 중");
    setCompletedDay(null);
    setSelectedDay(null);
    finishClose(() => {
      setSelectedDay(1);
      setPlaybackRequest((request) => request + 1);
      setLiveStatus("전원 전체 일정 · 1일차 경로 재생 중");
    });
  }

  const playbackComplete = useCallback((day: DayNumber) => {
    if (playingAll && day < 5) {
      const nextDay = (day + 1) as DayNumber;
      setSelectedDay(nextDay);
      setPlaybackRequest((request) => request + 1);
      setLiveStatus(`전원 전체 일정 · ${nextDay}일차 경로 재생 중`);
      return;
    }
    setCompletedDay(day);
    setLiveStatus(playingAll ? "전원 전체 일정 경로 재생 완료" : `전원 · ${day}일차 경로 재생 완료`);
  }, [playingAll]);

  function replay() {
    if (!selectedDay) return;
    setCompletedDay(null);
    if (playingAll) {
      setSelectedDay(1);
      setLiveStatus("전원 전체 일정 · 1일차 경로 다시 재생 중");
    } else {
      setLiveStatus(`전원 · ${selectedDay}일차 경로 다시 재생 중`);
    }
    setPlaybackRequest((request) => request + 1);
  }

  if (!payload) {
    return (
      <main className={styles.loading}>
        {loadError ? <><p role="alert">{loadError}</p><button type="button" onClick={() => void refresh().catch(() => {})}>일정 다시 불러오기</button></> : <p role="status">일정을 불러오는 중…</p>}
      </main>
    );
  }

  return (
    <main className={styles.app}>
      <GoogleTripMap railRoutes={payload.railRoutes} selectedTravelerId={null} selectedDay={selectedDay} playbackRequest={playbackRequest} reducedMotion={reducedMotion === true} onPlaybackComplete={playbackComplete} />
      {loadError && <p className={styles.staleWarning} role="alert">최신 데이터를 불러오지 못했습니다. 기존 일정을 표시합니다.</p>}
      {(panelOpen || panelClosing) && (
        <TripPanel
          payload={payload}
          selectedDay={selectedDay}
          allDaysSelected={playingAll}
          state={panelClosing ? "closing" : "open"}
          onSelectAll={selectAllDays}
          onSelectDay={selectDay}
          onClose={() => finishClose()}
        />
      )}
      {!panelOpen && !panelClosing && (
        <button type="button" className={styles.panelOpener} onClick={() => setPanelOpen(true)}>일정 패널 열기</button>
      )}
      {completedDay === selectedDay && selectedDay && (
        <button type="button" className={styles.replay} onClick={replay} aria-label={playingAll ? "전체 일정 다시 재생" : `${selectedDay}일차 경로 다시 재생`}>↻ 재생</button>
      )}
      <p className={styles.liveStatus} role="status" aria-live="polite" aria-atomic="true">{liveStatus}</p>
    </main>
  );
}

export function TripApp() {
  return <MobileTripApp />;
}
