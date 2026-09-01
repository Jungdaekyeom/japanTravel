# 2026 일본 여행 지도

2026년 10월 2일~6일의 일본 여행 일정을 모바일 Google 지도 위에 보여주는 pnpm 모노레포입니다. **활성 공개 주소는 토큰 없는 루트 `/`**이며, 모든 사용자는 같은 공통 일정을 봅니다. 저장소 루트의 Next.js 웹과 `apps/owner`의 Android 전용 관리 앱을 함께 관리합니다.

좌측 패널에서 전원 또는 정대겸·이규열·박준수·한규준 중 한 명을 수동 선택한 뒤 1~5일차 또는 전체 일정을 선택해 경로를 재생합니다. 여행자 선택 자체는 재생을 시작하지 않으며, 일정 선택 후에만 재생합니다.

다른 컴퓨터나 새 세션에서 작업을 이어갈 때는 [세션 인계 기록](docs/SESSION_HANDOFF.md)을 먼저 읽으세요. 확정 요구사항, 현재 구현 상태, 보류 범위와 재개 명령을 정리해 두었습니다.

## 범위

- 모바일(767px 이하): 여행자 수동 선택, 1~5일차 또는 전체 경로 재생, Google 지도와 정적 fallback
- 데스크톱(768px 이상): 휴대폰 접속 안내만 표시 (`/terms`, `/privacy`는 예외)
- 1일차·5일차: 각 여행자의 개인 출발·도착 구간과 KIX→NRT 공통 일본 구간을 함께 표시
- 개인 출발·도착 기준: 만덕터널 인근, 이천시청, 수원시청
- 공개 웹 제외: 의견 제출·검토, 역할별 화면, 관리 UI, 개인 토큰 진입
- 소유자 앱: 정대겸의 지정 Android 기기에서만 의견 승인·반려와 네 철도 구간 확정을 제공한다.
- 보존: 기존 인증·의견 API와 Supabase 데이터·migration은 삭제하지 않는다. 공개 화면에서는 호출하지 않는다.
- 제외: GPS, 실시간 교통·운항, 오프라인/PWA, 분석, 푸시, 카카오 로그인, OpenAI/MCP

## 로컬 실행

Node.js 22.13 이상 23 미만과 pnpm 10을 사용합니다.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

`SUPABASE_URL`과 `SUPABASE_SECRET_KEY`는 활성 일정 API에 필수이므로 `.env.local`에 유효한 값을 설정해야 합니다. 누락되거나 Supabase에 연결할 수 없으면 `/api/trip` 요청이 실패해 일정 화면을 열 수 없습니다. Google Maps 변수는 선택 사항이며, 일정 API가 정상인 상태에서 지도 키가 없거나 지도 로딩에 실패하면 정적 일정 fallback을 사용합니다.

로컬 앱은 `http://localhost:3000/`에서 확인합니다. `.env.local`의 값, Supabase 서버 키, 지도 키, 기존 개인 링크·토큰·쿠키를 저장소나 로그에 남기지 마세요.

### Android 소유자 앱

`apps/owner`는 Expo SDK 57 기반 Android 앱입니다. 연결된 기기에서 개발할 때는 웹 서버를 실행한 뒤 다음 명령을 사용합니다.

```bash
adb reverse tcp:3000 tcp:3000
pnpm owner:android
```

등록 코드는 `supabase/migrations/202608310001_owner_claim.sql`을 대상 Supabase에 적용한 뒤 `pnpm owner:code`로 필요할 때만 새로 발급해 앱에 직접 붙여넣습니다. 이 명령의 출력은 비밀값이므로 URL·문서·커밋·채팅에 남기지 않습니다. 앱은 `samsung` `SM-S948N`, Android API 36 이상, `arm64-v8a` 기기에서만 서버 요청을 시작합니다. 배포용 API 주소와 APK 배포는 별도 승인 범위입니다.

## 현재 경로와 지도

- 공통 일본 구간은 KIX 입국부터 NRT 출국까지의 5일 일정이다.
- 개인 구간은 여행자 선택에 따라 표시한다. 정대겸은 만덕터널 인근↔김해국제공항, 이규열·박준수는 이천시청↔인천국제공항, 한규준은 수원시청↔인천국제공항을 사용한다.
- KIX→교토, 교토→오다와라, 오다와라→도쿄, 도쿄→NRT는 공통 일본 경로다. 확정 전 철도 구간은 앱 내 근사 경로로 표시한다.
- 날짜를 누르면 해당 일차 경로를 한 번 재생하고, 전체 일정은 1일차부터 5일차까지 순차 재생한다. 재생 완료 뒤 다시 재생할 수 있다.

## Google Maps 설정

Google Cloud 프로젝트에서 결제를 연결하고 다음 두 키를 분리합니다.

### 브라우저 지도 키

- Maps JavaScript API만 허용합니다.
- HTTP referrer를 Production 주소와 필요한 로컬 개발 주소로 제한합니다.
- 키는 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, 지도 ID는 `NEXT_PUBLIC_GOOGLE_MAP_ID`에 설정합니다.

### 서버 철도 경로 키

- `GOOGLE_ROUTES_API_KEY`는 서버 전용이며 절대 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.
- 소유자 앱의 Routes API 확정 흐름에서만 `GOOGLE_PLACE_ID_*` 변수를 사용합니다. 공개 웹은 이 흐름을 호출하지 않습니다.
- 좌표는 Google 지도 위에서만 사용하며 생성 후 최대 30일 또는 2026년 10월 7일 00:00(JST) 중 이른 시각까지만 저장합니다. 기본 Google 저작권 표시를 가리지 마세요.

키 제한과 할당량은 [Google Maps API 보안 권장사항](https://developers.google.com/maps/api-security-best-practices)을 기준으로 최종 확인합니다. 지도 화면에는 [Maps JavaScript API allowlist CSP](https://developers.google.com/maps/documentation/javascript/content-security-policy)의 Google 도메인, `blob:`과 `unsafe-eval`을 허용합니다. 서버 비밀값은 브라우저에 노출하지 않습니다.

## 소유자 앱과 보존 백엔드

공개 웹에는 관리 진입점이나 역할별 화면이 없습니다. 소유자 앱만 URL 없는 일회용 코드로 세션을 등록하고 기존 의견·경로 API를 사용합니다. 일반 개인 링크와 역할별 웹 흐름은 호환성을 위해 보존된 **dormant/legacy** 범위이며 공개 접속 방법으로 안내하지 않습니다.

`SESSION_PEPPER`, Supabase 서버 키, Routes 키와 Place ID는 서버 전용입니다. 쿠키와 기존 개인 토큰을 포함한 비밀값은 저장소·문서·로그에 남기거나 브라우저 공개 번들에 포함하지 마세요. 의견 원문도 애플리케이션 로그에 추가하지 마세요.

## 브랜치와 배포 상태

- `production`은 공개 복구 기준 커밋 `d6e6290`을 가리킨다.
- `develop`은 현재 로컬 기능 개발 브랜치다.
- 이 작업은 원격 push나 Vercel 배포를 수행하지 않는다. 배포·외부 서비스 변경은 명시적 승인 후에만 한다.

## 검증

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

테스트는 fixture와 네트워크 가로채기를 사용하며 실제 외부 API나 배포를 호출하지 않습니다. `/privacy`와 `/terms`는 이번 공개 경로 변경과 무관하며 그대로 유지합니다.
