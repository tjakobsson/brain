## ADDED Requirements

### Requirement: External web links are identifiable
Authored HTTP and HTTPS links whose origin differs from the configured Brain site origin SHALL have a persistent visual external-site indicator and an accessible external-site description. The treatment MUST remain distinguishable from local wiki-links, cross-Brain links, potential links, and unwritten links without depending on color or hover. External web links SHALL retain normal same-tab navigation unless the author explicitly requests different behavior. Relative links, fragments, attachments, same-origin absolute links, `mailto:` links, and `tel:` links MUST NOT receive the external-website treatment solely because they are not wiki-links.

#### Scenario: Recognize an external website
- **WHEN** a published note links to `https://docs.astro.build/` from a Brain hosted on another origin
- **THEN** the rendered link has a solid link treatment, a conventional external-link icon, and an accessible description identifying an external site

#### Scenario: Keep same-origin links internal
- **WHEN** a note contains an absolute HTTP URL whose origin matches the configured Brain site
- **THEN** the rendered link does not receive the external-site indicator

#### Scenario: Preserve non-web link semantics
- **WHEN** a note links to a relative attachment, heading fragment, email address, or telephone number
- **THEN** Brain preserves that link type without labelling it as an external website

#### Scenario: Navigate in the current tab
- **WHEN** a reader activates an authored external web link without an explicit new-context instruction
- **THEN** the browser follows it in the current tab

#### Scenario: Wrap external links on a phone
- **WHEN** an external link wraps across lines in a narrow note column
- **THEN** its indicator remains associated with the link without causing horizontal page overflow or obscuring adjacent punctuation
