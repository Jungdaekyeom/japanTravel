import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Button, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ApiError, approveOpinion, claimSession, dashboard, deleteSession, finalizeRailRoute, rejectOpinion } from "./src/api";
import { isSupportedOwnerDevice } from "./src/device";
import { clearSession, loadSession, saveSession } from "./src/session";
import { departureAt } from "./src/time";
import type { OwnerDashboard, OwnerSession, PendingOpinion, RailSegment, RejectionCategory } from "./src/types";

const codePattern = /^[A-Za-z0-9_-]{43}$/;
const sessionLoadFailureMessage = "저장된 관리 정보를 불러오지 못했습니다. 관리 코드를 다시 등록해 주세요.";
const sessionSaveFailureMessage = "관리 정보를 기기에 저장하지 못했습니다. 새 관리 코드를 발급받아 다시 시도해 주세요.";
const categories: readonly { value: RejectionCategory; label: string }[] = [
  { value: "distance_over_50km", label: "50km 초과" },
  { value: "schedule_impossible", label: "일정 불가" },
  { value: "unsafe_or_illegal", label: "안전·위법" },
  { value: "purpose_conflict", label: "목적 저해" },
  { value: "other", label: "기타" },
];

export default function App() {
  const supported = isSupportedOwnerDevice();
  const [session, setSession] = useState<OwnerSession | null>(null);
  const [data, setData] = useState<OwnerDashboard | null>(null);
  const [loading, setLoading] = useState(supported);
  const [message, setMessage] = useState("");

  const returnToEnrollment = useCallback(async () => {
    try {
      await clearSession();
    } catch {
      // The server session is already unusable; local state must still recover.
    } finally {
      setSession(null);
      setData(null);
      setMessage("다시 관리 코드를 등록해 주세요.");
    }
  }, []);

  const refresh = useCallback(async (activeSession: OwnerSession) => {
    setLoading(true);
    setMessage("");
    try {
      setData(await dashboard(activeSession));
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await returnToEnrollment();
      } else {
        setMessage("연결을 확인한 뒤 다시 시도해 주세요.");
      }
    } finally {
      setLoading(false);
    }
  }, [returnToEnrollment]);

  useEffect(() => {
    if (!supported) return;
    void (async () => {
      try {
        const stored = await loadSession();
        setSession(stored);
        if (stored) await refresh(stored);
      } catch {
        setSession(null);
        setData(null);
        setMessage(sessionLoadFailureMessage);
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh, supported]);

  if (!supported) {
    return <Centered text="이 기기는 일본여행 관리 앱을 사용할 수 없습니다." />;
  }

  if (loading && !session) return <Centered text="관리 정보를 불러오는 중입니다." loading />;

  if (!session) {
    return <Enrollment initialMessage={message} onEnrolled={async (next) => {
      try {
        await saveSession(next);
      } catch {
        try {
          await deleteSession(next);
        } catch {
          // Best effort: storage recovery must not depend on the network.
        }
        throw new SessionSaveError();
      }
      setSession(next);
      await refresh(next);
    }} />;
  }

  return (
    <DashboardView
      data={data}
      message={message}
      refreshing={loading}
      session={session}
      onRefresh={() => refresh(session)}
      onUnauthorized={returnToEnrollment}
      onLogout={async () => {
        try {
          await deleteSession(session);
        } catch (error) {
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
            await returnToEnrollment();
          } else {
            setMessage("로그아웃하지 못했습니다. 연결을 확인해 주세요.");
          }
          return;
        }

        try {
          await clearSession();
          setMessage("");
        } catch {
          setMessage("서버 로그아웃은 완료됐지만 기기의 관리 정보를 삭제하지 못했습니다. 관리 코드를 다시 등록해 주세요.");
        } finally {
          setSession(null);
          setData(null);
        }
      }}
    />
  );
}

class SessionSaveError extends Error {
  constructor() {
    super(sessionSaveFailureMessage);
  }
}

function Enrollment({ initialMessage, onEnrolled }: { initialMessage: string; onEnrolled: (session: OwnerSession) => Promise<void> }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const valid = codePattern.test(token);

  async function submit() {
    if (!valid) return;
    setBusy(true);
    setMessage("");
    try {
      await onEnrolled(await claimSession(token));
    } catch (error) {
      setMessage(error instanceof SessionSaveError ? error.message : "관리 코드를 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>일본여행 관리</Text>
      <Text style={styles.copy}>발급받은 43자리 관리 코드를 입력하세요.</Text>
      <TextInput accessibilityLabel="관리 코드" autoCapitalize="none" autoCorrect={false} onChangeText={setToken} value={token} style={styles.input} />
      <Button title={busy ? "등록 중…" : "관리 코드 등록"} disabled={busy || !valid} onPress={submit} />
      {message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null}
    </View>
  );
}

function DashboardView({
  data,
  message,
  refreshing,
  session,
  onRefresh,
  onUnauthorized,
  onLogout,
}: {
  data: OwnerDashboard | null;
  message: string;
  refreshing: boolean;
  session: OwnerSession;
  onRefresh: () => Promise<void>;
  onUnauthorized: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  return (
    <ScrollView contentContainerStyle={styles.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}>
      <Text style={styles.title}>일본여행 관리</Text>
      <Button title="로그아웃" onPress={() => void onLogout()} />
      {message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null}
      {!data ? <Button title="다시 시도" onPress={() => void onRefresh()} /> : (
        <>
          <Text style={styles.heading}>검토 대기 의견</Text>
          {data.pendingOpinions.length === 0 ? <Text>검토할 의견이 없습니다.</Text> : data.pendingOpinions.map((opinion) => (
            <OpinionCard key={opinion.id} opinion={opinion} session={session} onRefresh={onRefresh} onUnauthorized={onUnauthorized} />
          ))}
          <Text style={styles.heading}>철도 경로 확정</Text>
          {data.railSegments.map((segment) => (
            <RailCard key={segment.key} segment={segment} session={session} onRefresh={onRefresh} onUnauthorized={onUnauthorized} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function OpinionCard({ opinion, session, onRefresh, onUnauthorized }: { opinion: PendingOpinion; session: OwnerSession; onRefresh: () => Promise<void>; onUnauthorized: () => Promise<void> }) {
  const [category, setCategory] = useState<RejectionCategory>("distance_over_50km");
  const [summary, setSummary] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const rejectable = summary.trim().length > 0 && summary.trim().length <= 80 && reason.trim().length > 0 && reason.trim().length <= 300;

  async function mutate(kind: "approve" | "reject") {
    setBusy(true);
    setMessage("");
    try {
      if (kind === "approve") await approveOpinion(session, opinion.id);
      else await rejectOpinion(session, opinion.id, { category, publicSummary: summary.trim(), reason: reason.trim() });
      await onRefresh();
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) await onUnauthorized();
      else setMessage("검토 결과를 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.strong}>{opinion.authorName} · {opinion.targetDay ? `${opinion.targetDay}일차` : "전체"}</Text>
      <Text>{opinion.body}</Text>
      <Button title="의견 승인" disabled={busy} onPress={() => void mutate("approve")} />
      <Text style={styles.label}>반려 분류</Text>
      <View style={styles.categories}>{categories.map((item) => <Pressable key={item.value} accessibilityRole="button" accessibilityState={{ selected: category === item.value }} onPress={() => setCategory(item.value)} style={styles.category}><Text>{item.label}</Text></Pressable>)}</View>
      <TextInput accessibilityLabel="공개 요약" maxLength={80} onChangeText={setSummary} placeholder="공개 요약 (80자 이내)" style={styles.input} value={summary} />
      <TextInput accessibilityLabel="반려 사유" maxLength={300} multiline onChangeText={setReason} placeholder="반려 사유 (300자 이내)" style={styles.input} value={reason} />
      <Button title="의견 반려" disabled={busy || !rejectable} onPress={() => void mutate("reject")} />
      {message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null}
    </View>
  );
}

function RailCard({ segment, session, onRefresh, onUnauthorized }: { segment: RailSegment; session: OwnerSession; onRefresh: () => Promise<void>; onUnauthorized: () => Promise<void> }) {
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function finalize() {
    setBusy(true);
    setMessage("");
    try {
      await finalizeRailRoute(session, segment.key, departureAt(segment.tripDate, time), segment.key === "tokyo-narita" ? "skyliner" : undefined);
      await onRefresh();
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) await onUnauthorized();
      else setMessage(error instanceof Error ? error.message : "철도 경로를 확정하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.strong}>{segment.title}</Text>
      <Text>{segment.finalized ? "확정 완료" : "경로 확정 전"}</Text>
      {segment.finalized ? null : (
        <>
          <TextInput accessibilityLabel={`${segment.title} 출발 시각`} keyboardType="numbers-and-punctuation" onChangeText={setTime} placeholder="HH:mm" style={styles.input} value={time} />
          {segment.key === "tokyo-narita" ? <Text>이동 수단: Keisei Skyliner</Text> : null}
          <Button title={`${segment.title} 경로 확정`} disabled={busy || !segment.canFinalize || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)} onPress={() => void finalize()} />
        </>
      )}
      {message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null}
    </View>
  );
}

function Centered({ text, loading = false }: { text: string; loading?: boolean }) {
  return <View style={[styles.screen, styles.center]}>{loading ? <ActivityIndicator /> : null}<Text>{text}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, gap: 12, padding: 20, backgroundColor: "#fff" },
  center: { alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700" },
  heading: { fontSize: 19, fontWeight: "700", marginTop: 12 },
  copy: { color: "#4b5563" },
  card: { borderColor: "#d1d5db", borderWidth: 1, borderRadius: 8, gap: 8, padding: 12 },
  strong: { fontWeight: "700" },
  label: { fontWeight: "600" },
  input: { borderColor: "#9ca3af", borderWidth: 1, borderRadius: 6, minHeight: 42, paddingHorizontal: 10, paddingVertical: 8 },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  category: { borderColor: "#9ca3af", borderWidth: 1, borderRadius: 6, padding: 6 },
  error: { color: "#b91c1c" },
});
