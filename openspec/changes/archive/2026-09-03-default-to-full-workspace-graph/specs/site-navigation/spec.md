## MODIFIED Requirements

### Requirement: Direct Graph and Search actions
One activation of the four-dot launcher SHALL directly reveal Search on every viewport and SHALL reveal any available Graph action outside note pages without a nested menu. Outside note pages, Graph MUST navigate under the configured site base path to the page context's canonical global graph: the full workspace graph from workspace-level pages and the active Brain's graph from Brain-scoped pages. Every note page MUST expose its Graph action outside the expandable menu beside Home in one visible two-action pill, including notes without a rendered connection map. That Graph action MUST open the originating note's neighborhood page when valid in-session return context is present and otherwise the note's own neighborhood page; both destinations MUST be pathname-only links. The separate focused-neighborhood action for the current note MUST remain visible in the note content and MUST open the current note's neighborhood page. Search MUST open the quick switcher in the page context's scope.

#### Scenario: Open a neighborhood from a direct note visit
- **WHEN** a reader opens Graph from a directly visited Engineering note
- **THEN** the browser opens that note's neighborhood page with the note focused

#### Scenario: Return to an unpinned graph
- **WHEN** a reader activates Home from an Engineering note in workspace mode
- **THEN** the browser opens the full workspace graph without any note focused

#### Scenario: Return to an originating pinned graph
- **WHEN** a reader activates the visible Graph action on a note reached from a neighborhood pinned on another note
- **THEN** the browser opens the originally pinned note's neighborhood page

#### Scenario: Return to selected graph context
- **WHEN** a reader activates Graph from an Engineering-scoped tags, recent, or orphans page
- **THEN** the browser opens Engineering's graph rather than the full workspace graph

#### Scenario: Focus an isolated note visibly
- **WHEN** a note has no rendered connection map
- **THEN** its visible focused-neighborhood action remains available and opens that note's neighborhood page

#### Scenario: Open the graph directly
- **WHEN** a desktop reader expands navigation and activates an available Graph action outside a note page
- **THEN** the browser navigates to that context's global graph without opening another navigation layer

#### Scenario: Open the graph on mobile
- **WHEN** a mobile reader activates the visible Graph action on a note
- **THEN** the browser opens the same neighborhood page without opening the expandable navigation

#### Scenario: Open search directly
- **WHEN** a reader expands navigation and activates Search
- **THEN** the quick switcher opens without another navigation layer and uses the page context's scope

#### Scenario: Use a configured base path
- **WHEN** the generated site is hosted under a non-root base path and a reader activates any Graph action
- **THEN** navigation stays within that configured base path and the destination is a pathname-only link

### Requirement: Expandable secondary navigation
The four-dot launcher SHALL expand the navigation pill itself on every viewport and directly reveal Search and the Tags, Recent, and Orphans destinations for the page context: workspace-wide aggregates on workspace-level pages and Brain-scoped pages on Brain-scoped pages. It SHALL also reveal Graph when available outside note pages, but MUST omit Graph on note pages because the visible Home-and-Graph pill provides that action. The expanded pill MUST NOT duplicate the always-visible Home destination or expose About. It MUST NOT use a nested secondary flyout or reintroduce a persistent Brain selector. In workspace mode the always-visible Home destination MUST open the full workspace graph. The launcher MUST expose its open state, support pointer and keyboard operation, use a bounded expand and collapse transition that respects reduced motion, and provide pointer users with a visible label or tooltip for each icon-only action.

#### Scenario: Return Home without expanding navigation
- **WHEN** a reader activates the always-visible Home icon from a note, report, or graph in workspace mode
- **THEN** the browser opens the full workspace graph and the expandable menu contains no duplicate Brains destination

#### Scenario: Keep note Graph navigation visible
- **WHEN** a reader opens the expandable navigation on a note page
- **THEN** Graph is absent from the expanded actions and remains available beside Home in the separate two-action pill

#### Scenario: Expand the remaining destinations
- **WHEN** a desktop reader activates the four-dot launcher in a single-vault or active-brain context outside a note page
- **THEN** the pill expands in place and directly reveals every destination applicable to that context, including Graph when available

#### Scenario: Expand mobile navigation
- **WHEN** a touch reader activates the four-dot launcher
- **THEN** the same pill expands in place and directly reveals every destination applicable to that context

#### Scenario: Expand workspace-level navigation
- **WHEN** a reader expands navigation on the full workspace graph or a workspace-wide report
- **THEN** Search and the workspace-wide Tags, Recent, and Orphans destinations appear without a Brain selector or About

#### Scenario: Inspect the generated version on the chooser
- **WHEN** a reader opens About on the workspace root graph
- **THEN** the root identifies the semantic Brain generator version in a perceivable, selectable bounded disclosure and other pages expose no About action

#### Scenario: Dismiss mobile navigation
- **WHEN** a reader presses Escape, activates a navigation destination, opens Search, or activates outside the expanded pill
- **THEN** the pill returns to its collapsed launcher state and keyboard focus remains predictable

#### Scenario: Reduce navigation motion
- **WHEN** `prefers-reduced-motion: reduce` is active and a reader toggles navigation
- **THEN** the pill reaches the requested state without animated expansion, collapse, or staggered action movement

#### Scenario: Operate the pill by keyboard
- **WHEN** a keyboard user focuses and activates the launcher, Graph, Search, or another navigation destination
- **THEN** the chosen action runs, focus remains visible, and focus order follows the visual expanded order

#### Scenario: Identify icon-only actions
- **WHEN** assistive technology or a desktop pointer user examines the launcher, the visible note navigation pill, or expanded icon actions
- **THEN** each control exposes a distinct accessible name, pointer users can discover its label, and decorative icons are not announced separately
