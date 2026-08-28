## Purpose

Makes the vault graph settle into a stable, readable composition that responds to the current viewport and user interactions without continuous motion.

## ADDED Requirements

### Requirement: Controlled initial settling
The global graph SHALL begin from its deterministic build-time layout and animate into a settled composition. Motion MUST stop automatically after convergence or a bounded time limit.

#### Scenario: Graph settles after loading
- **WHEN** a reader opens the graph with motion enabled
- **THEN** nodes move smoothly from the stable baseline into their settled positions and stop without further input

#### Scenario: Settling remains bounded
- **WHEN** the graph cannot reach the movement threshold promptly
- **THEN** the system stops settling within 2.5 seconds

### Requirement: Viewport-aware composition
The graph SHALL adapt its visible composition to the current graph viewport while preserving recognizable cluster relationships.

#### Scenario: Phone orientation changes
- **WHEN** a reader rotates a phone between portrait and landscape
- **THEN** the graph animates to use the new width and height and refits the visible nodes within the viewport

#### Scenario: Graph container resizes
- **WHEN** the graph container dimensions change without a page reload
- **THEN** the graph debounces repeated resize events and performs one responsive refit and settle for the final dimensions

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
