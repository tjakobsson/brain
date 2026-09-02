## MODIFIED Requirements

### Requirement: Persistent navigation pill
The site SHALL use one top-right navigation pill as its primary navigation on every viewport. The pill MUST default to a single four-dot launcher, remain available without changing in response to scrolling, and keep its collapsed footprint clear of page content and graph controls.

#### Scenario: Navigate on desktop
- **WHEN** a reader opens any site page in a desktop viewport
- **THEN** the top-right navigation is presented as one collapsed four-dot launcher rather than an always-expanded action rail

#### Scenario: Navigate on a small or coarse-pointer device
- **WHEN** a reader opens any site page on a small viewport or a device with a coarse primary pointer
- **THEN** the same collapsed four-dot launcher is present while the other navigation actions remain hidden until requested

#### Scenario: Scroll a note page
- **WHEN** a reader scrolls down or up on a note page
- **THEN** the same launcher remains available without switching control structures or overlapping readable content

### Requirement: Direct Graph and Search actions
One activation of the four-dot launcher SHALL directly reveal Search and any available Graph action on every viewport without a nested menu. Graph MUST navigate to the context's canonical global graph route under the configured site base path, and Search MUST open the quick switcher. A workspace chooser with no selected brain or combined view does not establish a graph destination.

#### Scenario: Open the graph directly
- **WHEN** a desktop reader expands navigation and activates an available Graph action
- **THEN** the browser navigates to that context's global graph without opening another navigation layer

#### Scenario: Open the graph on mobile
- **WHEN** a mobile reader expands navigation and activates an available Graph action
- **THEN** the browser navigates to that context's global graph without opening another navigation layer

#### Scenario: Open search directly
- **WHEN** a reader expands navigation and activates Search
- **THEN** the quick switcher opens without another navigation layer

#### Scenario: Use a configured base path
- **WHEN** the generated site is hosted under a non-root base path and a reader activates an available Graph action
- **THEN** navigation stays within that configured base path

### Requirement: Expandable secondary navigation
The four-dot launcher SHALL expand the navigation pill itself on every viewport and directly reveal brain context when applicable, Graph when available, Search, and all context-appropriate Tags, Recent, and Orphans destinations. The expanded pill MUST NOT use a nested secondary flyout. Workspace-level pages without an active brain MUST omit destinations that require an active brain. The launcher MUST expose its open state, support pointer and keyboard operation, use a bounded expand and collapse transition that respects reduced motion, and provide pointer users with a visible label or tooltip for each icon-only action.

#### Scenario: Expand the remaining destinations
- **WHEN** a desktop reader activates the four-dot launcher in a single-vault or active-brain context
- **THEN** the pill expands in place and directly reveals every destination applicable to that context

#### Scenario: Expand mobile navigation
- **WHEN** a touch reader activates the four-dot launcher
- **THEN** the same pill expands in place and directly reveals every destination applicable to that context

#### Scenario: Expand workspace-level navigation
- **WHEN** a reader expands navigation on the workspace chooser or a combined graph
- **THEN** Search and available workspace actions appear without Tags, Recent, or Orphans that require an active brain

#### Scenario: Dismiss mobile navigation
- **WHEN** a reader presses Escape, activates a navigation destination, opens Search, or activates outside the expanded pill
- **THEN** the pill returns to its collapsed launcher state and keyboard focus remains predictable

#### Scenario: Reduce navigation motion
- **WHEN** `prefers-reduced-motion: reduce` is active and a reader toggles navigation
- **THEN** the pill reaches the requested state without animated expansion, collapse, or staggered action movement

#### Scenario: Operate the pill by keyboard
- **WHEN** a keyboard user focuses and activates the launcher, Graph, Search, brain context, or a navigation destination
- **THEN** the chosen action runs, focus remains visible, and focus order follows the visual expanded order

#### Scenario: Identify icon-only actions
- **WHEN** assistive technology or a desktop pointer user examines the launcher and expanded icon actions
- **THEN** each control exposes a distinct accessible name, pointer users can discover its label, and decorative icons are not announced separately
