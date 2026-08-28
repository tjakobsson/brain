## 1. Project Scaffold

- [x] 1.1 Scaffold Astro project in repo root (TypeScript strict, minimal starter) and verify `astro dev` serves the default page
- [x] 1.2 Add dependencies (`zod`, `gray-matter`, `sigma`, `graphology`, `graphology-layout-forceatlas2`, `seedrandom`, `fuse.js` (D6 fallback — `fzf-for-js` is unpublished/404 on npm), `pagefind` as devDep) — look up and pin the latest stable + secure patch of each at install time, verify each license is on the permissive allowlist (design D8), and verify install succeeds
- [x] 1.3 Create `vault/` with 3–5 seed notes exercising every convention (types, statuses, tags, aliases, heading links, an unwritten link) and verify the notes are valid Obsidian-style markdown

## 2. Vault Conventions & Collection

- [x] 2.1 Create `src/content.config.ts` with a `notes` collection (`glob()` loader, `base: "./vault"`, slugified `generateId`) and zod schema per spec (title/type/status/tags/created/updated with defaults) — verify `astro build` succeeds with valid seed notes
- [x] 2.2 Verify schema enforcement: temporarily add a note with an invalid `type` and confirm the build fails naming the file and field; remove it afterward
- [x] 2.3 Write `AGENTS.md` at repo root documenting the authoring contract (filenames, frontmatter, wiki-link syntax, no-editing scope) and verify it matches specs/vault-conventions exactly

## 3. Link Index (Phase 1 scan)

- [x] 3.1 Implement the shared wiki-link parser module (`[[title]]`, `[[title|alias]]`, `[[title#heading]]`) with unit tests covering all three forms
- [x] 3.2 Implement the vault scan (Astro integration, `astro:config:setup`): builds title→note map, throws on duplicate titles — verify duplicate titles fail the build with both file paths
- [x] 3.3 Extend the scan to produce adjacency (resolved edges only), backlinks with context lines, unlinked mentions (word-boundary, skip code blocks, min title length 4), and orphans — verify against the seed vault with a small unit/integration test per output
- [x] 3.4 Emit `graph-data.json` (nodes with id/title/url/type/status/tags/degree, edges) as a static asset and verify it exists in `dist/` after build with correct content

## 4. Wiki-Link Rendering (Phase 2)

- [x] 4.1 Implement the custom remark plugin resolving wiki-links via the Phase-1 index (aliases, heading anchors) and verify rendered HTML contains correct `<a href>` for each seed-vault link
- [x] 4.2 Add unwritten-note handling (distinct class + build warning naming source file and target) and verify the seed vault's intentional broken link warns but does not fail the build
- [x] 4.3 Add callout and highlight rendering (off-the-shelf plugin per design D3) and verify `> [!warning]` and `==text==` render with distinct styling on a note page

## 5. Note Pages & Publishing Views

- [x] 5.1 Create the note page (`src/pages/notes/[...id].astro`) rendering content plus type/status/tags/dates with visually distinct status treatments — verify a draft and an established note are distinguishable at a glance
- [x] 5.2 Create tag pages (`src/pages/tags/[tag].astro`) listing tagged notes and verify each seed tag page lists exactly its notes
- [x] 5.3 Create the recently changed view ordered by `updated`/file history and verify a touched note rises to the top after rebuild
- [x] 5.4 Verify all note pages render with JavaScript disabled (links are plain static `<a href>`)

## 6. Link Intelligence UI

- [x] 6.1 Add the "Linked mentions" section to note pages (backlinks + context line, omitted when empty) and verify against seed notes, including the empty case
- [x] 6.2 Add the "Unlinked mentions" section and verify a plain-text title mention appears there, while a linked note does not get double-reported
- [x] 6.3 Create the orphans report page and verify it lists exactly the seed vault's zero-inbound-link notes

## 7. Global Graph

- [x] 7.1 Implement build-time ForceAtlas2 layout (Barnes-Hut, seeded RNG keyed by note id) writing x/y into `graph-data.json` and verify two consecutive builds of unchanged content produce identical coordinates
- [x] 7.2 Create the global graph page with a `client:only` sigma island (dynamic import) rendering nodes colored by type, sized by degree, status-distinguishable — verify rendering against the seed vault
- [x] 7.3 Add filter controls (type/status/tag) via nodeReducer hiding, and verify deselecting a type removes those nodes and their edges
- [x] 7.4 Add graph search (dim non-matches, camera animate to selected match) and hover neighborhood highlight, and verify each interaction on the seed vault
- [x] 7.5 Wire click-to-navigate and verify clicking a node loads its note page

## 8. Local Graph

- [x] 8.1 Create the local graph island slicing the note's neighborhood (depth 1–2) from `graph-data.json`, reusing global coordinates, camera fitted to the crop — verify it matches the global graph's local shape
- [x] 8.2 Add hover + click-to-navigate to the local graph and verify on a seed note with three links

## 9. Search

- [x] 9.1 Add Pagefind post-build step (`data-pagefind-body` on the note article) and verify search returns a snippeted result for a body phrase on `astro preview`
- [x] 9.2 Build the Cmd+K quick switcher island over a generated titles+tags JSON using `fuse.js` (D6 fallback) and verify full keyboard navigation to a note and to a tag page
- [x] 9.3 Verify the switcher opens via Cmd+K from a note page, the graph page, and a tag page; verify dev mode degrades gracefully without Pagefind

## 10. Final Verification

- [x] 10.1 Run `astro build` clean (no warnings beyond the intentional unwritten-link warning) and audit the checklist: every scenario in the five spec files has been manually verified once
- [x] 10.2 Smoke-test the built site (note navigation, backlinks, unlinked mentions, orphans, both graphs, filters, search, quick switcher) on `astro preview`
- [x] 10.3 Audit the final dependency tree's licenses (`npx license-checker-rseidelsohn` or equivalent) and verify zero copyleft packages — or that each copyleft package has a corresponding ADR in `docs/adr/` per design D8
