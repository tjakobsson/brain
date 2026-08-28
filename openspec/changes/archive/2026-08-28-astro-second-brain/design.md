## Context

Greenfield repo (only OpenSpec metadata exists). See proposal.md for motivation. Constraints that shape the design: the site must be plain static output; the Astro content layer's `glob()` loader can read a vault directory anywhere; the AI author writes files directly, so build-time validation is the only safety net (no editor autocomplete). Vault scale target: hundreds now, design headroom to ~2,000 notes.

## Goals / Non-Goals

**Goals:**
- Single-parse efficiency: every vault scan happens once at build; runtime does zero graph/link computation.
- Deterministic builds: same vault content → same output, including graph layout.
- Vanilla-TypeScript islands only — no UI framework runtime.

**Non-Goals:**
- No SSR, API routes, or any server component (static build only).
- No client-side force simulation for the global graph.
- No visual design system work beyond what makes the above presentable (a full theme pass is a future change).

## Decisions

### D1: Vault lives at `vault/`, loaded via `glob()` loader with custom `base`

`src/content.config.ts` defines one `notes` collection: `glob({ pattern: "**/*.md", base: "./vault" })` with a zod schema per the vault-conventions spec. A `generateId` override slugifies the filename to produce URL-friendly IDs.

- **Why over `src/content/notes`**: keeps content separate from site code; `vault/` is a clean directory that Obsidian (or any tool) can open directly.
- **Why over an external path** (e.g. `~/Documents/vault`): the repo *is* the brain — notes versioned with the site, CI/deploy works without local machine state.

### D2: Two-phase build — explicit vault scan first, remark resolution second

Phase 1 (an Astro integration hooking `astro:config:setup` / plugin init): scan `vault/` once with `gray-matter` + a wiki-link regex/parser, producing a shared **link index**: title→note map, adjacency (edges), backlinks with context lines, unlinked mentions, orphans, duplicate-title detection (throw on duplicates). Phase 2: the remark plugin consumes that index purely for lookup during rendering.

- **Why not a remark side-channel** (plugin builds the index while transforming): Astro may render entries in orders/scopes that make module-level accumulation fragile, and it mixes two concerns. An explicit scan is deterministic, testable in isolation, and gives the index to page templates and the graph emitter without re-parsing.
- The scan and the remark plugin share one wiki-link parser module so syntax never drifts between resolution and indexing.

### D3: Custom remark plugin for wiki-links; off-the-shelf for callouts/highlights

The custom plugin resolves `[[title]]`, `[[title|alias]]`, `[[title#heading]]` against the Phase-1 index: resolvable → `<a href>`; unresolvable → distinct "unwritten" styling + `console.warn`. Callouts and highlights use an existing remark plugin (evaluate `remark-obsidian-md` with its wiki-link handling disabled, or `remark-callout` + `remark-mark`).

- **Why custom for wiki-links**: resolution *is* our domain logic (vault-wide title lookup, unwritten-note semantics, shared parser with the indexer). It's ~100 lines on well-trodden ground; `@portaljs/remark-wiki-link` can't feed our index and `@braindb/*` pulls in a framework we don't otherwise need.
- **Why off-the-shelf for callouts/highlights**: commodity rendering, no interaction with our data model.

### D4: Graph stack — sigma.js v3 + graphology, ForceAtlas2 precomputed at build

The Phase-1 index's adjacency feeds a `graphology.Graph` in Node at build; layout runs via `graphology-layout-forceatlas2` (Barnes-Hut, tuned gravity/scaling for cluster separation); output is `graph-data.json` (nodes: id, title, url, x, y, size from degree, color/shape inputs from type/status, tags; edges: source/target) served as a static asset. The browser island builds a graphology graph from that JSON and renders with sigma v3.

- **Why FA2 over d3-force**: ForceAtlas2 is designed for network-map cluster structure (it's the Gephi algorithm) and runs headless in Node cleanly.
- **Why precompute**: the site is stale-until-rebuild by design, so per-load client simulation buys nothing and costs jank + layout instability. Spec guarantees stable positions across loads.
- **Deterministic layout**: FA2's stochastic start is seeded via a seeded RNG (e.g. `seedrandom` keyed by note id) for the initial positions, keeping builds reproducible.
- **Why sigma v3, not v4**: v4's hybrid DOM labels are attractive but alpha; pin v3, revisit later. Sigma's reducer API implements spec'd filter (hide), search (dim + camera focus), and hover (neighborhood highlight) without touching layout.
- **Why not force-graph/cytoscape**: canvas ceilings (~1–2k nodes) sit right at our headroom boundary; reducers + WebGL give the exact filter/search UX for free-ish; cytoscape is analysis-oriented and 5× the weight.

### D5: Local graph reuses global coordinates

The per-note local graph slices the note's neighborhood (depth 1–2) from the same `graph-data.json`, **keeping the global x/y coordinates**, and fits the camera to the crop.

- **Why**: spatial consistency between local and global views (a cluster looks the same in both), zero additional layout computation, one code path. Alternative (client-side mini-simulation per note) was rejected as wasted motion and a second visual language.

### D6: Search — Pagefind for full-text, tiny custom island for the quick switcher

Pagefind runs post-build against `dist/` (`data-pagefind-body` on the article element); the quick switcher is a small vanilla-TS island over a build-generated `search-index.json` of titles + tags, fuzzy-matched with `fuse.js`.

- **Why both**: Pagefind gives ranked full-text with snippets but isn't a title-first "jump" UX; the switcher answers "open note X" in keystrokes with a ~3KB index. They complement; neither alone covers the spec.
- **Why Fuse.js**: `fzf-for-js` was the preferred smaller option, but its npm package is unpublished and returns 404. Fuse.js was the planned fallback and has a permissive Apache-2.0 license.

### D7: Vanilla TS islands, no UI framework

Sigma is framework-agnostic; the switcher and filter panel are simple DOM. Islands load with `client:only` + dynamic `import()` so note pages never pay the graph chunk; the global page and local island share one chunk.

- **Why not React**: ~40KB+ runtime to render a search box and a sigma wrapper buys nothing here.

### D8: Dependency policy — latest stable, permissive licenses only

Every dependency is looked up at install time and pinned to the latest stable release including security patches — never a version remembered from training data. Licenses are checked before adoption: only permissive licenses (MIT, ISC, BSD-2/3-Clause, Apache-2.0, CC0-1.0, 0BSD, Python-2.0, BlueOak-1.0.0) are accepted. Copyleft (GPL/AGPL/LGPL/MPL/SSPL family) is rejected unless we explicitly agree otherwise — that agreement MUST be recorded as an ADR at `docs/adr/NNNN-<title>.md` before the dependency is added.

- **Why**: the AI author/installer must not rely on stale version knowledge, and the project's license posture stays permissive by default with copyleft as a documented, deliberate exception.
- **Recorded exception**: the full-tree audit found `libvips` (LGPL-3.0, via sharp) and `lightningcss` (MPL-2.0) — both build-time-only, both accepted in `docs/adr/0001-copyleft-build-tooling.md`. All direct dependencies are permissive.

## Risks / Trade-offs

- **Adding one note reshuffles the whole global layout** (force-layout nature) → positions are only guaranteed stable *between* rebuilds (per spec); seeded RNG keeps rebuilds of unchanged content identical; accept cluster drift as the brain grows.
- **Unlinked mentions false positives** (common words that happen to be titles) → whole-title, word-boundary, case-insensitive matching; skip code blocks/links; titles under 4 chars excluded. It's advisory UI — noise is tolerable, tune later.
- **Sigma v3 maintenance drift while v4 matures** → pin exact version; v4 migration is a contained island-level change.
- **Pagefind doesn't exist in `astro dev`** (it indexes `dist/`) → search gracefully degrades to the quick switcher in dev; document the workflow (build + preview to test search).
- **Two-phase scan adds build latency** → trivial at target scale (single regex pass per file); profile if the vault passes ~5k notes.
- **`astro:config:setup` timing for the scan** → the vault must be scannable before remark runs; if hook ordering proves wrong, fall back to scanning lazily inside plugin init (memoized singleton).

## Migration Plan

Greenfield — nothing to migrate. Rollout: scaffold → conventions + rendering → link index → graphs → search, each independently verifiable per tasks.md. Rollback is `git` (site is static; `dist/` regenerates).

## Open Questions

- Deploy target (Netlify / GitHub Pages / local-only) — build stays plain static output either way.
- Final visual theme (typography, palette, dark mode) — a dedicated design pass later.
