import type { Metadata } from "next";
import Link from "next/link";

import styles from "../legal.module.css";

export const metadata: Metadata = { title: "서비스 이용약관 · 2026 일본 여행" };

export default function TermsPage() {
  return (
    <main className={styles.legal}>
      <article className={styles.article}>
        <p className={styles.eyebrow}>JAPAN · 2026</p>
        <h1>서비스 이용약관</h1>
        <p className={styles.updated}>시행일: 2026년 8월 30일</p>

        <h2>1. 서비스 목적</h2>
        <p>이 사이트는 2026년 10월 일본 여행의 확정 일정과 이동 경로를 친구끼리 공유하고, 참가자의 의견을 관리자가 검토하기 위한 비영리 개인용 서비스입니다.</p>

        <h2>2. 접속과 역할</h2>
        <ul>
          <li>초대 링크만 가진 사용자는 관찰자로서 확정 일정과 공개된 최신 반려만 볼 수 있습니다.</li>
          <li>관리자 포함 지정된 참가자의 개인 링크는 첫 접속 기기에서 한 번만 역할을 활성화합니다. 활성 세션이 있는 같은 브라우저에서는 다시 열어도 역할이 유지됩니다.</li>
          <li>소비된 개인 링크를 전달받거나 다른 기기에서 열면 관찰자로 접속합니다. 쿠키를 삭제했거나 기기를 바꾼 뒤 역할이 필요하면 관리자에게 링크 재발급을 요청해야 합니다.</li>
          <li>역할 세션 쿠키는 늦어도 2026년 10월 13일 23:59:59(JST)에 만료되며, 사용자가 관찰자 모드로 전환하면 더 일찍 종료됩니다.</li>
          <li>관리자는 의견을 승인하거나 분류·요약·사유와 함께 반려할 수 있습니다. 승인만으로 공개 일정이 자동 변경되지는 않습니다.</li>
        </ul>

        <h2>3. 의견과 금지 사항</h2>
        <p>참가자는 여행과 관련된 의견만 제출해야 합니다. 위법하거나 안전을 해치고, 타인의 권리를 침해하거나 서비스 운영을 방해하는 내용은 제한될 수 있습니다.</p>

        <h2>4. 지도 서비스</h2>
        <p>지도와 일부 철도 경로는 Google Maps Platform을 사용합니다. Google 지도를 이용할 때는 <a href="https://cloud.google.com/maps-platform/terms/maps-service-terms">Google Maps Platform 서비스 약관</a>도 적용됩니다.</p>

        <h2>5. 변경과 중단</h2>
        <p>개인 여행 운영에 필요한 범위에서 일정, 기능 또는 운영 기간이 바뀔 수 있습니다. 외부 지도·호스팅 서비스 장애나 네트워크 상황으로 일시적으로 이용할 수 없을 수 있습니다.</p>

        <nav className={styles.navigation} aria-label="정책 문서">
          <Link href="/privacy">개인정보처리방침</Link>
        </nav>
      </article>
    </main>
  );
}
