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

  constructor(initial: InitialData = {}) {
    this.participants = initial.participants ?? [];
    this.sessions = initial.sessions ?? [];
    this.loginAttempts = initial.loginAttempts ?? [];
    this.opinions = initial.opinions ?? [];
    this.routeGeometry = initial.routeGeometry ?? [];
  }

  async listParticipantCredentials() {
    return this.participants;
  }

  async findParticipantById(id: string) {
    return this.participants.find((participant) => participant.id === id) ?? null;
  }

  async createSession(session: SessionRecord) {
    this.sessions.push(session);
  }

  async findSessionByTokenHash(tokenHash: string) {
    return this.sessions.find((session) => session.tokenHash === tokenHash) ?? null;
  }

  async deleteSessionByTokenHash(tokenHash: string) {
    this.sessions = this.sessions.filter((session) => session.tokenHash !== tokenHash);
  }

  async countFailedLoginAttempts(since: Date, ipHash?: string) {
    return this.loginAttempts.filter(
      (attempt) => attempt.attemptedAt >= since && (!ipHash || attempt.ipHash === ipHash),
    ).length;
  }

  async recordFailedLoginAttempt(attempt: LoginAttemptRecord) {
    this.loginAttempts.push(attempt);
  }

  async listOpinions() {
    return this.opinions;
  }

  async createOpinion(input: CreateOpinionInput) {
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
    this.opinions.push(opinion);
    return opinion;
  }

  async updateOpinion(id: string, input: UpdateOpinionInput) {
    const opinion = this.opinions.find((candidate) => candidate.id === id);
    if (!opinion) return null;
    Object.assign(opinion, input, { updatedAt: new Date() });
    return opinion;
  }

  async listRouteGeometry() {
    return this.routeGeometry;
  }

  async findRouteGeometry(segmentKey: string) {
    return this.routeGeometry.find((route) => route.segmentKey === segmentKey) ?? null;
  }

  async upsertRouteGeometry(record: RouteGeometryRecord) {
    const index = this.routeGeometry.findIndex((route) => route.segmentKey === record.segmentKey);
    if (index === -1) this.routeGeometry.push(record);
    else this.routeGeometry[index] = record;
  }

  async deleteExpiredRouteGeometry(now: Date) {
    this.routeGeometry = this.routeGeometry.filter((route) => route.expiresAt > now);
  }
}
