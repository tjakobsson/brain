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
Published code blocks SHALL provide coordinated light and dark presentations that follow the site's active operating-system color preference. Code text, syntax tokens, block background, and block boundary MUST remain legible in both presentations.

#### Scenario: Dark color preference
- **WHEN** the reader's active color preference is dark
- **THEN** each highlighted code block uses the dark code presentation

#### Scenario: Light color preference
- **WHEN** the reader's active color preference is light
- **THEN** each highlighted code block uses the light code presentation without requiring a page reload or client-side theme script

### Requirement: Plain-code fallback
The publisher MUST render unlabelled and unsupported-language fenced blocks as readable plain code. An unsupported language identifier MUST NOT cause an otherwise valid vault build to fail.

#### Scenario: Fence without a language
- **WHEN** a note contains a fenced code block without a language identifier
- **THEN** the published note displays its contents as a styled plain-code block

#### Scenario: Unsupported language identifier
- **WHEN** a note contains a fenced code block with a language identifier unavailable to the highlighter
- **THEN** the build succeeds and the published note displays the block as plain code

### Requirement: Responsive fenced-block presentation
Fenced code blocks SHALL be visually distinct from inline code and SHALL remain usable within the note column at narrow viewport widths. Long lines MUST be accessible without widening the page or clipping their content.

#### Scenario: Long line on a narrow viewport
- **WHEN** a fenced block contains a line wider than the note column on a phone-sized viewport
- **THEN** the block provides horizontal overflow within its own bounds and the page does not become wider than the viewport

#### Scenario: Inline and fenced code coexist
- **WHEN** a note contains both inline code and a fenced code block
- **THEN** inline code retains its compact inline treatment while the fenced block uses block spacing, padding, and syntax presentation
