## Why

Graph fitting currently uses node centers, so large nodes and long labels can remain clipped after a reader selects Fit view. Note pages also lack a way to refit their connection maps, while desktop navigation changes shape as readers scroll and hides the graph shortcut inside a menu.

## What Changes

- Add Fit view to each note page's local connection map.
- Make Fit view on both global and local graphs account for the rendered bounds of visible node circles and labels.
- Replace the full desktop navigation and scroll-dependent compact state with the same persistent top-right pill used on smaller screens.
- Add direct Graph and Search actions to the pill, plus a dedicated expand action that reveals the remaining navigation items instead of using a hamburger icon.
- Preserve keyboard access, accessible labels, base-path-safe navigation, and responsive behavior across pointer types and viewport sizes.

## Capabilities

### New Capabilities
- `site-navigation`: Defines the persistent responsive navigation pill, its direct actions, and its expandable menu.

### Modified Capabilities
- `graph-explorer`: Adds reader-triggered, content-aware camera fitting to both global and local graphs.

## Impact

- Affects shared layout markup and header styling, graph controls, camera-bound calculations, and graph initialization.
- Extends unit and browser coverage for rendered graph bounds, local graph fitting, desktop navigation, mobile navigation, keyboard operation, and configured base paths.
- Removes the desktop text-navigation and scroll-compaction variants. No public data format, route, or dependency changes are expected.
