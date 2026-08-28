import type { PublicTripDefinition, ViewerRole } from "./public";

export type {
  DayNumber,
  ItineraryDay,
  OpinionStatus,
  Place,
  PlaceKey,
  PublicRailRoute,
  RailSegment,
  RejectionCategory,
  ViewerRole,
} from "./public";

export type Viewer =
  | { role: "observer" }
  | { id: string; role: "contributor" }
  | { id: string; role: "admin" };

export type RouteGeometryStatus = "placeholder" | "finalized" | "expired";

export type Participant = {
  id: string;
  name: string;
  birthYear: number;
  departureCity: "부산" | "인천";
  role: Exclude<ViewerRole, "observer">;
};

export type TripDefinition = PublicTripDefinition & {
  participants: readonly Participant[];
};
