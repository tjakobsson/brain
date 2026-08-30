## MODIFIED Requirements

### Requirement: Persistent navigation pill
The site SHALL use one top-right vertical navigation pill as its primary navigation on desktop and smaller screens. In workspace mode, a brain-glyph context control MUST be contained within that same pill and appear above Graph, Search, and the expand action. The context control and navigation actions MUST remain available without changing header modes in response to page scrolling, and the unified pill and its panels MUST avoid overlapping or hiding page content or their own controls.

#### Scenario: Navigate on desktop
- **WHEN** a reader opens any site page in a desktop viewport
- **THEN** one top-right vertical navigation pill is present instead of a full row of text navigation or a separate brain-selector pill

#### Scenario: Scroll a note page
- **WHEN** a reader scrolls down or up on a note page
- **THEN** the same unified navigation pill remains available without switching header modes

#### Scenario: Navigate on a small or coarse-pointer device
- **WHEN** a reader opens a workspace page on a small viewport or a device with a coarse primary pointer
- **THEN** the brain context control and navigation actions remain usable in one vertical pill without overlapping page content or hiding one another

#### Scenario: Read navigation order
- **WHEN** a reader encounters the navigation pill in workspace mode
- **THEN** the brain context control appears above and precedes the Graph, Search, and expand actions in visual and focus order

### Requirement: Expandable secondary navigation
The navigation pill SHALL provide a dedicated expand action, visually distinct from a hamburger menu, that reveals the remaining navigation destinations. In a single-vault or active-brain context, the expanded menu MUST include Tags, Recent, and Orphans for that context. Workspace-level pages without an active brain MUST omit those single-brain destinations. The expanded menu MUST NOT offer a second Search destination. The menu MUST support pointer and keyboard operation with an accessible name and exposed open state.

#### Scenario: Expand the remaining destinations
- **WHEN** a reader activates the expand action in a single-vault or active-brain context
- **THEN** the menu reveals links to Tags, Recent, and Orphans without a Search link

#### Scenario: Expand workspace-level navigation
- **WHEN** a reader activates the expand action on the workspace chooser or a combined graph
- **THEN** the menu does not offer Search, Tags, Recent, or Orphans

#### Scenario: Operate the pill by keyboard
- **WHEN** a keyboard user focuses and activates the brain context control, Graph, Search, the expand action, or an expanded navigation link
- **THEN** the chosen action runs and focus remains visible and follows normal navigation or dialog behavior

#### Scenario: Identify icon-only actions
- **WHEN** assistive technology examines the Graph, Search, and expand controls
- **THEN** each control exposes a distinct accessible name and the decorative icon is not announced separately

#### Scenario: Identify and switch the active brain
- **WHEN** a reader examines or activates the brain-glyph context control
- **THEN** its tooltip and accessible name identify the current context, and its viewport-contained chooser visibly marks the active brain even when an ID is long
