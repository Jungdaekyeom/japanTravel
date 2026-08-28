import { PUBLIC_TRIP_DEFINITION, type DayNumber } from "./public";
import type { TripDefinition } from "./types";

export const TRIP_DEFINITION = {
  ...PUBLIC_TRIP_DEFINITION,
  participants: [
    { id: "daekyeom", name: "정대겸", birthYear: 1993, departureCity: "부산", role: "admin" },
    { id: "gyuyeol", name: "이규열", birthYear: 1998, departureCity: "인천", role: "contributor" },
    { id: "junsu", name: "박준수", birthYear: 1998, departureCity: "인천", role: "contributor" },
    { id: "gyujun", name: "한규준", birthYear: 1998, departureCity: "인천", role: "contributor" },
  ],
} as const satisfies TripDefinition;

export function getDay(day: DayNumber) {
  return PUBLIC_TRIP_DEFINITION.days[day - 1];
}
