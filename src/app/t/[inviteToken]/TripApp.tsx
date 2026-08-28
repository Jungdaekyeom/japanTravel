"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { TripPanel } from "../../../components/TripPanel";
import { GoogleTripMap } from "../../../components/map/GoogleTripMap";
import type { TripPayload } from "../../../server/trip/payload";
import type { DayNumber } from "../../../trip/types";
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

function MobileTripApp({ inviteToken }: { inviteToken: string }) {
  const reducedMotion = useMedia("(prefers-reduced-motion: reduce)");
  const [payload, setPayload] = useState<TripPayload | null>(null);
  const [loadError, setLoadError] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelClosing, setPanelClosing] = useState(false);
  const [focusOnOpen, setFocusOnOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayNumber | null>(null);
  const [playbackRequest, setPlaybackRequest] = useState(0);
  const [completedDay, setCompletedDay] = useState<DayNumber | null>(null);
  const [liveStatus, setLiveStatus] = useState("전체 5일 경로 표시 중");
  const closeTimer = useRef<number | null>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/trip/${encodeURIComponent(inviteToken)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("일정을 불러오지 못했습니다.");
      setPayload(await response.json() as TripPayload);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "일정을 불러오지 못했습니다.");
    }
  }, [inviteToken]);

  useEffect(() => {
    let intervalId: number | undefined;
    const schedule = () => {
      if (intervalId !== undefined) window.clearInterval(intervalId);
      intervalId = document.visibilityState === "visible" ? window.setInterval(refresh, 30_000) : undefined;
    };
    const onVisibility = () => {
      schedule();
      if (document.visibilityState === "visible") void refresh();
    };
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(); };

    void refresh();
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      if (intervalId !== undefined) window.clearInterval(intervalId);
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (!panelOpen && !panelClosing) openButtonRef.current?.focus();
  }, [panelClosing, panelOpen]);

  function finishClose(afterClose?: () => void) {
    setPanelClosing(true);
    setFocusOnOpen(false);
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setPanelOpen(false);
      setPanelClosing(false);
      closeTimer.current = null;
      afterClose?.();
    }, 250);
  }

  function selectDay(day: DayNumber) {
    setLiveStatus(`${day}일차 선택됨. 패널 닫는 중`);
    setCompletedDay(null);
    setSelectedDay(null);
    finishClose(() => {
      setSelectedDay(day);
      setPlaybackRequest((request) => request + 1);
      setLiveStatus(`${day}일차 경로 재생 중`);
    });
  }

  const playbackComplete = useCallback((day: DayNumber) => {
    setCompletedDay(day);
    setLiveStatus(`${day}일차 경로 재생 완료`);
  }, []);

  function replay() {
    if (!selectedDay) return;
    setCompletedDay(null);
    setLiveStatus(`${selectedDay}일차 경로 다시 재생 중`);
    setPlaybackRequest((request) => request + 1);
  }

  if (!payload) {
    return (
      <main className={styles.loading}>
        {loadError ? <><p role="alert">{loadError}</p><button type="button" onClick={() => void refresh()}>일정 다시 불러오기</button></> : <p role="status">일정을 불러오는 중…</p>}
      </main>
    );
  }

  return (
    <main className={styles.app}>
      <GoogleTripMap selectedDay={selectedDay} playbackRequest={playbackRequest} reducedMotion={reducedMotion === true} onPlaybackComplete={playbackComplete} />
      {(panelOpen || panelClosing) && (
        <TripPanel
          payload={payload}
          selectedDay={selectedDay}
          state={panelClosing ? "closing" : "open"}
          focusOnOpen={focusOnOpen}
          onSelectDay={selectDay}
          onClose={() => finishClose()}
          onRefresh={refresh}
        />
      )}
      {!panelOpen && !panelClosing && (
        <button ref={openButtonRef} type="button" className={styles.panelOpener} onClick={() => { setPanelOpen(true); setFocusOnOpen(true); }}>일정 패널 열기</button>
      )}
      {completedDay === selectedDay && selectedDay && (
        <button type="button" className={styles.replay} onClick={replay} aria-label={`${selectedDay}일차 경로 다시 재생`}>↻ 재생</button>
      )}
      <p className={styles.liveStatus} role="status" aria-live="polite" aria-atomic="true">{liveStatus}</p>
    </main>
  );
}

export function TripApp({ inviteToken }: { inviteToken: string }) {
  const desktop = useMedia("(min-width: 768px)");
  if (desktop === null) return null;
  if (desktop) return <main className={styles.desktopGate}><p>휴대폰에서 접속해 주세요</p></main>;
  return <MobileTripApp inviteToken={inviteToken} />;
}
