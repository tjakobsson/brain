# Site Navigation Specification

## Purpose

Provides one compact, predictable navigation control on every page and viewport while keeping Search and contextual Graph navigation available without opening a menu.

## Requirements

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
One activation of the four-dot launcher SHALL directly reveal Search on every viewport and SHALL reveal any available Graph action outside note pages without a nested menu. Graph MUST navigate under the configured site base path to the browsing scope's canonical global graph route. Every note page MUST expose its context-aware Graph action outside the expandable menu beside Home in one visible two-action pill, including notes without a rendered connection map. When valid originating focused-graph context is present, the note-page Graph action MUST restore that selection and focus. Otherwise it MUST open an unpinned graph in the retained valid selected-Brain scope, or default to the note's owning Brain for a direct note visit. The separate focused-neighborhood action for the current note MUST remain visible in the note content and MUST focus the current note. Search MUST open the quick switcher in the retained browsing scope. A workspace chooser with no selected brain or combined view does not establish a graph destination.

#### Scenario: Return to an unpinned graph
- **WHEN** a reader opens Graph from a directly visited Engineering note
- **THEN** the browser opens Engineering's canonical graph without persistently focusing the note

#### Scenario: Return to an originating pinned graph
- **WHEN** a reader activates the visible Graph action on a note reached from a pinned Engineering and Design neighborhood
- **THEN** the browser restores the encoded Engineering and Design graph and its originating persistent focus

#### Scenario: Focus an isolated note visibly
- **WHEN** a note has no rendered connection map
- **THEN** its visible focused-neighborhood action remains available and opens the graph focused on that note

#### Scenario: Open the graph directly
- **WHEN** a desktop reader expands navigation and activates an available Graph action outside a note page
- **THEN** the browser navigates to that context's global graph without opening another navigation layer

#### Scenario: Return to selected graph context
- **WHEN** a reader opens Graph from an Engineering note reached through an Engineering and Design combined view
- **THEN** the browser opens the unpinned Engineering and Design graph rather than collapsing to Engineering alone

#### Scenario: Open the graph on mobile
- **WHEN** a mobile reader activates the visible Graph action on a note
- **THEN** the browser opens the same context-aware graph without opening the expandable navigation

#### Scenario: Open search directly
- **WHEN** a reader expands navigation and activates Search
- **THEN** the quick switcher opens without another navigation layer and uses the retained browsing scope

#### Scenario: Use a configured base path
- **WHEN** the generated site is hosted under a non-root base path and a reader activates an available Graph action
- **THEN** navigation stays within that configured base path

### Requirement: Expandable secondary navigation
The four-dot launcher SHALL expand the navigation pill itself on every viewport and directly reveal Search and all context-appropriate Tags, Recent, and Orphans destinations. It SHALL also reveal Graph when available outside note pages, but MUST omit Graph on note pages because the visible Home-and-Graph pill provides that action. The expanded pill MUST NOT duplicate the always-visible Home destination or expose About. It MUST NOT use a nested secondary flyout or reintroduce a persistent Brain selector. Workspace-level pages without an active brain MUST omit destinations that require an active brain. The launcher MUST expose its open state, support pointer and keyboard operation, use a bounded expand and collapse transition that respects reduced motion, and provide pointer users with a visible label or tooltip for each icon-only action.

#### Scenario: Return Home without expanding navigation
- **WHEN** a reader activates the always-visible Home icon from a note, report, or graph in workspace mode
- **THEN** the browser opens the Brain chooser and the expandable menu contains no duplicate Brains destination

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
- **WHEN** a reader expands navigation on the workspace chooser or a combined graph
- **THEN** Search appears without Brains, About, Tags, Recent, or Orphans

#### Scenario: Inspect the generated version on the chooser
- **WHEN** a reader opens About on the Brain chooser
- **THEN** the chooser identifies the semantic Brain generator version in a perceivable, selectable bounded disclosure and other pages expose no About action

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

### Requirement: Visible note Home and Graph pill
In workspace mode, every note page SHALL place Home and the context-aware Graph action together in one visible two-segment icon pill outside the expandable navigation. The pill MUST remain available on every supported viewport, preserve touch targets of at least 44 by 44 CSS pixels, remain clear of the note title and expandable navigation, and identify both actions accessibly without relying on icon shape alone.

#### Scenario: View note navigation on desktop
- **WHEN** a reader opens a workspace note on a desktop viewport
- **THEN** Home and Graph appear as adjacent segments of one visible pill and Graph does not appear in the expandable navigation

#### Scenario: View note navigation on a phone
- **WHEN** a reader opens a workspace note on a supported phone viewport
- **THEN** the two-action pill remains operable without overlapping the note title or the right-side launcher

#### Scenario: Operate note navigation accessibly
- **WHEN** a keyboard, touch, or assistive-technology user examines the note navigation pill
- **THEN** Home and Graph each provide a distinct accessible name, visible focus, and a touch target of at least 44 by 44 CSS pixels
