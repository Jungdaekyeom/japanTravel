import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  CreateOpinionInput,
  OpinionRecord,
  ParticipantRecord,
  RouteGeometryRecord,
  SessionRecord,
  TripRepository,
  UpdateOpinionInput,
} from "./types";

type Row = Record<string, unknown>;

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function participant(row: Row): ParticipantRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    birthYear: Number(row.birth_year),
    departureCity: row.departure_city as ParticipantRecord["departureCity"],
    role: row.role as ParticipantRecord["role"],
    codeSalt: String(row.code_salt),
    codeHash: String(row.code_hash),
    createdAt: new Date(String(row.created_at)),
  };
}

function session(row: Row): SessionRecord {
  return {
    id: String(row.id),
    participantId: String(row.participant_id),
    tokenHash: String(row.token_hash),
    createdAt: new Date(String(row.created_at)),
    expiresAt: new Date(String(row.expires_at)),
  };
}

function opinion(row: Row): OpinionRecord {
  return {
    id: String(row.id),
    participantId: String(row.participant_id),
    targetDay: row.target_day as OpinionRecord["targetDay"],
    body: String(row.body),
    status: row.status as OpinionRecord["status"],
    reviewedBy: (row.reviewed_by as string | null) ?? null,
    reviewedAt: row.reviewed_at ? new Date(String(row.reviewed_at)) : null,
    rejectionCategory: row.rejection_category as OpinionRecord["rejectionCategory"],
    publicSummary: (row.public_summary as string | null) ?? null,
    rejectionReason: (row.rejection_reason as string | null) ?? null,
    rejectionAcceptedAt: row.rejection_accepted_at ? new Date(String(row.rejection_accepted_at)) : null,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

function routeGeometry(row: Row): RouteGeometryRecord {
  return {
    segmentKey: row.segment_key as RouteGeometryRecord["segmentKey"],
    status: row.status as RouteGeometryRecord["status"],
    encodedPolyline: String(row.encoded_polyline),
    departureTime: (row.departure_time as string | null) ?? null,
    naritaRailChoice: row.narita_rail_choice as RouteGeometryRecord["naritaRailChoice"],
    createdAt: new Date(String(row.created_at)),
    expiresAt: new Date(String(row.expires_at)),
  };
}

export class SupabaseTripRepository implements TripRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listParticipantCredentials() {
    const { data, error } = await this.client.from("participants").select("*");
    fail(error);
    return (data ?? []).map((row) => participant(row as Row));
  }

  async findParticipantById(id: string) {
    const { data, error } = await this.client.from("participants").select("*").eq("id", id).maybeSingle();
    fail(error);
    return data ? participant(data as Row) : null;
  }

  async createSession(record: SessionRecord) {
    const { error } = await this.client.from("sessions").insert({
      id: record.id,
      participant_id: record.participantId,
      token_hash: record.tokenHash,
      created_at: record.createdAt.toISOString(),
      expires_at: record.expiresAt.toISOString(),
    });
    fail(error);
  }

  async findSessionByTokenHash(tokenHash: string) {
    const { data, error } = await this.client.from("sessions").select("*").eq("token_hash", tokenHash).maybeSingle();
    fail(error);
    return data ? session(data as Row) : null;
  }

  async deleteSessionByTokenHash(tokenHash: string) {
    const { error } = await this.client.from("sessions").delete().eq("token_hash", tokenHash);
    fail(error);
  }

  async reserveLoginAttempt(ipHash: string, _now: Date) {
    const { data, error } = await this.client.rpc("reserve_login_attempt", { request_ip_hash: ipHash });
    fail(error);
    return data as string | null;
  }

  async releaseLoginAttempt(reservationId: string) {
    const { error } = await this.client.from("login_attempts").delete().eq("id", reservationId);
    fail(error);
  }

  async finalizeLoginAttempt(reservationId: string) {
    const { error } = await this.client.rpc("finalize_login_attempt", { reservation_id: reservationId });
    fail(error);
  }

  async listOpinions() {
    const { data, error } = await this.client.from("opinions").select("*");
    fail(error);
    return (data ?? []).map((row) => opinion(row as Row));
  }

  async createOpinion(input: CreateOpinionInput) {
    const { data, error } = await this.client.from("opinions").insert({
      participant_id: input.participantId,
      target_day: input.targetDay,
      body: input.body,
    }).select().single();
    fail(error);
    return opinion(data as Row);
  }

  async createOpinionIfNoUnacceptedRejection(input: CreateOpinionInput) {
    const { data, error } = await this.client.rpc("submit_opinion_if_allowed", {
      request_participant_id: input.participantId,
      request_target_day: input.targetDay,
      request_body: input.body,
    });
    fail(error);
    const row = (data as Row[] | null)?.[0];
    return row ? opinion(row) : null;
  }

  async updateOpinion(id: string, input: UpdateOpinionInput) {
    const { data, error } = await this.client.from("opinions").update({
      status: input.status,
      reviewed_by: input.reviewedBy,
      reviewed_at: input.reviewedAt?.toISOString(),
      rejection_category: input.rejectionCategory,
      public_summary: input.publicSummary,
      rejection_reason: input.rejectionReason,
      rejection_accepted_at: input.rejectionAcceptedAt?.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", id).select().maybeSingle();
    fail(error);
    return data ? opinion(data as Row) : null;
  }

  async transitionOpinion(id: string, fromStatus: OpinionRecord["status"], input: UpdateOpinionInput) {
    const { data, error } = await this.client.from("opinions").update({
      status: input.status,
      reviewed_by: input.reviewedBy,
      reviewed_at: input.reviewedAt?.toISOString(),
      rejection_category: input.rejectionCategory,
      public_summary: input.publicSummary,
      rejection_reason: input.rejectionReason,
      rejection_accepted_at: input.rejectionAcceptedAt?.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", id).eq("status", fromStatus).select().maybeSingle();
    fail(error);
    return data ? opinion(data as Row) : null;
  }

  async acceptRejectedOpinionByAuthor(id: string, participantId: string, acceptedAt: Date) {
    const { data, error } = await this.client.rpc("accept_rejected_opinion_by_author", {
      request_opinion_id: id,
      request_participant_id: participantId,
      request_accepted_at: acceptedAt.toISOString(),
    });
    fail(error);
    const row = (data as Row[] | null)?.[0];
    return row ? opinion(row) : null;
  }

  async listRouteGeometry(now: Date) {
    const { data, error } = await this.client.from("route_geometry_cache").select("*").gt("expires_at", now.toISOString());
    fail(error);
    return (data ?? []).map((row) => routeGeometry(row as Row));
  }

  async findRouteGeometry(segmentKey: RouteGeometryRecord["segmentKey"], now: Date) {
    const { data, error } = await this.client.from("route_geometry_cache").select("*").eq("segment_key", segmentKey).gt("expires_at", now.toISOString()).maybeSingle();
    fail(error);
    return data ? routeGeometry(data as Row) : null;
  }

  async upsertRouteGeometry(record: RouteGeometryRecord) {
    const { error } = await this.client.from("route_geometry_cache").upsert({
      segment_key: record.segmentKey,
      status: record.status,
      encoded_polyline: record.encodedPolyline,
      departure_time: record.departureTime,
      narita_rail_choice: record.naritaRailChoice,
      created_at: record.createdAt.toISOString(),
      expires_at: record.expiresAt.toISOString(),
    });
    fail(error);
  }

  async deleteExpiredRouteGeometry(now: Date) {
    const { error } = await this.client.from("route_geometry_cache").delete().lte("expires_at", now.toISOString());
    fail(error);
  }
}

export function createSupabaseRepository(url: string, serviceRoleKey: string) {
  return new SupabaseTripRepository(
    createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } }),
  );
}
