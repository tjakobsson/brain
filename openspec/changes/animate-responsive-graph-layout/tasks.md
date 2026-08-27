## 1. Deterministic responsive targets

- [x] 1.1 Add pure helpers for graph signatures, viewport classes, bounded aspect transforms, and trigger-specific iteration budgets; verify unit tests cover portrait, landscape, small graphs, and 2,000-node budgets.
- [x] 1.2 Add a module worker that computes ForceAtlas2 targets for an active graph with fixed iterations; verify repeated worker inputs return the same coordinates and `npm run build` bundles the worker.

## 2. Motion controller

- [x] 2.1 Implement a single cancellable graph motion controller that interpolates node coordinates for at most 2.5 seconds; verify a newer generation prevents stale worker results and animation frames from mutating the graph.
- [x] 2.2 Add visible-node camera fitting with animated and immediate modes; verify portrait and landscape bounds retain padding and reduced motion applies the target without tweening.
- [x] 2.3 Add compatible `sessionStorage` position caching keyed by graph signature and viewport class; verify malformed, stale, and unavailable storage falls back to build-time coordinates.

## 3. Global graph integration

- [x] 3.1 Start controlled settling when the global graph mounts and wire debounced `ResizeObserver` and `visibilitychange` handling; verify resizing triggers one final settle and hiding the page cancels active motion.
- [x] 3.2 Request visible-subgraph settling and camera fitting after type, status, and tag changes; verify hidden nodes remain hidden and rapid filter changes leave only the latest motion active.
- [x] 3.3 Expose drag completion to the controller and perform a short neighborhood settle anchored at the dropped node; verify the dragged node keeps the reader's final placement.

## 4. Performance and acceptance

- [x] 4.1 Run `npm test` and add coverage for deterministic targets, cancellation, reduced motion, and cache compatibility; verify the complete suite passes.
- [x] 4.2 Build the real vault and the generated 2,000-note vault; verify both builds succeed and browser interaction remains responsive while settling.
- [x] 4.3 Verify initial settling, phone rotation, desktop resize, filtering, dragging, session return, and reduced motion in the production preview on desktop and phone-sized viewports.
