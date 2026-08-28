import { TRIP_DEFINITION } from "../../trip/definition";
import type { OpinionViewer } from "../opinions/service";
import type { OpinionRecord } from "../repository/types";

type Trip = Omit<typeof TRIP_DEFINITION, "participants">;
type PublicRejection = { authorName: string; publicSummary: string; reason: string; accepted: boolean };
type OwnOpinion = { id: string; targetDay: OpinionRecord["targetDay"]; body: string; status: OpinionRecord["status"]; accepted: boolean };
type ReviewOpinion = ReturnType<typeof reviewOpinion>;
type ObserverPayload = { role: "observer"; trip: Trip; publicRejections: PublicRejection[] };
type ContributorPayload = { role: "contributor"; trip: Trip; publicRejections: PublicRejection[]; ownOpinions: OwnOpinion[] };
type AdminPayload = { role: "admin"; trip: Trip; publicRejections: PublicRejection[]; reviewQueue: ReviewOpinion[] };
type TripPayload = ObserverPayload | ContributorPayload | AdminPayload;

function toIso(value: Date | null) {
  return value?.toISOString() ?? null;
}

function isLaterRejection(candidate: OpinionRecord, current: OpinionRecord) {
  return (candidate.reviewedAt ?? candidate.createdAt).getTime() > (current.reviewedAt ?? current.createdAt).getTime();
}

function publicRejections(opinions: readonly OpinionRecord[]) {
  const latestByAuthor = new Map<string, OpinionRecord>();
  for (const opinion of opinions) {
    if (opinion.status !== "rejected") continue;
    const current = latestByAuthor.get(opinion.participantId);
    if (!current || isLaterRejection(opinion, current)) latestByAuthor.set(opinion.participantId, opinion);
  }
  const names = new Map<string, string>(TRIP_DEFINITION.participants.map((participant) => [participant.id, participant.name]));
  return [...latestByAuthor.values()].flatMap((opinion) => {
    const authorName = names.get(opinion.participantId);
    return authorName && opinion.publicSummary && opinion.rejectionReason
      ? [{ authorName, publicSummary: opinion.publicSummary, reason: opinion.rejectionReason, accepted: opinion.rejectionAcceptedAt !== null }]
      : [];
  });
}

function ownOpinion(opinion: OpinionRecord) {
  return {
    id: opinion.id,
    targetDay: opinion.targetDay,
    body: opinion.body,
    status: opinion.status,
    accepted: opinion.rejectionAcceptedAt !== null,
  };
}

function reviewOpinion(opinion: OpinionRecord) {
  return {
    id: opinion.id,
    participantId: opinion.participantId,
    targetDay: opinion.targetDay,
    body: opinion.body,
    status: opinion.status,
    reviewedBy: opinion.reviewedBy,
    reviewedAt: toIso(opinion.reviewedAt),
    rejectionCategory: opinion.rejectionCategory,
    publicSummary: opinion.publicSummary,
    rejectionReason: opinion.rejectionReason,
    rejectionAcceptedAt: toIso(opinion.rejectionAcceptedAt),
    createdAt: opinion.createdAt.toISOString(),
    updatedAt: opinion.updatedAt.toISOString(),
  };
}

export function buildTripPayload(viewer: Extract<OpinionViewer, { role: "observer" }>, opinions: readonly OpinionRecord[]): ObserverPayload;
export function buildTripPayload(viewer: Extract<OpinionViewer, { role: "contributor" }>, opinions: readonly OpinionRecord[]): ContributorPayload;
export function buildTripPayload(viewer: Extract<OpinionViewer, { role: "admin" }>, opinions: readonly OpinionRecord[]): AdminPayload;
export function buildTripPayload(viewer: OpinionViewer, opinions: readonly OpinionRecord[]): TripPayload;
export function buildTripPayload(viewer: OpinionViewer, opinions: readonly OpinionRecord[]) {
  const { participants: _participants, ...trip } = TRIP_DEFINITION;
  if (viewer.role === "contributor") {
    return { role: "contributor" as const, trip, publicRejections: publicRejections(opinions), ownOpinions: opinions.filter((opinion) => opinion.participantId === viewer.id).map(ownOpinion) };
  }
  if (viewer.role === "admin") return { role: "admin" as const, trip, publicRejections: publicRejections(opinions), reviewQueue: opinions.map(reviewOpinion) };
  return { role: "observer" as const, trip, publicRejections: publicRejections(opinions) };
}
