## MODIFIED Requirements

### Requirement: Base-path-correct static site
The generator SHALL prefix every internal page URL, navigation target, recovery action, focused-graph link, redirect, client-side data request, search asset, graph asset, favicon, wiki-link, and copied attachment with the configured base path. The generated custom not-found document and any context-aware recommendation it loads MUST remain functional when served for an unknown nested path. An empty base path MUST remain valid for root domains and custom domains.

#### Scenario: Generate for project Pages
- **WHEN** the site is built with base path `/vault-repo`
- **THEN** all site features, focused links, and not-found recovery actions load and navigate under `/vault-repo/` without requesting application resources from the domain root

#### Scenario: Recover from a nested project path
- **WHEN** a reader requests `/vault-repo/brains/engineering/notes/missing`
- **THEN** the custom not-found page loads its styles and local recommendation data from `/vault-repo/` and keeps every recovery destination within that base

#### Scenario: Generate for a root domain
- **WHEN** the site is built with an empty base path
- **THEN** all site features use root-relative URLs without an extra path segment

### Requirement: Reproducible site content
The generator SHALL produce equivalent site files for the same generator version, vault content, and build inputs without embedding build timestamps or machine-specific paths. Every generated HTML page MUST identify the semantic Brain generator version through machine-readable metadata, and the reader-visible About surface MUST report that same value. Contextual not-found recommendations MUST be selected deterministically from the missing URL and generated note data rather than embedding build-time randomness.

#### Scenario: Repeat a build
- **WHEN** the same vault and configuration are built twice with the same generator version
- **THEN** corresponding generated site files have identical content

#### Scenario: Inspect generator provenance
- **WHEN** a reader or diagnostic tool examines any generated page
- **THEN** it can discover the same semantic Brain version reported by the generator's version command without a timestamp or machine path

#### Scenario: Repeat a missing route
- **WHEN** the same missing URL is opened repeatedly against unchanged generated content
- **THEN** the not-found page recommends the same initial note

## ADDED Requirements

### Requirement: Custom static not-found recovery
The generator SHALL emit a complete custom `404.html` document using the shared site presentation. Static preview and live-serving commands MUST return that document with HTTP status 404 for unknown in-base page routes while preserving the originally requested browser URL for context inference. The page MUST provide usable chooser or graph recovery without requiring client-side JavaScript and MUST expose a Search trigger that progressively opens the shared quick switcher when scripting is available. When client-side data is available, it SHALL additionally show one deterministic published-note recommendation from the valid selected-Brain query scope, valid namespaced Brain path, or whole available vault in that priority order. Missing assets and requests outside a configured base MUST continue to return a non-success status and MUST NOT be rewritten as successful pages.

#### Scenario: Serve a custom local 404
- **WHEN** preview or live serving receives an unknown page route within the configured base
- **THEN** it returns the generated not-found document with status 404 and leaves the requested URL available to the page

#### Scenario: Recover without JavaScript
- **WHEN** a reader opens the not-found document with client-side scripting unavailable
- **THEN** the page still offers deterministic navigation to the workspace chooser or single-vault graph

#### Scenario: Search from a missing page
- **WHEN** a reader activates Search on the not-found document with client-side scripting available
- **THEN** the shared quick switcher opens without navigating away from the requested missing URL

#### Scenario: Recommend a scoped note
- **WHEN** scripting is available and a missing URL identifies a valid Brain selection or configured Brain path
- **THEN** the page recommends one published note from that scope and visibly identifies its owning Brain

#### Scenario: Recommend across an unscoped site
- **WHEN** a missing URL has no valid Brain context
- **THEN** the page recommends one published note from the available vault or workspace and offers the root recovery destination

#### Scenario: Keep missing resources unsuccessful
- **WHEN** a browser requests a missing asset or a route outside the configured site base
- **THEN** the server responds with a non-success status without redirecting to a successful content route
