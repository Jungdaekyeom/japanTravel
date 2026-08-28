import { TRIP_DEFINITION } from "../../trip/definition";
import type { RejectionCategory, Viewer } from "../../trip/types";
import type { CreateOpinionInput, OpinionRecord, TripRepository } from "../repository/types";

type ContributorViewer = Extract<Viewer, { role: "contributor" }>;
type AdminViewer = Extract<Viewer, { role: "admin" }>;
export type OpinionViewer = Viewer;
type RejectionInput = { category: RejectionCategory; publicSummary: string; reason: string };

export class OpinionServiceError extends Error {
  constructor(readonly code: "forbidden" | "not_found" | "conflict") {
    super(code);
  }
}

function canContribute(viewer: OpinionViewer): viewer is ContributorViewer {
  return viewer.role === "contributor" && TRIP_DEFINITION.participants.some(
    (participant) => participant.id === viewer.id && participant.role === "contributor",
  );
}

function requireAdmin(viewer: OpinionViewer): asserts viewer is AdminViewer {
  if (viewer.role !== "admin") throw new OpinionServiceError("forbidden");
}

export async function submitOpinion(repository: TripRepository, viewer: OpinionViewer, input: Omit<CreateOpinionInput, "participantId">) {
  if (!canContribute(viewer)) throw new OpinionServiceError("forbidden");
  const opinion = await repository.createOpinionIfNoUnacceptedRejection({ ...input, participantId: viewer.id });
  if (!opinion) throw new OpinionServiceError("conflict");
  return opinion;
}

export async function approveOpinion(repository: TripRepository, viewer: OpinionViewer, id: string, now = () => new Date()) {
  requireAdmin(viewer);
  const reviewedAt = now();
  const opinion = await repository.transitionOpinion(id, "pending", {
    status: "approved",
    reviewedBy: viewer.id,
    reviewedAt,
  });
  if (!opinion) throw new OpinionServiceError("conflict");
  return opinion;
}

export async function rejectOpinion(
  repository: TripRepository,
  viewer: OpinionViewer,
  id: string,
  input: RejectionInput,
  now = () => new Date(),
) {
  requireAdmin(viewer);
  const reviewedAt = now();
  const opinion = await repository.transitionOpinion(id, "pending", {
    status: "rejected",
    reviewedBy: viewer.id,
    reviewedAt,
    rejectionCategory: input.category,
    publicSummary: input.publicSummary,
    rejectionReason: input.reason,
  });
  if (!opinion) throw new OpinionServiceError("conflict");
  return opinion;
}

export async function acceptRejection(repository: TripRepository, viewer: OpinionViewer, id: string, now = () => new Date()) {
  if (!canContribute(viewer)) throw new OpinionServiceError("forbidden");
  const opinion = await repository.acceptRejectedOpinionByAuthor(id, viewer.id, now());
  if (!opinion) throw new OpinionServiceError("not_found");
  return opinion;
}
