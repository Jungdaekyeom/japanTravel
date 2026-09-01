# Task 2 report — Day 5 and overview camera framing

## Implementation

- Kept the Korea–Japan restriction coordinates and changed the map to soft bounds (`strictBounds: false`) with `minZoom: 4`.
- Changed the all-days overview `fitBounds` padding from 36px to the existing 54px camera padding. The overview still calls only `fitBounds`; it does not recenter or move the camera afterward.
- Kept focus cameras calculated from `map.getDiv()` at the start of each focus stage. The only padding exception is the two-pin `ueno`/`nrt` focus, which uses 48px; all other focus stages retain 54px.
- Kept the existing move-camera interpolation, animation stages and durations, traveler filtering, reduced-motion completion path, and no-mid-animation-`fitBounds` behavior unchanged.

## Changed files

- `src/components/map/GoogleTripMap.tsx`
- `src/components/map/GoogleTripMap.test.tsx`

## RED

Command:

```sh
COREPACK_HOME=/private/tmp/japanTravel-corepack-10.15 corepack pnpm@10.15.0 exec vitest run src/components/map/GoogleTripMap.test.tsx
```

Output summary before the production edit:

```text
❯ src/components/map/GoogleTripMap.test.tsx (30 tests | 10 failed)
× uses a soft Korea-Japan restriction and 54px overview bounds at 320x568
× uses a soft Korea-Japan restriction and 54px overview bounds at 360x800
× uses a soft Korea-Japan restriction and 54px overview bounds at 390x844
× uses a soft Korea-Japan restriction and 54px overview bounds at 430x932
× uses a soft Korea-Japan restriction and 54px overview bounds at 767x1024
× fits every Day 5 focus endpoint in the viewport at 320x568 without a motion bounds jump
× fits every Day 5 focus endpoint in the viewport at 360x800 without a motion bounds jump
× fits every Day 5 focus endpoint in the viewport at 390x844 without a motion bounds jump
× fits every Day 5 focus endpoint in the viewport at 430x932 without a motion bounds jump
× fits every Day 5 focus endpoint in the viewport at 767x1024 without a motion bounds jump

AssertionError: expected true to be false
AssertionError: expected 8.919591240912785 to be close to 8.99902570840719
```

The first post-edit test run isolated a hand-entered overview north-bound fixture error; the actual route curve value is `37.586560000000006`, which was corrected in the test literal before the final GREEN run.

## GREEN

Focused map tests:

```sh
COREPACK_HOME=/private/tmp/japanTravel-corepack-10.15 corepack pnpm@10.15.0 exec vitest run src/components/map/GoogleTripMap.test.tsx
```

```text
Test Files  1 passed (1)
Tests  30 passed (30)
Duration  1.68s
```

Type check:

```sh
COREPACK_HOME=/private/tmp/japanTravel-corepack-10.15 corepack pnpm@10.15.0 typecheck
```

```text
> tsc6 --noEmit
```

Exited with status 0.

## Width matrix evidence

The map harness sets the current map element dimensions before each render. For every row below, tests assert soft restriction/minimum zoom 4, the exact overview route bounds with 54px padding, no overview camera recenter, all Day 5 focus endpoints projected inside the padded viewport, the 48px Ueno–NRT target, the two remaining 54px targets, and no `fitBounds` call while Day 5 motion runs.

| Map element | Result |
| --- | --- |
| 320×568 | pass |
| 360×800 | pass |
| 390×844 | pass |
| 430×932 | pass |
| 767×1024 | pass |

## Self-review

- The change is limited to the requested map camera behavior and its focused component test.
- The Korea–Japan coordinate restriction remains intact; only its strictness changes.
- The test uses the actual emitted `moveCamera` target and independently projects each relevant pin to screen coordinates; it will fail for an incorrect padding, target zoom, or camera-center calculation.
- Existing tests continue to cover the reduced-motion route fit and non-Day-5 camera transitions. The focused suite remains fully green.
- `git diff --check` is clean and TypeScript type checking passes.

## Concerns

None. Google Maps is mocked in this component suite, so visual marker-label extents are represented by the approved padding contract rather than rendered Google marker DOM measurements.
