## Context

See `proposal.md` for motivation and `specs/graph-explorer/spec.md` for the revised behavior contract. The v1.2.2 implementation uses a fixed Sigma camera ratio of `0.75` for both global and local graphs. Sigma camera ratios are relative to the renderer's custom bounding box and fit correction, not a universal zoom scale. A local neighborhood can therefore be meaningfully enlarged while its ratio remains above the absolute threshold.

The current browser test confirms only that the local graph screenshot changes after a wheel event. It does not compare eligible visible nodes with displayed titles, so the reported failure passed CI.

## Goals / Non-Goals

**Goals:**

- Define local detailed zoom relative to each connection map's latest fitted ratio.
- Keep selective labels at initial fit and after Fit view.
- Prove that eligible visible local nodes gain titles after relative zoom and lose forced titles on return to fit.
- Preserve the released global graph threshold and interaction behavior.

**Non-Goals:**

- Retuning global graph labels or changing Sigma's renderer.
- Forcing all local labels in the fitted overview.
- Changing local neighborhood derivation, graph dimensions, layout, or navigation.

## Decisions

### Track a fitted ratio per local renderer

Each local graph records the camera ratio produced by its latest completed fit. While calculating a new fit, it preserves that baseline but suppresses forced-label state so fitting measures the selective overview. The previous baseline resumes as soon as synchronous planning ends, keeping zoom labels available if the camera animation is interrupted. Initial non-animated fit records its new baseline immediately. Animated Fit view replaces it in the fit completion callback.

Using the renderer's configured minimum or maximum ratio was rejected because those limits do not represent the visual overview. Using the first camera state was rejected because Sigma starts at a generic state before project fitting runs.

### Reveal local labels by relative zoom

A local graph enters detailed-title mode when its current camera ratio is at most 75 percent of its recorded fitted ratio. The comparison uses division or multiplication only after a positive fitted ratio exists. This keeps the threshold deterministic while adapting to different custom bounding boxes, host sizes, and neighborhood topology.

The global graph retains the released absolute `0.75` behavior. A dedicated local policy avoids changing the main graph while making the distinction explicit and testable.

### Keep threshold transitions event-driven

The local camera listener compares the next reveal state with the previous state and refreshes reducers only when the state changes. Updating the fitted baseline also recomputes the reveal state once. Teardown continues removing the listener.

### Assert displayed titles in browser coverage

Local graphs expose their displayed-label count and latest fitted ratio, extending the existing global graph diagnostics. A narrow browser fixture uses a neighborhood whose fitted ratio stays above the old absolute threshold, zooms by a known fraction of the fitted view, and verifies all eligible on-screen titles are displayed. Fit view then verifies the count returns to the collision-selected overview subset at the original fitted ratio. Focused lifecycle coverage verifies that the previous baseline resumes when an animated fit never calls its completion callback. Existing screenshot, scrolling, pan, tap, and bounds assertions remain.

## Risks / Trade-offs

- [A fit calculation includes forced detailed labels] -> Preserve the previous baseline but suppress forced-label state during synchronous planning, then record the new baseline only when fitting completes.
- [A reader interrupts the fit animation] -> Resume the previous completed baseline immediately after planning so zoom labels do not depend on the canceled completion callback.
- [A very dense local cluster still overlaps after relative zoom] -> Keep the 75 percent threshold and allow further zoom; the fitted overview remains selective.
- [Displayed-label diagnostics become stale] -> Update them from Sigma's `afterRender` event and remove the listener during renderer teardown.
- [Regression test depends on incidental demo layout] -> Use controlled graph data and assert camera-relative behavior rather than fixed pixel positions or screenshots alone.

## Migration Plan

No data or dependency migration is required. Ship the local camera baseline, diagnostics, and browser regression together. Rollback restores the absolute local threshold while leaving the main graph and persisted content unchanged.
