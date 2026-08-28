import type {
  DayNumber,
  OpinionStatus,
  Participant,
  RejectionCategory,
  RouteGeometryStatus,
} from "../../trip/types";

export type ParticipantRecord = Participant & {
  codeSalt: string;
  codeHash: string;
  createdAt: Date;
};

export type SessionRecord = {
  id: string;
  participantId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
};

export type LoginAttemptRecord = {
  id: string;
  ipHash: string;
  attemptedAt: Date;
};

export type OpinionRecord = {
  id: string;
  participantId: string;
  targetDay: DayNumber | null;
  body: string;
  status: OpinionStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  rejectionCategory: RejectionCategory | null;
  publicSummary: string | null;
  rejectionReason: string | null;
  rejectionAcceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RouteGeometryRecord = {
  segmentKey: string;
  status: RouteGeometryStatus;
  geometry: readonly [number, number][];
  departureTime: string | null;
  naritaRailChoice: "skyliner" | "nex" | null;
  createdAt: Date;
  expiresAt: Date;
};

export type CreateOpinionInput = Pick<OpinionRecord, "participantId" | "targetDay" | "body">;
export type UpdateOpinionInput = Partial<
  Pick<
    OpinionRecord,
    | "status"
    | "reviewedBy"
    | "reviewedAt"
    | "rejectionCategory"
    | "publicSummary"
    | "rejectionReason"
    | "rejectionAcceptedAt"
  >
>;

export type TripRepository = {
  listParticipantCredentials(): Promise<readonly ParticipantRecord[]>;
  findParticipantById(id: string): Promise<ParticipantRecord | null>;
  createSession(session: SessionRecord): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  countFailedLoginAttempts(since: Date, ipHash?: string): Promise<number>;
  recordFailedLoginAttempt(attempt: LoginAttemptRecord): Promise<void>;
  listOpinions(): Promise<readonly OpinionRecord[]>;
  createOpinion(input: CreateOpinionInput): Promise<OpinionRecord>;
  updateOpinion(id: string, input: UpdateOpinionInput): Promise<OpinionRecord | null>;
  listRouteGeometry(): Promise<readonly RouteGeometryRecord[]>;
  findRouteGeometry(segmentKey: string): Promise<RouteGeometryRecord | null>;
  upsertRouteGeometry(record: RouteGeometryRecord): Promise<void>;
  deleteExpiredRouteGeometry(now: Date): Promise<void>;
};
