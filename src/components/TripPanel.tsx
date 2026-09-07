"use client";

import type { DayNumber, SharedTripPayload } from "../trip/public";
import styles from "./TripPanel.module.css";

type TripPanelProps = {
  payload: SharedTripPayload;
  selectedDay: DayNumber | null;
  allDaysSelected: boolean;
  state: "open" | "closing";
  onSelectAll: () => void;
  onSelectDay: (day: DayNumber) => void;
  onClose: () => void;
};

export function TripPanel({ payload, selectedDay, allDaysSelected, state, onSelectAll, onSelectDay, onClose }: TripPanelProps) {
  return (
    <aside className={styles.panel} data-state={state}>
      <nav aria-label="여행 일정" data-state={state}>
        <header className={styles.panelHeader}>
          <div><p className={styles.eyebrow}>JAPAN · 2026</p><h1>4박 5일 여행</h1></div>
          <button type="button" className={styles.iconButton} aria-label="일정 패널 닫기" onClick={onClose}>‹</button>
        </header>
        <button type="button" className={`${styles.dayButton} ${styles.allDaysButton}`} aria-current={allDaysSelected ? "true" : undefined} onClick={onSelectAll}>전체 일정</button>
        <ol className={styles.days}>
          {payload.trip.days.map((day) => (
            <li key={day.day}>
              <button
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

      {/* 의견·관리 진입점은 경로 개발에 집중하기 위해 보류했다. 사용자 요청 시 공개 의견 모델로 재설계한다. */}
    </aside>
  );
}
