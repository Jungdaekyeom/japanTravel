import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, SESSION_EXPIRES_AT } from "./auth/session";

const secure = process.env.NODE_ENV === "production";

export function getSessionToken(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((entry) => entry.trim().split("=", 2))
    .find(([key]) => key === SESSION_COOKIE_NAME)?.[1];
}

export function getClientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    expires: SESSION_EXPIRES_AT,
    path: "/",
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    expires: new Date(0),
    maxAge: 0,
    path: "/",
  });
}
