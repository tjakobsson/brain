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
The multi-brain root page SHALL present every configured brain in the declared hierarchy and allow a reader to enter one brain. While a brain is active, graph, tags, recent notes, orphans, search, and quick-switcher entry points MUST default to that brain and MUST identify the active brain.

#### Scenario: Enter a brain
- **WHEN** a reader selects Engineering from the root chooser
- **THEN** the reader reaches Engineering's graph and subsequent navigation defaults to Engineering content

### Requirement: Reader-selected combined view
The chooser SHALL allow a reader to select two or more configured brains and open a combined view containing exactly those brains. The selected set MUST be represented in the URL so the view can be bookmarked and shared, and an unknown brain ID MUST produce a clear not-found result rather than silently changing the selection.

#### Scenario: Open a combined domain view
- **WHEN** a reader selects Engineering and Research
- **THEN** the combined view includes notes and connections from exactly those two brains and exposes the selected brain filters

#### Scenario: Share a combined view
- **WHEN** another reader opens the URL for a saved Engineering and Research selection
- **THEN** Brain restores the same selected set without relying on browser storage

### Requirement: Static configured collaboration boundary
Brain SHALL combine only sources declared by the publisher at build time. Generation MUST NOT merge, move, or modify source files, and the generated site MUST NOT allow readers to attach arbitrary remote brains at runtime.

#### Scenario: Build a collaborative workspace
- **WHEN** configured brains originate from separate directories or repository checkouts
- **THEN** Brain publishes their combined indexes while leaving every source directory unchanged
