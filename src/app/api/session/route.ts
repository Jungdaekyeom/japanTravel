import { hashSessionToken } from "../../../server/auth/crypto";
import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionToken } from "../../../server/http";
import type { TripRepository } from "../../../server/repository/types";

type DeleteDependencies = { repository: TripRepository };

export function createDeleteSessionHandler({ repository }: DeleteDependencies) {
  return async function removeSession(request: Request) {
    const token = getSessionToken(request);
    if (token) await repository.deleteSessionByTokenHash(hashSessionToken(token));
    const response = new NextResponse(null, { status: 204 });
    clearSessionCookie(response);
    return response;
  };
}

export async function DELETE(request: Request) {
  const { getTripRepository } = await import("../../../server/repository");
  return createDeleteSessionHandler({ repository: getTripRepository() })(request);
}
