## Why

The graph currently renders fixed build-time coordinates, so it appears abruptly and does not adapt its composition when the viewport, filters, or dragged nodes change. A controlled live layout can make the graph feel responsive while preserving the stable spatial structure users rely on.

## What Changes

- Animate graph nodes from deterministic build-time positions into a settled live layout.
- Run browser-side settling off the main thread and stop automatically once movement is negligible or a time limit is reached.
- Refit and briefly resettle the graph after viewport changes, filtering, and node dragging.
- Preserve deterministic positions as the baseline so repeated visits do not produce unrelated layouts.
- Disable nonessential graph motion when the user requests reduced motion.
- Keep large vaults responsive by bounding simulation work and avoiding continuous animation.

## Capabilities

### New Capabilities

- `responsive-graph-motion`: Controlled graph settling, viewport adaptation, interaction-triggered motion, and reduced-motion behavior.

### Modified Capabilities

None.

## Impact

- Browser graph rendering and interaction logic in `src/lib/graph-view.ts`.
- Graph layout tests and browser-level verification for motion lifecycle behavior.
- Uses the existing Graphology ForceAtlas2 dependency and worker entry point; no new runtime dependency is expected.
