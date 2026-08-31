# Public Entry and Traveler Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 토큰 없는 공개 루트에서 전원 또는 네 사람을 선택해 1~5일차 공통·개인 경로를 재생하는 모바일 여행 앱을 만든다.

**Architecture:** 기존 인증·의견·관리 백엔드는 보존하되 활성 루트는 새 공통 payload와 읽기 전용 API만 사용한다. 지도 geometry에는 공통 또는 적용 여행자 ID를 붙이고 `buildDayLayers` 한 곳에서 선·핀·재생 stage를 필터링하여 Google 지도와 전체 일정 재생이 같은 선택 상태를 공유한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Vitest, Testing Library, Playwright, Google Maps JavaScript API

**Spec:** `docs/superpowers/specs/2026-08-31-public-entry-traveler-routes-design.md`

## Global Constraints

- 작업 브랜치는 로컬 `develop`; 현재 공개 복구 기준은 로컬 `production`의 `d6e6290`이다.
- 원격 push와 Vercel 배포를 수행하지 않는다.
- `/`와 `GET /api/trip`은 초대 토큰, 개인 토큰, 세션 또는 역할 없이 동작한다.
- 기존 인증·세션·의견·관리 API, 컴포넌트, repository 메서드, Supabase migration과 Production 데이터는 삭제하거나 변경하지 않는다.
- 활성 payload에는 `role`, `displayName`, `ownOpinions`, `reviewQueue`, `publicRejections`를 포함하지 않는다.
- 공개 여행자 정보는 `id`와 `name`만 포함하며 생년, 역할, 출발 도시, 인증 정보를 포함하지 않는다.
- `null` 여행자 선택은 전원이며 첫 진입 기본값이다. 사람 선택만으로 재생하거나 패널을 닫지 않는다.
- 1일차와 5일차만 개인 경로를 필터링하고 2~4일차는 모든 여행자에게 공통이다.
- 지도 핀과 이동 라벨에는 사람 이름을 넣지 않는다. 사람 이름은 여행자 선택 탭에만 둔다.
- 이천시청 좌표는 `37.2723484, 127.4350167`, 수원시청 좌표는 `37.2634787, 127.0287097`을 사용하고 만덕터널 인근 좌표는 유지한다.
- 항공편명, 실제 시각, 터미널, 실시간 운항·교통 정보와 선택 상태 영속화는 추가하지 않는다.
- 의견·관리 진입점에는 경로 개발을 위해 보류했으며 사용자 요청 시 공개 의견 모델로 재설계한다는 인라인 주석을 남긴다.
- `/privacy`와 `/terms` 페이지는 수정하지 않는다.
- 모든 코드 변경은 실패하는 테스트를 먼저 확인하고 최소 구현으로 통과시킨다.
- 커밋은 단일 라인 `type: 한국어 설명` 형식만 사용하고 본문·트레일러·스코프를 넣지 않는다.

---

### Task 1: 공통 여행자 계약과 토큰 없는 읽기 API

**Files:**
- Create: `src/trip/travelers.ts`
- Create: `src/trip/travelers.test.ts`
- Create: `src/app/api/trip/route.ts`
- Create: `src/app/api/trip/route.test.ts`
- Modify: `src/trip/public.ts`
- Modify: `src/trip/public.test.ts`
- Modify: `src/server/trip/payload.ts`
- Modify: `src/server/trip/payload.test.ts`
- Modify: `src/server/env.ts`
- Modify: `src/server/env.test.ts`
- Modify: `src/server/repository/index.ts`

**Interfaces:**
- Consumes: 기존 `PUBLIC_TRIP_DEFINITION`, `PublicRailRoute`, `TripRepository.listRouteGeometry(now)`와 확정 geometry 필터링 규칙.
- Produces: `TRAVELERS`, `TravelerId`, `PublicTraveler`, `SharedTripPayload`, `buildSharedTripPayload(routes, now)`, `getSupabaseEnv()`, 토큰 없는 `GET /api/trip`.

- [ ] **Step 1: 여행자 공개 계약과 공통 payload의 실패 테스트 작성**

```ts
import { describe, expect, it } from "vitest";

import { TRAVELERS } from "./travelers";

describe("public travelers", () => {
  it("publishes only the fixed traveler ids and names", () => {
    expect(TRAVELERS).toEqual([
      { id: "daekyeom", name: "정대겸" },
      { id: "gyuyeol", name: "이규열" },
      { id: "junsu", name: "박준수" },
      { id: "gyujun", name: "한규준" },
    ]);
    expect(JSON.stringify(TRAVELERS)).not.toMatch(/birthYear|role|departureCity|token|session/);
  });
});
```

`src/server/trip/payload.test.ts`에는 다음 계약을 추가한다.

```ts
it("builds one role-free shared payload", () => {
  const payload = buildSharedTripPayload([], new Date("2026-09-10T00:00:00.000Z"));

  expect(payload).toMatchObject({
    trip: { startDate: "2026-10-02", endDate: "2026-10-06" },
    travelers: [
      { id: "daekyeom", name: "정대겸" },
      { id: "gyuyeol", name: "이규열" },
      { id: "junsu", name: "박준수" },
      { id: "gyujun", name: "한규준" },
    ],
    railRoutes: [],
  });
  expect(JSON.stringify(payload)).not.toMatch(/role|displayName|ownOpinions|reviewQueue|publicRejections|birthYear/);
});
```

- [ ] **Step 2: 새 계약 테스트가 정의 누락으로 실패하는지 확인**

Run: `pnpm test --run src/trip/travelers.test.ts src/server/trip/payload.test.ts`

Expected: FAIL because `TRAVELERS` and `buildSharedTripPayload` do not exist.

- [ ] **Step 3: 여행자 타입과 공통 payload 최소 구현**

```ts
// src/trip/travelers.ts
export const TRAVELERS = [
  { id: "daekyeom", name: "정대겸" },
  { id: "gyuyeol", name: "이규열" },
  { id: "junsu", name: "박준수" },
  { id: "gyujun", name: "한규준" },
] as const;

export type TravelerId = typeof TRAVELERS[number]["id"];
export type PublicTraveler = typeof TRAVELERS[number];
```

`src/trip/public.ts`에 기존 역할별 타입과 공존하는 활성 타입을 추가한다.

```ts
import type { PublicTraveler } from "./travelers";

export type SharedTripPayload = {
  trip: PublicTrip;
  travelers: readonly PublicTraveler[];
  railRoutes: PublicRailRoute[];
};
```

`src/server/trip/payload.ts`는 기존 `buildTripPayload`를 보존하고 다음 함수를 추가한다.

```ts
import { TRAVELERS } from "../../trip/travelers";
import type { SharedTripPayload } from "../../trip/public";

export function buildSharedTripPayload(
  routes: readonly RouteGeometryRecord[] = [],
  now = new Date(),
): SharedTripPayload {
  return {
    trip: PUBLIC_TRIP_DEFINITION,
    travelers: TRAVELERS,
    railRoutes: publicRailRoutes(routes, now),
  };
}
```

- [ ] **Step 4: 공통 payload 테스트 통과 확인**

Run: `pnpm test --run src/trip/travelers.test.ts src/trip/public.test.ts src/server/trip/payload.test.ts`

Expected: PASS, including existing legacy role payload tests.

- [ ] **Step 5: 공개 API와 Supabase 환경 분리의 실패 테스트 작성**

```ts
// src/app/api/trip/route.test.ts
import { describe, expect, it } from "vitest";
import { InMemoryTripRepository } from "../../../server/repository/memory";
import { createTripHandler } from "./route";

describe("GET /api/trip", () => {
  it("returns the shared trip without a token or role fields", async () => {
    const response = await createTripHandler({
      repository: new InMemoryTripRepository(),
      now: () => new Date("2026-09-10T00:00:00.000Z"),
    })();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.travelers).toHaveLength(4);
    expect(payload.trip.startDate).toBe("2026-10-02");
    expect(JSON.stringify(payload)).not.toMatch(/role|session|opinion|invite/i);
  });

  it("returns 503 when route storage is unavailable", async () => {
    const repository = new InMemoryTripRepository();
    repository.listRouteGeometry = async () => { throw new Error("offline"); };
    const response = await createTripHandler({ repository })();
    expect(response.status).toBe(503);
  });
});
```

`src/server/env.test.ts`에 `SUPABASE_URL`과 `SUPABASE_SECRET_KEY`만으로 `getSupabaseEnv()`가 성공하고, 기존 `getServerEnv()`는 여전히 레거시 비밀값을 검증하는 테스트를 추가한다.

- [ ] **Step 6: 새 API와 환경 함수가 없어 실패하는지 확인**

Run: `pnpm test --run src/app/api/trip/route.test.ts src/server/env.test.ts`

Expected: FAIL because the public handler and `getSupabaseEnv` are not implemented.

- [ ] **Step 7: 토큰 없는 API와 저장소 환경 최소 구현**

```ts
// src/app/api/trip/route.ts
import { NextResponse } from "next/server";

import type { TripRepository } from "../../../server/repository/types";
import { buildSharedTripPayload } from "../../../server/trip/payload";

export const runtime = "nodejs";

type Dependencies = {
  repository: Pick<TripRepository, "listRouteGeometry">;
  now?: () => Date;
};

export function createTripHandler({ repository, now = () => new Date() }: Dependencies) {
  return async function trip() {
    try {
      const requestTime = now();
      const routes = await repository.listRouteGeometry(requestTime);
      return NextResponse.json(buildSharedTripPayload(routes, requestTime));
    } catch {
      return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
    }
  };
}

export async function GET() {
  const { getTripRepository } = await import("../../../server/repository");
  return createTripHandler({ repository: getTripRepository() })();
}
```

```ts
// src/server/env.ts
export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;

export function getSupabaseEnv(): SupabaseEnv {
  const parsed = supabaseEnvSchema.safeParse(process.env);
  if (!parsed.success) throw new Error("Missing required Supabase environment variables");
  return parsed.data;
}
```

`src/server/repository/index.ts`는 `getServerEnv()` 대신 `getSupabaseEnv()`로 service-role 저장소를 만든다. 기존 인증 API가 직접 사용하는 `getServerEnv()`와 레거시 동적 여행 API는 삭제하지 않는다.

- [ ] **Step 8: Task 1 테스트와 타입 검사 통과 확인**

Run: `pnpm test --run src/trip/travelers.test.ts src/trip/public.test.ts src/server/trip/payload.test.ts src/app/api/trip/route.test.ts src/server/env.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 9: Task 1 커밋**

```bash
git add src/trip/travelers.ts src/trip/travelers.test.ts src/trip/public.ts src/trip/public.test.ts src/server/trip/payload.ts src/server/trip/payload.test.ts src/server/env.ts src/server/env.test.ts src/server/repository/index.ts src/app/api/trip/route.ts src/app/api/trip/route.test.ts
git commit -m "feat: 공개 여행 API와 여행자 목록 추가"
```

### Task 2: 사람별 경로 메타데이터와 날짜 레이어 필터

**Files:**
- Modify: `src/trip/public.ts`
- Modify: `src/trip/public.test.ts`
- Modify: `src/trip/definition.test.ts`
- Modify: `src/components/map/placeholder-routes.ts`
- Modify: `src/components/map/placeholder-routes.test.ts`

**Interfaces:**
- Consumes: Task 1의 `TravelerId`; 기존 `MapLine`, `MapPin`, `buildDayLayers(day, routeLines, schedules)`.
- Produces: `MapLine.travelerIds`, `MapPin.travelerIds`, `buildDayLayers(day, routeLines, schedules, travelerId)`; `null` 메타데이터는 공통 구간, `null` 선택은 전원이다.

- [ ] **Step 1: 위치와 여행자별 1·5일차 조합의 실패 테스트 작성**

```ts
it("uses city halls and keeps person names out of map labels", () => {
  expect(PUBLIC_TRIP_DEFINITION.places.icheon).toMatchObject({
    name: "이천시청", latitude: 37.2723484, longitude: 127.4350167,
  });
  expect(PUBLIC_TRIP_DEFINITION.places.suwon).toMatchObject({
    name: "수원시청", latitude: 37.2634787, longitude: 127.0287097,
  });
  expect(FULL_ROUTE_PINS.map(({ label }) => label).join(" ")).not.toMatch(/정대겸|이규열|박준수|한규준/);
});

it.each([
  ["daekyeom", ["mandeok-pus", "pus-kix", "kix-kyoto"], ["tokyo-narita", "nrt-pus", "pus-mandeok"]],
  ["gyuyeol", ["icheon-icn", "icn-kix", "kix-kyoto"], ["tokyo-narita", "nrt-icn", "icn-icheon"]],
  ["junsu", ["icheon-icn", "icn-kix", "kix-kyoto"], ["tokyo-narita", "nrt-icn", "icn-icheon"]],
  ["gyujun", ["suwon-icn", "icn-kix", "kix-kyoto"], ["tokyo-narita", "nrt-icn", "icn-suwon"]],
] as const)("filters day 1 and 5 for %s", (travelerId, day1Keys, day5Keys) => {
  expect(buildDayLayers(1, FULL_ROUTE_LINES, ROUTE_SCHEDULES, travelerId).lines.map(({ key }) => key)).toEqual(day1Keys);
  expect(buildDayLayers(5, FULL_ROUTE_LINES, ROUTE_SCHEDULES, travelerId).lines.map(({ key }) => key)).toEqual(day5Keys);
});

it("returns identical shared layers for every traveler on days 2 through 4", () => {
  for (const day of [2, 3, 4] as const) {
    const expected = buildDayLayers(day, FULL_ROUTE_LINES, ROUTE_SCHEDULES, "daekyeom");
    for (const travelerId of ["gyuyeol", "junsu", "gyujun"] as const) {
      expect(buildDayLayers(day, FULL_ROUTE_LINES, ROUTE_SCHEDULES, travelerId)).toEqual(expected);
    }
  }
});
```

선택된 사람의 stage가 다른 사람의 선·핀을 참조하지 않는 검사도 추가한다.

```ts
const layers = buildDayLayers(1, FULL_ROUTE_LINES, ROUTE_SCHEDULES, "daekyeom");
const lineKeys = new Set(layers.lines.map(({ key }) => key));
const pinKeys = new Set(layers.pins.map(({ key }) => key));
expect(layers.stages.flatMap(({ lineKeys = [] }) => lineKeys).every((key) => lineKeys.has(key))).toBe(true);
expect(layers.stages.flatMap(({ focusPinKeys = [] }) => focusPinKeys).every((key) => pinKeys.has(key))).toBe(true);
expect(layers.pins.map(({ key }) => key)).not.toEqual(expect.arrayContaining(["suwon", "icheon", "incheon"]));
```

- [ ] **Step 2: 새 필터 계약이 실패하는지 확인**

Run: `pnpm test --run src/trip/public.test.ts src/components/map/placeholder-routes.test.ts`

Expected: FAIL on old station coordinates, person-name labels, and the missing fourth `buildDayLayers` argument behavior.

- [ ] **Step 3: 장소·선·핀에 공통/개인 메타데이터 추가**

`src/trip/public.ts`의 두 장소를 정확한 시청 위치로 변경한다.

```ts
suwon: { name: "수원시청", latitude: 37.2634787, longitude: 127.0287097 },
icheon: { name: "이천시청", latitude: 37.2723484, longitude: 127.4350167 },
```

`TRIP_DEFINITION`이 공개 장소를 재사용하므로 `src/trip/definition.test.ts`의 장소 기대값도 같은 이름과 좌표로 갱신한다. 참가자 역할·생년·출발 도시를 검증하는 레거시 계약은 변경하지 않는다.

`src/components/map/placeholder-routes.ts` 타입은 다음과 같이 확장한다.

```ts
import type { TravelerId } from "../../trip/travelers";

type TravelerScope = readonly TravelerId[] | null;

export type MapLine = {
  key: string;
  kind: "car" | "flight" | "rail" | "connector";
  color: string;
  outlineColor?: string;
  pinKeys: readonly [PlaceKey, PlaceKey];
  path: readonly Coordinate[];
  dashed: boolean;
  label?: "경로 확정 전" | "철도 이동";
  transportLabel?: string;
  googleDerived?: true;
  travelerIds: TravelerScope;
};

export type MapPin = {
  key: string;
  label: string;
  position: Coordinate;
  travelerIds: TravelerScope;
};
```

공통 철도·connector와 일본 내 핀에는 `travelerIds: null`을, 개인 구간에는 다음 매핑을 넣는다.

```ts
const DAEKYEOM = ["daekyeom"] as const;
const INCHEON_TRAVELERS = ["gyuyeol", "junsu", "gyujun"] as const;
const ICHEON_TRAVELERS = ["gyuyeol", "junsu"] as const;
const GYUJUN = ["gyujun"] as const;

// mandeok-pus, pus-kix, nrt-pus, pus-mandeok: DAEKYEOM
// suwon-icn, icn-suwon: GYUJUN
// icheon-icn, icn-icheon: ICHEON_TRAVELERS
// icn-kix, nrt-icn: INCHEON_TRAVELERS
// 일본 공통 이동: null
```

핀 라벨은 장소만 나타낸다.

```ts
mandeok: { key: "mandeok", label: "만덕터널 인근", position: place("mandeok"), travelerIds: DAEKYEOM },
suwon: { key: "suwon", label: "수원시청", position: place("suwon"), travelerIds: GYUJUN },
icheon: { key: "icheon", label: "이천시청", position: place("icheon"), travelerIds: ICHEON_TRAVELERS },
busan: { key: "busan", label: "김해국제공항", position: place("busan"), travelerIds: DAEKYEOM },
incheon: { key: "incheon", label: "인천국제공항", position: place("incheon"), travelerIds: INCHEON_TRAVELERS },
```

- [ ] **Step 4: 선·핀·stage를 한 번에 필터링하는 최소 구현**

```ts
function visibleTo(travelerIds: TravelerScope, selectedTravelerId: TravelerId | null) {
  return selectedTravelerId === null || travelerIds === null || travelerIds.includes(selectedTravelerId);
}

export function buildDayLayers(
  day: DayNumber,
  routeLines: readonly MapLine[] = FULL_ROUTE_LINES,
  schedules: Readonly<Partial<Record<string, RouteSchedule>>> = ROUTE_SCHEDULES,
  selectedTravelerId: TravelerId | null = null,
): DayLayers {
  const replacements = new Map(routeLines.map((line) => [line.key, line]));
  const selectedLines = days[day].lines
    .map((line) => replacements.get(line.key) ?? line)
    .filter((line) => visibleTo(line.travelerIds, selectedTravelerId));
  const selectedPins = days[day].pins.filter((pin) => visibleTo(pin.travelerIds, selectedTravelerId));
  const lineKeys = new Set(selectedLines.map((line) => line.key));
  const pinKeys = new Set(selectedPins.map((pin) => pin.key));
  const stages = days[day].stages.flatMap((stage) => {
    const nextLineKeys = stage.lineKeys?.filter((key) => lineKeys.has(key));
    const nextFocusPinKeys = stage.focusPinKeys?.filter((key) => pinKeys.has(key));
    if (stage.lineKeys && nextLineKeys?.length === 0) return [];
    if (stage.focusPinKeys && nextFocusPinKeys?.length === 0) return [];
    if (stage.pinKey && !pinKeys.has(stage.pinKey)) return [];
    const filtered = {
      ...stage,
      ...(nextLineKeys ? { lineKeys: nextLineKeys } : {}),
      ...(nextFocusPinKeys ? { focusPinKeys: nextFocusPinKeys } : {}),
    };
    const lineTimings = stageTiming(filtered, schedules);
    return [lineTimings ? { ...filtered, lineTimings } : filtered];
  });
  return { lines: selectedLines, pins: selectedPins, stages };
}
```

- [ ] **Step 5: Task 2 테스트와 타입 검사 통과 확인**

Run: `pnpm test --run src/trip/public.test.ts src/trip/definition.test.ts src/components/map/placeholder-routes.test.ts && pnpm typecheck`

Expected: PASS. 기존 `buildDayLayers(day)` 호출은 기본 전원 동작을 유지한다.

- [ ] **Step 6: Task 2 커밋**

```bash
git add src/trip/public.ts src/trip/public.test.ts src/trip/definition.test.ts src/components/map/placeholder-routes.ts src/components/map/placeholder-routes.test.ts
git commit -m "feat: 사람별 출입국 경로 필터 추가"
```

### Task 3: Google 지도 재생에 여행자 선택 연결

**Files:**
- Modify: `src/components/map/GoogleTripMap.tsx`
- Modify: `src/components/map/GoogleTripMap.test.tsx`

**Interfaces:**
- Consumes: Task 2의 `buildDayLayers(day, routeLines, schedules, selectedTravelerId)`와 `TravelerId`.
- Produces: `GoogleTripMap`의 `selectedTravelerId: TravelerId | null` prop; 여행자까지 포함한 재생 요청 키; 선택된 사람만 표시하는 선·핀·카메라 범위.

- [ ] **Step 1: 개인 경로 표시와 여행자 변경 취소의 실패 테스트 작성**

기존 Google Maps fake를 유지하고 모든 기존 렌더에 `selectedTravelerId={null}`을 추가한다. 새 테스트는 감소 모션으로 1일차를 끝까지 즉시 그린 뒤 정대겸 선택에는 이천·수원·인천 핀이 없음을 검사한다.

```tsx
render(
  <GoogleTripMap
    selectedTravelerId="daekyeom"
    selectedDay={1}
    playbackRequest={1}
    reducedMotion
    onPlaybackComplete={onPlaybackComplete}
  />,
);

await waitFor(() => expect(onPlaybackComplete).toHaveBeenCalledWith(1));
expect(markerTitles()).toEqual(expect.arrayContaining(["만덕터널 인근", "김해국제공항", "간사이국제공항", "교토역"]));
expect(markerTitles()).not.toEqual(expect.arrayContaining(["수원시청", "이천시청", "인천국제공항"]));
```

같은 날짜에서 `selectedTravelerId`를 `daekyeom`에서 `gyujun`으로 rerender하고 기존 재생의 예약 프레임이 취소되며 새 요청만 완료되는 테스트를 추가한다.

- [ ] **Step 2: 새 지도 테스트가 prop과 필터 미연결로 실패하는지 확인**

Run: `pnpm test --run src/components/map/GoogleTripMap.test.tsx`

Expected: FAIL because `selectedTravelerId` is not part of props, layers, request identity, marker visibility, or camera fitting.

- [ ] **Step 3: 여행자별 레이어와 요청 키 최소 구현**

```ts
type GoogleTripMapProps = {
  railRoutes?: readonly PublicRailRoute[];
  selectedTravelerId: TravelerId | null;
  selectedDay: DayNumber | null;
  playbackRequest: number;
  reducedMotion: boolean;
  onPlaybackComplete: (day: DayNumber) => void;
};

const visibleRouteLines = useMemo(
  () => selectedDay
    ? buildDayLayers(selectedDay, routeLines, ROUTE_SCHEDULES, selectedTravelerId).lines
    : routeLines,
  [routeLines, selectedDay, selectedTravelerId],
);

const requestKey = selectedDay && playbackRequest > 0
  ? `${selectedTravelerId ?? "all"}:${selectedDay}:${playbackRequest}`
  : null;
```

재생 effect의 `layers`와 `fitDay`에도 같은 여행자를 전달한다.

```ts
const layers = buildDayLayers(selectedDay, routeLines, ROUTE_SCHEDULES, selectedTravelerId);

function fitDay(
  map: google.maps.Map,
  day: DayNumber,
  routeLines: readonly MapLine[],
  selectedTravelerId: TravelerId | null,
) {
  const layers = buildDayLayers(day, routeLines, ROUTE_SCHEDULES, selectedTravelerId);
  const nextBounds = bounds([
    ...layers.lines.flatMap((line) => line.path),
    ...layers.pins.map((pin) => pin.position),
  ]);
  map.fitBounds(nextBounds, CAMERA_PADDING);
  map.setCenter(centerOf(nextBounds));
}
```

effect dependency에 `selectedTravelerId`를 포함해 변경 순간 기존 `routePlayback.cancel()` cleanup이 실행되게 한다. 선택된 stage의 `layers.pins`만 marker map에 남기는 기존 로직은 그대로 사용한다.

- [ ] **Step 4: Task 3 지도·애니메이션 테스트 통과 확인**

Run: `pnpm test --run src/components/map/GoogleTripMap.test.tsx src/components/map/animation.test.ts src/components/map/placeholder-routes.test.ts && pnpm typecheck`

Expected: PASS, including reduced-motion immediate completion and existing retry/Google geometry behavior.

- [ ] **Step 5: Task 3 커밋**

```bash
git add src/components/map/GoogleTripMap.tsx src/components/map/GoogleTripMap.test.tsx
git commit -m "feat: 사람별 지도 경로 재생 연결"
```

### Task 4: 공개 루트와 여행자 탭 중심의 활성 앱

**Files:**
- Create: `src/app/page.tsx`
- Create: `src/app/page.test.tsx`
- Modify: `src/app/t/[inviteToken]/page.tsx`
- Create: `src/app/t/[inviteToken]/page.test.tsx`
- Modify: `src/app/t/[inviteToken]/TripApp.tsx`
- Modify: `src/app/t/[inviteToken]/TripApp.test.tsx`
- Modify: `src/app/t/[inviteToken]/TripApp.play-all.test.tsx`
- Modify: `src/components/TripPanel.tsx`
- Modify: `src/components/TripPanel.module.css`

**Interfaces:**
- Consumes: Task 1의 `SharedTripPayload`·`TRAVELERS`, Task 3의 `GoogleTripMap.selectedTravelerId`.
- Produces: prop 없는 `TripApp`, 공개 `/`, 레거시 `/t/[inviteToken]` → `/` redirect, `TripPanel` 여행자 탭, 선택한 여행자를 유지하는 단일·전체 일정 재생.

- [ ] **Step 1: 활성 앱이 공개 API만 호출하는 실패 테스트로 기존 역할 테스트 교체**

`src/app/t/[inviteToken]/TripApp.test.tsx`의 payload를 공통 형태로 바꾸고 인증·역할 UI 테스트를 제거한 뒤 다음을 추가한다.

```tsx
const sharedPayload = {
  trip: PUBLIC_TRIP_DEFINITION,
  travelers: TRAVELERS,
  railRoutes: [],
};

it("loads only the public trip endpoint and renders no auth or opinion entry points", async () => {
  const fetch = vi.fn(async (input: string | URL | Request) => {
    expect(String(input)).toBe("/api/trip");
    return json(sharedPayload);
  });
  vi.stubGlobal("fetch", fetch);

  render(<TripApp />);

  expect(await screen.findByRole("tab", { name: "전원" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["전원", "정대겸", "이규열", "박준수", "한규준"]);
  expect(screen.queryByText(/관찰자|참가자|관리자/)).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: /의견|검토/ })).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: 사람 탭은 재생하지 않고 다음 일정에 적용되는 실패 테스트 작성**

지도 mock이 받은 prop을 화면에 출력하게 한다.

```tsx
GoogleTripMap: ({ selectedTravelerId, selectedDay, onPlaybackComplete }: MockProps) => (
  <>
    <output aria-label="지도 선택">{selectedTravelerId ?? "all"}:{selectedDay ?? "overview"}</output>
    <button type="button" disabled={!selectedDay} onClick={() => selectedDay && onPlaybackComplete(selectedDay)}>지도 재생 완료</button>
  </>
),
```

```tsx
fireEvent.click(await screen.findByRole("tab", { name: "정대겸" }));
expect(screen.getByLabelText("지도 선택")).toHaveTextContent("daekyeom:overview");
expect(screen.getByRole("navigation", { name: "여행 일정" })).toBeVisible();

fireEvent.click(screen.getByRole("button", { name: /1일차/ }));
await act(async () => vi.advanceTimersByTime(250));
expect(screen.getByLabelText("지도 선택")).toHaveTextContent("daekyeom:1");
```

전체 일정 테스트에는 `한규준`을 선택한 뒤 완료 콜백으로 1→5일차를 진행하는 동안 지도 prop이 계속 `gyujun`인지 검사한다. 여행자 변경 중에는 `selectedDay`가 `null`, `playbackRequest`가 `0`으로 돌아가 기존 재생을 취소하는 검사도 추가한다.

- [ ] **Step 3: 공개 루트와 레거시 redirect 실패 테스트 작성**

```tsx
// src/app/page.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./t/[inviteToken]/TripApp", () => ({ TripApp: () => <div>public-trip-app</div> }));
import Page from "./page";

describe("root page", () => {
  it("renders the public trip app", () => {
    render(<Page />);
    expect(screen.getByText("public-trip-app")).toBeInTheDocument();
  });
});
```

```ts
// src/app/t/[inviteToken]/page.test.tsx
import { describe, expect, it, vi } from "vitest";
const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));
vi.mock("next/navigation", () => ({ redirect }));
import TripPage from "./page";

describe("legacy token page", () => {
  it("redirects every old token URL to the tokenless root", () => {
    expect(() => TripPage()).toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/");
  });
});
```

- [ ] **Step 4: 새 활성 앱 테스트가 기존 prop·역할 UI 때문에 실패하는지 확인**

Run: `pnpm test --run src/app/page.test.tsx src/app/t/'[inviteToken]'/page.test.tsx src/app/t/'[inviteToken]'/TripApp.test.tsx src/app/t/'[inviteToken]'/TripApp.play-all.test.tsx`

Expected: FAIL because `/` is absent, `TripApp` requires `inviteToken`, calls token/session APIs, and `TripPanel` has no traveler tabs.

- [ ] **Step 5: `TripPanel`을 여행자 탭과 일정 선택만 남기도록 최소화**

```ts
type TripPanelProps = {
  payload: SharedTripPayload;
  selectedTravelerId: TravelerId | null;
  selectedDay: DayNumber | null;
  allDaysSelected: boolean;
  state: "open" | "closing";
  focusOnOpen: boolean;
  onSelectTraveler: (travelerId: TravelerId | null) => void;
  onSelectAll: () => void;
  onSelectDay: (day: DayNumber) => void;
  onClose: () => void;
};
```

제목 바로 아래에 `전원`과 payload의 네 여행자를 렌더링한다.

```tsx
<div className={styles.travelerTabs} role="tablist" aria-label="여행자 선택">
  {[{ id: null, name: "전원" }, ...payload.travelers].map((traveler) => {
    const selected = selectedTravelerId === traveler.id;
    return (
      <button
        key={traveler.id ?? "all"}
        type="button"
        role="tab"
        aria-selected={selected}
        tabIndex={selected ? 0 : -1}
        onClick={() => onSelectTraveler(traveler.id)}
      >
        {traveler.name}
      </button>
    );
  })}
</div>
```

역할 배지, 세션 잠금, `RejectionCards`, `OpinionComposer`, `RouteFinalizer`, `AdminReviewControls`의 import·state·렌더를 제거하고 다음 주석만 남긴다.

```tsx
{/* 의견·관리 진입점은 경로 개발에 집중하기 위해 보류했다. 사용자 요청 시 공개 의견 모델로 재설계한다. */}
```

CSS는 가로 스크롤과 44px 터치 높이를 보장한다.

```css
.travelerTabs {
  display: flex;
  gap: 6px;
  margin-top: 14px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
}
.travelerTabs button {
  min-height: 44px;
  flex: 0 0 auto;
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  background: #21262d;
  color: #f0f6fc;
  padding: 8px 11px;
}
.travelerTabs button[aria-selected="true"] {
  border-color: #58a6ff;
  background: rgba(56, 139, 253, 0.22);
}
```

- [ ] **Step 6: `TripApp`을 공통 payload와 수동 여행자 상태로 전환**

`inviteToken`, `claimError`, fragment listener와 `/api/session/claim` 호출을 제거하고 `fetch("/api/trip")`만 사용한다.

```ts
const [payload, setPayload] = useState<SharedTripPayload | null>(null);
const [selectedTravelerId, setSelectedTravelerId] = useState<TravelerId | null>(null);

const refresh = useCallback(async () => {
  const id = ++refreshId.current;
  refreshController.current?.abort();
  const controller = new AbortController();
  refreshController.current = controller;
  try {
    const response = await fetch("/api/trip", { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error("일정을 불러오지 못했습니다.");
    const nextPayload = await response.json() as SharedTripPayload;
    if (controller.signal.aborted || id !== refreshId.current) return;
    setPayload(nextPayload);
    setLoadError("");
  } catch (error) {
    if (controller.signal.aborted || id !== refreshId.current) return;
    const message = error instanceof Error ? error.message : "일정을 불러오지 못했습니다.";
    setLoadError(message);
    throw new Error(message);
  } finally {
    if (id === refreshId.current) refreshController.current = null;
  }
}, []);

function selectTraveler(travelerId: TravelerId | null) {
  const label = travelerId === null
    ? "전원"
    : payload?.travelers.find((traveler) => traveler.id === travelerId)?.name ?? "전원";
  setSelectedTravelerId(travelerId);
  setPlayingAll(false);
  setSelectedDay(null);
  setCompletedDay(null);
  setPlaybackRequest(0);
  setLiveStatus(`${label} 선택됨. 일정을 선택해 주세요`);
}
```

`selectDay`, `selectAllDays`, `playbackComplete`, `replay`의 라이브 상태에는 현재 여행자 이름 또는 `전원`을 앞에 붙인다. `GoogleTripMap`과 `TripPanel`에 `selectedTravelerId`를 전달하고 `TripApp` export는 prop을 받지 않는다.

- [ ] **Step 7: 공개 페이지와 토큰 제거 redirect 구현**

```tsx
// src/app/page.tsx
import { TripApp } from "./t/[inviteToken]/TripApp";

export default function Page() {
  return <TripApp />;
}
```

```tsx
// src/app/t/[inviteToken]/page.tsx
import { redirect } from "next/navigation";

export default function TripPage() {
  redirect("/");
}
```

- [ ] **Step 8: Task 4 컴포넌트 테스트와 타입 검사 통과 확인**

Run: `pnpm test --run src/app/page.test.tsx src/app/t/'[inviteToken]'/page.test.tsx src/app/t/'[inviteToken]'/TripApp.test.tsx src/app/t/'[inviteToken]'/TripApp.play-all.test.tsx src/components/map/GoogleTripMap.test.tsx && pnpm typecheck`

Expected: PASS. 활성 UI에서 역할·세션·의견·관리 요청과 화면이 사라지고 기존 API/컴포넌트 파일은 남아 있다.

- [ ] **Step 9: Task 4 커밋**

```bash
git add src/app/page.tsx src/app/page.test.tsx src/app/t/'[inviteToken]'/page.tsx src/app/t/'[inviteToken]'/page.test.tsx src/app/t/'[inviteToken]'/TripApp.tsx src/app/t/'[inviteToken]'/TripApp.test.tsx src/app/t/'[inviteToken]'/TripApp.play-all.test.tsx src/components/TripPanel.tsx src/components/TripPanel.module.css
git commit -m "feat: 공개 진입과 여행자 일정 탭 적용"
```

### Task 5: 루트 지도 보안 정책과 모바일 공개 흐름

**Files:**
- Modify: `next.config.ts`
- Modify: `src/security-headers.test.ts`
- Modify: `playwright.config.ts`
- Modify: `e2e/trip-flow.spec.ts`
- Modify: `e2e/desktop-gate.spec.ts`

**Interfaces:**
- Consumes: Task 4의 공개 `/`, `/api/trip`, 여행자 탭과 전체 일정 재생.
- Produces: `/`에만 Google Maps CSP 허용, 공개 흐름 Playwright 계약, 기존 `/terms`·`/privacy`의 엄격한 CSP 유지.

- [ ] **Step 1: 루트 CSP와 공개 모바일 여정의 실패 테스트 작성**

`src/security-headers.test.ts`에서 지도 전용 rule이 `/`에 존재하고 `/terms`·`/privacy`를 포괄하는 일반 정책은 완화되지 않는지 검사한다.

```ts
const rules = await nextConfig.headers?.();
expect(rules?.find(({ source }) => source === "/")).toMatchObject({
  headers: [expect.objectContaining({
    key: "Content-Security-Policy",
    value: expect.stringContaining("'unsafe-eval'"),
  })],
});
expect(buildContentSecurityPolicy({ development: false, googleMaps: false })).not.toContain("'unsafe-eval'");
```

`e2e/trip-flow.spec.ts`는 역할 흐름 대신 공개 payload 하나를 `/api/trip`에 제공하고 다음을 검증한다.

```ts
test("selects all or one traveler and starts playback only after choosing a schedule", async ({ page }) => {
  await installPublicTripApi(page);
  await page.goto("/");

  await expect(page.getByRole("tab", { name: "전원" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "정대겸" }).click();
  await expect(page.getByRole("navigation", { name: "여행 일정" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("정대겸 선택됨");
  await page.getByRole("button", { name: /1일차/ }).click();
  await expect(page.getByRole("status")).toContainText("정대겸 · 1일차");
});

test("old token URLs redirect to the tokenless root", async ({ page }) => {
  await installPublicTripApi(page);
  await page.goto("/t/any-old-value");
  await expect(page).toHaveURL(/\/$/);
});
```

API route mock은 `GET /api/trip`만 허용하며 session/opinion/admin 요청이 발생하면 테스트를 실패시킨다. `playwright.config.ts`의 readiness URL과 desktop/security E2E 진입점은 `/`로 바꾼다.

- [ ] **Step 2: 보안·E2E 테스트가 기존 `/t/*` 기준 때문에 실패하는지 확인**

Run: `pnpm test --run src/security-headers.test.ts && pnpm exec playwright test e2e/trip-flow.spec.ts e2e/desktop-gate.spec.ts`

Expected: unit test FAIL until the root map rule exists; E2E FAIL until all fixtures and navigation use the public root.

- [ ] **Step 3: `/`에만 기존 Google Maps CSP 적용**

`next.config.ts`의 일반 엄격 정책 뒤에 정확한 루트 rule을 둔다. 레거시 `/t/:path*` rule은 redirect 응답 호환을 위해 유지해도 되며 `/terms`·`/privacy`에는 지도 정책을 추가하지 않는다.

```ts
{
  source: "/",
  headers: [{
    key: "Content-Security-Policy",
    value: buildContentSecurityPolicy({ development, googleMaps: true }),
  }],
},
```

- [ ] **Step 4: 공개 E2E fixture와 진입점 최소 구현**

```ts
async function installPublicTripApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/trip") {
      await route.fulfill({ json: { trip: PUBLIC_TRIP_DEFINITION, travelers: TRAVELERS, railRoutes: [] } });
      return;
    }
    throw new Error(`unexpected active API request: ${request.method()} ${url.pathname}`);
  });
}
```

`playwright.config.ts`의 `webServer.url`, `e2e/desktop-gate.spec.ts`의 앱 URL과 CSP 응답 URL을 모두 `/`로 바꾼다. 법적 페이지 검사는 내용 변경 없이 그대로 둔다.

- [ ] **Step 5: Task 5 unit·E2E 통과 확인**

Run: `pnpm test --run src/security-headers.test.ts && pnpm exec playwright test e2e/trip-flow.spec.ts e2e/desktop-gate.spec.ts`

Expected: PASS. 모바일 공개 루트, 사람 탭, 일정 선택, 레거시 redirect, 데스크톱 gate, noindex와 CSP가 모두 검증된다.

- [ ] **Step 6: Task 5 커밋**

```bash
git add next.config.ts src/security-headers.test.ts playwright.config.ts e2e/trip-flow.spec.ts e2e/desktop-gate.spec.ts
git commit -m "test: 공개 여행 진입과 보안 정책 검증"
```

### Task 6: 운영 문서 갱신과 전체 회귀 검증

**Files:**
- Modify: `README.md`
- Modify: `docs/SESSION_HANDOFF.md`

**Interfaces:**
- Consumes: Tasks 1–5에서 검증된 활성 공개 앱 동작과 로컬 브랜치 상태.
- Produces: 다음 세션이 토큰·역할 UI를 활성 기능으로 오해하지 않도록 하는 현재 운영 문서.

- [ ] **Step 1: README의 활성 앱 설명을 공개 경로 기준으로 교체**

README 첫 문단과 범위·로컬 실행·운영 섹션에 다음 사실을 명시한다.

```markdown
- 활성 앱 주소는 토큰 없는 `/`이며 모든 사용자가 같은 공통 일정을 본다.
- 좌측 패널에서 전원 또는 네 사람을 수동 선택한 뒤 1~5일차나 전체 일정을 재생한다.
- 의견·역할·관리 UI는 경로 작업을 위해 보류되어 활성 앱에서 호출되지 않는다.
- 기존 인증·의견 API와 Supabase 데이터는 삭제하지 않고 보존한다.
- `production`은 공개 복구 기준 `d6e6290`, `develop`은 현재 기능 개발 브랜치다.
- 이 작업은 원격 push나 Vercel 배포를 수행하지 않는다.
```

개인 링크 발급 절차와 역할 흐름은 “레거시 보존 백엔드”로 명확히 구분하고 현재 접속 방법으로 안내하지 않는다. 지도 환경변수와 service-role 서버 전용 원칙은 유지한다.

- [ ] **Step 2: 인계 문서를 현재 브랜치와 보류 범위로 갱신**

`docs/SESSION_HANDOFF.md`의 재개 명령은 `git switch develop`을 사용하고 다음 우선순위를 기록한다.

```markdown
1. `develop`에서 공개 루트와 사람별 경로 테스트를 다시 실행한다.
2. 사용자 요청 전에는 의견·관리 UI나 개인 토큰 진입을 다시 활성화하지 않는다.
3. 사용자 승인 전에는 `develop`을 push하거나 Vercel Production에 배포하지 않는다.
4. 기존 Supabase migration과 Production 의견·세션 데이터는 삭제하지 않는다.
```

확정 경로에는 만덕터널 인근, 이천시청, 수원시청 출·도착과 KIX→NRT 공통 구간을 기록한다. 기존 `/privacy`·`/terms` 페이지는 이번 변경과 무관함을 적는다.

- [ ] **Step 3: 문서에 활성 기능과 충돌하는 표현이 남지 않았는지 검색**

Run: `rg -n "현재 기능 브랜치는|공유 주소는 /t|개인 역할 활성|관찰자.*활성|Production Branch.*main" README.md docs/SESSION_HANDOFF.md`

Expected: no matches that describe the token/role flow as the active app. Historical backend notes may contain the terms only when explicitly labeled dormant or legacy.

- [ ] **Step 4: 전체 unit/component 회귀 검증**

Run: `pnpm test --run`

Expected: all Vitest tests PASS, including untouched legacy auth/opinion/backend tests.

- [ ] **Step 5: 정적 검사와 Production build 검증**

Run: `pnpm typecheck && pnpm lint && pnpm build`

Expected: all commands exit 0; route manifest includes `/`, `/api/trip`, `/t/[inviteToken]`, `/privacy`, and `/terms`.

- [ ] **Step 6: 전체 브라우저 회귀 검증**

Run: `pnpm exec playwright test`

Expected: all Playwright tests PASS at mobile and explicit desktop viewport sizes without real external API or deployment changes.

- [ ] **Step 7: 변경 범위와 비밀값 누출 점검**

Run: `git diff production...develop --stat && git diff --check && git status --short && git log --oneline --decorate -8`

Expected: only planned source/test/docs changes; no `.env*`, token values, generated Playwright artifacts, DB migration, privacy/terms edits, push, or deployment changes.

- [ ] **Step 8: Task 6 커밋**

```bash
git add README.md docs/SESSION_HANDOFF.md
git commit -m "docs: 공개 여행 운영 기준 갱신"
```
