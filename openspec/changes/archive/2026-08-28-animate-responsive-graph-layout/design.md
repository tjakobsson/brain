## Context

See `proposal.md` for motivation and `specs/responsive-graph-motion/spec.md` for behavior. The global graph currently receives deterministic ForceAtlas2 coordinates generated during the Astro build. Sigma renders those positions and fits the camera once. Filters hide nodes without changing layout, resize behavior relies on Sigma's canvas resize, and dragging directly mutates positions.

The earlier graph contract requires stable build-time positions for spatial memory and smooth interaction at 2,000 notes. A browser layout therefore cannot run forever or produce a different result from timing differences on every visit.

## Goals / Non-Goals

**Goals:**

- Keep the build-time coordinates as a recognizable baseline.
- Produce deterministic target positions for initial and filter-triggered settling.
- Adapt graph spread and camera framing to portrait, landscape, and resized containers.
- Keep expensive force calculations off the main thread.
- Cancel stale work when a newer interaction supersedes it.

**Non-Goals:**

- Continuous ambient motion after the graph settles.
- Physics animation for compact local graphs on note pages.
- Persisting reader-adjusted layouts across browser sessions or vault rebuilds.
- Adding a new graph or animation dependency.

## Decisions

### Compute targets in a dedicated worker, then animate on the main thread

A module worker will reconstruct the active Graphology graph and run the existing ForceAtlas2 implementation for a fixed, size-dependent iteration budget. It returns target coordinates as plain data. The browser interpolates the rendered graph from its current coordinates to those targets with `requestAnimationFrame` and an ease-out curve.

Fixed iterations produce repeatable targets for the same vault, active filters, and viewport class. Computing targets before animation also avoids a timed worker supervisor whose final positions depend on scheduling. The alternative, running ForceAtlas2 directly against the rendered graph, gives more organic live physics but weakens repeatability and makes cancellation harder.

### Treat viewport shape as an explicit layout input

The controller derives a bounded aspect transform from the graph host dimensions. After force layout, it centers the result and scales its x/y spread toward the available aspect ratio, with clamping to prevent extreme distortion. Portrait and landscape therefore receive different deterministic targets while keeping cluster topology recognizable.

A `ResizeObserver` watches the graph host. Resize events are debounced, and only changes that cross a meaningful size threshold request new targets. This avoids restart loops caused by mobile browser chrome and small canvas adjustments.

### Use one cancellable motion controller

The global graph owns one controller with a monotonically increasing generation token. Initial load, resize, filters, and drag release all request work through it. A new request terminates the previous worker calculation or animation frame loop before starting. `visibilitychange` also cancels active work.

The controller exposes trigger-specific budgets:

- Initial and orientation settle: full active graph, longest bounded budget.
- Filter settle: visible-node subgraph, medium budget, followed by visible-node camera fit.
- Drag settle: dragged node and nearby nodes, shortest budget, with the dragged node anchored to the reader's final placement.

### Animate camera framing separately from node positions

Visible-node bounds determine the target camera state with padding for node labels and the mobile filter button. Camera transitions use Sigma's camera animation when motion is enabled and immediate state updates under reduced motion. Node and camera animation share the same cancellation generation so they cannot fight each other.

### Cache only compatible session positions

Settled positions are saved in `sessionStorage` under a key derived from sorted node IDs, sorted edges, and a coarse viewport class. The cache is ignored when the graph signature or viewport class changes. Storage failures are nonfatal. Reader drag adjustments can update the current session entry but never modify Markdown or build output.

### Reduced motion keeps layout but removes tweening

When `prefers-reduced-motion: reduce` is active, the worker may still calculate responsive target positions, but the controller applies node coordinates and camera state immediately. No entry, resize, filter, or drag animation runs.

## Risks / Trade-offs

- [Worker startup can outweigh layout work for the current five-note vault] -> Skip force calculation below a small-node threshold and use only aspect transformation plus camera animation.
- [Responsive scaling can distort cluster geometry on very narrow screens] -> Clamp independent axis scaling and retain the build-time layout as the force seed.
- [Filtering can cause large jumps when only a few nodes remain] -> Use shorter interpolation, generous camera padding, and preserve hidden-node coordinates.
- [Repeated mobile viewport changes can consume battery] -> Debounce resize events, require a meaningful dimension change, and enforce iteration and duration caps.
- [Session positions can become stale] -> Include the graph signature and viewport class in the cache key; ignore malformed values.
- [ForceAtlas2 bundling may fail in a module worker] -> Verify production worker output early; fall back to chunked deterministic calculations only if worker bundling cannot support the existing package.

## Migration Plan

No content or persisted-data migration is required. Deploy the new controller and worker with the static assets. Rollback consists of removing the controller integration; deterministic build positions remain unchanged and continue to render normally.
