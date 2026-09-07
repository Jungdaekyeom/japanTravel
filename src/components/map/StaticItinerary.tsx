import { DAY1_SCHEDULES, PUBLIC_TRIP_DEFINITION, type DayNumber } from "../../trip/public";
import { TRAVELERS, type TravelerId } from "../../trip/travelers";

import styles from "./GoogleTripMap.module.css";

const DAY1_GROUPS = [
  { travelerIds: ["daekyeom"], carKey: "mandeok-pus", carLabel: "PUS 이동", flightKey: "pus-kix", flightLabel: "PUS→KIX" },
  { travelerIds: ["gyuyeol", "junsu"], carKey: "icheon-gmp", carLabel: "GMP 이동", flightKey: "gmp-kix", flightLabel: "GMP→KIX" },
  { travelerIds: ["gyujun"], carKey: "suwon-gmp", carLabel: "GMP 이동", flightKey: "gmp-kix", flightLabel: "GMP→KIX" },
] as const satisfies readonly {
  travelerIds: readonly TravelerId[];
  carKey: keyof typeof DAY1_SCHEDULES;
  carLabel: string;
  flightKey: keyof typeof DAY1_SCHEDULES;
  flightLabel: string;
}[];

type DayOneProps = { selectedTravelerId: TravelerId | null };

export function DayOneStatus({ minute, selectedTravelerId }: DayOneProps & { minute: number }) {
  return (
    <section className={styles.travelStatus} aria-label="1일차 이동 현황">
      <strong>예정 {formatMinute(minute)}</strong>
      <ul>
        {visibleGroups(selectedTravelerId).map((group) => (
          <li key={group.carKey}>{group.names} · {phaseAt(group, minute)}</li>
        ))}
      </ul>
    </section>
  );
}

export function DayOneSchedule({ selectedTravelerId }: DayOneProps) {
  return (
    <section className={styles.plannedSchedule} aria-label="1일차 계획 시간">
      <strong>10월 2일 계획 시간</strong>
      <ul>
        {visibleGroups(selectedTravelerId).map((group) => {
          const car = DAY1_SCHEDULES[group.carKey];
          const flight = DAY1_SCHEDULES[group.flightKey];
          return <li key={group.carKey}>{group.names} · {group.carLabel} {formatMinute(car.departureMinute)}–{formatMinute(car.arrivalMinute)} · {group.flightLabel} {formatMinute(flight.departureMinute)}–{formatMinute(flight.arrivalMinute)}</li>;
        })}
      </ul>
    </section>
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
      <ol>
        {PUBLIC_TRIP_DEFINITION.days.map((day) => (
          <li key={day.day} data-selected={selectedDay === day.day}>
            <strong>{day.day}일차 · {day.title}</strong><span>{day.summary}</span>
          </li>
        ))}
      </ol>
      {(selectedDay === null || selectedDay === 1) && <DayOneSchedule selectedTravelerId={selectedTravelerId} />}
      <button type="button" onClick={onRetry}>지도 다시 불러오기</button>
    </section>
  );
}

function visibleGroups(selectedTravelerId: TravelerId | null) {
  return DAY1_GROUPS.flatMap((group) => {
    const travelers = TRAVELERS.filter(({ id }) => (group.travelerIds as readonly TravelerId[]).includes(id) && (!selectedTravelerId || id === selectedTravelerId));
    return travelers.length ? [{ ...group, names: travelers.map(({ name }) => name).join(" · ") }] : [];
  });
}

function phaseAt(group: ReturnType<typeof visibleGroups>[number], minute: number) {
  const car = DAY1_SCHEDULES[group.carKey];
  const flight = DAY1_SCHEDULES[group.flightKey];
  if (minute < car.departureMinute) return "출발 대기";
  if (minute < car.arrivalMinute) return "차량 이동";
  if (minute < flight.departureMinute) return "공항 대기";
  if (minute < flight.arrivalMinute) return "비행 중";
  return "KIX 도착";
}

function formatMinute(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
