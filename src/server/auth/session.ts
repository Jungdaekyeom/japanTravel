import { randomBytes, randomUUID } from "node:crypto";

import type { ViewerRole } from "../../trip/types";
import type { SessionRecord, TripRepository } from "../repository/types";

import { hashSessionToken } from "./crypto";

export const SESSION_COOKIE_NAME = "jt_session";
export const SESSION_EXPIRES_AT = new Date("2026-10-13T14:59:59.000Z");

export function issueSession(participantId: string, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const session: SessionRecord = {
    id: randomUUID(),
    participantId,
    tokenHash: hashSessionToken(token),
    createdAt: now,
    expiresAt: new Date(SESSION_EXPIRES_AT),
  };

  return { token, session };
}

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((entry) => entry.trim().split("=", 2))
    .find(([key]) => key === name)?.[1];
}

export async function getViewer(request: Request, repository?: TripRepository, now = new Date()) {
  const token = readCookie(request, SESSION_COOKIE_NAME);
  if (!token) return { role: "observer" as const };

  const activeRepository = repository ?? (await import("../repository")).getTripRepository();
  const session = await activeRepository.findSessionByTokenHash(hashSessionToken(token));
  if (!session || session.expiresAt <= now) return { role: "observer" as const };

  const participant = await activeRepository.findParticipantById(session.participantId);
  return participant
    ? { id: participant.id, role: participant.role as Exclude<ViewerRole, "observer"> }
    : { role: "observer" as const };
}
