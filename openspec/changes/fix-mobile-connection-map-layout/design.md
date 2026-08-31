## Context

The global graph uses `GraphMotionController` and the layout worker to settle active nodes, adapt positions to the renderer dimensions, and coordinate node and camera movement. A note-page connection map instead builds a subset with inherited global coordinates and calls `fitRenderedGraph`; fitting contains the outer rendered bounds but cannot create separation within a clustered subset. Local maps also lack a `ResizeObserver`, so same-breakpoint dimension changes do not trigger composition updates.

The existing worker pipeline, rendered-bounds fitter, local label reveal lifecycle, and interaction wiring constrain the implementation. See `proposal.md` for motivation and `specs/responsive-graph-motion/spec.md` for required behavior.

## Goals / Non-Goals

**Goals:**

- Reuse the established responsive layout and coordinated fitting behavior for local neighborhoods.
- Keep the current note spatially anchored while surrounding notes adapt to each map's dimensions.
- Respond to actual local container changes without duplicate resize work.
- Retain local label reveal state and existing graph interactions after automatic settling.

**Non-Goals:**

- Redesign graph labels, controls, neighborhood membership, or map height.
- Add collision detection to the camera fitter.
- Persist local compositions across pages or browser sessions.
- Change global graph behavior.

## Decisions

### Reuse the motion controller for local maps

Instantiate the existing motion controller with each local graph and its neighborhood data, then request an initial settle using all local node IDs and the current note as the pinned node. This keeps worker-based layout computation, portrait adaptation, reduced-motion behavior, cancellation, and coordinated fitting consistent with the main graph.

The alternative was a local-only radial or collision layout. That would duplicate layout policy, make local maps visually unrelated to the full graph, and create a second responsive implementation to maintain.

### Observe local graph container dimensions

Attach a `ResizeObserver` to each local host and use the existing resize-settling debounce path to resize the renderer and request a responsive settle only after dimensions stabilize. Media-query changes continue to update label density, but container dimensions become the source of truth for layout changes.

The alternative was listening only to window resize or the existing 700px breakpoint. Neither detects all article/container changes, and both can miss orientation or layout changes that remain within one breakpoint.

### Separate manual fitting from automatic composition

Keep Fit view as a camera-only action over the current local positions. Initial load and container resize trigger responsive settling; manual fitting does not rerun layout. This preserves the control's established meaning and avoids surprising node movement when a reader only wants to recover the overview.

### Preserve local label fit bookkeeping

Record the fitted camera ratio after both automatic coordinated fits and manual fits so narrow-screen label reveal remains relative to the latest overview. Extend the motion completion hook if needed rather than bypassing the local label controller.

## Risks / Trade-offs

- [Small local graphs may move more than readers expect on load] -> Pin the current note and begin from deterministic inherited coordinates to preserve spatial continuity.
- [A resize observer can trigger from renderer-driven layout changes] -> Debounce dimension changes and ignore unchanged dimensions through the shared resize-settling mechanism.
- [Motion completion and label fit bookkeeping can race] -> Cancel superseded motion and update the fitted ratio only for the current completed fit.
- [Worker startup adds overhead per local map] -> Note pages normally mount one small map, and the bounded shared worker path keeps computation off the main thread.

## Migration Plan

No data migration is required. Deploy the client behavior and tests together; rollback consists of reverting the local motion integration while leaving graph data and routes unchanged.
