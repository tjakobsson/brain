# Brain Workspaces Specification

## Purpose

Defines how a static Brain site registers, organizes, selects, and combines independently sourced brains without merging or modifying their Markdown content.

## Requirements

### Requirement: Validated workspace registry
A workspace SHALL declare one or more brains with a unique stable ID, display title, source directory, and optional description, accent, and hierarchy group. Brain IDs and group IDs MUST be URL-safe and unique in their respective namespaces; brain paths MUST resolve to distinct readable directories; hierarchy references MUST resolve without cycles. Invalid workspace configuration MUST fail before generation with an actionable diagnostic.

#### Scenario: Load a valid workspace
- **WHEN** a workspace registers several valid brain directories and hierarchy groups
- **THEN** Brain loads each source under its declared stable ID and preserves the declared presentation hierarchy

#### Scenario: Reject conflicting identity
- **WHEN** two workspace entries declare the same brain ID
- **THEN** generation fails and identifies both conflicting entries

#### Scenario: Reject invalid hierarchy
- **WHEN** a workspace group references a missing parent or creates a cycle
- **THEN** generation fails and identifies the invalid hierarchy chain

### Requirement: Stable identity independent of hierarchy
A brain's canonical identity SHALL be its stable ID. Moving a brain between hierarchy groups or changing its display title, description, or accent MUST NOT change note identities, cross-brain link targets, or generated note URLs.

#### Scenario: Reorganize a domain
- **WHEN** a publisher moves `research` from one presentation group to another without changing its ID
- **THEN** existing links to `@research` and URLs beneath that brain remain unchanged

### Requirement: Brain chooser and contextual navigation
The multi-brain root page SHALL present every configured brain in the declared hierarchy and make entering one Brain the primary action on each Brain card. Combining Brains MUST remain available as a secondary selection action, but the chooser MUST NOT initially present a disabled multi-Brain requirement as the page's dominant call to action. The chooser and contextual navigation MUST identify Brain entries with a shared brain-shaped mark, and each configured Brain MAY tint that mark with its accent. Brain cards MUST use a uniform neutral boundary rather than an asymmetric accent border. Brain titles or stable IDs MUST remain visible so identity never depends on the mark or color alone. At desktop widths, cards in the same chooser grid MUST remain visually aligned when a Brain title or stable `@brain` identifier wraps onto multiple lines. Shared navigation MUST NOT reserve a persistent Brain selector. A note page MUST identify the note's owning Brain in its metadata alongside type, status, and tags, using discoverable text so ownership does not depend on the Brain mark or color. While a Brain browsing scope is active, graph and search entry points MUST retain and identify that scope where those destinations apply; Brain-specific tags, recent notes, and orphans MAY continue to use the note owner's Brain when no combined destination exists.

#### Scenario: Enter a brain
- **WHEN** a reader arrives at the root chooser without making a selection
- **THEN** each Brain presents an obvious Enter Brain action while the page does not lead with an instruction requiring two selections

#### Scenario: Begin a combined selection
- **WHEN** a reader selects one Brain for combination
- **THEN** the chooser reveals secondary guidance to select another Brain without obscuring the selected card's direct Enter Brain action

#### Scenario: Distinguish Brain entries without color
- **WHEN** a reader views the chooser or context switcher without perceiving the configured accent colors
- **THEN** every entry remains identifiable by its Brain mark together with its title or stable ID

#### Scenario: Present a Brain card
- **WHEN** the chooser displays a configured Brain
- **THEN** its card uses the Brain mark for accent identity and does not use a colored top or side rule as decoration
#### Scenario: Align cards with wrapping identifiers
- **WHEN** desktop chooser cards include `@brain` identifiers that occupy different numbers of lines
- **THEN** cards in the same grid row retain aligned boundaries and consistently positioned actions without truncating the identifiers

#### Scenario: Identify note ownership
- **WHEN** a reader opens a note owned by Engineering while browsing Engineering and Design
- **THEN** the note metadata identifies Engineering as the owner without misrepresenting the retained Engineering and Design browsing scope

#### Scenario: Keep note titles clear
- **WHEN** a long note title wraps on a supported phone viewport
- **THEN** shared navigation does not reserve a Brain control or overlap the title

#### Scenario: Keep navigation focused
- **WHEN** a reader uses shared navigation on a workspace page
- **THEN** the navigation pill contains navigation actions without a separate Brain selector

### Requirement: Reader-selected combined view
The root chooser and full-graph Brain control SHALL allow a reader to select two or more configured brains and open a combined view containing exactly those brains. The selected set MUST be represented canonically in the URL so the view can be bookmarked and shared, and an unknown brain ID MUST produce a clear not-found result rather than silently changing the selection. Changing the combined set from the graph control MUST update the graph, URL, control state, quick switcher, and applicable context-scoped navigation together. When a reader follows a note from a combined graph or selected-scope search, the note route MUST retain the valid selected set as browsing context without changing the note's canonical identity or owning-Brain path. Subsequent note and search navigation MUST preserve that context until the reader explicitly changes scope or enters a destination that establishes a different context. The graph MUST NOT reserve a separate permanent banner for listing the selected Brain titles.

#### Scenario: Open a combined domain view
- **WHEN** a reader selects Engineering and Research
- **THEN** the combined view includes notes and connections from exactly those two brains and the full-graph Brain control exposes the selected set

#### Scenario: Share a combined view
- **WHEN** another reader opens the URL for a saved Engineering and Research selection
- **THEN** Brain restores the same selected set without relying on browser storage

#### Scenario: Read a note without losing selection
- **WHEN** a reader opens an Engineering note from an Engineering and Design combined graph
- **THEN** the note remains owned by Engineering while its URL and applicable navigation retain the Engineering and Design browsing scope

#### Scenario: Follow another note in retained scope
- **WHEN** a reader follows an internal note result or note link while a valid combined browsing scope is present
- **THEN** the destination retains the same selected set unless the reader explicitly chooses another scope

#### Scenario: Open a note directly
- **WHEN** a reader opens a namespaced note URL without selected-Brain context
- **THEN** applicable navigation defaults to the note's owning Brain

#### Scenario: Change a combined selection
- **WHEN** a reader changes the selected Brains through the full-graph Brain control
- **THEN** the graph, URL, control state, and applicable contextual destinations represent the resulting selection without a separate combined-context banner

### Requirement: Static configured collaboration boundary
Brain SHALL combine only sources declared by the publisher at build time. Generation MUST NOT merge, move, or modify source files, and the generated site MUST NOT allow readers to attach arbitrary remote brains at runtime.

#### Scenario: Build a collaborative workspace
- **WHEN** configured brains originate from separate directories or repository checkouts
- **THEN** Brain publishes their combined indexes while leaving every source directory unchanged

### Requirement: Context-aware missing-page recovery
A workspace not-found page SHALL offer a safe route to the Brain chooser and search. When the missing URL contains a valid canonical selected-Brain scope, the page MUST offer recovery to that selected graph and recommend a published note owned by one of those Brains. Otherwise, when the route grammar identifies one configured Brain, the page MUST offer recovery to that Brain's graph and recommend a note from that Brain. Unknown or malformed Brain IDs MUST NOT be treated as valid scope.

#### Scenario: Recover inside one Brain
- **WHEN** a reader requests a missing route beneath `/brains/engineering/`
- **THEN** the not-found page links to Engineering's graph and recommends a published Engineering note

#### Scenario: Recover inside a retained selection
- **WHEN** a missing note URL retains a valid Engineering and Design browsing scope
- **THEN** the not-found page links to that combined graph and recommends a note owned by Engineering or Design

#### Scenario: Reject misleading path inference
- **WHEN** a missing URL contains an unknown Brain ID or only resembles a Brain name outside the supported route grammar
- **THEN** the page falls back to workspace-wide recovery without presenting the unknown value as a configured Brain
