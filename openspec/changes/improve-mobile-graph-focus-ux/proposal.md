## Why

On narrow screens, fitting a focused graph neighborhood can shrink useful node geometry into an unreadable line because full, fixed-pixel labels control the camera scale. The persistent focus card also covers a large part of the graph without contributing its height to the usable viewport calculation.

## What Changes

- Make reader-triggered graph fitting prioritize visible node markers and a readable camera scale instead of zooming out until every full label fits.
- Select and shorten canvas labels at the fitted mobile overview while keeping the focused note's full title available in the focus UI.
- Replace the tall mobile focus card with a compact, expandable focus bar that keeps the primary note action visible and moves secondary actions and connected-domain details behind disclosure.
- Fit focused neighborhoods within the unobscured graph area above the focus bar and around other graph overlays.
- Require before-and-after mobile screenshots in this change directory, visual review of those screenshots, and a pause for user confirmation when the result is not clearly readable and space-efficient.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `graph-explorer`: Change reader-controlled fitting, progressive mobile labels, and focused-neighborhood presentation so mobile focused views remain readable and preserve graph space.

## Impact

- Affects graph fit measurement and camera limits in `src/lib/graph-fit.ts` and related motion integration.
- Affects focused label selection and focus UI state in `src/lib/graph-view.ts`.
- Affects focus panel markup in `src/components/GlobalGraph.astro` and responsive styles in `src/styles/global.css`.
- Extends graph fit, interaction, and browser-level visual verification. No new runtime dependency or public data-format change is expected.
