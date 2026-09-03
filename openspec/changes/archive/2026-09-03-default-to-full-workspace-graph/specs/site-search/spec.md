## MODIFIED Requirements

### Requirement: Quick switcher
The quick switcher SHALL fuzzy-match note titles and tags within the page context's scope by default: the active Brain on Brain-scoped pages and note pages, and every configured Brain on workspace-level pages. On Brain-scoped and note pages it SHALL offer an explicit workspace scope covering every configured Brain. Scope MUST derive from the page's namespaced path and MUST NOT depend on query parameters or stored state. Every note result MUST identify its owning brain, and confirming a note result MUST navigate to its namespaced route as a pathname-only link. Equal titles from different Brains MUST remain distinct.

#### Scenario: Distinguish duplicate titles
- **WHEN** the current switcher scope contains equal note titles from two brains
- **THEN** both results appear with brain labels and each navigates to the correct note

#### Scenario: Keep local navigation concise
- **WHEN** a reader opens the switcher on an Engineering page or an Engineering-owned note
- **THEN** the default results contain Engineering notes and tags only

#### Scenario: Widen to the workspace
- **WHEN** a reader switches the switcher to workspace scope from an Engineering note
- **THEN** results from every configured Brain appear with their owners identified

#### Scenario: Search from a combined-context note
- **WHEN** a reader opens the switcher from an Engineering note reached through the full workspace graph
- **THEN** the switcher defaults to Engineering from the note's path and offers the workspace scope, without reading any query or stored context

#### Scenario: Preserve scope after a jump
- **WHEN** a reader confirms a Design note result while in workspace scope
- **THEN** the browser opens the Design note's namespaced route with no query context and the switcher there defaults to Design from the path

#### Scenario: Keyboard-first navigation
- **WHEN** a reader opens the switcher, types part of a title, selects a result with arrow keys, and presses Enter
- **THEN** the browser navigates to the selected namespaced note without pointer input and without query context

#### Scenario: Tag jump
- **WHEN** a reader types a tag name into the quick switcher
- **THEN** matching tag pages in the current scope appear among the results with brain context

### Requirement: Search availability on every page
The navigation pill's Search action and the Cmd+K or Ctrl+K shortcut SHALL open the quick switcher on the workspace root graph, workspace-wide reports, Brain pages, note pages, neighborhood pages, and Brain-scoped reports. Search opened from a workspace-level page MUST use all configured brains because no active brain exists. The generated site MUST NOT expose a dedicated general Search page or a secondary Search menu destination.

#### Scenario: Search from the chooser
- **WHEN** a reader activates the pill's Search action or presses the search shortcut on the workspace root graph
- **THEN** the switcher opens with results from all configured brains and labels their owners

#### Scenario: Shortcut works from any page
- **WHEN** a reader presses the search shortcut on a root, note, neighborhood, graph, tag, or report page
- **THEN** the quick switcher opens with the page context's scope

#### Scenario: Use the only search entry point
- **WHEN** a reader examines the navigation pill and expanded menu
- **THEN** the direct Search action opens the quick switcher and no link to a dedicated Search page is offered
