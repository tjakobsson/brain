## MODIFIED Requirements

### Requirement: Reader-controlled graph fitting
The global graph and each note page's local graph SHALL provide a visible Fit view control. On viewports wider than the narrow graph breakpoint, activating Fit view MUST place the complete rendered bounds of every included node marker and every label rendered at the fitted camera state inside the usable graph viewport with visible padding, provided each individual rendered item can fit within that viewport. On narrow viewports, Fit view MUST frame every included node marker with visible padding before selecting labels for the resulting camera state; label width MUST NOT make the camera zoom out beyond that marker-based fit. The usable graph viewport MUST exclude intersecting persistent controls and focused-neighborhood UI from its fitted area.

#### Scenario: Fit the global graph
- **WHEN** a reader activates Fit view on the global graph after loading, filtering, zooming, or panning
- **THEN** all included visible node markers fit inside the unobscured graph viewport without clipping

#### Scenario: Fit a local connection map
- **WHEN** a reader activates Fit view on a note page's connection map after zooming or panning
- **THEN** every node marker in that local graph fits inside the unobscured graph viewport without clipping

#### Scenario: Fit a long title on a phone
- **WHEN** a narrow graph includes a rendered note title whose full width would require zooming farther out than the marker-based fit
- **THEN** Fit view preserves the marker-based camera scale and selects, shortens, or omits that canvas label instead of shrinking the node composition

#### Scenario: Fit around focused-neighborhood UI
- **WHEN** persistent focused-neighborhood UI intersects the graph while Fit view runs
- **THEN** every included node marker is framed within the graph area that remains visible around that UI

#### Scenario: Fit long and highly connected notes
- **WHEN** a wide graph contains a long rendered note title or a node marker enlarged by high connectivity
- **THEN** Fit view accounts for that rendered extent rather than fitting only the node's center point

#### Scenario: Fit only included nodes
- **WHEN** global graph filters hide one or more nodes
- **THEN** Fit view excludes the hidden nodes and their labels when calculating the fitted camera state

## ADDED Requirements

### Requirement: Compact mobile focused-neighborhood bar
On a narrow global graph or neighborhood page, persistent focus information SHALL appear as a compact bar no more than 72 CSS pixels tall in its collapsed state. The collapsed bar MUST show a single-line focused-note title, an action that opens the note, and a control that reveals secondary focus information and actions. The expanded state MUST make the complete focused-note title, copy-link action, connected-domain information when present, and clear-focus action when allowed available without permanently consuming graph space. Interactive controls MUST retain touch targets of at least 44 by 44 CSS pixels and expose accessible names and expanded state.

#### Scenario: Inspect a focused graph on a phone
- **WHEN** a focused neighborhood appears on a narrow viewport
- **THEN** the focus bar remains at most 72 CSS pixels tall, identifies the focused note on one line, and leaves the rest of the graph visible

#### Scenario: Open the focused note directly
- **WHEN** a touch reader uses the collapsed focus bar
- **THEN** the reader can open the focused note without first expanding the bar

#### Scenario: Reveal secondary focus actions
- **WHEN** a reader expands the focus bar
- **THEN** the complete title and applicable copy, domain, and clear-focus controls become available with accessible touch targets

#### Scenario: Collapse focus details
- **WHEN** a reader closes the expanded focus bar
- **THEN** the bar returns to its compact state without clearing graph focus or changing node positions

### Requirement: Readable focused labels on narrow graphs
At a fitted narrow-screen overview, the graph SHALL always identify the focused note on the canvas and SHALL render only direct-neighbor labels that remain individually legible at the marker-based camera state. A canvas label that is too wide for its available space MUST be shortened or omitted instead of changing the camera scale. The complete focused-note title MUST remain available through the focused-neighborhood bar. Zooming in MUST continue to reveal eligible labels according to the progressive mobile label behavior.

#### Scenario: Fit a focused neighborhood with long titles
- **WHEN** a focused note and one or more direct neighbors have titles that cannot all fit legibly at the narrow fitted overview
- **THEN** the focused note remains identified, neighbor labels are selected or shortened, and the node composition does not collapse to fit full titles

#### Scenario: Read the complete focused title
- **WHEN** the focused canvas label is shortened on a narrow viewport
- **THEN** the reader can reveal the complete title from the focused-neighborhood bar

#### Scenario: Zoom into omitted neighbor labels
- **WHEN** a reader zooms in enough to create meaningful separation after a narrow focused fit
- **THEN** eligible direct-neighbor labels appear according to the detailed zoom state without moving nodes
