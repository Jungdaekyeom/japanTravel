import { TRIP_DEFINITION } from "../../trip/definition";
import { PUBLIC_TRIP_DEFINITION } from "../../trip/public";
import type {
  AdminPayload,
  ContributorPayload,
  ObserverPayload,
  ReviewOpinion,
  TripPayload,
} from "../../trip/public";
import type { OpinionViewer } from "../opinions/service";
import type { OpinionRecord } from "../repository/types";

export type { AdminPayload, ContributorPayload, ObserverPayload, ReviewOpinion, TripPayload } from "../../trip/public";

const participantNames = new Map<string, string>(TRIP_DEFINITION.participants.map((participant) => [participant.id, participant.name]));

function participantName(id: string) {
  return participantNames.get(id) ?? id;
}

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
  return [...latestByAuthor.values()].flatMap((opinion) => {
    const authorName = participantNames.get(opinion.participantId);
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
    authorName: participantName(opinion.participantId),
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
export function buildTripPayload(viewer: OpinionViewer, opinions: readonly OpinionRecord[]): TripPayload {
  if (viewer.role === "contributor") {
    return { role: "contributor" as const, displayName: participantName(viewer.id), trip: PUBLIC_TRIP_DEFINITION, publicRejections: publicRejections(opinions), ownOpinions: opinions.filter((opinion) => opinion.participantId === viewer.id).map(ownOpinion) };
  }
  if (viewer.role === "admin") return { role: "admin" as const, displayName: participantName(viewer.id), trip: PUBLIC_TRIP_DEFINITION, publicRejections: publicRejections(opinions), reviewQueue: opinions.map(reviewOpinion) };
  return { role: "observer" as const, trip: PUBLIC_TRIP_DEFINITION, publicRejections: publicRejections(opinions) };
}
