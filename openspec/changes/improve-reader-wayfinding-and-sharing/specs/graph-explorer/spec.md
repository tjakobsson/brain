## MODIFIED Requirements

### Requirement: Concise contextual graph legends
The global graph and every rendered note-page connection map SHALL provide a Legend information action that opens a concise, accessible popover without permanently covering the graph. The legend MUST explain status markers and connectivity size, and MUST add brain ownership, related-note, or cross-brain edge explanations when those encodings can appear in that graph. Every open legend popover MUST remain fully contained within the visual viewport on supported desktop, narrow, and coarse-pointer layouts, including when the global Filters panel is closed.

#### Scenario: Explain a global graph
- **WHEN** a reader opens Legend on a global graph with the Filters panel closed
- **THEN** the popover briefly explains every applicable encoding and all of its edges remain inside the viewport

#### Scenario: Explain a connection map
- **WHEN** a reader opens Legend on a note-page connection map
- **THEN** the popover briefly explains status markers, node size, and related-note and cross-brain encodings that can appear in that map

#### Scenario: Operate a legend accessibly
- **WHEN** a keyboard, touch, or assistive-technology user opens and closes Legend
- **THEN** the trigger exposes its open state, the popover content is perceivable, and focus remains predictable

### Requirement: Graph search
Graph search SHALL match note titles within the graph's current brain selection, show the owning brain for every match, and keep equal titles from different brains as distinct results. Selecting a match MUST establish the corresponding namespaced node as the graph's persistent focus, update the shareable focused-graph URL, and fit its visible neighborhood without changing graph-space node positions.

#### Scenario: Search duplicate titles
- **WHEN** two selected brains contain `Principles` and a reader searches for that title
- **THEN** both results appear with different brain labels and either result focuses the correct node

#### Scenario: Search focuses node
- **WHEN** a reader selects a graph search result
- **THEN** the matching node and its direct neighborhood become persistently focused, the camera fits that neighborhood, and the URL identifies the focused composite node

## ADDED Requirements

### Requirement: Shareable focused graph neighborhoods
The global graph SHALL let a reader persist the neighborhood currently inspected by pointer, touch, or graph search. A focused neighborhood MUST retain full emphasis for the focused note, its directly connected visible neighbors, their titles, and edges incident to the focused note while preserving unrelated markers as lower-emphasis orientation context. The focused note MUST have a persistent non-color-only indicator distinct from transient hover. The canonical graph URL MUST identify the focused composite note together with the current Brain selection, and opening that URL MUST restore the selection, focused neighborhood, and a camera fit containing the focused note and its visible direct neighbors. Focus links MUST NOT encode transient filters, dragged positions, or raw camera coordinates.

On a fine-pointer desktop graph, invoking the context menu over an eligible node marker or rendered title SHALL offer actions to pin or move focus, copy the focused-neighborhood link, and open the note. The native context menu MUST remain available over empty graph space. Touch long press and keyboard-accessible graph search MUST reach the same focused state. A reader MUST be able to copy and clear focus without relying on another right-click.

Secondary-button and context-menu gestures MUST NOT begin or continue node dragging. While a neighborhood is focused, pointer movement over other nodes MUST NOT replace the focused emphasis, reveal another neighborhood, or move graph nodes; the reader MUST clear focus before transient hover inspection resumes.

#### Scenario: Pin a hovered neighborhood
- **WHEN** a desktop reader opens the context menu over a hovered note marker or rendered title and chooses Pin neighborhood
- **THEN** that note remains visibly focused after the pointer leaves and the graph URL records its composite identity

#### Scenario: Copy a neighborhood link
- **WHEN** a reader copies the link for a focused Engineering note in an Engineering and Design combined graph
- **THEN** the copied URL records both selected Brains and the focused Engineering note without recording camera or layout coordinates

#### Scenario: Open a shared doorway
- **WHEN** another reader opens a valid focused-neighborhood URL
- **THEN** the graph restores the selected Brains, makes the focused note visible, emphasizes its direct neighborhood, and fits that neighborhood within the usable viewport

#### Scenario: Reveal a focused cross-Brain boundary
- **WHEN** a focused note in a per-Brain graph has a directly connected foreign note while general Related Brains visibility is off
- **THEN** the focused neighborhood reveals that direct foreign note and edge without revealing unrelated foreign boundary notes

#### Scenario: Preserve native empty-stage behavior
- **WHEN** a desktop reader opens the context menu over graph space that does not target a marker or rendered title
- **THEN** Brain does not suppress the browser's native context menu or change graph focus

#### Scenario: Keep context-menu gestures out of drag state
- **WHEN** a desktop reader opens a node context menu and moves the pointer before or after pinning
- **THEN** no node follows the pointer and graph-space positions remain unchanged

#### Scenario: Lock a focused neighborhood
- **WHEN** a reader moves the pointer over another node while one neighborhood is focused
- **THEN** the focused note, its direct neighbors, their titles, and incident edges remain the only emphasized neighborhood until the reader clears focus

#### Scenario: Clear an invalidated focus
- **WHEN** the reader changes Brain selection or an explicit filter so the focused note is no longer included
- **THEN** Brain clears the focus indicator and removes the focused-note state from the canonical URL

#### Scenario: Ignore recipient filter history
- **WHEN** a reader opens a focused-neighborhood URL but stored local filter state would hide the focused note
- **THEN** the shared focus takes precedence on initial restoration so the subject and its neighborhood remain visible

#### Scenario: Operate focus without a fine pointer
- **WHEN** a touch reader long-presses a note or a keyboard reader selects a graph-search result
- **THEN** Brain establishes the same persistent focused state and exposes accessible actions to copy or clear it
