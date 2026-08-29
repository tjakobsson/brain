## MODIFIED Requirements

### Requirement: Brain chooser and contextual navigation
The multi-brain root page SHALL present every configured brain in the declared hierarchy and allow a reader to enter one brain. The chooser and contextual navigation MUST identify Brain entries with a shared brain-shaped mark, and each configured Brain MAY tint that mark with its accent. Brain cards MUST use a uniform neutral boundary rather than an asymmetric accent border. Brain titles or stable IDs MUST remain visible so identity never depends on the mark or color alone. While a brain is active, the navigation pill MUST contain the brain context control before Graph, quick-switcher Search, and the expand action. Graph, tags, recent notes, orphans, and quick-switcher entry points MUST default to that brain and MUST identify the active brain.

#### Scenario: Enter a brain
- **WHEN** a reader selects Engineering from the root chooser
- **THEN** the reader reaches Engineering's graph and subsequent navigation defaults to Engineering content

#### Scenario: Distinguish Brain entries without color
- **WHEN** a reader views the chooser or context switcher without perceiving the configured accent colors
- **THEN** every entry remains identifiable by its Brain mark together with its title or stable ID

#### Scenario: Present a Brain card
- **WHEN** the chooser displays a configured Brain
- **THEN** its card uses the Brain mark for accent identity and does not use a colored top or side rule as decoration

#### Scenario: Keep active Brain controls together
- **WHEN** a reader views an active-brain page at any supported viewport size
- **THEN** one navigation pill contains the marked active-brain context control before the context-aware Graph, Search, and expand actions
