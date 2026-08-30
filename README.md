# 2026 일본 여행 지도

2026년 10월 2일~6일의 오사카 입국·도쿄 출국 일정을 모바일 Google 지도 위에 보여주고, 사람별 1회용 개인 링크로 참가자 의견과 관리자 검토를 처리하는 비공개 Next.js 웹앱입니다.

다른 컴퓨터나 새 세션에서 작업을 이어갈 때는 [세션 인계 기록](docs/SESSION_HANDOFF.md)을 먼저 읽으세요. 확정 요구사항, 현재 구현 상태, 아직 구현하지 않은 최신 논의와 재개 명령을 정리해 두었습니다.

## 범위

- 모바일(767px 이하): 1~5일차 일정, 1회 경로 애니메이션, 개인 링크 자동 인증, 의견 제출·반려 수용, 관리자 검토·철도 경로 확정
- 데스크톱(768px 이상): 휴대폰 접속 안내만 표시 (`/terms`, `/privacy`는 예외)
- 관찰자: 초대 링크로 승인된 고정 일정과 사람별 최신 반려 한 건 조회
- 참가자: 이규열·박준수·한규준의 개인 의견 제출과 본인 반려 수용
- 관리자: 정대겸의 수동 승인·반려와 철도 경로 확정
- 제외: GPS, 실시간 교통·운항, 오프라인/PWA, 분석, 푸시, 카카오 로그인, OpenAI/MCP

## 로컬 실행

Node.js 22.13 이상 23 미만과 pnpm 10을 사용합니다.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

`.env.local`에는 아래 운영 절차에서 발급한 값을 직접 넣습니다. 비밀값, 개인 링크, 초대 토큰을 저장소나 로그에 남기지 마세요.

## Supabase 설정

1. Production용 Supabase 프로젝트를 만들고 Project URL과 서버용 `sb_secret_...` secret key를 준비합니다.
2. Supabase CLI로 프로젝트를 연결한 뒤 `supabase/migrations`의 SQL을 파일명 순서대로 적용합니다. 기존 Production에도 과거 migration을 수정하지 말고 `202608300001_personal_link_claims.sql`을 추가 적용합니다.
3. migration은 `pgcrypto`, `pg_cron`, RLS, 브라우저 역할 권한 제거, 로그인 제한 RPC, 1회용 개인 토큰 원자적 소비·세션 생성 RPC와 만료 경로 삭제 Cron을 구성합니다. 프로젝트에서 `pg_cron` 사용 가능 여부와 매일 15:00 UTC(자정 KST/JST) 작업을 확인합니다.
4. `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, Production 주소인 `APP_ORIGIN`, `INVITE_TOKEN`, 16자 이상의 무작위 `SESSION_PEPPER`를 `.env.local`에 설정합니다. pepper는 `openssl rand -base64 32`처럼 암호학적으로 안전하게 생성합니다.
5. 관리자 포함 네 사람의 개인 링크를 한 번 발급합니다.

```bash
pnpm links:issue
```

명령은 `/t/<INVITE_TOKEN>#join=<32바이트 base64url 토큰>` 형식의 완전한 URL 네 개를 터미널에 한 번만 출력하고 DB에는 SHA-256 토큰 해시만 저장합니다. 출력은 비밀번호 관리자 등 안전한 곳으로 즉시 옮긴 뒤 각 사람에게 따로 전달합니다. 기존 링크가 있으면 기본 실행은 중단됩니다. 쿠키 삭제·기기 변경·노출 시 `pnpm links:issue --reissue`를 실행하면 네 링크를 모두 교체하고 네 사람의 기존 로그인 세션도 폐기합니다. DB 저장과 세션 폐기가 모두 성공한 뒤에만 새 링크를 출력합니다. 교체된 링크와 폐기된 세션은 복구되지 않으므로 네 사람 모두 새 링크를 다시 열어야 합니다.

Production 데이터는 브라우저에서 Supabase를 직접 읽지 않습니다. Vercel 서버만 secret key를 사용합니다.

## Google Maps 설정

Google Cloud 프로젝트에서 결제를 연결하고 다음 두 키를 분리합니다.

### 브라우저 지도 키

- Maps JavaScript API만 허용합니다.
- HTTP referrer를 Production 주소(예: `https://프로젝트.vercel.app/*`)와 필요한 로컬 개발 주소로 제한합니다.
- 키는 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, 지도 ID는 `NEXT_PUBLIC_GOOGLE_MAP_ID`에 설정합니다.

### 서버 철도 경로 키

- Routes API만 허용하고 `GOOGLE_ROUTES_API_KEY`에 설정합니다. 이 키에는 절대 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.
- Google Place ID Finder 등으로 KIX, 교토역, 오다와라역, 도쿄역, 게이세이 우에노역, 나리타공항의 정확한 Place ID를 확인해 대응하는 `GOOGLE_PLACE_ID_*` 변수에 넣습니다.
- 2026년 9월 7일 이후 관리자가 실제 탑승일의 출발 시각을 입력해 네 철도 구간을 확정합니다. 나리타 구간은 우에노 출발 게이세이 스카이라이너로 고정합니다.
- 좌표는 Google 지도 위에서만 사용하며 생성 후 최대 30일 또는 2026년 10월 7일 00:00(JST) 중 이른 시각까지만 저장됩니다. 기본 Google 저작권 표시를 가리지 마세요.

키 제한과 할당량은 [Google Maps API 보안 권장사항](https://developers.google.com/maps/api-security-best-practices)을 기준으로 최종 확인합니다.
지도 화면 `/t/*`에만 [Maps JavaScript API allowlist CSP](https://developers.google.com/maps/documentation/javascript/content-security-policy)의 Google 도메인, `blob:`과 `unsafe-eval`을 허용합니다. API·약관·개인정보·robots와 그 밖의 경로에는 `unsafe-eval`을 허용하지 않습니다.

## 초대와 서버 비밀값

- `INVITE_TOKEN`은 URL에 안전한 32바이트 이상 무작위 값으로 생성합니다. 공유 주소는 `/t/<INVITE_TOKEN>`입니다.
- 관리자 포함 지정된 네 사람에게는 `/t/<INVITE_TOKEN>#join=<개인 토큰>` 링크를 각각 전달합니다. `#join` fragment는 GET·referrer·서버 접근 로그로 전송되지 않고, 브라우저가 JSON POST로 제출한 직후 성공 여부와 관계없이 주소에서 제거합니다.
- 개인 링크는 처음 연 기기에서 한 번만 소비되어 2026년 10월 13일 23:59:59(JST)까지 유효한 HttpOnly 세션 쿠키를 만듭니다. 같은 카카오 인앱 브라우저의 활성 세션에서 링크를 다시 열면 기존 역할을 유지합니다.
- 소비된 개인 링크를 다른 기기로 전달해도 관찰자로만 접속합니다. 쿠키를 지웠거나 다른 기기에서 역할이 필요하면 관리자가 링크를 재발급해야 합니다. 일반 초대 링크는 언제나 관찰자용입니다.
- `SESSION_PEPPER`, Supabase 서버 키, Routes 키, Place ID는 서버 전용입니다.
- 의견 원문, 개인 토큰, 쿠키와 초대 토큰을 애플리케이션 로그에 추가하지 마세요.

## Vercel 배포

1. Git 저장소를 Vercel에 가져오고 Production Branch를 `main`으로 둡니다. 프레임워크와 Node 22는 `vercel.json`과 `package.json`에서 감지됩니다.
2. 위 환경변수를 Vercel Production에 등록합니다. Preview에는 별도 테스트 Supabase와 별도 제한 키를 쓰거나 비밀값을 넣지 않습니다.
3. Production 배포 후 실제 도메인을 브라우저 지도 키의 HTTP referrer에 추가하고, 필요하면 기본 `*.vercel.app` 주소도 유지합니다.
4. 커스텀 도메인은 필요할 때만 추가합니다. `robots.txt`, meta robots와 `X-Robots-Tag`가 검색 색인을 차단하지만 초대 링크 자체가 인증 수단은 아니므로 링크도 비밀처럼 취급합니다.

이 저장소 작업은 Vercel 배포나 외부 서비스 변경을 자동으로 수행하지 않습니다.

## 검증

```bash
pnpm lint
pnpm typecheck
pnpm test --run
pnpm build
pnpm exec playwright install chromium
pnpm exec playwright test
```

Playwright는 Production 백도어 없이 브라우저 네트워크 요청만 가로채 관찰자→참가자 제출→관리자 반려→당사자 수용과 데스크톱 차단을 검증합니다.

Production 배포에서는 모바일 기기로 다음 항목을 수동 점검합니다.

- 초대 링크의 관찰자 화면과 사람별 최신 반려 한 건만 노출되는지
- 네 개인 링크가 첫 기기에서만 올바른 역할을 만들고, URL fragment가 즉시 제거되며 재전달·재사용 시 관찰자로 남는지
- 날짜를 누르면 패널이 접히고 경로가 한 번 재생되며 다시 재생할 수 있는지
- Google 지도·마커·저작권 표시와 지도 실패 시 정적 일정·재시도 화면
- 참가자 제출, 관리자 승인·반려, 당사자만 가능한 수용, 수용 전 재제출 차단
- 2026년 9월 7일 전 경로 확정 차단, 이후 네 철도 구간 확정, 실패 시 점선 유지
- 1280px 데스크톱 차단과 `/terms`, `/privacy`, `/robots.txt` 접근
- 응답의 CSP, `Referrer-Policy: strict-origin`, noindex 헤더와 HTTPS 쿠키 유지

여행 운영이 끝나면 Supabase의 참가자·세션·로그인 시도·의견 데이터를 삭제하고, Vercel 비밀값과 Google 키를 폐기하거나 회전하며 초대 링크 배포를 중단합니다.
