## MODIFIED Requirements

### Requirement: Note pages with resolved wiki-links
Every note SHALL be published at a route namespaced by its owning brain. Local and cross-brain links MUST render as static internal hyperlinks to the target note's namespaced URL, honoring aliases and heading anchors. Cross-brain links MUST include a visible brain label and a non-color-only distinction from local links.

#### Scenario: Publish duplicate titles across brains
- **WHEN** two brains each contain a note titled `Principles`
- **THEN** each note has a distinct namespaced page and links resolve to the intended brain

#### Scenario: Render a foreign link
- **WHEN** an Engineering note contains `[[@design/Interaction model|the design model]]`
- **THEN** the page renders a static link reading `the design model`, identifies Design beside it, and navigates to Design's note

#### Scenario: Heading anchor link
- **WHEN** a note contains `[[@research/Cognitive load#Clustering]]`
- **THEN** the published link navigates directly to that heading on Research's note page

#### Scenario: Static output
- **WHEN** a workspace site is built
- **THEN** local and cross-brain links are plain static `<a href>` elements that work with JavaScript disabled

### Requirement: Unwritten notes are visible, not fatal
A local or cross-brain link whose note target does not exist SHALL render with visually distinct unwritten styling and MUST produce a build warning naming the source brain, source file, target brain, and target title. A cross-brain link to an undeclared brain SHALL use a distinct invalid-brain diagnostic. Unresolved links MUST NOT fail a non-strict build.

#### Scenario: Link to an unwritten local note
- **WHEN** a published note contains `[[Future idea]]` and its brain has no such note
- **THEN** the page identifies an unwritten local note and the build warns with the owning brain and source

#### Scenario: Link to an unwritten foreign note
- **WHEN** a note contains `[[@design/Future idea]]` and Design is declared but has no such note
- **THEN** the page identifies an unwritten Design note and the build warning preserves that target brain

#### Scenario: Link to unwritten note
- **WHEN** a published note targets a missing local or foreign note in a non-strict build
- **THEN** the build warns and the page renders the target with unwritten-note styling

## REMOVED Requirements

### Requirement: Obsidian-flavored markdown extensions
**Reason**: Brain no longer promises native Obsidian compatibility or defines its Markdown features through another product.

**Migration**: Existing callout and highlight syntax remains supported under the new Brain Markdown extensions requirement.

## ADDED Requirements

### Requirement: Brain Markdown extensions
The renderer SHALL support Brain callouts such as `> [!note]` and `> [!warning]` as styled admonition blocks, and `==highlighted text==` as highlighted text. These constructs are part of Brain's authoring contract regardless of how other Markdown tools interpret them.

#### Scenario: Render a Brain callout
- **WHEN** a note contains a `> [!warning]` callout block
- **THEN** it renders as a visually distinct warning admonition rather than a plain blockquote
