# 일본 여행 모바일 지도 웹앱 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 초대 링크와 개인 코드로 역할을 구분하고, Google Maps에서 4박 5일 고정 일정을 애니메이션으로 보여주며 의견 승인·반려를 처리하는 모바일 웹을 구축한다.

**Architecture:** Next.js App Router가 UI와 Route Handler를 제공한다. 고정 여행 콘텐츠와 순수 도메인 로직을 분리하고, 서버 저장소 인터페이스 뒤에 Supabase 구현을 둬 외부 서비스 없이 단위 테스트한다. 지도는 Google Maps JavaScript API를 직접 로드하며 Routes API 호출과 캐시는 서버에서만 수행한다.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, Zod, Supabase JS, Vitest, Testing Library, Playwright, Google Maps JavaScript API, Google Routes API

**Spec:** `docs/superpowers/specs/2026-08-28-japan-trip-web-app-design.md`

## Global Constraints

- Node.js 22와 pnpm을 사용한다.
- UI 프레임워크와 OpenAI·MCP·카카오 API를 추가하지 않는다.
- 브라우저에서 Supabase를 직접 호출하지 않는다.
- 출생연도·개인 코드·세션 원문·의견 원문을 공개 응답이나 로그에 포함하지 않는다.
- 입력 경계는 Zod로 검증하고 권한은 서버에서 다시 검사한다.
- 새 비자명 로직은 실패를 먼저 확인한 테스트와 함께 구현한다.
- 커밋은 `type: 한국어 설명` 단일 라인 형식을 사용한다.

---

### Task 1: 프로젝트 기반과 고정 여행 도메인

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `src/test/setup.ts`
- Create: `src/trip/types.ts`, `src/trip/definition.ts`, `src/trip/definition.test.ts`
- Create: `src/app/layout.tsx`, `src/app/globals.css`

**Interfaces:**
- Produces: `TRIP_DEFINITION`, `getDay(day: 1|2|3|4|5)`, `RouteGeometryStatus`, `ViewerRole`, `OpinionStatus`, `RejectionCategory`

- [ ] 프로젝트 설정과 테스트 실행 스크립트를 추가하고 의존성을 설치한다.
- [ ] 참가자, 5일 일정, 네 철도 구간, 공항·도시 좌표를 검증하는 실패 테스트를 작성해 실행한다.
- [ ] `TRIP_DEFINITION`과 관련 타입을 최소 구현하고 테스트를 통과시킨다.
- [ ] 전역 메타데이터, 한국어 문서, 기본 CSS 변수와 reset을 추가한다.
- [ ] `pnpm test --run src/trip/definition.test.ts`와 `pnpm typecheck`를 실행한다.
- [ ] `feat: 여행 도메인과 프로젝트 기반 구성`으로 커밋한다.

### Task 2: 세션 보안과 서버 저장소

**Files:**
- Create: `src/server/auth/crypto.ts`, `src/server/auth/rate-limit.ts`, `src/server/auth/session.ts`
- Create: `src/server/repository/types.ts`, `src/server/repository/supabase.ts`, `src/server/repository/memory.ts`, `src/server/repository/index.ts`
- Create: `src/server/http.ts`, `src/server/env.ts`
- Create: `src/app/api/session/unlock/route.ts`, `src/app/api/session/route.ts`
- Create: `supabase/migrations/202608280001_initial_schema.sql`, `scripts/issue-participant-codes.ts`
- Test: `src/server/auth/*.test.ts`, `src/app/api/session/*.test.ts`

**Interfaces:**
- Produces: `hashParticipantCode(code,salt,pepper)`, `verifyParticipantCode(...)`, `hashSessionToken(token)`, `issueSession(participantId)`, `getViewer(request)`, `TripRepository`

- [ ] 코드 해시·세션 해시·동일 오류·만료·시도 제한에 대한 실패 테스트를 작성해 실행한다.
- [ ] Node `crypto` 기반 해시와 256비트 세션, IP/전체 제한 로직을 구현한다.
- [ ] 저장소 인터페이스와 테스트용 메모리 저장소, 서버 전용 Supabase 저장소를 구현한다.
- [ ] unlock/delete Route Handler와 2026-10-13 만료 쿠키를 구현한다.
- [ ] 다섯 테이블, 제약조건, RLS, 브라우저 권한 제거, 만료 경로 삭제 함수와 Cron SQL을 추가한다.
- [ ] 평문 코드를 한 번만 출력하는 발급 스크립트를 추가한다.
- [ ] 관련 Vitest와 `pnpm typecheck`를 실행한다.
- [ ] `feat: 개인 코드 세션과 보안 저장소 구현`으로 커밋한다.

### Task 3: 의견 승인·반려 API와 공개 응답

**Files:**
- Create: `src/server/opinions/service.ts`, `src/server/opinions/schemas.ts`
- Create: `src/app/api/opinions/route.ts`, `src/app/api/opinions/[id]/accept-rejection/route.ts`
- Create: `src/app/api/admin/opinions/[id]/approve/route.ts`, `src/app/api/admin/opinions/[id]/reject/route.ts`
- Create: `src/app/api/trip/[inviteToken]/route.ts`, `src/server/trip/payload.ts`
- Test: matching `*.test.ts` files

**Interfaces:**
- Consumes: `TripRepository`, `getViewer(request)`, `TRIP_DEFINITION`
- Produces: `submitOpinion`, `approveOpinion`, `rejectOpinion`, `acceptRejection`, `buildTripPayload`

- [ ] 관찰자 제출 금지, 관리자 권한, 타인 수용 금지, 미수용 제출 차단, 중복 전이에 대한 실패 테스트를 작성한다.
- [ ] Zod 길이 제한과 의견 상태 전이를 구현해 테스트를 통과시킨다.
- [ ] 역할별로 원문을 필터링하고 사람별 최신 반려 한 건만 만드는 payload 테스트와 구현을 추가한다.
- [ ] 초대 토큰을 constant-time 비교하는 trip API를 구현한다.
- [ ] 관련 Vitest와 `pnpm typecheck`를 실행한다.
- [ ] `feat: 의견 검토와 역할별 일정 API 구현`으로 커밋한다.

### Task 4: 모바일 지도, 접이식 패널과 경로 애니메이션

**Files:**
- Create: `src/app/t/[inviteToken]/page.tsx`, `src/app/t/[inviteToken]/TripApp.tsx`, `src/app/t/[inviteToken]/TripApp.module.css`
- Create: `src/components/TripPanel.tsx`, `src/components/TripPanel.module.css`, `src/components/OpinionComposer.tsx`, `src/components/RejectionCards.tsx`
- Create: `src/components/map/GoogleTripMap.tsx`, `src/components/map/map-script.ts`, `src/components/map/animation.ts`, `src/components/map/placeholder-routes.ts`, `src/components/map/StaticItinerary.tsx`
- Test: component and animation `*.test.ts(x)` files

**Interfaces:**
- Consumes: `GET /api/trip/[inviteToken]`, `TRIP_DEFINITION`
- Produces: `TripApp`, `createRoutePlayback`, `buildDayLayers`

- [ ] 모바일 렌더링, PC 차단, 날짜 선택 시 패널 접힘, 한 번 재생, 취소·재생 버튼, reduced-motion에 대한 실패 테스트를 작성한다.
- [ ] Codex형 패널과 의견·반려 UI를 구현해 컴포넌트 테스트를 통과시킨다.
- [ ] Google Maps 스크립트 로더와 지도 실패 fallback을 구현한다.
- [ ] 1일차 병렬 항공선→철도, 2·3·5일차 철도, 4일차 핀 강조 애니메이션을 구현한다.
- [ ] 30초와 focus 재조회, 접근 가능한 버튼·포커스 이동을 구현한다.
- [ ] 관련 Vitest와 `pnpm typecheck`를 실행한다.
- [ ] `feat: 모바일 여행 지도와 접이식 의견 패널 구현`으로 커밋한다.

### Task 5: Google Routes 철도 확정과 캐시

**Files:**
- Create: `src/server/routes/google-routes.ts`, `src/server/routes/polyline.ts`, `src/server/routes/service.ts`
- Create: `src/app/api/admin/routes/[segmentKey]/finalize/route.ts`
- Create: `src/components/admin/RouteFinalizer.tsx`
- Test: matching `*.test.ts(x)` files

**Interfaces:**
- Consumes: `TripRepository`, 관리자 세션, 네 segment key
- Produces: `finalizeRailRoute(segmentKey,input,now)`, `decodePolyline(encoded)`, `RouteFinalizer`

- [ ] 9월 7일 이전 차단, segment 검증, 나리타 선택, 열차 단계 선택, 실패 시 placeholder 유지, 만료 계산 테스트를 먼저 실패시킨다.
- [ ] Routes API 요청을 서버 전용 키로 구현하고 철도 단계 polyline만 추출한다.
- [ ] `min(created+30일, 2026-10-07 00:00 JST)` 만료와 만료 데이터 미노출을 구현한다.
- [ ] 관리자 API와 모바일 확정 폼을 구현한다.
- [ ] 관련 Vitest와 `pnpm typecheck`를 실행한다.
- [ ] `feat: 철도 경로 확정과 단기 캐시 구현`으로 커밋한다.

### Task 6: 정책 페이지, 운영 설정과 전체 흐름 검증

**Files:**
- Create: `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`, `src/app/legal.module.css`
- Create: `src/app/robots.ts`, `middleware.ts`, `.env.example`, `vercel.json`
- Create: `playwright.config.ts`, `e2e/trip-flow.spec.ts`, `e2e/desktop-gate.spec.ts`
- Modify: `README.md`, `package.json`

**Interfaces:**
- Consumes: 완성된 UI와 API
- Produces: Vercel/Supabase/Google 설정 안내와 모바일 핵심 흐름 E2E

- [ ] 관찰자, 참가자 제출, 관리자 반려, 당사자 수용, PC 차단의 Playwright 시나리오를 작성한다.
- [ ] Google 약관·개인정보 링크와 서비스 정책 페이지를 구현한다.
- [ ] robots noindex, strict-origin, 보안 헤더, 환경변수 예시, Vercel 빌드 설정을 추가한다.
- [ ] README에 Supabase migration, 코드 발급, Google 키 제한, Vercel 배포, 수동 점검 절차를 기록한다.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test --run`, `pnpm build`, `pnpm exec playwright test`를 실행한다.
- [ ] `test: 배포 설정과 모바일 전체 흐름 검증`으로 커밋한다.
