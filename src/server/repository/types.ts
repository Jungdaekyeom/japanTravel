import type {
  DayNumber,
  OpinionStatus,
  Participant,
  RejectionCategory,
  RailSegment,
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
  status: "pending" | "finalized";
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

export type RouteSegmentKey = RailSegment["key"];

export type RouteGeometryRecord = {
  segmentKey: RouteSegmentKey;
  status: RouteGeometryStatus;
  encodedPolyline: string;
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
  reserveLoginAttempt(ipHash: string, now: Date): Promise<string | null>;
  finalizeLoginAttempt(reservationId: string): Promise<void>;
  releaseLoginAttempt(reservationId: string): Promise<void>;
  listOpinions(): Promise<readonly OpinionRecord[]>;
  createOpinion(input: CreateOpinionInput): Promise<OpinionRecord>;
  createOpinionIfNoUnacceptedRejection(input: CreateOpinionInput): Promise<OpinionRecord | null>;
  updateOpinion(id: string, input: UpdateOpinionInput): Promise<OpinionRecord | null>;
  transitionOpinion(id: string, fromStatus: OpinionStatus, input: UpdateOpinionInput): Promise<OpinionRecord | null>;
  acceptRejectedOpinionByAuthor(id: string, participantId: string, acceptedAt: Date): Promise<OpinionRecord | null>;
  listRouteGeometry(now: Date): Promise<readonly RouteGeometryRecord[]>;
  findRouteGeometry(segmentKey: RouteSegmentKey, now: Date): Promise<RouteGeometryRecord | null>;
  upsertRouteGeometry(record: RouteGeometryRecord): Promise<void>;
  deleteExpiredRouteGeometry(now: Date): Promise<void>;
};
