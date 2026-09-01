# Task 1 report: start the itinerary panel closed

## Implementation

- Initialized `MobileTripApp` with `panelOpen` set to `false`.
- Added an explicit `restoreOpenerFocus` ref so the opener receives focus only after the user activates the panel close control. Initial successful loading and selection-driven closing do not restore focus.
- Kept the existing opener behavior: opening renders and focuses the close control without fetching or starting playback.
- Updated the unit, all-days playback, and Playwright flows so selecting an itinerary day first opens the panel.

## Files changed

- `src/app/t/[inviteToken]/TripApp.tsx`
- `src/app/t/[inviteToken]/TripApp.test.tsx`
- `src/app/t/[inviteToken]/TripApp.play-all.test.tsx`
- `e2e/trip-flow.spec.ts`

## TDD evidence

### RED

Command:

```sh
COREPACK_HOME=/private/tmp/japanTravel-corepack-10.15 corepack pnpm@10.15.0 test --run 'src/app/t/[inviteToken]/TripApp.test.tsx' 'src/app/t/[inviteToken]/TripApp.play-all.test.tsx'
```

Result before production changes: exit 1; 5 tests failed and 2 passed. The new initial-state/opening/focus tests failed because the itinerary panel was rendered open and the opener did not exist. Existing selection tests also failed after being updated to require opening first. This was the expected missing-feature failure.

### GREEN

Command:

```sh
COREPACK_HOME=/private/tmp/japanTravel-corepack-10.15 corepack pnpm@10.15.0 test --run 'src/app/t/[inviteToken]/TripApp.test.tsx' 'src/app/t/[inviteToken]/TripApp.play-all.test.tsx'
```

Result: exit 0; 2 test files passed, 7 tests passed.

Relevant browser command:

```sh
COREPACK_HOME=/private/tmp/japanTravel-corepack-10.15 corepack pnpm@10.15.0 e2e e2e/trip-flow.spec.ts
```

Result: exit 0; 2 Playwright tests passed. The flow verifies initial closure, opener-to-close-control focus, close-to-opener focus restoration, reopening, and selected-day playback.

`git diff --check` also completed with exit 0.

## Requirement review and self-review

- Initial state is closed with `selectedDay` still `null`, `playbackRequest` still `0`, map overview still mounted, opener copy unchanged, and live status unchanged.
- A successful initial load no longer focuses the opener.
- The opener retains its existing open/focus behavior and does not invoke `refresh` or playback.
- Only close-control activation requests focus restoration; selection-driven closes leave focus restoration disabled.
- Unit coverage includes initial closure/focus, overview map/state, open focus/no refetch/no playback, close restoration, stale refresh, single-day playback, and all-days playback. Playwright covers the corresponding user flow.
- No unrelated refactors, deployment, or pushes were made.

## Concerns

- Playwright's `webServer.command` is `pnpm dev`, so its child server reported the environment's Node 24.19.0 and pnpm 11.19.0 despite the outer verification command using the requested Corepack pnpm 10.15 wrapper. The focused browser suite passed; the warning reflects existing Playwright configuration rather than this task's code.
