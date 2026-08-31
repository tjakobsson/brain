## ADDED Requirements

### Requirement: Wiki-links can span soft line breaks
The renderer SHALL recognize a valid Brain wiki-link when its target, heading, or alias crosses one or more soft source line breaks within the same Markdown paragraph. It MUST resolve and render the link as if each soft line break were ordinary separating whitespace, while preserving the supported local, cross-brain, heading, alias, and unwritten-link behavior. A wiki-link MUST NOT span a Markdown block boundary.

#### Scenario: Wrapped local target
- **WHEN** a local wiki-link target is split by a soft source line break within one paragraph
- **THEN** it renders as one link to the intended local note

#### Scenario: Wrapped cross-brain link with heading and alias
- **WHEN** a valid cross-brain wiki-link has a target, heading, or alias split by soft source line breaks within one paragraph
- **THEN** it renders once with the intended foreign target, heading fragment, alias text, and foreign-link treatment

#### Scenario: Wrapped unwritten target
- **WHEN** a wiki-link split by a soft source line break targets a note that does not exist
- **THEN** the complete target renders once with unwritten-link treatment

#### Scenario: Link cannot cross a block boundary
- **WHEN** opening and closing wiki-link delimiters are separated by a Markdown block boundary
- **THEN** the renderer leaves the delimiter sequence unconverted
