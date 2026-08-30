## MODIFIED Requirements

### Requirement: Responsive fenced-block presentation
Fenced code blocks SHALL be visually distinct from inline code and SHALL remain usable within the note column at narrow viewport widths. Long lines MUST be accessible without widening the page or clipping their content. The copy control MUST remain available in the same compact top area as the first line instead of creating a separate control-height band above the code. Any content that passes beneath the fixed top-right control MUST remain revealable through the block's horizontal scrolling. A line-number gutter MUST remain aligned with recognized code while the block scrolls. Inline code MUST use a compact, borderless muted background while fenced blocks use block spacing, padding, controls, and syntax presentation.

#### Scenario: Long line on a narrow viewport
- **WHEN** a fenced block contains a line wider than the note column on a phone-sized viewport
- **THEN** the block provides horizontal overflow within its own bounds and the page does not become wider than the viewport

#### Scenario: Inline and fenced code coexist
- **WHEN** a note contains both inline code and a fenced code block
- **THEN** inline code retains its compact borderless treatment while the fenced block uses block spacing, padding, controls, and syntax presentation

#### Scenario: Long numbered code with a copy control
- **WHEN** a recognized code block has enough lines and line width to overflow a phone-sized viewport
- **THEN** its line numbers remain aligned, its code remains horizontally accessible, and all content can scroll clear of the top-right copy control

#### Scenario: Compact copy-control spacing
- **WHEN** a fenced code block displays its top-right copy control
- **THEN** the first code line starts within the block's normal top padding rather than below a separate empty control band
