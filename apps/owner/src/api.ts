import type { OwnerDashboard, OwnerSession, RejectionCategory } from "./types";

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export class ApiError extends Error {
  constructor(readonly status: number, message = "요청을 처리하지 못했습니다.") {
    super(message);
  }
}

function origin() {
  const value = process.env.EXPO_PUBLIC_API_ORIGIN?.replace(/\/$/, "");
  if (value) return value;
  if (__DEV__) return "http://127.0.0.1:3000";
  throw new Error("EXPO_PUBLIC_API_ORIGIN이 필요합니다.");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${origin()}${path}`, init);
  if (!response.ok) throw new ApiError(response.status);
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

function bearer(session: OwnerSession) {
  return { authorization: `Bearer ${session.accessToken}` };
}

export function claimSession(token: string) {
  if (!tokenPattern.test(token)) throw new Error("관리 코드는 43자리여야 합니다.");
  return request<OwnerSession>("/api/owner/session/claim", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

export function dashboard(session: OwnerSession) {
  return request<OwnerDashboard>("/api/owner/dashboard", { headers: bearer(session) });
}

export function approveOpinion(session: OwnerSession, id: string) {
  return request(`/api/admin/opinions/${id}/approve`, { method: "POST", headers: bearer(session) });
}

export function rejectOpinion(session: OwnerSession, id: string, input: { category: RejectionCategory; publicSummary: string; reason: string }) {
  return request(`/api/admin/opinions/${id}/reject`, {
    method: "POST",
    headers: { ...bearer(session), "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function finalizeRailRoute(session: OwnerSession, key: string, departureTime: string, naritaRailChoice?: "skyliner") {
  return request(`/api/admin/routes/${key}/finalize`, {
    method: "POST",
    headers: { ...bearer(session), "content-type": "application/json" },
    body: JSON.stringify({ departureTime, ...(naritaRailChoice ? { naritaRailChoice } : {}) }),
  });
}

export function deleteSession(session: OwnerSession) {
  return request<void>("/api/owner/session", { method: "DELETE", headers: bearer(session) });
}
