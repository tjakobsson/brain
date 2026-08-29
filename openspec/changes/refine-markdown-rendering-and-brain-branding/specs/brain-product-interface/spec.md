## ADDED Requirements

### Requirement: Generated sites carry Brain visual identity
The generated site SHALL use an owned brain-shaped visual mark for Brain identity rather than a framework or starter mark. The same recognizable mark MUST appear as the site favicon and wherever the interface uses a compact icon to identify a Brain. The mark MUST remain legible at favicon and navigation sizes in both supported color schemes.

#### Scenario: Identify a generated site in the browser
- **WHEN** a reader opens a generated Brain site in a browser
- **THEN** the browser tab uses the Brain mark rather than the Astro mark

#### Scenario: Reuse the mark in the interface
- **WHEN** the interface identifies a Brain in the chooser or contextual navigation
- **THEN** it uses the same recognizable mark as the favicon while retaining adjacent text for that Brain's identity
