import { TRIP_SCHEDULE, PUBLIC_TRIP_DEFINITION, type DayNumber } from "../../trip/public";
import type { TravelerId } from "../../trip/travelers";
import styles from "./GoogleTripMap.module.css";

export function DaySchedule({ day, selectedTravelerId, expanded = false }: { day: DayNumber; selectedTravelerId: TravelerId | null; expanded?: boolean }) {
  const entries = TRIP_SCHEDULE[day].filter((entry) => !selectedTravelerId || !entry.travelerIds || entry.travelerIds.includes(selectedTravelerId));
  return (
    <details className={styles.plannedSchedule} open={expanded}>
      <summary>{day}일차 · 10월 {day + 1}일 예정 일정</summary>
      <p>지도는 경로 미리보기입니다. 이동 속도는 실제 소요시간과 다릅니다.</p>
      <ul>{entries.map((entry, index) => (
        <li key={index}><strong>{entry.time}</strong> · {entry.text}{entry.note && <small>{entry.note}</small>}</li>
      ))}</ul>
    </details>
  );
}

export function StaticItinerary({ selectedDay, selectedTravelerId, message, onRetry }: { selectedDay: DayNumber | null; selectedTravelerId: TravelerId | null; message: string; onRetry: () => void }) {
  return (
    <section className={styles.fallback} aria-label="정적 여행 일정">
      <div>
        <p className={styles.kicker}>MAP OFFLINE</p>
        <h2>{selectedDay ? `${selectedDay}일차 일정` : "전체 여행 일정"}</h2>
        <p role="alert">{message}</p>
      </div>
      <ol>{PUBLIC_TRIP_DEFINITION.days.map((day) => (
        <li key={day.day} data-selected={selectedDay === day.day}>
          <strong>{day.day}일차 · {day.title}</strong><span>{day.summary}</span>
        </li>
      ))}</ol>
      {(selectedDay ? [selectedDay] : [1, 2, 3, 4, 5] as const).map((day) => (
        <DaySchedule key={day} day={day} selectedTravelerId={selectedTravelerId} expanded={selectedDay === day} />
      ))}
      <button type="button" onClick={onRetry}>지도 다시 불러오기</button>
    </section>
  );
}
