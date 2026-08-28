# 일본 여행 웹앱 세션 인계 기록

마지막 정리: 2026-08-28 (KST)

이 문서는 다른 컴퓨터나 새 Codex 세션에서 현재 상태를 바로 이어가기 위한 요약이다. 비밀값, 초대 토큰, 개인 코드와 실제 세션 값은 Git에 저장하지 않는다.

## 재개할 때 먼저 할 일

```bash
git clone https://github.com/Jungdaekyeom/japanTravel.git
cd japanTravel
git switch codex/japan-trip-app
pnpm install --frozen-lockfile
cp .env.example .env.local
```

그다음 이 문서, `README.md`, 아래 설계·계획 문서를 순서대로 읽는다.

- `docs/superpowers/specs/2026-08-28-japan-trip-web-app-design.md`
- `docs/superpowers/plans/2026-08-28-japan-trip-web-app.md`

현재 기능 브랜치는 `codex/japan-trip-app`, 기준 브랜치는 `main`이다. 정확한 최신 커밋은 `git log -1 --oneline`으로 확인한다. 기능 브랜치는 아직 `main`에 병합하지 않았다.

## 확정된 여행 정보

- 기간: 2026년 10월 2일~6일, 4박 5일
- 정대겸: 1993년생, 부산 출발, 관리자
- 이규열·박준수·한규준: 1998년생, 인천 출발, 참가자
- 입국: 간사이국제공항(KIX)
- 출국: 나리타국제공항(NRT)
- 1일차: 부산·인천→KIX, 하루카로 교토 이동, 교토 1박
- 2일차: 교토→오다와라, 하코네 권역, 1박
- 3일차: 오다와라→도쿄, 도쿄 1박
- 4일차: 도쿄 관광, 도쿄 1박
- 5일차: 도쿄→NRT, 귀국

## 확정된 제품 동작

- Vercel에 배포하는 Next.js 모바일 웹이다.
- 767px 이하에서 앱을 표시하고 768px 이상에서는 휴대폰 접속 안내만 보여준다. `/terms`와 `/privacy`는 예외다.
- 첫 화면은 전체 경로와 Codex형 접이식 패널을 펼친 상태다.
- 날짜를 누르면 패널이 250ms 동안 접히고 해당 일차 경로가 한 번 재생된다.
- 재생 완료 후 경로를 유지하고 작은 재생 버튼을 노출한다.
- 다른 날짜를 선택하면 이전 재생을 취소한다. reduced-motion에서는 완성된 경로를 즉시 표시한다.
- Google 지도 실패 시 정적 일정과 재시도 버튼을 표시한다.
- 공유 링크만 있으면 관찰자다. 서로 다른 6자리 개인 코드를 입력한 네 사람만 지정된 역할을 얻는다.
- 참가자는 자유문장 의견을 제출하고 자신의 반려만 수용할 수 있다.
- 관리자는 의견을 수동 승인·반려한다. AI 자동 답변·자동 판정은 v1에서 사용하지 않는다.
- 공개 화면에는 고정 일정과 사람별 최신 반려 한 건만 노출한다. 반려 카드는 이름·제안 요약·반려 사유·수용 여부를 표시한다.
- 반려를 수용하지 않은 당사자는 새 의견을 제출할 수 없다.
- 승인만으로 고정 일정 파일이 자동 변경되지는 않는다.

## 지도와 경로에 관한 최신 결정

메인 지도는 정적 스크린샷으로 교체하지 않고 **Google Maps JavaScript API**를 유지한다. 이유는 장거리 이동 중 지도 자체가 끊김 없이 이어지고 카메라가 경로를 따라 이동하는 연출이 필요하기 때문이다.

현재 구현된 상태:

- Google 지도, 일차별 polyline 1회 재생, 전체/일차 범위 맞춤, 다시 재생이 구현되어 있다.
- 동일한 30초 폴링 응답은 지도나 진행 중 애니메이션을 재생성하지 않는다.
- 1일차는 부산·인천 항공선을 동시에 재생한 뒤 KIX→교토 철도선을 재생한다.
- 2·3·5일차는 철도 경로, 4일차는 도쿄 핀 강조를 사용한다.

논의됐지만 아직 구현하지 않은 다음 변경:

- 선의 현재 끝점을 따라 Google 지도 카메라가 부드럽게 이동해야 한다.
- 장거리 구간은 적절한 줌을 유지하고 재생 완료 후 일차 전체 경로로 축소한다.
- 이 카메라 추적에는 Maps JavaScript API만 필요하며 Routes API, GPS, 실시간 교통은 필요하지 않다.
- Google 지도 스크린샷 두 장을 비교해 경로를 추출하는 안은 검토했지만 메인 방식으로 확정하지 않았다. 사진은 향후 정적 fallback이나 경로 시각 참고용으로만 고려한다.

정확한 철도 좌표는 다음 네 구간만 Google Routes API 대상이다.

- `kix-kyoto`
- `kyoto-odawara`
- `odawara-tokyo`
- `tokyo-narita`

2026년 9월 6일까지는 앱이 만든 점선을 표시한다. 9월 7일부터 관리자가 예정 출발 시각을 입력해 경로를 확정하며, 나리타 구간은 스카이라이너 또는 N'EX를 선택한다. 실패하면 점선을 유지한다.

## 구현 완료 범위

- 고정 여행 도메인과 모바일 UI
- Google Maps 로더, polyline, Advanced Marker, 정적 fallback
- 개인 코드 scrypt 해시, 256비트 세션, HttpOnly 쿠키
- IP·전체 로그인 실패 제한과 동시성 보호
- 관찰자·참가자·관리자 권한 분리
- 의견 제출→승인 또는 반려→당사자 수용→재제출 상태 흐름
- 역할별 공개 payload와 사람별 최신 반려 한 건
- Supabase 저장소, RLS, 브라우저 역할 권한 제거, 관련 SQL RPC
- Google Routes 철도 단계 검증, encoded polyline 저장, 30일 이내 만료·삭제
- 검색 색인 차단, strict-origin, CSP, 약관·개인정보 페이지
- 모바일/데스크톱/권한 흐름 Vitest·Playwright 테스트

마지막 전체 검증 기준은 Vitest 151개, Playwright 4개, lint, typecheck, production build 통과다. 새 컴퓨터에서는 아래 명령으로 다시 확인한다.

```bash
pnpm lint
pnpm typecheck
pnpm test --run
pnpm build
pnpm exec playwright install chromium
pnpm exec playwright test
```

## 외부에서 아직 하지 않은 일

- Vercel 배포
- Supabase 프로젝트 생성과 migration 적용
- 실제 환경변수 등록
- 네 명의 개인 코드 발급·전달
- 실제 Google Maps/Routes 키와 Map ID·Place ID 연결
- 실제 Google 응답으로 네 철도 구간 및 두 나리타 선택 검증
- 실제 모바일 기기에서 지도·저작권 표시·쿠키·CSP 수동 점검

`.env.local`과 Vercel에 필요한 변수 이름은 `.env.example`을 기준으로 한다. 값을 문서, 커밋, 이슈, 로그에 붙여넣지 않는다.

## 보안·운영 결정

- 세션 쿠키의 “2026년 10월 13일까지”는 2026-10-13 23:59:59 JST까지로 해석했다. 틀리면 마지막 날짜 안에서 최대 하루의 세션 수명 차이가 난다.
- 정확하지 않은 Google Place ID를 추측하지 않고 서버 환경변수로 받는다. 틀리면 배포 환경변수 항목이 불필요하게 늘어난다.
- Next.js 16의 정적 보안 헤더는 deprecated된 `middleware.ts` 대신 `next.config.ts headers()`를 사용한다. 향후 요청별 nonce가 필요하면 Proxy 도입이 필요하다.
- 현행 Next/ESLint 호환성을 위해 TypeScript 6.0.2와 `tsc6`를 사용한다. 틀리면 TypeScript 7의 새 compiler 이점을 놓친다.
- Google Maps JavaScript API가 요구하는 `unsafe-eval`은 사용자가 승인했으며 `/t/:path*` CSP에만 허용한다. 다른 라우트의 CSP는 계속 엄격하다.
- API의 malformed JSON과 잘못된 동적 ID를 모든 Route Handler에서 직접 검증하는 테스트 확대는 경미한 후속 과제다. 현재 구현은 안전하게 실패하도록 검토됐다.

## 다음 작업 우선순위

1. 사용자가 카메라 추적 연출을 최종 승인하면 `GoogleTripMap`의 기존 재생 상태를 사용해 현재 경로 끝점으로 `panTo`하고, 완료 후 `fitBounds`하도록 테스트 우선으로 구현한다.
2. 기능 브랜치를 `main`에 병합할지 PR로 검토할지 결정한다.
3. Supabase staging과 제한된 Google 키로 외부 통합을 검증한다.
4. Vercel에 배포하고 모바일 실기기 수동 점검을 수행한다.

범위를 임의로 넓히지 않는다. GPS, 실시간 교통·운항, PWA, 푸시, 분석, 카카오 로그인, OpenAI·MCP는 사용자가 다시 요청하기 전까지 제외한다.

## Git 규칙

- 커밋 메시지는 반드시 단일 라인 `type: 한국어 설명`이다.
- 스코프(`fix(map):`)와 본문·트레일러·Co-Authored-By를 넣지 않는다.
- 비밀값, 개인 코드, 쿠키, 초대 토큰, 의견 원문을 커밋하거나 로그에 남기지 않는다.

새 세션의 첫 요청으로 다음 문장을 사용할 수 있다.

> `README.md`와 `docs/SESSION_HANDOFF.md`, 설계·구현 계획을 먼저 읽고 `codex/japan-trip-app` 브랜치의 현재 상태를 확인해. 비밀값이나 외부 서비스를 변경하지 말고, 인계 문서의 최신 미구현 항목부터 나와 질의응답으로 방향을 확인한 뒤 진행해.
