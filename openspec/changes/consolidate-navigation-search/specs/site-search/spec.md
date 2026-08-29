## MODIFIED Requirements

### Requirement: Quick switcher
The quick switcher SHALL be the site's sole general search interface and SHALL fuzzy-match note titles and tags within the active brain by default. It SHALL offer an explicit workspace scope covering the current combined selection or all configured brains. Every note result MUST identify its owning brain, and confirming a result MUST navigate to its namespaced route.

#### Scenario: Distinguish duplicate titles
- **WHEN** the current switcher scope contains equal note titles from two brains
- **THEN** both results appear with brain labels and each navigates to the correct note

#### Scenario: Keep local navigation concise
- **WHEN** a reader opens the switcher in Engineering without selecting workspace scope
- **THEN** the default results contain Engineering notes and tags only

#### Scenario: Keyboard-first navigation
- **WHEN** a reader opens the switcher, types part of a title, selects a result with arrow keys, and presses Enter
- **THEN** the browser navigates to the selected namespaced note without pointer input

#### Scenario: Tag jump
- **WHEN** a reader types a tag name into the quick switcher
- **THEN** matching tag pages in the current scope appear among the results with brain context

### Requirement: Search availability on every page
The navigation pill's Search action and the Cmd+K or Ctrl+K shortcut SHALL open the quick switcher on brain pages, note pages, reports, combined views, and the root brain chooser. Search opened from the chooser MUST use all configured brains because no active brain exists. The generated site MUST NOT expose a dedicated general Search page or a secondary Search menu destination.

#### Scenario: Search from the chooser
- **WHEN** a reader activates the pill's Search action or presses the search shortcut on the root chooser
- **THEN** the switcher opens with results from all configured brains and labels their owners

#### Scenario: Shortcut works from any page
- **WHEN** a reader presses the search shortcut on a chooser, note, graph, tag, report, or combined page
- **THEN** the quick switcher opens with the context-appropriate scope

#### Scenario: Use the only search entry point
- **WHEN** a reader examines the navigation pill and expanded menu
- **THEN** the direct Search action opens the quick switcher and no link to a dedicated Search page is offered

## REMOVED Requirements

### Requirement: Full-text search
**Reason**: The dedicated full-text page duplicates the navigation pill's quick switcher and creates a competing search experience.

**Migration**: Use the navigation pill's Search action or Cmd+K/Ctrl+K quick-switcher shortcut to search note titles and tags in the active, selected, or all-brains scope.
