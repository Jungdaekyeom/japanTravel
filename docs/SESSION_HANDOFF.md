# 일본 여행 웹앱 세션 인계 기록

최신 상태: 2026-09-30 (KST)

**아래 9월 7일 기록은 과거 이력이며 현재 일정·배포 제한으로 사용하지 않는다.** 최신 일정은 `src/trip/public.ts`, 최신 구현·검증은 [9월 30일 재검증 기록](REVERIFICATION_2026-09-30.md)과 README를 따른다. 사용자는 자동 타이머 없이 계속 진행하고, 재검증 후 `develop` 커밋·푸시·Production 배포까지 승인했다. 실제 휴대폰 검사는 사용자가 수행한다.

## 2026-09-07 과거 인계 기록

이 문서는 다른 컴퓨터나 새 Codex 세션에서 현재 상태를 바로 이어가기 위한 요약이다. 비밀값, 기존 개인 링크, 초대 토큰과 실제 세션 값은 Git·문서·로그에 저장하지 않는다.

## 현재 작업과 실기기 확인 게이트

- 일정·애니메이션 구현과 자동 검사를 마쳤다. 2026-09-07 사용자 후속 지시로 **실기기 검증 전 커밋·`develop` 푸시가 승인되었다.** 실기기는 사용자가 직접 확인하며, 최종 불필요 코드 정리와 별도 수동 배포는 계속 보류한다. 기존 작업본 변경은 보존했다.
- 실제 Android Chrome, iPhone Safari, 폴드 기기는 아직 연결되지 않았다. Playwright 에뮬레이션/지도 모의 응답은 실기기 검증이 아니다.
- 실기기 연결 후 실제 Google Maps가 로드된 프로덕션 빌드로 최초 진입·패널·날짜 선택·전체 재생·재시작·1~5일차 모든 경로·지도 제스처·회전·접힘/펼침·백그라운드 복귀·감소 모션·실패 대체 화면·갱신·안내/레거시 링크를 확인한다. 기기/OS/브라우저/결과를 기록한다.
- 사용자 실기기 확인 결과를 받은 뒤 미사용 의견/거절 UI와 전용 테스트·스타일, 중복 래퍼를 정리하고 자동/동일 실기기 재검증을 진행한다. Owner 앱, 관리자/인증/보안 API, 데이터와 migration은 보존한다.
- 자동 검사 최종 결과는 아래 검증 항목에 기록한다.

## 1일차 예정 시각과 경로 출처

| 여행자 | 차량 이동 예정 | 항공편 예정 |
|---|---|---|
| 정대겸 | 06:00–07:00 PUS 이동 | PUS 08:30 → KIX 10:05 |
| 이규열·박준수 | 06:15–07:45 GMP 이동 | GMP 09:15 → KIX 10:55 |
| 한규준 | 06:45–07:45 GMP 이동 | GMP 09:15 → KIX 10:55 |

- 2026-10-02, 한국·일본 공통 UTC+09:00. 시각 원본은 `src/trip/public.ts`의 `DAY1_SCHEDULES`다. 라이브 운항/교통 시간을 가져오는 기능은 추가하지 않았다.
- 최초 확대 1초 뒤 오전 공통 시계 13.6초: 국내 이동 7초, 공항 대기 0.8초, 항공 5.8초. 기존 KIX 이후 8초를 합쳐 1일차 약22.6초.
- 오전 시계 기준4.0초 국내 GMP 구간,6.8초 GMP 공항,9.6초 두 항공 경로로 각각1초 전환한다. 08:30에는 GMP를 보면서 PUS 비행이 화면 밖에서 진행한다. 10:05 PUS 도착 시 GMP는50%이며,10:55 전원 도착 후에만 KIX–교토로 확대한다. 열차 실제 출발 시각은 표시하지 않는다.
- GMP 국제선 청사 좌표 `37.5655255,126.801378`: [Google Maps 장소](https://www.google.com/maps/place/?q=place_id:ChIJkx0jesCcfDURZF14U1BamVg), [한국공항공사 오시는 길](https://www.airport.co.kr/gimpo/cms/frCon/index.do?CONTENTS_NO=2&MENU_ID=1280).
- 수원 경로: [네이버 자동차 길찾기 원본](https://map.naver.com/p/api/directions/car?crs=EPSG%3A4326&rptype=4&respversion=4&output=json&start=127.0287097%2C37.2634787&goal=126.801378%2C37.5655255&cartype=1&fueltype=1&mileage=11.4&mainoption=traoptimal%2Cavoidhipassonly). 2026-09-07 13:45:58 KST 스냅샷. 호매실IC·금곡IC → 평택파주고속도로(수원–광명) → 광명·남부순환로 → 국제선 청사. 당시49.929km/약77분; 예정60분은 별도로 유지한다.
- 이천 경로: [네이버 자동차 길찾기 원본](https://map.naver.com/p/api/directions/car?crs=EPSG%3A4326&rptype=4&respversion=4&output=json&start=127.4350167%2C37.2723484&goal=126.801378%2C37.5655255&cartype=1&fueltype=1&mileage=11.4&mainoption=traoptimal%2Cavoidhipassonly). 2026-09-07 13:46:00 KST 스냅샷. 성남이천로 → 분당내곡로·양재IC → 경부고속도로·한남대교남단 → 올림픽대로·개화IC → 국제선 청사. 당시84.369km/약103분; 예정90분은 별도로 유지한다.
- 원본924/1,354개 도로 좌표를 런타임 밖에서81/149개로 단순화했다. 지역 평면 거리 기준 최대 오차19.83m/19.96m이며 원본 좌표만 남겼다. 시작/도착 핀 연결점은 별도로 붙였다. 현재 추천 경로는 교통 상황에 따라 달라지며 이 좌표는 해당 시점의 스냅샷이다.
- Google에서는 국제선 장소를 교차 확인했고 도로 좌표는 네이버 원본이다. 잠긴 Mac에서 지도 GUI 육안 확인은 수행하지 못했으므로 이를 화면/실기기 검증으로 기록하지 않는다.

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
3. 이번 `develop` 커밋·푸시는 승인되었으며 실기기 확인은 사용자가 진행한다. 최종 정리와 별도 수동 Production 배포는 보류한다.
4. 기존 Supabase migration과 Production 의견·세션 데이터는 삭제하지 않는다.

`/privacy`와 `/terms` 페이지는 이번 변경과 무관하며 유지한다.

## 활성 공개 앱

- 활성 주소는 토큰 없는 `/`이다. 모든 사용자는 같은 공통 여행 일정을 본다.
- 최신형 스마트폰과 펼친 폴더블의 화면 폭 전체에서 공개 지도·일정 UI를 표시한다. 화면 폭 차단이나 기기 모델 판별은 두지 않는다.
- 좌측 패널에서 1~5일차 또는 전체 일정을 선택하면 전원의 경로 재생이 시작된다.
- 전체 일정은 1일차부터 5일차까지 순차 재생하며, 재생 완료 후 다시 재생할 수 있다.
- 공개 앱은 `/api/trip`만 읽고, 의견·역할·관리 UI나 개인 토큰 흐름을 호출하지 않는다.
- Google 지도 로드에 실패하면 정적 일정과 재시도 화면을 제공한다.

## 확정된 여행 정보와 경로

- 기간: 2026년 10월 2일~6일, 4박 5일
- 일본 공통 구간: KIX 입국 → 교토 → 오다와라·하코네 → 도쿄 → NRT 출국
- 1일차와 5일차는 공통 일본 구간에 각자의 국내 첫·마지막 마일을 붙여 표시한다.
- 정대겸: 만덕터널 인근 ↔ 김해국제공항 ↔ KIX/NRT
- 이규열·박준수: 출국 이천시청 → GMP → KIX / 귀국 NRT → ICN → 이천시청
- 한규준: 출국 수원시청 → GMP → KIX / 귀국 NRT → ICN → 수원시청
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
- 카메라 계산·보간은 소수 줌을 사용하므로 `isFractionalZoomEnabled: true`를 명시한다. [Google 공식 문서](https://developers.google.com/maps/documentation/javascript/vector-map)에 따르면 래스터 지도에서는 기본값이 꺼져 있어 지도 ID 설정에 의존하지 않도록 한다.
- 브라우저 지도 키는 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`와 `NEXT_PUBLIC_GOOGLE_MAP_ID`로 제한한다.
- `GOOGLE_ROUTES_API_KEY`, `GOOGLE_PLACE_ID_*`, Supabase 서버 키와 `SESSION_PEPPER`는 서버 전용이다. 소유자 앱은 서버 API만 호출하며 공개 웹은 Routes 확정 API를 호출하지 않는다.
- 지도 키·서버 키·쿠키·기존 개인 토큰·의견 원문을 Git이나 로그에 남기지 않는다.
- GPS, 실시간 교통·운항, PWA, 푸시, 분석, 카카오 로그인, OpenAI/MCP는 사용자가 다시 요청하기 전까지 제외한다.

## 검증

2026-09-07 최종 수정분을 Node 22.16.0 / pnpm 10.15.0에서 다음 순서로 검사했다.

| 검사 | 결과 |
|---|---|
| 지도 관련 Vitest | 5개 파일, 86개 테스트 통과 |
| 전체 Vitest | 45개 파일, 261개 테스트 통과 |
| 타입 검사 → 린트 → 프로덕션 빌드 | 모두 통과 |
| Playwright | 6개 테스트 통과 |
| 최종 diff 검사·독립 재리뷰 | 통과, 발견된 동일 핀 카메라 전환 문제 수정 완료 |

Playwright는 로컬 개발 서버의 Chromium 모바일/폴드 폭 에뮬레이션이며, Google Maps 키 없이 API fixture와 대체 화면을 검사한다. 지도 카메라·시계·경로 진행·화면 크기 변경·취소·감소 모션은 Vitest 모의 지도 검사다. **실제 지도 렌더링이나 Android/iPhone/폴드 실기기 통과를 의미하지 않는다.** 개발 서버의 안내 페이지에서 React 디버깅용 `eval` CSP 경고가 남으며 보안 정책은 완화하지 않았다. 최종 빌드는 별도로 통과했다.

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

- 이번 작업의 stage·커밋·`develop` 푸시는 사용자 후속 지시로 승인되었다. 별도 수동 배포나 `production` 브랜치 변경은 수행하지 않는다.
- 커밋할 때는 단일 라인 `type: 한국어 설명` 형식을 사용한다. 스코프, 본문, 트레일러, Co-Authored-By는 넣지 않는다.
- 비밀값, 개인 링크, 쿠키, 초대 토큰, 의견 원문을 커밋하거나 로그에 남기지 않는다.
