## 1. Browsing Scope And Focus Routes

- [x] 1.1 Extend route helpers with canonical optional note browsing scope and focused composite-node graph state, and verify unit tests cover zero/one/many Brains, unknown IDs, fragments, root and subpath deployments, and removal of invalid focus.
- [x] 1.2 Separate note ownership from browsing scope in shared page context, then propagate valid scope through graph-node, wiki-link, mention, nearby-note, and quick-switcher note navigation; verify browser tests traverse each path from a combined graph without collapsing to the destination note's owner.
- [x] 1.3 Make note-page Graph and connection-map actions derive one focused destination from the current note plus retained scope, and verify direct notes open their owning graph while combined-context notes return to the selected graph with the note focused.

## 2. Shareable Graph Focus

- [x] 2.1 Consolidate persistent inspection focus separately from transient hover and layout-motion pinning, including URL synchronization, selection/filter invalidation, initial stored-filter precedence, and direct foreign-neighbor visibility; verify focused unit tests cover reducers, canonical state, visible nodes and edges, and clearing behavior.
- [x] 2.2 Add marker-and-title desktop context-menu targeting plus a viewport-contained DOM menu for Pin or Move focus, Copy neighborhood link, and Open note while preserving the native empty-stage menu; verify browser tests cover target resolution, menu bounds, dismissal, clipboard feedback, and unchanged left-click navigation.
- [x] 2.3 Add a persistent non-color focus marker and accessible focused-state actions for Copy, Open, and Clear, then route touch long press and graph-search activation through the same transition; verify pointer, touch, keyboard, light/dark, and transient-hover-over-focus browser assertions.
- [x] 2.4 Restore valid focused URLs after graph layout or session restoration and fit the focused note plus rendered direct-neighborhood bounds without changing graph-space positions; verify tests cover desktop-to-phone sharing, combined selection, per-Brain foreign boundaries, responsive settling, and omission of camera, filter, and dragged-position state from copied URLs.

## 3. Chooser, Navigation, And Provenance

- [x] 3.1 Rebalance Brain cards so Enter Brain remains primary, combination controls are secondary, and the combined action appears only after selection begins; verify desktop and phone browser tests cover zero, one, and two selected Brains without initial multi-Brain pressure or overflow.
- [x] 3.2 Add the base-path-correct Brains destination and bounded About/version disclosure to the shared navigation pill without a Brain selector, and verify action order, labels, focus, Escape/outside dismissal, reduced motion, short viewport scrolling, and workspace versus single-vault visibility.
- [x] 3.3 Inject the package semantic version into every page's generator metadata and the About disclosure from one source of truth, and verify generated HTML and browser-visible text match `brain --version` without timestamps or machine paths.

## 4. External Link Signalling

- [x] 4.1 Add a build-time rendered-link classifier for authored external HTTP(S) origins with semantic class and accessible external-site text, and verify renderer tests distinguish cross-origin, configured same-origin, relative, fragment, attachment, `mailto:`, `tel:`, and authored raw HTML cases.
- [x] 4.2 Add a persistent solid-link and box-arrow treatment distinct from wiki, cross-Brain, potential, and unwritten links while retaining same-tab behavior, and verify browser tests cover keyboard naming, light/dark contrast, punctuation, multiline phone wrapping, and no horizontal overflow.

## 5. Contextual Not-Found Recovery

- [x] 5.1 Create the shared custom 404 page with no-JavaScript root recovery and progressively enhanced Search, then add base-aware parsing that prioritizes valid `brains` scope, recognizes only known namespaced Brain paths, and selects a stable note recommendation from the compact search index; verify unit and browser tests cover single-Brain, combined, unknown, malformed, unscoped, repeat-load, and Another note behavior.
- [x] 5.2 Update static preview and live serving to return generated `404.html` with HTTP 404 for unknown in-base routes while preserving the requested URL and keeping outside-base or missing-resource responses unsuccessful; verify root, subpath, live reload, HEAD, missing asset, and existing route server tests.
- [x] 5.3 Align invalid combined-selection recovery with the custom not-found presentation where applicable, and verify unknown Brain queries remain clearly invalid, preserve static-host limitations, and link safely to the chooser without reporting an unknown Brain as valid context.

## 6. Graph Popover Containment

- [x] 6.1 Scope desktop global-legend alignment to the existing global disclosure while retaining local and narrow/coarse-pointer placement, and verify Playwright geometry keeps every legend edge inside 320, 390, coarse-tablet, and desktop viewports with Filters closed and no page overflow.

## 7. Contract And Integration Verification

- [x] 7.1 Add or update demo/browser fixtures for external links, focused graph return, chooser priority, provenance, and scoped missing routes; verify representative desktop, phone, coarse-pointer, light, and dark states are visually reviewed without changing the Brain Markdown contract.
- [x] 7.2 Run `openspec validate improve-reader-wayfinding-and-sharing --strict`, `npm test`, `npx astro build`, and the affected Playwright browser and server suites; resolve every failure and confirm generated root/subpath output satisfies all six delta specifications.
- [x] 7.3 Render Brain highlight syntax in linked-mention excerpts while preserving highlighted inline potential links, and verify safe text handling, generated workspace output, browser rendering, and review screenshots stored with this change.
