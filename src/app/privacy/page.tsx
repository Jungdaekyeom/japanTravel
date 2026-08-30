import type { Metadata } from "next";
import Link from "next/link";

import styles from "../legal.module.css";

export const metadata: Metadata = { title: "개인정보처리방침 · 2026 일본 여행" };

export default function PrivacyPage() {
  return (
    <main className={styles.legal}>
      <article className={styles.article}>
        <p className={styles.eyebrow}>JAPAN · 2026</p>
        <h1>개인정보처리방침</h1>
        <p className={styles.updated}>시행일: 2026년 8월 30일</p>

        <h2>1. 처리하는 정보</h2>
        <ul>
          <li>참가자 이름, 출생연도, 출발지와 역할</li>
          <li>1회용 개인 링크 토큰의 단방향 해시·발급/소비 시각, 세션 토큰의 단방향 해시와 만료 시각</li>
          <li>의견 원문, 대상 일차, 검토 상태, 공개 요약·반려 사유와 수용 시각</li>
          <li>로그인 시도 제한을 위한 IP 주소의 단방향 해시와 시각</li>
        </ul>
        <p>출생연도, 개인 링크와 세션 정보, 의견 원문은 관찰자용 화면이나 공개 API에 제공하지 않습니다. 개인 링크의 fragment 비밀값은 브라우저가 서버에 JSON으로 한 번 제출한 뒤 성공 여부와 관계없이 주소에서 제거하며, 데이터베이스에는 원문을 저장하지 않습니다.</p>

        <h2>2. 이용 목적</h2>
        <p>참가자 역할 확인, 여행 일정과 의견 관리, 개인 링크 대입·재사용 방지, 지도 경로 표시를 위해서만 정보를 사용합니다.</p>

        <h2>3. 보관과 삭제</h2>
        <ul>
          <li>철도 경로 좌표는 생성 후 최대 30일 또는 2026년 10월 7일 00:00(JST) 중 이른 시각까지만 보관합니다.</li>
          <li>로그인 세션은 늦어도 2026년 10월 13일 23:59:59(JST)에 만료됩니다.</li>
          <li>개인 링크는 첫 기기에서 소비되며, 같은 브라우저의 활성 쿠키가 있으면 역할이 유지됩니다. 쿠키 삭제 또는 다른 기기 사용 후에는 링크 재발급이 필요합니다.</li>
          <li>관리자는 여행 운영 종료 후 참가자·의견·로그인 기록을 포함한 운영 데이터와 비밀값을 삭제합니다.</li>
        </ul>

        <h2>4. 외부 서비스</h2>
        <p>사이트 운영에는 Vercel(호스팅), Supabase(데이터베이스), Google Maps Platform(지도·철도 경로)을 사용합니다. Google 지도 이용 과정에서 처리되는 정보에는 <a href="https://policies.google.com/privacy">Google 개인정보처리방침</a>이 적용됩니다.</p>

        <h2>5. 권리와 문의</h2>
        <p>참가자는 관리자 정대겸에게 본인 정보의 열람, 정정 또는 삭제를 요청할 수 있습니다. 친구끼리 공유하는 서비스이므로 별도의 휴대폰 인증이나 광고 분석은 사용하지 않습니다.</p>

        <nav className={styles.navigation} aria-label="정책 문서">
          <Link href="/terms">서비스 이용약관</Link>
        </nav>
      </article>
    </main>
  );
}
