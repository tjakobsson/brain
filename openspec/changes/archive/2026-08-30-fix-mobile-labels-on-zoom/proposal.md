## Why

Sigma's screen-space label grid can continue selecting only a few titles after a reader zooms into a graph on mobile, including candidates that have moved offscreen. Visible nodes are consequently left without titles even when zooming has created enough room to render them.

## What Changes

- Use a finer label-selection grid for narrow global graphs so candidates are distributed across the phone viewport.
- Keep the fitted mobile overview collision-managed, then reveal every eligible visible title once the reader zooms in substantially.
- Apply the zoom behavior consistently to global and note-page local graphs, including titles normally omitted only because of narrow-view width limits.
- Add regression coverage for the responsive label-grid policy and zoom threshold.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `graph-explorer`: Require mobile graph titles to become available as the reader zooms in without making the fitted overview unreadable.

## Impact

- Affects Sigma settings and node reducers in `src/lib/graph-view.ts` and shared graph-label policy in `src/lib/graph-style.ts`.
- Extends graph rendering tests; no API, data, route, dependency, or migration changes.
