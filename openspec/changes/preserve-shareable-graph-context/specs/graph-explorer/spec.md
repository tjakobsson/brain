## ADDED Requirements

### Requirement: Focused graph round-trip navigation
When a reader opens a note from a persistently focused global graph, the note destination SHALL retain the valid originating Brain selection and focused composite note as return context. The originating focus MAY be the opened note or another note in the same visible focused neighborhood. The note's context-aware Graph action MUST restore that originating graph selection and focus, including for a first-time recipient of the note URL, without changing the opened note's canonical identity. A direct note visit without valid originating focus context MUST NOT infer a pinned neighborhood.

#### Scenario: Return after opening the focused note
- **WHEN** a reader opens the focused note from a pinned Engineering and Design graph and then activates Graph on the note page
- **THEN** Brain returns to the Engineering and Design graph with the same note and neighborhood persistently focused

#### Scenario: Return after opening a focused neighbor
- **WHEN** a reader opens a neighboring note from a graph pinned on another note and then activates Graph on the note page
- **THEN** Brain restores the original pinned note and neighborhood rather than moving focus to the opened neighbor

#### Scenario: Open a focused-context note link without prior state
- **WHEN** a first-time visitor opens a valid note URL carrying originating graph selection and focus context and activates Graph
- **THEN** Brain restores the encoded focused graph without requiring a previous Brain selection or navigation-history entry

#### Scenario: Open a direct note without return focus
- **WHEN** a reader opens a namespaced note URL that has no valid originating graph focus context
- **THEN** the note's Graph action opens the owning-Brain graph without persistent focus

#### Scenario: Ignore invalid return focus
- **WHEN** a note URL carries a focus that is unknown or invalid for its encoded graph selection
- **THEN** Brain omits the invalid focus and provides the valid unpinned graph destination for the retained selection or owning Brain
