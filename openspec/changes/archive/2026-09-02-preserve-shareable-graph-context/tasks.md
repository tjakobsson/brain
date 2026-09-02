## 1. Canonical Navigation Context

- [x] 1.1 Extend route composition and parsing to carry canonical Brain scope plus optional originating graph focus on note destinations, and verify unit tests cover query ordering, encoding, fragments, duplicate parameters, unknown Brain IDs, and configured base paths.
- [x] 1.2 Add validation that an originating focus exists in the encoded graph selection while preserving a valid unpinned scope when only focus is invalid, and verify focused, neighboring, out-of-scope, and malformed cases in route or graph-data unit tests.
- [x] 1.3 Audit generated workspace destination links for reliance on storage, history, or unscoped aliases, update them to use canonical namespaced or scoped routes, and verify a route regression test enumerates valid first-visit destinations.

## 2. Focused Graph Round Trip

- [x] 2.1 Update every global-graph note navigation path to append the persistent focused composite ID alongside selected Brain scope while focus exists, and verify graph interaction tests cover opening both the focused subject and one of its neighbors.
- [x] 2.2 Resolve note-page Graph destinations from validated URL return context while keeping direct note visits unpinned and the current-note Focused graph action unchanged, and verify unit or browser tests distinguish originating focus from the opened note.
- [x] 2.3 Add Playwright coverage using a clean browser context for shared note and focused-neighborhood links, verifying first-time visitors reach the intended destination and the note Graph action restores the original selected graph and pinned subject.

## 3. Note Navigation Pill

- [x] 3.1 Render Home and context-aware Graph as adjacent segments of one visible workspace note-page pill, remove Graph from the note-page expandable actions only, and verify non-note pages retain their existing expanded Graph action.
- [x] 3.2 Add responsive and accessible styling for the two-action pill, including distinct labels, visible focus, tooltips, 44-by-44-pixel targets, and collision-free supported phone layouts, and verify these properties in workspace Playwright tests at desktop and phone viewports.
- [x] 3.3 Verify the visible Graph segment respects retained combined scope, originating focus, owning-Brain fallback, and non-root deployment base paths in workspace and subpath browser tests.

## 4. Integration Verification

- [x] 4.1 Run `npm test` and resolve all unit and active-spec validation failures.
- [x] 4.2 Run `npm run test:browser` and resolve all desktop, mobile, first-visit, focus-round-trip, and subpath regressions.
- [x] 4.3 Run `npm run build` and verify the production static site builds successfully with no new unresolved-route warnings.
