## 1. Workspace configuration and inputs

- [x] 1.1 Add the versioned JSON workspace types, parser, ID and accent validation, hierarchy cycle checks, deterministic default accents, relative path resolution, and per-brain exclusions; verify unit tests cover valid manifests and each invalid registry case from `brain-workspaces`.
- [x] 1.2 Add `--workspace <path>` to build, preview, and serve inputs as mutually exclusive with `--vault`, pass the selected mode through internal settings, and verify generator input tests cover defaults, conflicts, malformed JSON, and unsupported manifest versions.
- [x] 1.3 Extend generator safety validation to realpath every workspace input, reject duplicate brain roots and output or work-directory overlap with any input, and verify safety tests cover symlink escapes, missing roots, unreadable roots, and actionable brain-specific diagnostics.
- [x] 1.4 Add a public multi-brain fixture with grouped brains, duplicate cross-brain titles, local and foreign links, equal attachment paths, unresolved targets, and varied metadata; verify the fixture itself contains no duplicate title within one brain.

## 2. Workspace content model and link intelligence

- [x] 2.1 Replace the single vault snapshot with a normalized workspace snapshot carrying mode, registry, per-brain manifests, and ownership-aware notes while preserving single-`--vault` behavior; verify existing vault scan, manifest, and snapshot tests still pass.
- [x] 2.2 Introduce one collision-safe composite note identity and add `brainId` to notes, edges, backlinks, diagnostics, and content entries; verify tests distinguish equal titles and slugs from different brains without changing single-brain IDs or routes.
- [x] 2.3 Extend the shared wiki-link parser for `[[@brain-id/Note Title]]`, aliases, and headings, reserve the leading namespace marker, and verify parser and text-reduction tests cover local links, foreign links, malformed namespaces, and titles containing ordinary `@` characters.
- [x] 2.4 Build the workspace index by resolving local targets in the source brain and foreign targets in the declared target brain; verify tests cover cross-brain backlinks with context, global inbound orphan counting, same-brain unlinked mentions, unknown brains, missing foreign notes, self-links, and edge deduplication.
- [x] 2.5 Isolate attachment discovery and resolution by owning brain and namespace generated asset routes by brain in workspace mode; verify attachment tests cover equal filenames across brains, ambiguity within one brain, escape rejection, exclusions, and unchanged single-brain output paths.
- [x] 2.6 Update the Astro content loader, remark renderer, strict-link handling, and process state to consume the workspace snapshot; verify a workspace build renders local, foreign, unwritten-note, and unknown-brain cases with the specified diagnostics and static links.

## 3. Routes, pages, and workspace navigation

- [x] 3.1 Add mode-aware route helpers for brain graphs, notes, tags, recent notes, orphans, search, namespaced assets, and canonical combined selections; verify route tests cover base paths, encoded segments, registry-order selection, duplicates, and unknown IDs.
- [x] 3.2 Generate workspace note and report pages from composite content IDs while retaining current pages in single-brain mode; verify static path tests and a production fixture build publish duplicate titles at distinct namespaced URLs.
- [x] 3.3 Render cross-brain links and linked mentions with the target or source brain accent, visible `@brain` text, and non-color-only foreign treatment; verify Markdown rendering tests and accessibility assertions cover aliases, headings, unwritten targets, keyboard navigation, and color-independent labels.
- [x] 3.4 Replace the workspace root graph with a responsive hierarchy-aware brain chooser supporting one-brain entry and multi-brain selection, and add an always-visible active-brain or combined-context switcher to navigation; verify Playwright tests cover desktop and mobile selection, shareable URLs, browser reload, unknown selections, and returning to the chooser.

## 4. Graph and search views

- [x] 4.1 Extend graph data with composite IDs, brain metadata, cross-brain edge flags, namespaced routes, and deterministic workspace positions; verify dataset and layout tests cover duplicate titles, foreign edges, unresolved exclusions, repeatable output, and the existing single-brain contract.
- [x] 4.2 Derive per-brain graphs with direct foreign boundary nodes and combined graphs from URL-selected brains, then add brain filters and canonical URL updates; verify graph interaction tests cover hidden incident edges, foreign boundary retention, duplicate-title search, and node navigation.
- [x] 4.3 Implement brain-aware graph rendering with local metadata colors, foreign markers and labels, combined-view accents, cross-brain edge treatment, and accessible legends; verify browser screenshots and DOM assertions demonstrate brain identity without relying on color on desktop and mobile.
- [x] 4.4 Add brain metadata to Pagefind pages and the quick-switch index, scope full-text and fuzzy search to the active brain by default, and add explicit selected-workspace and all-brains scopes; verify search tests distinguish duplicate titles, preserve namespaced routes, and search all brains from the chooser.
- [x] 4.5 Generate contextual tags, recent notes, orphans, nearby-note lists, and local graphs using the active brain while including resolved foreign relationships where specified; verify page tests cover a note connected only by a cross-brain inbound link and tags shared by several brains.
- [x] 4.6 Add a local-first related-brains toggle to per-brain graphs and visually subordinate enabled foreign boundary nodes and cross-brain edges; verify local nodes remain unchanged, combined graphs retain full emphasis, and desktop/mobile browser tests cover both toggle states.

## 5. Live serving and distributed generation

- [x] 5.1 Extend live serving to watch the workspace manifest and every active brain root, update the root set only after successful activation, and retain the last successful site and watch set after failure; verify live-server tests cover edits, additions, removals, hierarchy changes, failed manifest updates, recovery, debouncing, and shutdown.
- [x] 5.2 Update container build and preview examples and smoke tests for read-only workspace manifests and brain mounts; verify a network-disabled container builds and previews the multi-brain fixture without writing to any input.
- [x] 5.3 Add mutually exclusive workspace input support to the composite GitHub Action and parity workflows, including caller-prepared multi-repository checkouts; verify Action parity compares source and container workspace output and reports unavailable brain mounts by ID.
- [x] 5.4 Add workspace input support to the reusable Pages workflow for sources inside its caller checkout and reject external sources with Action-based guidance; verify workflow fixtures cover single-brain defaults, multi-brain publication inputs, conflicting inputs, and failed validation without deployment.

## 6. Documentation and migration

- [x] 6.1 Replace active Obsidian compatibility claims in package metadata, README, contributor instructions, diagnostics, and examples with the Brain Markdown contract while retaining `.obsidian` only as a documented default exclusion; verify a repository search leaves Obsidian references only where they describe migration or historical artifacts.
- [x] 6.2 Document the workspace JSON schema, hierarchy semantics, stable IDs, cross-brain grammar, public-content boundary, namespaced routes, search and graph scope, single-brain migration path, container mounts, Action checkouts, and Pages limitation; verify every documented source and container command runs against the public fixture.

## 7. End-to-end verification

- [x] 7.1 Run `npm test` and fix regressions across configuration, scanning, links, attachments, routes, graph, generator, and live-serving unit and integration suites.
- [x] 7.2 Run `npm run test:browser` and verify chooser, contextual navigation, foreign links, graph views, search scopes, and responsive behavior pass in all configured browser projects.
- [x] 7.3 Build the public fixture in both `--vault` and `--workspace` modes and compare repeated workspace builds for deterministic content; verify single-brain routes remain unchanged and workspace output contains no machine-specific source paths.
- [x] 7.4 Run the 2,000-note stress build with multiple brains and verify build completion, graph payload size, and interaction tests remain within the existing performance target without visible graph jank.
