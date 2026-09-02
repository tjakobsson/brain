## MODIFIED Requirements

### Requirement: Compact mobile graph controls
The global graph SHALL present Filters, Fit view, Related brains when available, and Legend as distinct icon actions within one compact horizontal pill on every viewport. The pill MUST remain within the graph viewport, stay clear of primary navigation, preserve touch targets of at least 44 by 44 CSS pixels, expose an accessible name and state for every action, and provide pointer users with a tooltip for each icon-only action.

#### Scenario: Use graph controls on desktop
- **WHEN** a reader opens a global graph in a desktop viewport
- **THEN** all applicable icon actions appear in one compact horizontal pill rather than separate text buttons

#### Scenario: Use graph controls on a phone
- **WHEN** a reader opens a per-brain graph with related brains available on a narrow viewport
- **THEN** all four icon actions fit in one horizontal pill without clipping, horizontal overflow, or overlap with primary navigation

#### Scenario: Toggle related brains
- **WHEN** a reader activates the Related brains icon action
- **THEN** its pressed state changes without changing the action's width or displacing the other controls

#### Scenario: Identify icon actions
- **WHEN** assistive technology or a desktop pointer user examines the graph control pill
- **THEN** Filters, Fit view, Related brains, and Legend expose distinct accessible names, pointer users can discover their labels, and decorative icons are not announced separately
