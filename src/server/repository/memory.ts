import { randomUUID } from "node:crypto";

import type {
  CreateOpinionInput,
  LoginAttemptRecord,
  OpinionRecord,
  ParticipantRecord,
  RouteGeometryRecord,
  SessionRecord,
  TripRepository,
  UpdateOpinionInput,
} from "./types";

const WINDOW_MS = 15 * 60 * 1000;
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
  loginAttempts: LoginAttemptRecord[];
  opinions: OpinionRecord[];
  routeGeometry: RouteGeometryRecord[];
}>;

export class InMemoryTripRepository implements TripRepository {
  private participants: ParticipantRecord[];
  private sessions: SessionRecord[];
  private loginAttempts: LoginAttemptRecord[];
  private opinions: OpinionRecord[];
  private routeGeometry: RouteGeometryRecord[];
  private reservationQueue = Promise.resolve();
  private opinionQueue = Promise.resolve();

  constructor(initial: InitialData = {}) {
    this.participants = copy(initial.participants ?? []);
    this.sessions = copy(initial.sessions ?? []);
    this.loginAttempts = copy(initial.loginAttempts ?? []);
    this.opinions = copy(initial.opinions ?? []);
    this.routeGeometry = copy(initial.routeGeometry ?? []);
  }

  private async locked<T>(queue: "reservationQueue" | "opinionQueue", operation: () => T) {
    let release!: () => void;
    const previous = this[queue];
    this[queue] = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return operation(); }
    finally { release(); }
  }

  async listParticipantCredentials() {
    return copy(this.participants);
  }

  async findParticipantById(id: string) {
    const participant = this.participants.find((candidate) => candidate.id === id);
    return participant ? copy(participant) : null;
  }

  async createSession(session: SessionRecord) {
    this.sessions.push(copy(session));
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
      const active = this.loginAttempts.filter((attempt) => attempt.attemptedAt >= since);
      if (active.length >= MAX_GLOBAL_FAILURES || active.filter((attempt) => attempt.ipHash === ipHash).length >= MAX_IP_FAILURES) return null;
      const id = randomUUID();
      this.loginAttempts.push({ id, ipHash, attemptedAt: new Date(now) });
      return id;
    });
  }

  async releaseLoginAttempt(reservationId: string) {
    this.loginAttempts = this.loginAttempts.filter((attempt) => attempt.id !== reservationId);
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
