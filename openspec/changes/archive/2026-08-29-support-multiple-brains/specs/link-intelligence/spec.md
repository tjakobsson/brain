## MODIFIED Requirements

### Requirement: Linked mentions (backlinks)
Every note page SHALL list all notes in the workspace that link to it, including notes owned by other brains. Each entry MUST include the source brain, source note title, and surrounding context. Notes with no inbound links MUST NOT render an empty section.

#### Scenario: Show a cross-brain backlink
- **WHEN** Engineering links to a Design note
- **THEN** the Design note's linked mentions identify Engineering, the source note, and the link context

#### Scenario: Backlink with context
- **WHEN** note A contains the sentence `This builds on [[Note B]] in practice`
- **THEN** note B's linked mentions show note A with the surrounding sentence and its owning brain

#### Scenario: No inbound links
- **WHEN** a note has no inbound links from any configured brain
- **THEN** no empty linked-mentions section is rendered on its page

### Requirement: Unlinked mentions
Every note page SHALL surface unlinked mentions from other notes in the same brain whose prose contains the note's title without a local link. Brain MUST NOT infer unlinked mentions across brains because titles are not globally unique. Unlinked mentions MUST remain separate from linked mentions.

#### Scenario: Detect an unlinked local mention
- **WHEN** one Engineering note mentions another Engineering note's title without linking it
- **THEN** the target note reports the source under unlinked mentions

#### Scenario: Ignore equal foreign titles
- **WHEN** Design prose contains a title also used by an Engineering note without an explicit cross-brain link
- **THEN** Brain does not report the Design prose as an unlinked mention of the Engineering note

#### Scenario: Plain-text mention detected
- **WHEN** a note's prose mentions another title in the same brain without linking to it
- **THEN** the target note shows the source under unlinked mentions

#### Scenario: Linked notes are not double-reported
- **WHEN** one note both links to and mentions another note in the same brain
- **THEN** the source appears under linked mentions only

### Requirement: Orphan report
Each brain's orphan report SHALL list notes with zero resolved inbound links from any configured brain. A resolved cross-brain inbound link MUST prevent a note from being classified as an orphan.

#### Scenario: Foreign link connects a note
- **WHEN** a Research note is linked only from Engineering
- **THEN** the Research note does not appear in Research's orphan report

#### Scenario: Orphan identified
- **WHEN** a note has no inbound links from any configured brain
- **THEN** it appears on its owning brain's orphan report

### Requirement: Build-time graph dataset
The build SHALL emit graph data with a globally unique composite node ID for each note, including its brain ID, title, namespaced URL, type, status, tags, and link degree. It SHALL emit one edge per resolved local or cross-brain link and identify cross-brain edges. Unresolved links MUST NOT produce edges or phantom nodes.

#### Scenario: Emit a cross-brain edge
- **WHEN** Engineering note A links to Design note B
- **THEN** graph data contains both namespaced nodes and one edge marked as crossing from Engineering to Design

#### Scenario: Keep duplicate titles distinct
- **WHEN** two brains contain notes with the same title
- **THEN** graph data assigns distinct composite IDs and routes to both nodes

#### Scenario: Dataset reflects vault
- **WHEN** note A links to note B within one brain
- **THEN** graph data contains both namespaced nodes with correct metadata and one resolved edge

#### Scenario: Unresolved links excluded
- **WHEN** a note links to a nonexistent local or foreign note
- **THEN** graph data contains no edge or phantom node for the unresolved target
