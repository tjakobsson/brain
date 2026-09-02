## ADDED Requirements

### Requirement: Self-contained workspace destination links
Every generated or copied link to a workspace destination that requires a Brain selection SHALL encode that selection or identify it through the destination's canonical namespaced path. Opening the link MUST resolve the intended published destination without relying on local storage, session storage, navigation history, or a previously selected Brain. Unknown or malformed encoded context MUST produce the existing clear not-found or invalid-selection recovery rather than silently opening the chooser as if no destination had been requested.

#### Scenario: Open a shared link as a first-time visitor
- **WHEN** a reader with no prior state for the site opens a valid link to a note, selected graph, or other Brain-scoped destination
- **THEN** Brain opens the linked destination in its encoded Brain scope instead of requiring the reader to choose a Brain first

#### Scenario: Preserve canonical destination identity
- **WHEN** a generated link identifies a note through its owning Brain path and also carries browsing context
- **THEN** the owning-Brain path remains the note's canonical identity while the additional context affects only applicable navigation

#### Scenario: Reject invalid shared context
- **WHEN** a shared destination link contains an unknown Brain ID or malformed selection
- **THEN** Brain presents the applicable invalid-context recovery and does not substitute browser history or stored state
