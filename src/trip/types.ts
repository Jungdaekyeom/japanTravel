export type DayNumber = 1 | 2 | 3 | 4 | 5;

export type ViewerRole = "observer" | "contributor" | "admin";

export type Viewer =
  | { role: "observer" }
  | { id: string; role: "contributor" }
  | { id: string; role: "admin" };

export type OpinionStatus = "pending" | "approved" | "rejected";

export type RejectionCategory = "schedule" | "budget" | "feasibility" | "other";

export type RouteGeometryStatus = "placeholder" | "finalized" | "expired";

export type Participant = {
  id: string;
  name: string;
  birthYear: number;
  departureCity: "부산" | "인천";
  role: Exclude<ViewerRole, "observer">;
};

export type ItineraryDay = {
  day: DayNumber;
  date: string;
  title: string;
  summary: string;
  overnight: "교토" | "하코네" | "도쿄" | null;
};

export type Place = {
  name: string;
  latitude: number;
  longitude: number;
};

export type PlaceKey = "busan" | "incheon" | "kix" | "kyoto" | "odawara" | "hakone" | "tokyo" | "nrt";

export type RailSegment = {
  key: "kix-kyoto" | "kyoto-odawara" | "odawara-tokyo" | "tokyo-narita";
  from: PlaceKey;
  to: PlaceKey;
  naritaRailChoices?: readonly ["skyliner", "nex"];
};

export type TripDefinition = {
  startDate: string;
  endDate: string;
  participants: readonly Participant[];
  days: readonly ItineraryDay[];
  railSegments: readonly RailSegment[];
  places: Record<PlaceKey, Place>;
};
