"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import type { DayNumber, TripPayload } from "../trip/public";
import { AdminReviewControls } from "./AdminReviewControls";
import { OpinionComposer } from "./OpinionComposer";
import { RejectionCards } from "./RejectionCards";
import { RouteFinalizer } from "./admin/RouteFinalizer";
import styles from "./TripPanel.module.css";

type TripPanelProps = {
  payload: TripPayload;
  selectedDay: DayNumber | null;
  state: "open" | "closing";
  focusOnOpen: boolean;
  onSelectDay: (day: DayNumber) => void;
  onClose: () => void;
  onRefresh: () => Promise<void>;
};

const roleLabel = { observer: "관찰자", contributor: "참가자", admin: "관리자" } as const;

export function TripPanel({ payload, selectedDay, state, focusOnOpen, onSelectDay, onClose, onRefresh }: TripPanelProps) {
  const dayRefs = useRef(new Map<DayNumber, HTMLButtonElement>());
  const closeRef = useRef<HTMLButtonElement>(null);
  const [code, setCode] = useState("");
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionMessage, setSessionMessage] = useState("");

  useEffect(() => {
    if (!focusOnOpen) return;
    (selectedDay ? dayRefs.current.get(selectedDay) : closeRef.current)?.focus();
  }, [focusOnOpen, selectedDay]);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    setSessionBusy(true);
    setSessionMessage("");
    try {
      const response = await fetch("/api/session/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) throw new Error(response.status === 429 ? "잠시 후 다시 시도해 주세요." : "코드를 확인해 주세요.");
      setCode("");
      setSessionMessage("역할 잠금을 해제했습니다.");
      await onRefresh();
    } catch (error) {
      setSessionMessage(error instanceof Error ? error.message : "잠금을 해제하지 못했습니다.");
    } finally {
      setSessionBusy(false);
    }
  }

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
          <span className={styles.roleBadge}>{roleLabel[payload.role]} 세션</span>
          <span className={styles.sessionState}>{payload.role === "observer" ? "공개 일정만 보기" : `${payload.displayName} · 개인 역할 활성`}</span>
        </div>
        <ol className={styles.days}>
          {payload.trip.days.map((day) => (
            <li key={day.day}>
              <button
                ref={(node) => { if (node) dayRefs.current.set(day.day, node); }}
                type="button"
                className={styles.dayButton}
                aria-label={`${day.day}일차 ${day.title}`}
                aria-current={selectedDay === day.day ? "true" : undefined}
                onClick={() => onSelectDay(day.day)}
              >
                <span className={styles.dayIndex}>{day.day}</span>
                <span><strong>{day.day}일차 · {day.date.slice(5).replace("-", ".")}</strong><small>{day.title}</small></span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className={styles.scrollContent}>
        <section className={styles.section} aria-labelledby="session-title">
          <h2 id="session-title">참여 상태</h2>
          {payload.role === "observer" ? (
            <form className={styles.form} onSubmit={unlock}>
              <label>개인 코드<input aria-label="개인 코드" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label>
              <button type="submit" disabled={sessionBusy || code.length !== 6}>{sessionBusy ? "확인 중…" : "역할 잠금 해제"}</button>
            </form>
          ) : <button type="button" disabled={sessionBusy} onClick={lock}>관찰자 모드로 전환</button>}
          {sessionMessage && <p role="status" className={styles.message}>{sessionMessage}</p>}
        </section>

        <RejectionCards publicRejections={payload.publicRejections} ownOpinions={ownOpinions} onRefresh={onRefresh} />
        {payload.role === "contributor" && <OpinionComposer blocked={blocked} onRefresh={onRefresh} />}
        {payload.role === "admin" && <RouteFinalizer railRoutes={payload.railRoutes} onRefresh={onRefresh} />}
        {payload.role === "admin" && <AdminReviewControls opinions={payload.reviewQueue} onRefresh={onRefresh} />}
      </div>
    </aside>
  );
}
