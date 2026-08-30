"use client";

import { useState, type FormEvent } from "react";

import type { PublicRailRoute, RailSegment } from "../../trip/public";
import styles from "../TripPanel.module.css";

const segments: readonly { key: RailSegment["key"]; title: string }[] = [
  { key: "kix-kyoto", title: "KIX → 교토" },
  { key: "kyoto-odawara", title: "교토 → 오다와라" },
  { key: "odawara-tokyo", title: "오다와라 → 도쿄" },
  { key: "tokyo-narita", title: "우에노 → 나리타" },
];

function SegmentFinalizer({
  segment,
  finalized,
  onRefresh,
}: {
  segment: typeof segments[number];
  finalized: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [departureTime, setDepartureTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const body = {
        departureTime: new Date(`${departureTime}:00+09:00`).toISOString(),
        ...(segment.key === "tokyo-narita" ? { naritaRailChoice: "skyliner" } : {}),
      };
      const response = await fetch(`/api/admin/routes/${segment.key}/finalize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(response.status === 409
          ? "2026년 9월 7일부터 확정할 수 있습니다."
          : response.status === 403
            ? "관리자 권한이 필요합니다."
            : "철도 경로를 확정하지 못했습니다. 기존 경로를 유지합니다.");
      }
      setMessage({ text: "철도 경로를 확정했습니다.", success: true });
      await onRefresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "철도 경로를 확정하지 못했습니다. 기존 경로를 유지합니다.", success: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <strong>{segment.title}</strong>
        <span>{finalized ? "확정 완료" : "경로 확정 전"}</span>
      </div>
      <form className={styles.form} onSubmit={submit}>
        <label>{segment.title} 출발 시각
          <input
            type="datetime-local"
            aria-label={`${segment.title} 출발 시각`}
            required
            value={departureTime}
            onChange={(event) => setDepartureTime(event.target.value)}
          />
        </label>
        {segment.key === "tokyo-narita" && (
          <p>이동 수단: Keisei Skyliner</p>
        )}
        <button type="submit" disabled={busy || !departureTime}>{busy ? "확정 중…" : `${segment.title} 경로 확정`}</button>
      </form>
      {message && <p role="status" className={message.success ? styles.message : styles.notice}>{message.text}</p>}
    </article>
  );
}

export function RouteFinalizer({ railRoutes, onRefresh }: { railRoutes: readonly PublicRailRoute[]; onRefresh: () => Promise<void> }) {
  const finalized = new Set(railRoutes.map((route) => route.segmentKey));
  return (
    <section className={styles.section} aria-labelledby="route-finalizer-title">
      <h2 id="route-finalizer-title">철도 경로 확정</h2>
      <p className={styles.muted}>일본 현지 출발 시각을 입력하세요. 확정 가능 날짜는 서버에서 확인합니다.</p>
      <div className={styles.cardList}>
        {segments.map((segment) => (
          <SegmentFinalizer key={segment.key} segment={segment} finalized={finalized.has(segment.key)} onRefresh={onRefresh} />
        ))}
      </div>
    </section>
  );
}
