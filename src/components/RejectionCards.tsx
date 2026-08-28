"use client";

import { useState } from "react";

import styles from "./TripPanel.module.css";

export type PublicRejection = { authorName: string; publicSummary: string; reason: string; accepted: boolean };
export type OwnOpinion = { id: string; targetDay: number | null; body: string; status: string; accepted: boolean };

export function RejectionCards({ publicRejections, ownOpinions = [], onRefresh }: { publicRejections: readonly PublicRejection[]; ownOpinions?: readonly OwnOpinion[]; onRefresh: () => Promise<void> | void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const pendingOwnRejections = ownOpinions.filter((opinion) => opinion.status === "rejected" && !opinion.accepted);

  async function accept(id: string) {
    setBusyId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/opinions/${id}/accept-rejection`, { method: "POST" });
      if (!response.ok) throw new Error("반려 확인을 저장하지 못했습니다.");
      setMessage("반려 내용을 확인했습니다.");
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "반려 확인을 저장하지 못했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="rejection-title">
      <h2 id="rejection-title">최근 반려</h2>
      {publicRejections.length === 0 ? <p className={styles.muted}>공개된 반려가 없습니다.</p> : (
        <div className={styles.cardList}>
          {publicRejections.map((rejection) => (
            <article className={styles.card} key={`${rejection.authorName}-${rejection.publicSummary}`}>
              <div className={styles.cardHeader}><strong>{rejection.authorName}</strong><span>{rejection.accepted ? "확인함" : "미확인"}</span></div>
              <h3>{rejection.publicSummary}</h3>
              <p>{rejection.reason}</p>
            </article>
          ))}
        </div>
      )}
      {pendingOwnRejections.map((opinion) => (
        <button key={opinion.id} type="button" disabled={busyId === opinion.id} onClick={() => accept(opinion.id)}>
          {busyId === opinion.id ? "확인 저장 중…" : "반려 내용 확인"}
        </button>
      ))}
      {message && <p role="status" className={styles.message}>{message}</p>}
    </section>
  );
}
