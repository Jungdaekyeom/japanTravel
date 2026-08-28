import { TRIP_DEFINITION } from "../../trip/definition";
import type { DayNumber } from "../../trip/types";

import styles from "./GoogleTripMap.module.css";

export function StaticItinerary({ selectedDay, message, onRetry }: { selectedDay: DayNumber | null; message: string; onRetry: () => void }) {
  return (
    <section className={styles.fallback} aria-label="정적 여행 일정">
      <div>
        <p className={styles.kicker}>MAP OFFLINE</p>
        <h2>{selectedDay ? `${selectedDay}일차 일정` : "전체 여행 일정"}</h2>
        <p role="alert">{message}</p>
      </div>
      <ol>
        {TRIP_DEFINITION.days.map((day) => (
          <li key={day.day} data-selected={selectedDay === day.day}>
            <strong>{day.day}일차 · {day.title}</strong><span>{day.summary}</span>
          </li>
        ))}
      </ol>
      <button type="button" onClick={onRetry}>지도 다시 불러오기</button>
    </section>
  );
}
