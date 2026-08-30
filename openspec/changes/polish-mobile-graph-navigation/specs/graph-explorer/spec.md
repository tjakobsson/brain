## MODIFIED Requirements

### Requirement: Meaningful visual encoding
Graph nodes and edges SHALL visibly encode brain membership and cross-brain relationships without relying on color alone. A per-brain graph MUST distinguish foreign boundary nodes from local nodes while retaining discernible type, status, and connectivity encoding. A combined graph MUST assign each brain a consistent accent and provide a legend mapping accents and non-color markers to brain identity.

In a per-brain graph, foreign boundary nodes and cross-brain edges MUST use a neutral, lower-emphasis treatment than local content while retaining a visible non-color foreign marker. Every foreign label that is rendered MUST include an explicit `@brain` identity. Combined graphs SHALL continue to render every selected brain at full emphasis.

#### Scenario: Recognize a foreign node
- **WHEN** a reader views a per-brain graph containing a linked note from another brain
- **THEN** the foreign note has a non-color foreign marker, any rendered label identifies the target brain, and its muted treatment remains visually subordinate to local notes

#### Scenario: Recognize brains in a combined graph
- **WHEN** a reader views notes from several selected brains
- **THEN** the graph and legend identify each node's owning brain without requiring hover or color perception

#### Scenario: Hubs stand out
- **WHEN** a note has many more links than the median visible note
- **THEN** its node is visibly larger than low-connectivity notes

#### Scenario: Established notes are distinguishable
- **WHEN** a reader views a per-brain or combined graph
- **THEN** established notes remain visually distinguishable from draft notes without hovering

## ADDED Requirements

### Requirement: Compact mobile graph controls
On narrow viewports, the global graph SHALL present Filters, Fit view, Related brains when available, and Legend as distinct icon actions within one horizontal pill. The pill MUST remain within the viewport, stay clear of the collapsed mobile navigation launcher, preserve touch targets of at least 44 by 44 CSS pixels, and expose an accessible name and state for every action.

#### Scenario: Use graph controls on a phone
- **WHEN** a reader opens a per-brain graph with related brains available on a narrow viewport
- **THEN** all four icon actions fit in one horizontal pill without clipping, horizontal overflow, or overlap with the collapsed navigation launcher

#### Scenario: Toggle related brains
- **WHEN** a reader activates the Related brains icon action
- **THEN** its pressed state changes without changing the action's width or displacing the other controls

#### Scenario: Identify icon actions
- **WHEN** assistive technology examines the graph control pill
- **THEN** Filters, Fit view, Related brains, and Legend expose distinct accessible names and their decorative icons are not announced separately

### Requirement: Readable related-brain graph
A per-brain graph on a narrow viewport SHALL preserve a readable node composition when related brains are shown. Labels MUST be selected so visible text remains individually legible rather than forcing every related note label into the fitted view, while foreign nodes remain identifiable through their non-color marker and rendered foreign labels retain `@brain` identity.

#### Scenario: Show many related notes on a phone
- **WHEN** a reader enables related brains and the boundary contains more labels than can fit legibly in the viewport
- **THEN** the graph renders a collision-managed subset of labels and retains a readable node cluster instead of collapsing into overlapping text

#### Scenario: Fit a related-brain graph
- **WHEN** automatic or reader-triggered fitting runs after related brains become visible
- **THEN** the fit accounts for the labels selected at the fitted state without zooming out to accommodate labels that are not rendered

### Requirement: Concise contextual graph legends
The global graph and every rendered note-page connection map SHALL provide a Legend information action that opens a concise, accessible popover without permanently covering the graph. The legend MUST explain status markers and connectivity size, and MUST add brain ownership, related-note, or cross-brain edge explanations when those encodings can appear in that graph.

#### Scenario: Explain a global graph
- **WHEN** a reader opens Legend on a global graph
- **THEN** the popover briefly explains status markers, node size, and every brain-aware encoding applicable to the current graph mode

#### Scenario: Explain a connection map
- **WHEN** a reader opens Legend on a note-page connection map
- **THEN** the popover briefly explains status markers, node size, and related-note and cross-brain encodings that can appear in that map

#### Scenario: Operate a legend accessibly
- **WHEN** a keyboard, touch, or assistive-technology user opens and closes Legend
- **THEN** the trigger exposes its open state, the popover content is perceivable, and focus remains predictable
