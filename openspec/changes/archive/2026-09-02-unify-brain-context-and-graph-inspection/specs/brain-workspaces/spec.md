## MODIFIED Requirements

### Requirement: Brain chooser and contextual navigation
The multi-brain root page SHALL present every configured brain in the declared hierarchy and allow a reader to enter one brain. The chooser and contextual navigation MUST identify Brain entries with a shared brain-shaped mark, and each configured Brain MAY tint that mark with its accent. Brain cards MUST use a uniform neutral boundary rather than an asymmetric accent border. Brain titles or stable IDs MUST remain visible so identity never depends on the mark or color alone. At desktop widths, cards in the same chooser grid MUST remain visually aligned when a Brain title or stable `@brain` identifier wraps onto multiple lines. Shared navigation MUST NOT reserve a persistent Brain selector. A note page MUST identify the note's owning Brain in its metadata alongside type, status, and tags, using discoverable text so ownership does not depend on the Brain mark or color. While a Brain context is active, graph, tags, recent notes, orphans, search, and quick-switcher entry points MUST use and identify that context where those destinations apply.

#### Scenario: Enter a brain
- **WHEN** a reader selects Engineering from the root chooser
- **THEN** the reader reaches Engineering's graph and subsequent navigation defaults to Engineering content

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
- **WHEN** a reader opens a note owned by Engineering
- **THEN** the note metadata identifies Engineering alongside the note's type, status, and tags

#### Scenario: Keep note titles clear
- **WHEN** a long note title wraps on a supported phone viewport
- **THEN** shared navigation does not reserve a Brain control or overlap the title

#### Scenario: Keep navigation focused
- **WHEN** a reader uses shared navigation on a workspace page
- **THEN** the navigation pill contains navigation actions without a separate Brain selector

### Requirement: Reader-selected combined view
The root chooser and full-graph Brain control SHALL allow a reader to select two or more configured brains and open a combined view containing exactly those brains. The selected set MUST be represented in the URL so the view can be bookmarked and shared, and an unknown brain ID MUST produce a clear not-found result rather than silently changing the selection. Changing the combined set from the graph control MUST update the graph, URL, control state, quick switcher, and applicable context-scoped navigation together. The graph MUST NOT reserve a separate permanent banner for listing the selected Brain titles.

#### Scenario: Open a combined domain view
- **WHEN** a reader selects Engineering and Research
- **THEN** the combined view includes notes and connections from exactly those two brains and the full-graph Brain control exposes the selected set

#### Scenario: Share a combined view
- **WHEN** another reader opens the URL for a saved Engineering and Research selection
- **THEN** Brain restores the same selected set without relying on browser storage

#### Scenario: Change a combined selection
- **WHEN** a reader changes the selected Brains through the full-graph Brain control
- **THEN** the graph, URL, control state, and applicable contextual destinations represent the resulting selection without a separate combined-context banner
