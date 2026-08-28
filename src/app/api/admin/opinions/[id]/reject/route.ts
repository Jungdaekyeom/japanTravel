import { NextResponse } from "next/server";

import { getViewer } from "../../../../../../server/auth/session";
import { OpinionServiceError, rejectOpinion } from "../../../../../../server/opinions/service";
import { opinionIdSchema, rejectionSchema } from "../../../../../../server/opinions/schemas";
import type { TripRepository } from "../../../../../../server/repository/types";

type RouteContext = { params: Promise<{ id: string }> };
type RejectDependencies = { repository: TripRepository; now?: () => Date };

function serviceError(error: unknown) {
  if (error instanceof OpinionServiceError) {
    const status = error.code === "forbidden" ? 403 : error.code === "not_found" ? 404 : 409;
    return NextResponse.json({ error: error.code }, { status });
  }
  return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
}

export function createRejectOpinionHandler({ repository, now }: RejectDependencies) {
  return async function reject(request: Request, context: RouteContext) {
    const [params, body] = await Promise.all([
      context.params.then((value) => opinionIdSchema.safeParse(value)),
      request.json().catch(() => null).then((value) => rejectionSchema.safeParse(value)),
    ]);
    if (!params.success) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (!body.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    try {
      const opinion = await rejectOpinion(repository, await getViewer(request, repository), params.data.id, body.data, now);
      return NextResponse.json({ opinion });
    } catch (error) {
      return serviceError(error);
    }
  };
}

export async function POST(request: Request, context: RouteContext) {
  const { getTripRepository } = await import("../../../../../../server/repository");
  return createRejectOpinionHandler({ repository: getTripRepository() })(request, context);
}
