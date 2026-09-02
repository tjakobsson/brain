## MODIFIED Requirements

### Requirement: Brain chooser and contextual navigation
The multi-brain root page SHALL present every configured brain in the declared hierarchy and allow a reader to enter one brain. The chooser and contextual navigation MUST identify Brain entries with a shared brain-shaped mark, and each configured Brain MAY tint that mark with its accent. Brain cards MUST use a uniform neutral boundary rather than an asymmetric accent border. Brain titles or stable IDs MUST remain visible so identity never depends on the mark or color alone. At desktop widths, cards in the same chooser grid MUST remain visually aligned when a Brain title or stable `@brain` identifier wraps onto multiple lines. While a brain is active, graph, tags, recent notes, orphans, search, and quick-switcher entry points MUST default to that brain and MUST identify the active brain.

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
