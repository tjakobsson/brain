# Inline Markup Rendering Specification

## Purpose

Keeps supported Brain inline markup reliable when authors wrap highlighted sentences and other paragraph text across source lines.

## Requirements

### Requirement: Highlights can span soft line breaks
The renderer SHALL recognize a Brain `==highlighted text==` span when its content crosses one or more soft line breaks within the same Markdown paragraph. It MUST preserve all highlighted text and line breaks in their original order inside one continuous highlighted region.

#### Scenario: Highlighted sentence wraps once
- **WHEN** a paragraph contains `==` followed by highlighted words, a soft line break, more highlighted words, and closing `==`
- **THEN** all words on both source lines render as one highlighted region

#### Scenario: Highlighted sentence wraps more than once
- **WHEN** a valid highlight span crosses multiple soft line breaks within one paragraph
- **THEN** all enclosed text renders once in one highlighted region and retains its source order

#### Scenario: Multiline highlight has surrounding prose
- **WHEN** ordinary prose appears before and after a valid highlight span that crosses a soft line break
- **THEN** only the delimited content is highlighted and all surrounding prose remains intact

### Requirement: Custom inline extensions have consistent line-break behavior
Every documented custom inline extension SHALL handle line breaks inside and around its delimiters according to the Brain Markdown contract. Parsing one inline extension MUST NOT consume a line break, delimiter, or unrelated text that belongs outside its matched span.

#### Scenario: Supported inline syntax appears after wrapped prose
- **WHEN** valid custom inline syntax appears after a soft line break in a paragraph
- **THEN** the renderer produces the same inline element it would produce if the preceding prose and syntax were on one source line

#### Scenario: Unsupported multiline delimiters
- **WHEN** an inline extension's opening and closing delimiters cross a soft line break but that syntax does not support multiline spans
- **THEN** the renderer leaves that delimiter sequence unconverted

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
