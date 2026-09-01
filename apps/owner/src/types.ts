export type OwnerSession = { accessToken: string; expiresAt: string };

export type RejectionCategory = "distance_over_50km" | "schedule_impossible" | "unsafe_or_illegal" | "purpose_conflict" | "other";

export type PendingOpinion = {
  id: string;
  authorName: string;
  targetDay: number | null;
  body: string;
  createdAt: string;
};

export type RailSegment = {
  key: "kix-kyoto" | "kyoto-odawara" | "odawara-tokyo" | "tokyo-narita";
  title: string;
  tripDate: string;
  finalized: boolean;
  departureTime: string | null;
  expiresAt: string | null;
  naritaRailChoice: "skyliner" | null;
  canFinalize: boolean;
};

export type OwnerDashboard = {
  pendingOpinions: PendingOpinion[];
  railSegments: RailSegment[];
  finalizationOpensAt: string;
  finalizationClosesAt: string;
};
