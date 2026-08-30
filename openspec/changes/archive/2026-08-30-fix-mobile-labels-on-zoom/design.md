## Context

See `proposal.md` for motivation and `specs/graph-explorer/spec.md` for observable behavior. Sigma 3.0.3 indexes label candidates in a fixed screen-space grid, chooses candidates by node size and density, and only afterwards discards candidates outside the current viewport. On a phone, the global graph's current 400 CSS pixel grid cell spans approximately the entire width, so zooming can leave visible nodes unlabelled while selected candidates move offscreen.

The fitted mobile graph must still satisfy the existing readable-composition requirement. Forcing every label at every zoom level would restore titles but recreate the overlap and over-fitting behavior that mobile label selection previously removed.

## Goals / Non-Goals

**Goals:**

- Distribute overview label candidates more evenly across narrow graph viewports.
- Reveal all eligible visible titles only once a narrow graph is substantially zoomed in.
- Keep global and local graphs consistent and return to selective rendering when zooming out.
- Refresh Sigma's reducers only when crossing the reveal threshold, not on every camera frame.

**Non-Goals:**

- Replacing Sigma's label renderer or implementing custom text collision detection.
- Changing desktop label density, graph layout, fitting, typography, or node visibility.
- Making a single title wider than the viewport fit without clipping or panning.

## Decisions

### Use a 180 CSS pixel narrow label grid

Global and local graphs use a 180 CSS pixel label-grid cell on narrow viewports. This retains Sigma's size-prioritized selection while creating multiple horizontal candidate regions on a typical phone. It also removes the unexplained difference between the global graph's 400 pixel override and the local graph's existing 180 pixel setting.

Using the desktop 100 pixel grid would render more labels in the fitted overview and increase overlap risk. Keeping 400 pixels would preserve the reported failure.

### Switch to forced labels at camera ratio 0.75

A shared policy considers a narrow graph substantially zoomed at a Sigma camera ratio of 0.75 or less. At that point node reducers set `forceLabel` for nodes with titles. Sigma still performs viewport clipping, so offscreen labels are not drawn, while the label grid can no longer choose an offscreen candidate instead of a visible title.

An absolute threshold is preferable to tracking gesture history or the fitted camera state: it is deterministic across restored sessions, fit actions, global graphs, and local graphs. The threshold remains disabled on desktop.

### Reprocess only when the threshold state changes

Each renderer listens to camera updates, compares the new reveal state with the previous state, and reapplies reducers only on a false-to-true or true-to-false transition. This avoids graph reprocessing for every wheel, pinch, pan, or animation frame. Renderer teardown removes the listener.

### Lift narrow title-width omission only in detailed zoom

The fitted global overview continues omitting titles that exceed its conservative narrow-view width allowance. Detailed zoom bypasses that omission and lets Sigma draw the title; viewport clipping and panning remain the normal boundary behavior.

## Risks / Trade-offs

- [Many nodes remain tightly clustered after zoom] -> Titles can overlap once detailed reveal is active; the threshold delays full rendering until nodes have materially separated, while readers can continue zooming or panning.
- [A graph's useful detail level differs from the fixed threshold] -> Keep the threshold in one tested shared policy so it can be adjusted without changing renderer wiring.
- [Forced labels increase rendering work] -> Restrict the behavior to narrow viewports and detailed zoom, where fewer nodes are normally onscreen, and update reducers only at threshold crossings.

## Migration Plan

No data or dependency migration is required. Deploy the renderer policy and tests together. Rollback restores the former 400 pixel global mobile grid and removes zoom-triggered forced labels without affecting persisted graph data or sessions.
