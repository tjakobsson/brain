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

### Requirement: Self-contained workspace destination links
Every generated or copied link to a workspace destination SHALL identify that destination through its pathname alone, using the destination's canonical namespaced path. Opening the link MUST resolve the intended published destination without relying on query parameters, URL fragments, local storage, session storage, navigation history, or a previously selected Brain, so that an authenticating proxy that returns only the pathname after sign-in still delivers the same destination. Query parameters MAY carry in-session graph state on a graph page, but losing them MUST never change which destination opens or narrow what it shows. An unknown Brain ID or note in a link path MUST produce the existing clear not-found recovery rather than silently opening a different page.

#### Scenario: Open a shared link as a first-time visitor
- **WHEN** a reader with no prior state for the site opens a copied neighborhood link
- **THEN** Brain opens that note's focused neighborhood with every configured Brain present instead of requiring a Brain selection first

#### Scenario: Survive a pathname-only proxy
- **WHEN** an authenticating proxy strips the query string and fragment from a shared workspace link before returning the reader to the site
- **THEN** the destination opens identically to a direct visit of the same pathname

#### Scenario: Preserve canonical destination identity
- **WHEN** a generated link identifies a note or its neighborhood through the note's owning Brain path
- **THEN** the owning-Brain path remains the note's canonical identity and no additional URL context is required to open it

#### Scenario: Reject invalid shared context
- **WHEN** a shared link's path names a Brain or note that is not published
- **THEN** Brain presents not-found recovery and does not substitute browser history or stored state

### Requirement: Static configured collaboration boundary
Brain SHALL combine only sources declared by the publisher at build time. Generation MUST NOT merge, move, or modify source files, and the generated site MUST NOT allow readers to attach arbitrary remote brains at runtime.

#### Scenario: Build a collaborative workspace
- **WHEN** configured brains originate from separate directories or repository checkouts
- **THEN** Brain publishes their combined indexes while leaving every source directory unchanged

### Requirement: Context-aware missing-page recovery
A workspace not-found page SHALL offer a safe route to the full workspace graph and search. When the route grammar identifies one configured Brain, the page MUST offer recovery to that Brain's graph and recommend a published note from that Brain; otherwise it MUST recommend a published note from the whole workspace. Query parameters MUST NOT be treated as scope, and unknown or malformed Brain IDs MUST NOT be treated as valid scope.

#### Scenario: Recover inside one Brain
- **WHEN** a reader requests a missing route beneath `/brains/engineering/`
- **THEN** the not-found page links to Engineering's graph and recommends a published Engineering note

#### Scenario: Recover at workspace level
- **WHEN** a reader requests a missing route outside any configured Brain path
- **THEN** the not-found page links to the full workspace graph and recommends a published note from any configured Brain

#### Scenario: Recover inside a retained selection
- **WHEN** a missing note URL beneath `/brains/engineering/` also carries query parameters naming Engineering and Design
- **THEN** the not-found page recovers to Engineering's graph from the path alone and does not present the query values as a selection

#### Scenario: Ignore query scope
- **WHEN** a missing URL outside any Brain path carries query parameters naming configured Brains
- **THEN** the page offers workspace-wide recovery and does not present the query values as a selection

#### Scenario: Reject misleading path inference
- **WHEN** a missing URL contains an unknown Brain ID or only resembles a Brain name outside the supported route grammar
- **THEN** the page falls back to workspace-wide recovery without presenting the unknown value as a configured Brain

### Requirement: Full workspace root graph and Brain identity
In workspace mode the root page SHALL present one interactive graph containing every configured Brain at full emphasis without requiring a Brain selection. The graph's Brain control MUST list every configured Brain in the declared hierarchy, identify each entry with the shared brain-shaped mark, MAY tint that mark with the Brain's accent, and MUST keep the Brain title or stable `@brain` identifier visible so identity never depends on the mark or color alone. Each listed Brain MUST offer a direct action that opens that Brain's own graph. Shared navigation MUST NOT reserve a persistent Brain selector. A note page MUST identify the note's owning Brain in its metadata alongside type, status, and tags using discoverable text. Workspace-level tags, recent, and orphans pages MUST aggregate every configured Brain and identify each entry's owning Brain, while Brain-scoped versions of those pages remain beneath the Brain's namespaced path.

#### Scenario: Arrive at the workspace root
- **WHEN** a reader with no prior state for the site opens the workspace root
- **THEN** the full graph of every configured Brain renders without a selection step and the Brain control lists every Brain in its declared hierarchy

#### Scenario: Enter a Brain from the control
- **WHEN** a reader activates a Brain's direct action in the Brain control
- **THEN** the browser opens that Brain's own graph beneath its namespaced path

#### Scenario: Distinguish Brain entries without color
- **WHEN** a reader views the Brain control or a note's ownership metadata without perceiving the configured accent colors
- **THEN** every entry remains identifiable by its Brain mark together with its title or stable ID

#### Scenario: Identify note ownership
- **WHEN** a reader opens a note owned by Engineering
- **THEN** the note metadata identifies Engineering as the owner using discoverable text

#### Scenario: Browse workspace-wide reports
- **WHEN** a reader opens the workspace-level tags, recent, or orphans page
- **THEN** entries from every configured Brain appear with their owning Brain identified, without a redirect to a selection step

#### Scenario: Keep navigation focused
- **WHEN** a reader uses shared navigation on a workspace page
- **THEN** the navigation pill contains navigation actions without a separate Brain selector

### Requirement: Personal Brain lens
The full workspace graph and each per-Brain graph SHALL let a reader dim any configured Brain through a checkbox-style Brain control. Dimming a Brain MUST lower the emphasis of that Brain's nodes, titles, and incident edges without removing them from the graph, without changing node positions, and without changing any URL. The lens MUST be remembered in the reader's own browser across pages and later visits to the same site, MUST be resettable to all Brains from the control, MUST NOT be encoded in generated or copied links, and MUST NOT affect any other reader. When every Brain would be dimmed, the graph MUST render every Brain at full emphasis. A persistently focused neighborhood MUST render at full emphasis regardless of the lens.

#### Scenario: Dim a Brain
- **WHEN** a reader unchecks Research in the Brain control on the full workspace graph
- **THEN** Research nodes, titles, and incident edges recede while remaining rendered in place and the page URL does not change

#### Scenario: Return in a later session
- **WHEN** a reader who dimmed Research opens any graph page of the same site in a later browser session
- **THEN** Research is still dimmed and the Brain control shows it unchecked

#### Scenario: Reset the lens
- **WHEN** a reader activates the control's reset action
- **THEN** every Brain returns to full emphasis and the remembered lens is cleared

#### Scenario: Dim every Brain
- **WHEN** a reader unchecks the last remaining checked Brain
- **THEN** the graph renders every Brain at full emphasis rather than an all-dimmed graph

#### Scenario: Share while dimmed
- **WHEN** a reader with Research dimmed copies a neighborhood link and another reader opens it
- **THEN** the recipient sees the neighborhood with every Brain at full emphasis and no lens information in the URL

#### Scenario: Focus outranks the lens
- **WHEN** a reader with Research dimmed opens a focused neighborhood that contains Research notes
- **THEN** the focused note and its direct neighbors, including the Research notes, render at full emphasis while unrelated Research notes stay dimmed
