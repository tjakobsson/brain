## ADDED Requirements

### Requirement: Readable Markdown tables
The renderer SHALL present Markdown tables as compact document tables with a visible boundary around every header and body cell. Body rows MUST alternate between neutral backgrounds, and table text and boundaries MUST remain legible in both supported color schemes.

#### Scenario: Scan a table in a published note
- **WHEN** a note contains a Markdown table with a header and several body rows
- **THEN** the published table shows a complete cell grid and alternating neutral body-row backgrounds

#### Scenario: Read a wide table on a phone
- **WHEN** a Markdown table is wider than the note column on a phone-sized viewport
- **THEN** the table scrolls horizontally within its own bounds without widening the page or clipping cell content

## MODIFIED Requirements

### Requirement: Brain Markdown extensions
The renderer SHALL support Brain callouts such as `> [!note]` and `> [!warning]` as styled admonition blocks, and `==highlighted text==` as highlighted text. Callouts MUST distinguish their title from their body, use a restrained semantic background appropriate to their type, and preserve normal readable body text. Callouts MUST NOT use an asymmetric accent border as decoration. These constructs are part of Brain's authoring contract regardless of how other Markdown tools interpret them.

#### Scenario: Render a Brain callout
- **WHEN** a note contains a `> [!warning]` callout block
- **THEN** it renders as a visually distinct warning admonition with a clear title, readable body, and warning treatment that does not depend on an accent-edge border

#### Scenario: Render a neutral note callout
- **WHEN** a note contains a `> [!note]` callout block
- **THEN** it renders on a neutral tonal background without a decorative colored stripe, outline, or shadow
