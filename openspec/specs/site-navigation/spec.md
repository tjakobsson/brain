# Site Navigation Specification

## Purpose

Provides one compact, predictable navigation control on every page and viewport while keeping Graph and Search available without opening a menu.

## Requirements

### Requirement: Persistent navigation pill
The site SHALL use a top-right navigation pill as its primary navigation on desktop and smaller screens. The pill MUST remain available without changing between a full header and compact navigation in response to page scrolling.

#### Scenario: Navigate on desktop
- **WHEN** a reader opens any site page in a desktop viewport
- **THEN** the top-right navigation pill is present instead of a full row of text navigation

#### Scenario: Scroll a note page
- **WHEN** a reader scrolls down or up on a note page
- **THEN** the same navigation pill remains available without switching header modes

#### Scenario: Navigate on a small or coarse-pointer device
- **WHEN** a reader opens any site page on a small viewport or a device with a coarse primary pointer
- **THEN** the navigation pill remains usable without overlapping or hiding its actions

### Requirement: Direct Graph and Search actions
The navigation pill SHALL expose distinct Graph and Search actions without requiring the reader to expand the navigation menu. The Graph action MUST navigate to the canonical global graph route under the configured site base path, and the Search action MUST open the quick switcher.

#### Scenario: Open the graph directly
- **WHEN** a reader activates the Graph action from a non-graph page
- **THEN** the browser navigates to the global graph without first opening the expanded menu

#### Scenario: Open search directly
- **WHEN** a reader activates the Search action from any page
- **THEN** the quick switcher opens without first opening the expanded menu

#### Scenario: Use a configured base path
- **WHEN** the generated site is hosted under a non-root base path and a reader activates Graph
- **THEN** navigation stays within that configured base path

### Requirement: Expandable secondary navigation
The navigation pill SHALL provide a dedicated expand action, visually distinct from a hamburger menu, that reveals the remaining navigation destinations. The expanded menu MUST include Tags, Recent, Orphans, and the full Search page, and MUST support pointer and keyboard operation with an accessible name and exposed open state.

#### Scenario: Expand the remaining destinations
- **WHEN** a reader activates the expand action
- **THEN** the menu reveals links to Tags, Recent, Orphans, and Search

#### Scenario: Operate the pill by keyboard
- **WHEN** a keyboard user focuses and activates Graph, Search, the expand action, or an expanded navigation link
- **THEN** the chosen action runs and focus remains visible and follows normal navigation or dialog behavior

#### Scenario: Identify icon-only actions
- **WHEN** assistive technology examines the Graph, Search, and expand controls
- **THEN** each control exposes a distinct accessible name and the decorative icon is not announced separately
