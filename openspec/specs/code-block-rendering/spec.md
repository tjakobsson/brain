# Code Block Rendering Specification

## Purpose

Defines how fenced code examples are rendered as readable, static note content across supported languages, color schemes, and viewport sizes.

## Requirements

### Requirement: Language-aware fenced code blocks
The publisher SHALL syntax-highlight a fenced Markdown code block when its declared language is supported. Highlighting MUST be present in the generated static HTML and MUST NOT require client-side JavaScript.

#### Scenario: Supported language fence
- **WHEN** a note contains a fenced code block declaring a supported language such as `js`
- **THEN** the published block visually distinguishes syntax tokens and remains highlighted with JavaScript disabled

### Requirement: Color-scheme-aware code highlighting
Published code blocks SHALL provide coordinated GitHub-style light and dark presentations that follow the site's active operating-system color preference. Code text, syntax tokens, line numbers, copy controls, and muted block background MUST remain legible in both presentations. Fenced blocks MUST use a simple borderless container with the copy button as its only overlaid control and without language banners or multi-action toolbars.

#### Scenario: Dark color preference
- **WHEN** the reader's active color preference is dark
- **THEN** each highlighted code block uses the dark syntax presentation on a muted dark background without a decorative outline

#### Scenario: Light color preference
- **WHEN** the reader's active color preference is light
- **THEN** each highlighted code block uses the light syntax presentation on a muted light background without requiring a page reload or client-side theme script

### Requirement: Plain-code fallback
The publisher MUST render unlabelled and unsupported-language fenced blocks as readable plain code. An unsupported language identifier MUST NOT cause an otherwise valid vault build to fail.

#### Scenario: Fence without a language
- **WHEN** a note contains a fenced code block without a language identifier
- **THEN** the published note displays its contents as a styled plain-code block

#### Scenario: Unsupported language identifier
- **WHEN** a note contains a fenced code block with a language identifier unavailable to the highlighter
- **THEN** the build succeeds and the published note displays the block as plain code

### Requirement: Responsive fenced-block presentation
Fenced code blocks SHALL be visually distinct from inline code and SHALL remain usable within the note column at narrow viewport widths. Long lines MUST be accessible without widening the page or clipping their content. The copy control MUST remain available without obscuring code, and a line-number gutter MUST remain aligned with recognized code while the block scrolls. Inline code MUST use a compact, borderless muted background while fenced blocks use block spacing, padding, controls, and syntax presentation.

#### Scenario: Long line on a narrow viewport
- **WHEN** a fenced block contains a line wider than the note column on a phone-sized viewport
- **THEN** the block provides horizontal overflow within its own bounds and the page does not become wider than the viewport

#### Scenario: Inline and fenced code coexist
- **WHEN** a note contains both inline code and a fenced code block
- **THEN** inline code retains its compact borderless treatment while the fenced block uses block spacing, padding, and syntax presentation

#### Scenario: Long numbered code with a copy control
- **WHEN** a recognized code block has enough lines and line width to overflow a phone-sized viewport
- **THEN** its line numbers remain aligned, its code remains horizontally accessible, and the top-right copy control does not obscure the content

### Requirement: Copyable fenced blocks
Every fenced code block SHALL provide a copy icon button in its top-right corner. The button MUST have an accessible name, MUST be reachable and operable by keyboard, and MUST provide visible and assistive-technology feedback after activation. A successful activation MUST copy the block's displayed text without line-number decoration.

#### Scenario: Copy highlighted code
- **WHEN** a reader activates the copy button on a recognized language fence
- **THEN** the clipboard receives the complete code text without line numbers and the control reports success

#### Scenario: Copy a plain-text fallback
- **WHEN** a reader activates the copy button on an unlabelled or unsupported-language fence
- **THEN** the clipboard receives the complete plain-text block and the control reports success

#### Scenario: Copy with a keyboard
- **WHEN** a keyboard user focuses and activates a fenced block's copy button
- **THEN** the same content is copied and the success feedback is exposed without moving focus away from the button

### Requirement: Line numbers for recognized code
Fenced blocks with a recognized declared language SHALL display one-based line numbers aligned with their source lines. Line numbers MUST NOT become part of text selection or copied content. Unlabelled and unsupported-language blocks rendered through the plain-text fallback MUST remain unnumbered.

#### Scenario: Number recognized code
- **WHEN** a recognized language fence contains multiple lines including a blank line
- **THEN** each source line has a sequential line number beginning at 1 and the blank line retains its position in the sequence

#### Scenario: Leave plain text unnumbered
- **WHEN** a fence has no language identifier or uses an unsupported identifier
- **THEN** the published plain-text block displays no line-number gutter
