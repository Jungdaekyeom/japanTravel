import { TRIP_DEFINITION } from "../../trip/definition";
import { PUBLIC_TRIP_DEFINITION } from "../../trip/public";
import { TRAVELERS } from "../../trip/travelers";
import type {
  AdminPayload,
  ContributorPayload,
  ObserverPayload,
  SharedTripPayload,
  TripPayload,
} from "../../trip/public";
import { decodePolyline } from "../routes/polyline";
import type { OpinionViewer } from "../opinions/service";
import type { OpinionRecord, RouteGeometryRecord } from "../repository/types";

export type { AdminPayload, ContributorPayload, ObserverPayload, ReviewOpinion, TripPayload } from "../../trip/public";

const participantNames = new Map<string, string>(TRIP_DEFINITION.participants.map((participant) => [participant.id, participant.name]));

function participantName(id: string) {
  return participantNames.get(id) ?? id;
}

function toIso(value: Date | null) {
  return value?.toISOString() ?? null;
}

function isLaterRejection(candidate: OpinionRecord, current: OpinionRecord) {
  const reviewDifference = (candidate.reviewedAt ?? candidate.createdAt).getTime() - (current.reviewedAt ?? current.createdAt).getTime();
  if (reviewDifference !== 0) return reviewDifference > 0;
  const creationDifference = candidate.createdAt.getTime() - current.createdAt.getTime();
  return creationDifference !== 0 ? creationDifference > 0 : candidate.id.localeCompare(current.id) > 0;
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

function publicRailRoutes(routes: readonly RouteGeometryRecord[], now: Date) {
  return routes.flatMap((route) => {
    if (route.status !== "finalized" || route.expiresAt <= now) return [];
    const segment = PUBLIC_TRIP_DEFINITION.railSegments.find(({ key }) => key === route.segmentKey);
    if (!segment) return [];
    try {
      const geometry = decodePolyline(route.encodedPolyline);
      // Previous snapshots ended at Tokyo; only a Ueno-reaching replacement is accepted.
      if (segment.key === "odawara-tokyo" && Math.hypot(geometry.at(-1)![0] - 35.71377, geometry.at(-1)![1] - 139.77725) > 0.01) return [];
      return [{
        segmentKey: segment.key,
        status: "finalized" as const,
        label: "철도 이동" as const,
        geometry,
      }];
    } catch {
      return [];
    }
  });
}

export function buildSharedTripPayload(
  routes: readonly RouteGeometryRecord[] = [],
  now = new Date(),
): SharedTripPayload {
  return {
    trip: PUBLIC_TRIP_DEFINITION,
    travelers: TRAVELERS,
    railRoutes: publicRailRoutes(routes, now),
  };
}

export function buildTripPayload(viewer: Extract<OpinionViewer, { role: "observer" }>, opinions: readonly OpinionRecord[], routes?: readonly RouteGeometryRecord[], now?: Date): ObserverPayload;
export function buildTripPayload(viewer: Extract<OpinionViewer, { role: "contributor" }>, opinions: readonly OpinionRecord[], routes?: readonly RouteGeometryRecord[], now?: Date): ContributorPayload;
export function buildTripPayload(viewer: Extract<OpinionViewer, { role: "admin" }>, opinions: readonly OpinionRecord[], routes?: readonly RouteGeometryRecord[], now?: Date): AdminPayload;
export function buildTripPayload(viewer: OpinionViewer, opinions: readonly OpinionRecord[], routes?: readonly RouteGeometryRecord[], now?: Date): TripPayload;
export function buildTripPayload(viewer: OpinionViewer, opinions: readonly OpinionRecord[], routes: readonly RouteGeometryRecord[] = [], now = new Date()): TripPayload {
  const railRoutes = publicRailRoutes(routes, now);
  if (viewer.role === "contributor") {
    return { role: "contributor" as const, displayName: participantName(viewer.id), trip: PUBLIC_TRIP_DEFINITION, railRoutes, publicRejections: publicRejections(opinions), ownOpinions: opinions.filter((opinion) => opinion.participantId === viewer.id).map(ownOpinion) };
  }
  if (viewer.role === "admin") return { role: "admin" as const, displayName: participantName(viewer.id), trip: PUBLIC_TRIP_DEFINITION, railRoutes, publicRejections: publicRejections(opinions), reviewQueue: opinions.map(reviewOpinion) };
  return { role: "observer" as const, trip: PUBLIC_TRIP_DEFINITION, railRoutes, publicRejections: publicRejections(opinions) };
}
