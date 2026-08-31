"use client";

import { useState } from "react";

import type { OwnOpinion } from "../trip/public";
import styles from "./TripPanel.module.css";

export function RejectionCards({ ownOpinions = [], onRefresh }: { ownOpinions?: readonly OwnOpinion[]; onRefresh: () => Promise<void> }) {
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

  if (pendingOwnRejections.length === 0 && !message) return null;

  return (
    <section className={styles.section} aria-label="반려 확인">
      {pendingOwnRejections.map((opinion) => (
        <button key={opinion.id} type="button" disabled={busyId === opinion.id} onClick={() => accept(opinion.id)}>
          {busyId === opinion.id ? "확인 저장 중…" : "반려 내용 확인"}
        </button>
      ))}
      {message && <p role="status" className={styles.message}>{message}</p>}
    </section>
  );
}
