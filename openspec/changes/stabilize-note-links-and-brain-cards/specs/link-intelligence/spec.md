## MODIFIED Requirements

### Requirement: Linked mentions (backlinks)
Every note page SHALL list all notes in the workspace that link to it, including notes owned by other brains. Each entry MUST include the source brain, source note title, and surrounding context. Linked mentions and any Potential links MUST appear after the note content and before the Connection map. Notes with no inbound links MUST NOT render an empty Linked mentions section.

Potential links SHALL use the existing deterministic unlinked-title detection: a case-insensitive whole-title match in plain prose from another note in the same Brain, excluding code, authored links, and source-target pairs that already have a wiki-link. The note page for the matched title MUST list source notes under the heading `Potential links`. On each source note page, every detected plain-text occurrence MUST remain non-clickable, retain the surrounding prose color, and receive a subtle dotted underline with a help cursor. Hover and keyboard focus MUST reveal a neutral badge that names the target and explains that the text is a potential link rather than an authored wiki-link. Notes with no detected title matches MUST NOT render an empty Potential links section.

#### Scenario: Show a cross-brain backlink
- **WHEN** Engineering links to a Design note
- **THEN** the Design note's linked mentions identify Engineering, the source note, and the link context

#### Scenario: Backlink with context
- **WHEN** note A contains the sentence `This builds on [[Note B]] in practice`
- **THEN** note B's linked mentions show note A with the surrounding sentence and its owning brain

#### Scenario: Mentions precede the connection map
- **WHEN** a note page has mentions and a Connection map
- **THEN** all rendered mention sections appear before the Connection map

#### Scenario: Show a potential link
- **WHEN** a same-Brain note contains another note's whole title in plain prose without linking to it
- **THEN** the target note lists the source under Potential links and the matching source phrase has a subtle, non-clickable dotted underline

#### Scenario: Distinguish authored and potential links
- **WHEN** a reader encounters a detected title match in note prose
- **THEN** it retains the prose color and a help cursor, and hover or keyboard focus explains that it is a potential link rather than a navigable authored wiki-link

#### Scenario: Exclude deliberate and structural text
- **WHEN** a title occurs inside code, an authored link, or a source note that already links to the target
- **THEN** the occurrence is not presented as a Potential link

#### Scenario: No inbound links
- **WHEN** a note has no inbound links from any configured brain
- **THEN** no empty linked-mentions section is rendered on its page

#### Scenario: No potential links
- **WHEN** a note has no qualifying plain-text title matches
- **THEN** no empty Potential links section is rendered on its page
