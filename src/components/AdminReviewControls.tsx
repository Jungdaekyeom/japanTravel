"use client";

import { useState } from "react";

import { REJECTION_CATEGORY_OPTIONS, type RejectionCategory, type ReviewOpinion } from "../trip/public";
import styles from "./TripPanel.module.css";

function ReviewCard({ opinion, onRefresh }: { opinion: ReviewOpinion; onRefresh: () => Promise<void> }) {
  const [category, setCategory] = useState<RejectionCategory>("schedule");
  const [publicSummary, setPublicSummary] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function act(kind: "approve" | "reject") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/opinions/${opinion.id}/${kind}`, {
        method: "POST",
        headers: kind === "reject" ? { "content-type": "application/json" } : undefined,
        body: kind === "reject" ? JSON.stringify({ category, publicSummary, reason }) : undefined,
      });
      if (!response.ok) throw new Error("검토 결과를 저장하지 못했습니다.");
      setMessage(kind === "approve" ? "의견을 승인했습니다." : "의견을 반려했습니다.");
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "검토 결과를 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <strong>{opinion.authorName}</strong>
        <span>{opinion.targetDay ? `${opinion.targetDay}일차` : "전체"}</span>
      </div>
      <p>{opinion.body}</p>
      <button type="button" disabled={busy} onClick={() => act("approve")}>의견 승인</button>
      <div className={styles.form}>
        <label>반려 분류
          <select value={category} onChange={(event) => setCategory(event.target.value as RejectionCategory)}>
            {REJECTION_CATEGORY_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>공개 요약<input value={publicSummary} onChange={(event) => setPublicSummary(event.target.value)} maxLength={80} /></label>
        <label>반려 사유<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} rows={3} /></label>
        <button type="button" disabled={busy || !publicSummary.trim() || !reason.trim()} onClick={() => act("reject")}>의견 반려</button>
      </div>
      {message && <p role="status" className={styles.message}>{message}</p>}
    </article>
  );
}

export function AdminReviewControls({ opinions, onRefresh }: { opinions: readonly ReviewOpinion[]; onRefresh: () => Promise<void> }) {
  const pending = opinions.filter((opinion) => opinion.status === "pending");
  return (
    <section className={styles.section} aria-labelledby="review-title">
      <h2 id="review-title">의견 검토</h2>
      {pending.length === 0 ? <p className={styles.muted}>검토할 의견이 없습니다.</p> : (
        <div className={styles.cardList}>{pending.map((opinion) => <ReviewCard key={opinion.id} opinion={opinion} onRefresh={onRefresh} />)}</div>
      )}
    </section>
  );
}
