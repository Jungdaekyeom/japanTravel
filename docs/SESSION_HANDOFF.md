# 일본 여행 웹앱 세션 인계 기록

마지막 정리: 2026-08-31 (KST)

이 문서는 다른 컴퓨터나 새 Codex 세션에서 현재 상태를 바로 이어가기 위한 요약이다. 비밀값, 기존 개인 링크, 초대 토큰과 실제 세션 값은 Git·문서·로그에 저장하지 않는다.

## 재개할 때 먼저 할 일

```bash
git clone https://github.com/Jungdaekyeom/japanTravel.git
cd japanTravel
git switch develop
pnpm install --frozen-lockfile
cp .env.example .env.local
```

현재 작업 브랜치는 `develop`이며, `production`은 공개 복구 기준 커밋 `d6e6290`이다. 재개 시 정확한 상태는 `git status --short`와 `git log -1 --oneline`으로 확인한다.

다음 우선순위를 지킨다.

1. `develop`에서 공개 루트와 사람별 경로 테스트를 다시 실행한다.
2. 공개 웹에는 의견·관리 UI나 개인 토큰 진입을 추가하지 않는다. 관리 기능은 `apps/owner`에만 둔다.
3. 사용자 승인 전에는 `develop`을 push하거나 Vercel Production에 배포하지 않는다.
4. 기존 Supabase migration과 Production 의견·세션 데이터는 삭제하지 않는다.

`/privacy`와 `/terms` 페이지는 이번 변경과 무관하며 유지한다.

## 활성 공개 앱

- 활성 주소는 토큰 없는 `/`이다. 모든 사용자는 같은 공통 여행 일정을 본다.
- 767px 이하에서 공개 지도·일정 UI를 표시하고, 768px 이상에서는 휴대폰 접속 안내만 표시한다. `/privacy`와 `/terms`는 예외다.
- 좌측 패널에서 전원 또는 정대겸·이규열·박준수·한규준을 수동 선택한다.
- 여행자 선택은 지도 필터만 바꾼다. 그 뒤 1~5일차 또는 전체 일정을 선택하면 경로 재생이 시작된다.
- 전체 일정은 1일차부터 5일차까지 순차 재생하며, 재생 완료 후 다시 재생할 수 있다.
- 공개 앱은 `/api/trip`만 읽고, 의견·역할·관리 UI나 개인 토큰 흐름을 호출하지 않는다.
- Google 지도 로드에 실패하면 정적 일정과 재시도 화면을 제공한다.

## 확정된 여행 정보와 경로

- 기간: 2026년 10월 2일~6일, 4박 5일
- 일본 공통 구간: KIX 입국 → 교토 → 오다와라·하코네 → 도쿄 → NRT 출국
- 1일차와 5일차는 공통 일본 구간에 각자의 국내 첫·마지막 마일을 붙여 표시한다.
- 정대겸: 만덕터널 인근 ↔ 김해국제공항 ↔ KIX/NRT
- 이규열·박준수: 이천시청 ↔ 인천국제공항 ↔ KIX/NRT
- 한규준: 수원시청 ↔ 인천국제공항 ↔ KIX/NRT
- KIX→교토, 교토→오다와라, 오다와라→도쿄, 도쿄→NRT는 공통 일본 경로다. 철도 확정 경로가 없을 때는 지도상 근사선으로 표시한다.

## Android 소유자 앱

- pnpm workspace는 루트 Next.js 앱과 `apps/owner` Expo 앱으로 구성한다. Vercel 프로젝트 루트는 변경하지 않는다.
- 소유자 앱은 `samsung` `SM-S948N`, Android API 36 이상, `arm64-v8a` 실제 기기에서만 API를 호출한다.
- 앱에는 역할명을 표시하지 않는다. 서버는 소유자 ID `daekyeom`만 허용한다.
- `pnpm owner:code`가 URL 없는 1회용 등록 코드를 발급한다. 코드는 앱에 직접 붙여넣고 SecureStore 세션으로 교환한다.
- 의견 승인·반려와 KIX→교토, 교토→오다와라, 오다와라→도쿄, 도쿄→NRT 철도 경로 확정만 제공한다.
- 로컬 기기 연결은 `adb reverse tcp:3000 tcp:3000` 후 `pnpm owner:android`를 사용한다.

## 보류 및 레거시 보존 범위

역할별 공개 화면, 의견 제출 UI, 개인 링크 진입은 계속 보류한다. 소유자 앱의 관리 기능은 공개 웹에 import하거나 링크하지 않는다.

기존 개인 링크 API와 Production 데이터는 **레거시/dormant 보존 백엔드**다. 삭제하지 않으며 기존 개인 링크나 초대 토큰의 원문을 문서·커밋·로그에 기록하지 않는다.

## 지도·보안 운영 메모

- Google Maps JavaScript API를 사용하며, 화면에는 기본 Google 저작권 표시를 유지한다.
- 브라우저 지도 키는 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`와 `NEXT_PUBLIC_GOOGLE_MAP_ID`로 제한한다.
- `GOOGLE_ROUTES_API_KEY`, `GOOGLE_PLACE_ID_*`, Supabase 서버 키와 `SESSION_PEPPER`는 서버 전용이다. 소유자 앱은 서버 API만 호출하며 공개 웹은 Routes 확정 API를 호출하지 않는다.
- 지도 키·서버 키·쿠키·기존 개인 토큰·의견 원문을 Git이나 로그에 남기지 않는다.
- GPS, 실시간 교통·운항, PWA, 푸시, 분석, 카카오 로그인, OpenAI/MCP는 사용자가 다시 요청하기 전까지 제외한다.

## 검증

새 세션에서는 다음 명령을 실행한다. fixture 기반 테스트만 사용하며 실제 외부 API·Supabase·Vercel을 호출하지 않는다.

```bash
pnpm test --run
pnpm typecheck
pnpm lint
pnpm build
pnpm exec playwright test
pnpm owner:test
pnpm owner:typecheck
pnpm owner:lint
```

정상 build의 route manifest에는 `/`, `/api/trip`, `/api/owner/*`, `/t/[inviteToken]`, `/privacy`, `/terms`가 포함되어야 한다. `/t/[inviteToken]`은 레거시 보존 대상으로 남아 있지만 공개 진입이나 활성 UI가 아니다.

## Git 규칙

- 이번 작업은 커밋·stage·push·배포를 수행하지 않는다.
- 커밋이 별도로 승인됐을 때만 단일 라인 `type: 한국어 설명` 형식을 사용한다. 스코프, 본문, 트레일러, Co-Authored-By는 넣지 않는다.
- 비밀값, 개인 링크, 쿠키, 초대 토큰, 의견 원문을 커밋하거나 로그에 남기지 않는다.
