## MODIFIED Requirements

### Requirement: Custom static not-found recovery
The generator SHALL emit a complete custom `404.html` document using the shared site presentation. Static preview and live-serving commands MUST return that document with HTTP status 404 for unknown in-base page routes while preserving the originally requested browser URL for context inference. The page MUST provide usable graph recovery without requiring client-side JavaScript and MUST expose a Search trigger that progressively opens the shared quick switcher when scripting is available. When client-side data is available, it SHALL additionally show one deterministic published-note recommendation from the valid namespaced Brain path or the whole available vault or workspace in that priority order, and MUST NOT infer scope from query parameters. Missing assets and requests outside a configured base MUST continue to return a non-success status and MUST NOT be rewritten as successful pages.

#### Scenario: Serve a custom local 404
- **WHEN** preview or live serving receives an unknown page route within the configured base
- **THEN** it returns the generated not-found document with status 404 and leaves the requested URL available to the page

#### Scenario: Recover without JavaScript
- **WHEN** a reader opens the not-found document with client-side scripting unavailable
- **THEN** the page still offers deterministic navigation to the full workspace graph or single-vault graph

#### Scenario: Search from a missing page
- **WHEN** a reader activates Search on the not-found document with client-side scripting available
- **THEN** the shared quick switcher opens without navigating away from the requested missing URL

#### Scenario: Recommend a scoped note
- **WHEN** scripting is available and a missing URL lies beneath a configured Brain path
- **THEN** the page recommends one published note from that Brain and visibly identifies its owning Brain

#### Scenario: Recommend across an unscoped site
- **WHEN** a missing URL has no valid Brain path, regardless of any query parameters it carries
- **THEN** the page recommends one published note from the available vault or workspace and offers the root recovery destination

#### Scenario: Keep missing resources unsuccessful
- **WHEN** a browser requests a missing asset or a route outside the configured site base
- **THEN** the server responds with a non-success status without redirecting to a successful content route
