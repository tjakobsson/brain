## MODIFIED Requirements

### Requirement: Persistent navigation pill
The site SHALL use a top-right navigation pill as its primary navigation on desktop and smaller screens. On desktop, the established vertical action rail MUST remain visible without changing in response to page scrolling. On mobile, the pill MUST default to a single four-dot launcher and remain available without overlapping page content or graph controls.

#### Scenario: Navigate on desktop
- **WHEN** a reader opens any site page in a desktop viewport
- **THEN** the established top-right vertical navigation rail is present instead of a full row of text navigation

#### Scenario: Scroll a note page
- **WHEN** a reader scrolls down or up on a note page
- **THEN** the same desktop rail or mobile launcher remains available without switching modes because of scrolling

#### Scenario: Navigate on a small or coarse-pointer device
- **WHEN** a reader opens any site page on a small viewport or a device with a coarse primary pointer
- **THEN** one four-dot launcher remains usable while the other navigation actions stay collapsed until requested

### Requirement: Direct Graph and Search actions
On desktop, the navigation pill SHALL expose Search without requiring the reader to expand the navigation menu and SHALL expose Graph when the current context has a graph destination. On mobile, one activation of the four-dot launcher SHALL directly reveal Search and any available Graph action without a nested menu. Graph MUST navigate to the context's canonical global graph route under the configured site base path, and Search MUST open the quick switcher. A workspace chooser with no selected brain or combined view does not establish a graph destination.

#### Scenario: Open the graph directly
- **WHEN** a desktop reader activates Graph from a non-graph page in a single-brain or active-brain context
- **THEN** the browser navigates to that context's global graph without first opening the secondary menu

#### Scenario: Open the graph on mobile
- **WHEN** a mobile reader expands the launcher and activates an available Graph action
- **THEN** the browser navigates to the context's global graph without opening another navigation layer

#### Scenario: Open search directly
- **WHEN** a reader activates the visible Search action on desktop or from the expanded mobile pill
- **THEN** the quick switcher opens without another navigation layer

#### Scenario: Use a configured base path
- **WHEN** the generated site is hosted under a non-root base path and a reader activates an available Graph action
- **THEN** navigation stays within that configured base path

### Requirement: Expandable secondary navigation
The desktop navigation rail SHALL retain a dedicated secondary-navigation action for applicable destinations. On mobile, the four-dot launcher SHALL expand the pill itself and reveal brain context when applicable, Graph when available, Search, and all context-appropriate Tags, Recent, and Orphans destinations directly, with no nested secondary flyout. Workspace-level pages without an active brain MUST omit destinations that require an active brain. The launcher MUST be visually distinct from a hamburger or directional arrow, expose its open state, support pointer and keyboard operation, and use a bounded expand and collapse transition that respects reduced motion.

#### Scenario: Expand the remaining destinations
- **WHEN** a desktop reader activates secondary navigation in a single-vault or active-brain context
- **THEN** the menu reveals direct links to Tags, Recent, and Orphans for that context

#### Scenario: Expand mobile navigation
- **WHEN** a mobile reader activates the four-dot launcher
- **THEN** the pill expands in place with a polished transition and directly reveals every action applicable to the current context

#### Scenario: Expand workspace-level navigation
- **WHEN** a mobile reader expands navigation on the workspace chooser or a combined graph
- **THEN** Search and available workspace actions appear without Tags, Recent, or Orphans that require an active brain

#### Scenario: Dismiss mobile navigation
- **WHEN** a reader presses Escape, activates a navigation destination, opens Search, or clicks outside the expanded mobile pill
- **THEN** the pill returns to its collapsed launcher state and keyboard focus remains predictable

#### Scenario: Reduce navigation motion
- **WHEN** `prefers-reduced-motion: reduce` is active and a reader toggles mobile navigation
- **THEN** the pill reaches the requested state without animated expansion, collapse, or staggered action movement

#### Scenario: Operate the pill by keyboard
- **WHEN** a keyboard user focuses and activates the launcher, Graph, Search, brain context, or a navigation destination
- **THEN** the chosen action runs, focus remains visible, and focus order follows the visual expanded order

#### Scenario: Identify icon-only actions
- **WHEN** assistive technology examines the launcher and expanded icon actions
- **THEN** each control exposes a distinct accessible name and the decorative icon is not announced separately
