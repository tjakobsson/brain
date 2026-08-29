## Context

See `proposal.md` for motivation. The generator currently passes one `BRAIN_VAULT` into one Astro content loader, publishes one process-wide snapshot, keys notes by lower-cased title and slug, and exposes unnamespaced routes and datasets. The same assumptions are repeated in attachment handling, remark link rendering, graph layout, search, reports, the live watcher, and distribution inputs.

The site must remain a deterministic static build. Source directories are read-only, browser editing and authentication remain absent, and no runtime service can resolve or fetch remote brains. Existing single-vault consumers need a supported path while workspace mode introduces deliberately different root and note routes.

## Goals / Non-Goals

**Goals:**

- Normalize single-brain and multi-brain inputs into one internal workspace model.
- Keep brain identity stable when display hierarchy changes.
- Resolve local and cross-brain links in one build-time index without globally reserving note titles.
- Make active, foreign, and combined brain context explicit in routes, links, graph views, search, reports, and navigation.
- Keep generated output reproducible and every input directory read-only.
- Preserve the current single-brain CLI mode and generated route shape as a migration path.

**Non-Goals:**

- Runtime federation, remote index discovery, or adding brains from the browser.
- Authentication, private-note filtering, editing, synchronization, or conflict resolution.
- Moving source notes into one directory or imposing workspace hierarchy on note folders.
- Native compatibility with Obsidian or another knowledge-management application.
- Cross-brain attachment references or inferred cross-brain unlinked mentions.

## Decisions

### Use a versioned JSON workspace manifest

Add `--workspace <path>` as mutually exclusive with `--vault <path>`. The manifest uses JSON so Node can load it without a new parser dependency and so malformed input has a precise location. Version 1 has workspace display metadata, global exclusions, presentation groups, and brain entries:

```json
{
  "version": 1,
  "title": "Product knowledge",
  "groups": [
    { "id": "company", "title": "Company" },
    { "id": "product", "title": "Product", "parent": "company" }
  ],
  "brains": [
    {
      "id": "design",
      "title": "Design",
      "path": "./design",
      "group": "product",
      "description": "Interaction and visual design",
      "accent": "#b56cff",
      "exclusions": ["private/**"]
    }
  ]
}
```

Paths and brain exclusions resolve relative to the manifest. Brain and group IDs use lower-case kebab-case. Groups form a validated acyclic presentation tree and never enter note identity. Missing accents are assigned deterministically from a built-in accessible palette. User-provided accents must use a constrained color format and the UI must pair them with text or shape markers.

Alternatives considered were repeated `--brain id=path` options and directory conventions. Repeated options cannot carry hierarchy and display metadata cleanly. Directory conventions couple identity to filesystem layout and make reorganizing a workspace break links.

### Normalize inputs into a workspace snapshot

Introduce an internal workspace definition and snapshot containing ordered brain definitions, one manifest per brain, one workspace-wide note index, and resolved attachments. `--vault` creates an implicit single-brain definition internally; workspace mode loads explicit definitions. This avoids maintaining separate scanners and link resolvers.

Each note carries `brainId`, a per-brain title key, slug, composite ID, and route. Composite IDs are constructed through one encoder rather than string concatenation at call sites. Maps are nested by brain ID or use encoded tuples so delimiter characters in titles cannot collide.

The process publishes one workspace snapshot instead of one vault snapshot. Astro content entry IDs use the composite ID in workspace mode. Single-brain mode keeps current public routes and may keep current collection IDs where Astro path generation depends on them.

An alternative was one Astro collection per brain. Collection names must be known while loading configuration and would spread dynamic collection handling through every page. One collection with explicit ownership keeps page generation and shared indexing tractable.

### Keep source scanning isolated, then resolve links globally

Scan and validate each brain independently first. Per-brain scans enforce title uniqueness, resolve attachments only inside the owning brain, and preserve brain-relative source paths. After all scans succeed, build a workspace index keyed by `(brainId, lowerCaseTitle)`.

The shared link parser produces an optional target brain in addition to title, heading, alias, and source offset:

```text
[[Local Note]]
[[@design/Foreign Note]]
[[@design/Foreign Note#Heading|alias]]
```

A missing namespace resolves to the source note's brain. A leading `@brain-id/` selects a declared foreign brain. The namespace marker is reserved and cannot be interpreted as part of a local title. Unknown brains and missing notes remain separate diagnostic kinds so strict mode and rendered unwritten labels can report the right cause.

Backlinks and graph edges use the global index. Unlinked mention detection stays inside each brain. Orphan status considers inbound edges from the whole workspace. Attachment resolution never crosses a brain boundary.

The suffix form `[[Note@brain]]` was rejected because titles can contain `@`, parsing must work before the target brain is known, and typing `[[@` provides a natural completion point for brain IDs.

### Namespace workspace routes while preserving single-brain routes

Workspace mode uses stable ID routes:

```text
/                                      chooser
/brains/<brain-id>                     brain graph
/brains/<brain-id>/notes/<slug>        note
/brains/<brain-id>/tags                tags
/brains/<brain-id>/tags/<tag>          tag
/brains/<brain-id>/recent              recent
/brains/<brain-id>/orphans             orphans
/brains/<brain-id>/search              scoped search
/graph?brains=<sorted-comma-list>      combined graph
/search?brains=<sorted-comma-list>     combined search
```

Selection query values are validated against the generated registry, deduplicated, and serialized in registry order for canonical shareable URLs. Static pages contain the full configured registry needed for client-side selection. An invalid selection renders a clear error state and does not silently fall back.

Single-brain `--vault` mode retains `/`, `/notes/<slug>`, and existing report routes. This isolates the breaking URL change to sites that opt into workspace mode while letting existing consumers migrate deliberately.

### Emit one workspace dataset and derive contextual views

Graph data contains all workspace nodes and edges, with composite IDs, brain metadata, cross-brain flags, namespaced routes, and precomputed positions. The build computes one deterministic layout over the full workspace. Per-brain views select all local nodes plus foreign nodes directly connected to them. Combined views select nodes owned by the requested brains and only edges whose endpoints remain visible.

Per-brain graphs retain current local type, status, and degree encoding. Foreign boundary nodes use the target brain accent, a foreign marker or ring, an `@brain` label, and distinct cross-brain edges. Combined graphs use brain accent as the primary hue, status intensity, degree size, explicit brain labels or markers, and metadata filters for type and status. A legend explains the current encoding.

One dataset avoids emitting every possible brain combination and allows a shareable query selection. The 2,000-note target makes this reasonable, but payload and render performance remain part of verification.

### Carry brain context through static search indexes

Every searchable page and quick-switch entry includes `brainId`, brain title, and namespaced route. Pagefind records brain ownership as filter metadata. Search pages choose the active brain or selected set when issuing a query. The quick-switcher loads one static title/tag index and applies scope before fuzzy matching, with an explicit control to broaden from the active brain to the selected workspace or all brains.

Tags are scoped by brain in contextual routes. The combined search may aggregate matching tags, but navigation from a tag result must retain or clearly choose a brain rather than implying tags are globally owned.

### Treat workspace builds as one atomic unit

Build, preview, and serve validate every brain before publishing output. Live serving watches the manifest and all current brain manifests. A successful manifest change replaces the watched-root set after activation; a failed change keeps the previous site and watch set active while continuing to watch the manifest for recovery.

Container users mount the workspace manifest and referenced sources read-only beneath paths visible to the manifest. The GitHub Action can consume multiple repositories that the caller checks out into its job workspace. The reusable Pages workflow has a separate job and therefore supports only workspace sources in its own caller checkout; cross-repository publication uses a caller-authored job with explicit checkouts and the build Action.

### Retire Obsidian as a contract, not plain Markdown

Documentation and active specifications will call inputs Brain directories or Brain workspaces. Plain `.md`, YAML frontmatter, readable wiki-style links, callouts, and highlights remain supported because they are useful Brain features. References to native Obsidian resolution and Obsidian-defined behavior are removed. `.obsidian` remains a default exclusion only to avoid unexpectedly publishing migration metadata.

## Risks / Trade-offs

- [A full workspace dataset can increase initial graph and switcher payloads] -> Measure the 2,000-note fixture, omit body content from navigation datasets, and keep Pagefind as the full-text index.
- [Brain accents can conflict with type and status colors] -> Use context-specific graph encoding plus persistent labels, markers, and legends instead of relying on hue alone.
- [Namespaced routes break links when a site moves from single-brain to workspace mode] -> Preserve single-brain mode, document the route change, and require stable IDs before workspace publication.
- [A workspace can expose content that collaborators expected to remain private] -> Publish only explicitly registered directories and exclusions, document that all generated content is public, and provide no automatic repository discovery.
- [Symlinks or relative paths can escape expected source boundaries] -> Resolve real paths before safety checks and reject output overlap, attachment escape, duplicate roots, and reusable-workflow sources outside its caller checkout.
- [Manifest edits can invalidate the live watch set] -> Keep the last successful site and roots active until a complete rebuild succeeds, while always retaining a watch on the manifest itself.
- [Cross-repository Pages setup is less automatic] -> Document the Action-based workflow with explicit checkouts rather than adding repository credentials and checkout policy to the reusable deployment workflow.

## Migration Plan

1. Add workspace parsing and validation without changing `--vault` behavior.
2. Normalize the loader and indexes around workspace-owned notes, then verify existing single-brain fixtures and routes remain unchanged.
3. Add a multi-brain fixture covering duplicate titles, hierarchy, cross-links, attachments, unresolved targets, search, reports, and graphs.
4. Add workspace routes and UI, followed by build, preview, serve, container, Action, and Pages inputs.
5. Replace Obsidian compatibility language in active documentation with the Brain Markdown contract and document the new link grammar and route migration.
6. Roll back a failed deployment by selecting the previous generator release or continuing to build one source with `--vault`; atomic output promotion preserves the last successful site.
