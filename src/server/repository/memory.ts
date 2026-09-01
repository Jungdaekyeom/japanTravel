import { randomUUID } from "node:crypto";

import type {
  ClaimedSessionRecord,
  CreateOpinionInput,
  LoginAttemptRecord,
  OpinionRecord,
  ParticipantClaimTokenRecord,
  ParticipantRecord,
  RouteGeometryRecord,
  SessionRecord,
  TripRepository,
  UpdateOpinionInput,
} from "./types";

const WINDOW_MS = 15 * 60 * 1000;
const PENDING_TTL_MS = 60 * 1000;
const MAX_IP_FAILURES = 5;
const MAX_GLOBAL_FAILURES = 50;

function copy<T>(value: T): T {
  return structuredClone(value);
}

function validOpinion(opinion: OpinionRecord) {
  const reviewFieldsAreEmpty =
    opinion.reviewedBy === null &&
    opinion.reviewedAt === null &&
    opinion.rejectionCategory === null &&
    opinion.publicSummary === null &&
    opinion.rejectionReason === null &&
    opinion.rejectionAcceptedAt === null;
  const approved =
    opinion.reviewedBy !== null &&
    opinion.reviewedAt !== null &&
    opinion.rejectionCategory === null &&
    opinion.publicSummary === null &&
    opinion.rejectionReason === null &&
    opinion.rejectionAcceptedAt === null;
  const rejected =
    opinion.reviewedBy !== null &&
    opinion.reviewedAt !== null &&
    opinion.rejectionCategory !== null &&
    opinion.publicSummary !== null &&
    opinion.rejectionReason !== null;
  return (
    opinion.targetDay === null || (opinion.targetDay >= 1 && opinion.targetDay <= 5)
  ) && opinion.body.length >= 1 && opinion.body.length <= 1000 && (
    (opinion.status === "pending" && reviewFieldsAreEmpty) ||
    (opinion.status === "approved" && approved) ||
    (opinion.status === "rejected" && rejected)
  );
}

type InitialData = Partial<{
  participants: ParticipantRecord[];
  sessions: SessionRecord[];
  claimTokens: ParticipantClaimTokenRecord[];
  loginAttempts: LoginAttemptRecord[];
  opinions: OpinionRecord[];
  routeGeometry: RouteGeometryRecord[];
}>;

export class InMemoryTripRepository implements TripRepository {
  private participants: ParticipantRecord[];
  private sessions: SessionRecord[];
  private claimTokens: ParticipantClaimTokenRecord[];
  private loginAttempts: LoginAttemptRecord[];
  private opinions: OpinionRecord[];
  private routeGeometry: RouteGeometryRecord[];
  private reservationQueue = Promise.resolve();
  private sessionQueue = Promise.resolve();
  private opinionQueue = Promise.resolve();

  constructor(initial: InitialData = {}) {
    this.participants = copy(initial.participants ?? []);
    this.sessions = copy(initial.sessions ?? []);
    this.claimTokens = copy(initial.claimTokens ?? []);
    this.loginAttempts = copy(initial.loginAttempts ?? []);
    this.opinions = copy(initial.opinions ?? []);
    this.routeGeometry = copy(initial.routeGeometry ?? []);
  }

  private async locked<T>(queue: "reservationQueue" | "sessionQueue" | "opinionQueue", operation: () => T) {
    let release!: () => void;
    const previous = this[queue];
    this[queue] = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return operation(); }
    finally { release(); }
  }

  async findParticipantById(id: string) {
    const participant = this.participants.find((candidate) => candidate.id === id);
    return participant ? copy(participant) : null;
  }

  async createSession(session: SessionRecord) {
    if (this.sessions.some((candidate) => candidate.id === session.id || candidate.tokenHash === session.tokenHash)) {
      throw new Error("Session token hash already exists");
    }
    this.sessions.push(copy(session));
  }

  async claimPersonalToken(tokenHash: string, session: ClaimedSessionRecord) {
    return this.locked("sessionQueue", () => {
      const token = this.claimTokens.find((candidate) => candidate.tokenHash === tokenHash && candidate.consumedAt === null);
      if (!token) return null;
      const participant = this.participants.find((candidate) => candidate.id === token.participantId);
      if (!participant) return null;
      if (this.sessions.some((candidate) => candidate.id === session.id || candidate.tokenHash === session.tokenHash)) {
        throw new Error("Session token hash already exists");
      }
      this.sessions.push(copy({ ...session, participantId: participant.id }));
      token.consumedAt = new Date(session.createdAt);
      return { participantId: participant.id, role: participant.role };
    });
  }

  async claimOwnerToken(tokenHash: string, session: ClaimedSessionRecord) {
    return this.locked("sessionQueue", () => {
      const token = this.claimTokens.find((candidate) =>
        candidate.participantId === "daekyeom" && candidate.tokenHash === tokenHash && candidate.consumedAt === null,
      );
      const owner = this.participants.find((candidate) => candidate.id === "daekyeom" && candidate.role === "admin");
      if (!token || !owner) return null;
      if (this.sessions.some((candidate) =>
        candidate.participantId !== owner.id && (candidate.id === session.id || candidate.tokenHash === session.tokenHash),
      )) throw new Error("Session token hash already exists");

      this.sessions = this.sessions.filter((candidate) => candidate.participantId !== owner.id);
      this.sessions.push(copy({ ...session, participantId: owner.id }));
      token.consumedAt = new Date(session.createdAt);
      return { participantId: owner.id, role: owner.role };
    });
  }

  async findSessionByTokenHash(tokenHash: string) {
    const session = this.sessions.find((candidate) => candidate.tokenHash === tokenHash);
    return session ? copy(session) : null;
  }

  async deleteSessionByTokenHash(tokenHash: string) {
    this.sessions = this.sessions.filter((session) => session.tokenHash !== tokenHash);
  }

  async reserveLoginAttempt(ipHash: string, now: Date) {
    return this.locked("reservationQueue", () => {
      const since = new Date(now.getTime() - WINDOW_MS);
      const active = this.loginAttempts.filter((attempt) =>
        attempt.status === "finalized"
          ? attempt.attemptedAt > since
          : attempt.attemptedAt > new Date(now.getTime() - PENDING_TTL_MS),
      );
      if (active.length >= MAX_GLOBAL_FAILURES || active.filter((attempt) => attempt.ipHash === ipHash).length >= MAX_IP_FAILURES) return null;
      const id = randomUUID();
      this.loginAttempts.push({ id, ipHash, attemptedAt: new Date(now), status: "pending" });
      return id;
    });
  }

  async releaseLoginAttempt(reservationId: string) {
    this.loginAttempts = this.loginAttempts.filter((attempt) => attempt.id !== reservationId);
  }

  async finalizeLoginAttempt(reservationId: string) {
    const reservation = this.loginAttempts.find((attempt) => attempt.id === reservationId);
    if (reservation) reservation.status = "finalized";
  }

  async listOpinions() {
    return copy(this.opinions);
  }

  async createOpinion(input: CreateOpinionInput) {
    return this.createOpinionRecord(input);
  }

  private createOpinionRecord(input: CreateOpinionInput) {
    const now = new Date();
    const opinion: OpinionRecord = {
      id: randomUUID(),
      ...input,
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      rejectionCategory: null,
      publicSummary: null,
      rejectionReason: null,
      rejectionAcceptedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    if (!validOpinion(opinion)) throw new Error("Invalid opinion");
    this.opinions.push(opinion);
    return copy(opinion);
  }

  async createOpinionIfNoUnacceptedRejection(input: CreateOpinionInput) {
    return this.locked("opinionQueue", () => {
      if (this.opinions.some((opinion) => opinion.participantId === input.participantId && opinion.status === "rejected" && opinion.rejectionAcceptedAt === null)) return null;
      return this.createOpinionRecord(input);
    });
  }

  async updateOpinion(id: string, input: UpdateOpinionInput) {
    const opinion = this.opinions.find((candidate) => candidate.id === id);
    if (!opinion) return null;
    const updated = { ...opinion, ...copy(input), updatedAt: new Date() };
    if (!validOpinion(updated)) throw new Error("Invalid opinion");
    Object.assign(opinion, updated);
    return copy(opinion);
  }

  async transitionOpinion(id: string, fromStatus: OpinionRecord["status"], input: UpdateOpinionInput) {
    return this.locked("opinionQueue", () => {
      const opinion = this.opinions.find((candidate) => candidate.id === id);
      if (!opinion || opinion.status !== fromStatus) return null;
      const updated = { ...opinion, ...copy(input), updatedAt: new Date() };
      if (!validOpinion(updated)) throw new Error("Invalid opinion");
      Object.assign(opinion, updated);
      return copy(opinion);
    });
  }

  async acceptRejectedOpinionByAuthor(id: string, participantId: string, acceptedAt: Date) {
    return this.locked("opinionQueue", () => {
      const opinion = this.opinions.find((candidate) =>
        candidate.id === id && candidate.participantId === participantId && candidate.status === "rejected",
      );
      if (!opinion) return null;
      if (opinion.rejectionAcceptedAt === null) {
        const updated = { ...opinion, rejectionAcceptedAt: new Date(acceptedAt), updatedAt: new Date(acceptedAt) };
        if (!validOpinion(updated)) throw new Error("Invalid opinion");
        Object.assign(opinion, updated);
      }
      return copy(opinion);
    });
  }

  async listRouteGeometry(now: Date) {
    return copy(this.routeGeometry.filter((route) => route.expiresAt > now));
  }

  async findRouteGeometry(segmentKey: RouteGeometryRecord["segmentKey"], now: Date) {
    const route = this.routeGeometry.find((candidate) => candidate.segmentKey === segmentKey && candidate.expiresAt > now);
    return route ? copy(route) : null;
  }

  async upsertRouteGeometry(record: RouteGeometryRecord) {
    const index = this.routeGeometry.findIndex((route) => route.segmentKey === record.segmentKey);
    if (index === -1) this.routeGeometry.push(copy(record));
    else this.routeGeometry[index] = copy(record);
  }

  async deleteExpiredRouteGeometry(now: Date) {
    this.routeGeometry = this.routeGeometry.filter((route) => route.expiresAt > now);
  }
}
