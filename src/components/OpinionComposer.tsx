"use client";

import { useState, type FormEvent } from "react";

import { DAY_OPTIONS } from "../trip/public";
import styles from "./TripPanel.module.css";

export function OpinionComposer({ onRefresh, blocked }: { onRefresh: () => Promise<void>; blocked: boolean }) {
  const [targetDay, setTargetDay] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/opinions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetDay: targetDay ? Number(targetDay) : null, body }),
      });
      if (!response.ok) throw new Error(response.status === 409 ? "먼저 반려 내용을 확인해 주세요." : "의견을 보내지 못했습니다.");
      setBody("");
      setMessage("의견을 보냈습니다.");
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "의견을 보내지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="opinion-composer-title">
      <h2 id="opinion-composer-title">의견 남기기</h2>
      <form onSubmit={submit} className={styles.form}>
        <label>
          대상 일정
          <select value={targetDay} onChange={(event) => setTargetDay(event.target.value)}>
            <option value="">전체 일정</option>
            {DAY_OPTIONS.map((day) => <option key={day} value={day}>{day}일차</option>)}
          </select>
        </label>
        <label>
          의견
          <textarea value={body} onChange={(event) => setBody(event.target.value)} minLength={1} maxLength={1000} required rows={4} />
        </label>
        {blocked && <p className={styles.notice}>먼저 반려 내용을 확인해 주세요.</p>}
        <button type="submit" disabled={blocked || busy}>{busy ? "보내는 중…" : "의견 제출"}</button>
        {message && <p role="status" className={styles.message}>{message}</p>}
      </form>
    </section>
  );
}
