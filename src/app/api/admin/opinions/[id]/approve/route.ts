import { NextResponse } from "next/server";

import { getViewer } from "../../../../../../server/auth/session";
import { OpinionServiceError, approveOpinion } from "../../../../../../server/opinions/service";
import { opinionIdSchema } from "../../../../../../server/opinions/schemas";
import type { TripRepository } from "../../../../../../server/repository/types";

type RouteContext = { params: Promise<{ id: string }> };
type ApproveDependencies = { repository: TripRepository; now?: () => Date };

function serviceError(error: unknown) {
  if (error instanceof OpinionServiceError) {
    const status = error.code === "forbidden" ? 403 : error.code === "not_found" ? 404 : 409;
    return NextResponse.json({ error: error.code }, { status });
  }
  return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
}

export function createApproveOpinionHandler({ repository, now }: ApproveDependencies) {
  return async function approve(request: Request, context: RouteContext) {
    const params = opinionIdSchema.safeParse(await context.params);
    if (!params.success) return NextResponse.json({ error: "not_found" }, { status: 404 });
    try {
      const opinion = await approveOpinion(repository, await getViewer(request, repository), params.data.id, now);
      return NextResponse.json({ opinion });
    } catch (error) {
      return serviceError(error);
    }
  };
}

export async function POST(request: Request, context: RouteContext) {
  const { getTripRepository } = await import("../../../../../../server/repository");
  return createApproveOpinionHandler({ repository: getTripRepository() })(request, context);
}
