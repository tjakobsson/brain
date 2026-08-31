## 1. Unified Navigation

- [x] 1.1 Replace viewport-specific navigation state and mobile-named selectors with one collapsed disclosure model, remove the desktop secondary flyout, and verify component/browser assertions find the same launcher and direct action order at desktop and phone widths.
- [x] 1.2 Apply bounded expansion, dismissal, focus restoration, pointer tooltip, and reduced-motion behavior on every viewport, and verify the affected workspace and subpath browser tests cover keyboard, outside activation, short viewports, contextual destinations, and configured base paths.

## 2. Unified Graph Controls

- [x] 2.1 Promote the icon-pill container, separators, icons, hidden labels, and 44-by-44 action geometry to the base graph-control styles while retaining responsive placement rules, and verify desktop and mobile browser assertions cover dimensions, viewport containment, sidebar movement, and primary-navigation clearance.
- [x] 2.2 Keep graph-control accessible names, stateful labels, and pointer tooltips synchronized for Filters, Fit view, Related brains, and Legend, and verify browser coverage checks names, tooltip text, expanded/pressed state, and stable pill geometry.

## 3. Graph Neighborhood Emphasis

- [x] 3.1 Refactor shared graph inspection state to derive one active node from transient pointer hover and pinned touch inspection, and verify unit tests cover pointer entry, pointer exit, pinned fallback on hybrid input, and unchanged graph/camera geometry.
- [x] 3.2 Add light- and dark-theme faded label colors and reducer-driven per-node label styling alongside the stronger unrelated node and edge treatment, and verify unit tests prove selected neighborhoods retain their original node, label, and incident-edge attributes while unrelated elements remain visible and recede.
- [x] 3.3 Verify global and local graph rendering applies the shared emphasis in both color schemes without hover oscillation, click-target displacement, hidden labels, or graph movement using the focused graph interaction browser suite.

## 4. Persistent Touch Inspection

- [x] 4.1 Add cancellable long-press timing and consumed-press state around touch node interaction, sharing the established drag tolerance and cleaning timers during renderer teardown, and verify unit tests distinguish hold, early release, movement, drag, and teardown paths.
- [x] 4.2 Integrate pinned long-press inspection with global and local graph tap handling so release does not navigate, an empty-stage tap clears emphasis, and a later node tap navigates, and verify touch browser coverage exercises all three outcomes without regressing label hit targets or node dragging.

## 5. WebKit Code Typography

- [x] 5.1 Constrain standard and WebKit fenced-block text adjustment to `100%` without changing the declared font size or intrinsic scroll clearance, and verify code-block browser assertions cover font size, line-number alignment, compact copy-control geometry, horizontal overflow, and page-width containment.
- [x] 5.2 Add a phone-sized WebKit project restricted to the code-block suite and install WebKit in browser CI, and verify the focused WebKit run passes without running unrelated browser files under WebKit.

## 6. Contract Verification

- [x] 6.1 Run `openspec validate align-cross-device-interactions --strict`, `npm test`, `npx astro build`, and the affected Chromium and WebKit Playwright suites; resolve every failure and confirm the implementation satisfies all four delta specs.
