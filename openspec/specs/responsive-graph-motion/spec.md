# Responsive Graph Motion Specification

## Purpose

Makes the vault graph settle into a stable, readable composition that responds to the current viewport and user interactions without continuous motion.

## Requirements

### Requirement: Controlled initial settling
The global graph SHALL begin from its deterministic build-time layout and animate its nodes and camera framing into a settled composition as one continuous transition. It MUST NOT start a distinct follow-up camera transition after the initial node settling completes. Motion MUST stop automatically after convergence or a bounded time limit.

#### Scenario: Graph settles after loading
- **WHEN** a reader opens the graph without a stored composition and with motion enabled
- **THEN** nodes and camera framing transition smoothly into the fitted settled composition and stop without a subsequent camera movement

#### Scenario: Settling remains bounded
- **WHEN** the graph cannot reach the movement threshold promptly
- **THEN** the system stops settling within 2.5 seconds

### Requirement: Viewport-aware composition
The global graph and each note-page connection map SHALL adapt their visible composition to the current graph viewport while preserving recognizable cluster relationships. A connection map MUST compose its displayed neighborhood for its own viewport rather than relying only on inherited full-graph coordinates and camera fitting. Resize observations and responsive-policy changes belonging to the same viewport change MUST be coalesced into one final update. When that update triggers animated settling, nodes and camera framing SHALL move as one continuous transition and MUST NOT start a distinct follow-up node or camera transition after settling completes.

#### Scenario: Phone orientation changes
- **WHEN** a reader rotates a phone between portrait and landscape
- **THEN** the graph animates to use the new width and height and refits the visible nodes within the viewport as one continuous transition

#### Scenario: Graph container resizes
- **WHEN** the graph container dimensions change without a page reload
- **THEN** the graph debounces repeated resize events and performs one coordinated responsive refit and settle for the final dimensions without subsequent camera movement

#### Scenario: Desktop filter panel changes graph width
- **WHEN** a reader opens or closes the filter panel and the graph viewport width changes
- **THEN** the graph performs one coordinated transition into the fitted composition for the new width

#### Scenario: Mobile filter panel overlays the graph
- **WHEN** a reader opens or closes an overlay filter panel without changing the graph viewport dimensions
- **THEN** the panel transition does not initiate graph settling or camera movement

#### Scenario: Clustered local neighborhood opens on a phone
- **WHEN** a connection map's notes have inherited full-graph positions that overlap or align too closely for its narrow viewport
- **THEN** the map settles the neighborhood into a readable viewport-aware composition and fits that composition within the map

#### Scenario: Browser zoom crosses a responsive breakpoint
- **WHEN** browser zoom changes the effective viewport and its graph label policy in one operation
- **THEN** the graph applies the final dimensions and label policy through one coordinated update rather than competing resize and breakpoint settles

#### Scenario: Hover after responsive settling
- **WHEN** the coordinated responsive update has completed and the reader inspects a node
- **THEN** inspection does not initiate, repeat, or resume graph settling

### Requirement: Interaction-triggered settling
The graph SHALL briefly adapt after filtering or node dragging, and new motion SHALL replace rather than overlap motion already in progress.

#### Scenario: Filters change the visible graph
- **WHEN** a reader changes type, status, or tag filters
- **THEN** the remaining visible nodes settle and the camera refits them within the graph viewport

#### Scenario: Reader finishes dragging a node
- **WHEN** a reader releases a dragged node after moving it
- **THEN** the dragged neighborhood performs a brief local settle without discarding the reader's placement

#### Scenario: A new trigger interrupts settling
- **WHEN** a resize, filter change, or drag release occurs while settling is active
- **THEN** the previous motion stops and only the latest requested settle continues

### Requirement: Stable spatial continuity
The graph SHALL retain deterministic build positions as its baseline and SHALL preserve settled positions during the current browser session for the same vault data and viewport class.

#### Scenario: Reader returns to the graph
- **WHEN** a reader navigates to a note and returns to the graph in the same browser session without rebuilding the vault
- **THEN** the graph resumes from its stored settled composition instead of starting from an unrelated arrangement

#### Scenario: Vault data changes
- **WHEN** the vault graph changes after a rebuild
- **THEN** stored positions for the previous graph are ignored

### Requirement: Motion accessibility and performance
Graph settling SHALL respect the reader's reduced-motion preference and MUST preserve fluid graph interaction at the supported vault size of 2,000 notes.

#### Scenario: Reduced motion is requested
- **WHEN** `prefers-reduced-motion: reduce` is active
- **THEN** the graph applies the responsive composition and camera fit without animated node movement

#### Scenario: Large vault settles
- **WHEN** the graph contains 2,000 notes
- **THEN** layout computation does not block panning, zooming, or page controls on the main thread

#### Scenario: Page is not visible
- **WHEN** the browser tab becomes hidden during graph motion
- **THEN** active settling stops until a later user-visible trigger requests it again
