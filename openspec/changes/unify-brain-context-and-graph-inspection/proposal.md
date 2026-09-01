## Why

Combined graphs currently spend scarce graph space on a long context banner, while a global Brain selector competes with note titles on pages where changing the selected set has no in-place effect. Dense neighborhood inspection also leaves unrelated titles competing with the notes a reader is trying to follow. Browser zoom can expose unstable hover behavior in the large graph, so the global and note-page graph experiences need one clear, cross-device interaction model.

## What Changes

- Remove Brain selection from shared navigation and restore the navigation launcher as its own compact pill.
- Show a note's owning Brain in note metadata alongside type, status, and tags.
- Make one Brain selector the rightmost segment of the left full-graph control pill, keep its accessible name synchronized with the selection, and remove the separate full-width combined-context banner.
- During node inspection, retain markers and titles for the inspected node and its immediate neighbors while hiding unrelated titles and fading unrelated markers and edges.
- Treat rendered graph titles as pointer targets so moving across a long highlighted title does not end inspection; retain equivalent touch inspection behavior.
- Coalesce responsive graph updates so browser zoom, including Microsoft Edge zoom near responsive breakpoints, cannot trigger competing graph settles or hover oscillation.
- Require reviewable before-and-after captures for phone standalone presentation, desktop inspection, and Edge browser zoom under `screenshots/` inside this change directory.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `brain-workspaces`: Show Brain ownership in note metadata and keep Brain selection out of shared navigation.
- `graph-explorer`: Put canonical Brain selection in the full graph controls, remove the permanent combined-context overlay, and revise neighborhood inspection so unrelated titles are hidden while highlighted titles remain readable and interactive.
- `graph-interaction-stability`: Extend stable inspection targets across rendered titles and require stable large-graph hover under browser zoom.
- `responsive-graph-motion`: Coalesce resize and responsive-policy changes into one coordinated graph update.

## Impact

- Affects shared navigation, note metadata, combined graph routing, graph controls, graph reducers, label hit testing, responsive settling, and graph fit insets.
- Revises the recently established rule that unrelated labels remain visible during inspection; they will now disappear while their node markers remain as orientation context.
- Adds focused component, unit, and Playwright coverage, including Microsoft Edge or equivalent Chromium browser-level zoom coverage.
- Adds review artifacts beneath `openspec/changes/unify-brain-context-and-graph-inspection/screenshots/` with capture metadata.
- Adds no runtime dependency and changes no generated note URLs or Markdown contracts.
