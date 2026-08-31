# Route animation design QA

## Comparison target

- Product state: observer session, mobile map, day panel collapsed, selected rail segment playing.
- Implementation viewport: 390 × 844 CSS px, device scale factor 1; every implementation capture is 390 × 844 px.
- The references are Google Maps route crops rather than complete app screens. App chrome, portrait crop, Google base-map labels, and live tile placement are therefore intentional product/runtime differences; the comparison target is the selected route corridor, endpoints, core/outline color, and playback direction.

## Source visual truth and rendered evidence

| Segment | Source truth | Source pixels | Implementation | Side-by-side comparison |
| --- | --- | ---: | --- | --- |
| JR Haruka | `/Users/daekyeomjung/Desktop/간사이 국제공항 -> 교토역 이동.png` | 1170 × 1430 | `/private/tmp/japan-route-ui-haruka.png` | `/private/tmp/japan-route-qa-haruka.png` |
| Tokaido Shinkansen | `/Users/daekyeomjung/Desktop/교토역 -> 오다와라 역 신칸센.png` | 1658 × 574 | `/private/tmp/japan-route-ui-shinkansen.png` | `/private/tmp/japan-route-qa-shinkansen.png` |
| Hakone Tozan | `/Users/daekyeomjung/Desktop/오다와라 -> 하코네유모토.png` | 1520 × 838 | `/private/tmp/japan-route-ui-hakone.png` | `/private/tmp/japan-route-qa-hakone.png` |
| Tokaido Main Line | `/Users/daekyeomjung/Desktop/오다와라 -> 우에노.png` | 1468 × 1102 | `/private/tmp/japan-route-ui-odawara-ueno.png` | `/private/tmp/japan-route-qa-odawara-ueno.png` |
| Keisei Skyliner | `/Users/daekyeomjung/Desktop/우에노역 -> 나리타 국제공항.png` | 1862 × 402 | `/private/tmp/japan-route-ui-skyliner.png` | `/private/tmp/japan-route-qa-skyliner.png` |

All side-by-side canvases are 1200 × 900 px and contain the source and rendered implementation in one comparison input. No density resampling was used; each image is aspect-fitted without stretching.

## Full-view and focused comparison evidence

- Full mobile views confirm that the Codex-style panel closes, the selected-day legend remains readable, endpoint labels remain above the map, and replay/status controls do not obstruct the active corridor.
- The same side-by-side canvases serve as focused comparisons because each source is already a route-only map crop. They show the selected core and dark outline together, literal start/end stations, the reference corridor bends, and forward draw direction.
- The reverse Hakone leg reuses the exact Odawara–Hakone points in reverse order, so a second source crop is not required.

## Required fidelity surfaces

- Fonts and typography: the source does not define app typography. Existing app typography remains coherent and legible at 390 px; station labels and the compact route legend do not clip.
- Spacing and layout rhythm: top controls retain safe spacing and 44 px targets. Mixed landscape source crops necessarily become a wider geographic view on a portrait phone without changing endpoints.
- Colors and tokens: sampled route core/outline pairs are rendered without the previous whole-map CSS filter, so the supplied blue, navy, and orange colors are not post-processed.
- Image quality and asset fidelity: Google remains the live base map; no screenshot is shipped as a fake map asset. Temporary tile changes are external map behavior, and route overlays remain vector polylines.
- Copy and content: the five supplied train names are present. Day 3 now ends at Ueno and no longer claims a separate Tokyo-to-Ueno Yamanote playback.
- Interaction and accessibility: day selection closes the panel, playback runs once, replay works, later selection cancels the previous animation, reduced motion renders completed paths, and only the first/final labels remain after completion.

## Findings

- No actionable P0, P1, or P2 visual mismatch remains for the supplied route-reference scope.
- P3: the full-trip background lines remain faintly visible behind a selected day because the established product behavior retains the whole journey. They can be further muted in a later polish pass if the selected segment should become the only visible route.
- P3: Google base-map labels differ from the supplied crops as zoom, locale, and tile data change. Custom station labels are intentionally limited to the active segment endpoints.

## Comparison history

1. Initial comparison found a P1 camera error: focus bounds changed zoom but left the center near the full restriction midpoint. The focus helper now explicitly centers every segment after fitting it. Post-fix evidence: `/private/tmp/japan-trip-skyliner-resumed-900.png` and the five final implementation captures above.
2. Initial comparison found a P2 label error: focus-only stages caused intermediate transfer labels to survive completion. Terminal labels now derive only from line/pin stages, leaving the literal first departure and final arrival.
3. Initial comparison found a P2 color error: a CSS filter altered the sampled route colors along with the Google map. The filter was removed; post-fix evidence is the five 1200 × 900 side-by-side canvases above.
4. Final comparison found no remaining P0/P1/P2 issue. The portrait crop and animated partial line are expected differences from the static source crops.

## Browser verification

- Primary interactions tested: initial overview, all five day buttons, 250 ms panel close, sequential segment focus, one-shot Motion playback, replay, day-switch cancellation, current endpoint labels, and Day 5 return-flight transition.
- Browser console checked after playback: no errors or warnings.
- Google map failure/reduced-motion behavior remains covered by automated component tests.

final result: passed
