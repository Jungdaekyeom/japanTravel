"use client";

import { useEffect, useRef, useState } from "react";

import type { DayNumber, TripPayload } from "../trip/public";
import { AdminReviewControls } from "./AdminReviewControls";
import { OpinionComposer } from "./OpinionComposer";
import { RejectionCards } from "./RejectionCards";
import { RouteFinalizer } from "./admin/RouteFinalizer";
import styles from "./TripPanel.module.css";

type TripPanelProps = {
  payload: TripPayload;
  selectedDay: DayNumber | null;
  allDaysSelected: boolean;
  state: "open" | "closing";
  focusOnOpen: boolean;
  onSelectAll: () => void;
  onSelectDay: (day: DayNumber) => void;
  onClose: () => void;
  onRefresh: () => Promise<void>;
};

const roleLabel = { observer: "관찰자", contributor: "참가자", admin: "관리자" } as const;

export function TripPanel({ payload, selectedDay, allDaysSelected, state, focusOnOpen, onSelectAll, onSelectDay, onClose, onRefresh }: TripPanelProps) {
  const allDaysRef = useRef<HTMLButtonElement>(null);
  const dayRefs = useRef(new Map<DayNumber, HTMLButtonElement>());
  const closeRef = useRef<HTMLButtonElement>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionMessage, setSessionMessage] = useState("");

  useEffect(() => {
    if (!focusOnOpen) return;
    (allDaysSelected ? allDaysRef.current : selectedDay ? dayRefs.current.get(selectedDay) : closeRef.current)?.focus();
  }, [allDaysSelected, focusOnOpen, selectedDay]);

  async function lock() {
    setSessionBusy(true);
    setSessionMessage("");
    try {
      const response = await fetch("/api/session", { method: "DELETE" });
      if (!response.ok) throw new Error("잠금을 복원하지 못했습니다.");
      setSessionMessage("관찰자 모드로 전환했습니다.");
      await onRefresh();
    } catch (error) {
      setSessionMessage(error instanceof Error ? error.message : "잠금을 복원하지 못했습니다.");
    } finally {
      setSessionBusy(false);
    }
  }

  const ownOpinions = payload.role === "contributor" ? payload.ownOpinions : [];
  const blocked = ownOpinions.some((opinion) => opinion.status === "rejected" && !opinion.accepted);

  return (
    <aside className={styles.panel} data-state={state}>
      <nav aria-label="여행 일정" data-state={state}>
        <header className={styles.panelHeader}>
          <div><p className={styles.eyebrow}>JAPAN · 2026</p><h1>4박 5일 여행</h1></div>
          <button ref={closeRef} type="button" className={styles.iconButton} aria-label="일정 패널 닫기" onClick={onClose}>‹</button>
        </header>
        <div className={styles.sessionRow}>
          <div className={styles.sessionIdentity}>
            <span className={styles.roleBadge}>{roleLabel[payload.role]} 세션</span>
            <span className={styles.sessionState}>{payload.role === "observer" ? "공개 일정만 보기" : `${payload.displayName} · 개인 역할 활성`}</span>
          </div>
          {payload.role !== "observer" && <button className={styles.sessionControl} type="button" disabled={sessionBusy} onClick={lock}>관찰자 모드로 전환</button>}
        </div>
        {sessionMessage && <p role="status" className={styles.message}>{sessionMessage}</p>}
        <button ref={allDaysRef} type="button" className={`${styles.dayButton} ${styles.allDaysButton}`} aria-current={allDaysSelected ? "true" : undefined} onClick={onSelectAll}>전체 일정</button>
        <ol className={styles.days}>
          {payload.trip.days.map((day) => (
            <li key={day.day}>
              <button
                ref={(node) => { if (node) dayRefs.current.set(day.day, node); }}
                type="button"
                className={styles.dayButton}
                aria-label={`${day.day}일차 ${day.title}. ${day.summary}`}
                aria-current={!allDaysSelected && selectedDay === day.day ? "true" : undefined}
                onClick={() => onSelectDay(day.day)}
              >
                <span className={styles.dayIndex}>{day.day}</span>
                <span><strong>{day.day}일차 · {day.date.slice(5).replace("-", ".")}</strong><small>{day.summary}</small></span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className={styles.scrollContent}>
        <RejectionCards ownOpinions={ownOpinions} onRefresh={onRefresh} />
        {payload.role === "contributor" && <OpinionComposer blocked={blocked} onRefresh={onRefresh} />}
        {payload.role === "admin" && <RouteFinalizer railRoutes={payload.railRoutes} onRefresh={onRefresh} />}
        {payload.role === "admin" && <AdminReviewControls opinions={payload.reviewQueue} onRefresh={onRefresh} />}
      </div>
    </aside>
  );
}
