## MODIFIED Requirements

### Requirement: Direct Graph and Search actions
One activation of the four-dot launcher SHALL directly reveal Search and any available Graph action on every viewport without a nested menu. Graph MUST navigate under the configured site base path to the browsing scope's canonical global graph route. On a note page, Graph MUST additionally focus the current note; a retained valid selected-Brain scope takes precedence, while a direct note visit defaults to the note's owning Brain. Search MUST open the quick switcher in the retained browsing scope. A workspace chooser with no selected brain or combined view does not establish a graph destination.

#### Scenario: Focus a note in its graph
- **WHEN** a reader opens Graph from a directly visited Engineering note
- **THEN** the browser opens Engineering's graph with that note persistently focused

#### Scenario: Open the graph directly
- **WHEN** a desktop reader expands navigation and activates an available Graph action outside a note page
- **THEN** the browser navigates to that context's global graph without opening another navigation layer

#### Scenario: Return to selected graph context
- **WHEN** a reader opens Graph from an Engineering note reached through an Engineering and Design combined view
- **THEN** the browser opens the Engineering and Design graph with the current note focused rather than collapsing to Engineering alone

#### Scenario: Open the graph on mobile
- **WHEN** a mobile reader expands navigation on a note and activates Graph
- **THEN** the browser opens the same context-aware focused graph without another navigation layer

#### Scenario: Open search directly
- **WHEN** a reader expands navigation and activates Search
- **THEN** the quick switcher opens without another navigation layer and uses the retained browsing scope

#### Scenario: Use a configured base path
- **WHEN** the generated site is hosted under a non-root base path and a reader activates an available Graph action
- **THEN** navigation stays within that configured base path

### Requirement: Expandable secondary navigation
The four-dot launcher SHALL expand the navigation pill itself on every viewport and directly reveal a Brain chooser destination on every workspace page, Graph when available, Search, all context-appropriate Tags, Recent, and Orphans destinations, and a quiet About action exposing the generated Brain version. The expanded pill MUST NOT use a nested secondary flyout or reintroduce a persistent Brain selector. Workspace-level pages without an active brain MUST omit destinations that require an active brain. The launcher MUST expose its open state, support pointer and keyboard operation, use a bounded expand and collapse transition that respects reduced motion, and provide pointer users with a visible label or tooltip for each icon-only action.

#### Scenario: Return to the Brain chooser
- **WHEN** a reader expands navigation from a note, report, or graph in workspace mode and activates Brains
- **THEN** the browser opens the workspace root where the reader can enter one Brain or begin a combined selection

#### Scenario: Expand the remaining destinations
- **WHEN** a desktop reader activates the four-dot launcher in a single-vault or active-brain context
- **THEN** the pill expands in place and directly reveals every destination applicable to that context

#### Scenario: Expand mobile navigation
- **WHEN** a touch reader activates the four-dot launcher
- **THEN** the same pill expands in place and directly reveals every destination applicable to that context

#### Scenario: Expand workspace-level navigation
- **WHEN** a reader expands navigation on the workspace chooser or a combined graph
- **THEN** Brains, Search, and About appear without Tags, Recent, or Orphans that require an active brain

#### Scenario: Inspect the generated version
- **WHEN** a reader activates About from any generated page
- **THEN** the page identifies the semantic Brain generator version in a perceivable, selectable form without permanently occupying content or graph space

#### Scenario: Dismiss mobile navigation
- **WHEN** a reader presses Escape, activates a navigation destination, opens Search, or activates outside the expanded pill
- **THEN** the pill returns to its collapsed launcher state and keyboard focus remains predictable

#### Scenario: Reduce navigation motion
- **WHEN** `prefers-reduced-motion: reduce` is active and a reader toggles navigation
- **THEN** the pill reaches the requested state without animated expansion, collapse, or staggered action movement

#### Scenario: Operate the pill by keyboard
- **WHEN** a keyboard user focuses and activates the launcher, Graph, Search, Brains, About, or another navigation destination
- **THEN** the chosen action runs, focus remains visible, and focus order follows the visual expanded order

#### Scenario: Identify icon-only actions
- **WHEN** assistive technology or a desktop pointer user examines the launcher and expanded icon actions
- **THEN** each control exposes a distinct accessible name, pointer users can discover its label, and decorative icons are not announced separately
