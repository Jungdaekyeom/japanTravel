import { NextResponse } from "next/server";

import { getViewer } from "../../../server/auth/session";
import { OpinionServiceError, submitOpinion } from "../../../server/opinions/service";
import { submissionSchema } from "../../../server/opinions/schemas";
import type { TripRepository } from "../../../server/repository/types";

type SubmitDependencies = { repository: TripRepository };

function serviceError(error: unknown) {
  if (error instanceof OpinionServiceError) {
    const status = error.code === "forbidden" ? 403 : error.code === "not_found" ? 404 : 409;
    return NextResponse.json({ error: error.code }, { status });
  }
  return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
}

export function createSubmitOpinionHandler({ repository }: SubmitDependencies) {
  return async function submit(request: Request) {
    const parsed = submissionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    try {
      const opinion = await submitOpinion(repository, await getViewer(request, repository), parsed.data);
      return NextResponse.json({ opinion }, { status: 201 });
    } catch (error) {
      return serviceError(error);
    }
  };
}

export async function POST(request: Request) {
  const { getTripRepository } = await import("../../../server/repository");
  return createSubmitOpinionHandler({ repository: getTripRepository() })(request);
}
