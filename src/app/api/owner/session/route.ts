import { NextResponse } from "next/server";

import { hashSessionToken } from "../../../../server/auth/crypto";
import { getBearerToken } from "../../../../server/auth/session";
import type { TripRepository } from "../../../../server/repository/types";

type DeleteOwnerSessionDependencies = { repository: TripRepository };

export function createDeleteOwnerSessionHandler({ repository }: DeleteOwnerSessionDependencies) {
  return async function removeSession(request: Request) {
    const token = getBearerToken(request);
    if (!token) return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    try {
      await repository.deleteSessionByTokenHash(hashSessionToken(token));
      return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    } catch {
      return new NextResponse(null, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  };
}

export async function DELETE(request: Request) {
  const { getTripRepository } = await import("../../../../server/repository");
  return createDeleteOwnerSessionHandler({ repository: getTripRepository() })(request);
}
