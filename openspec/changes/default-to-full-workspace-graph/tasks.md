## 1. Baseline and Route Grammar

- [x] 1.1 Build the demo workspace from the unchanged `main` and capture before screenshots of the chooser, the combined graph with a pinned neighborhood, a note page, and the "Choose a valid set of Brains" card at desktop and phone widths into `openspec/changes/default-to-full-workspace-graph/screenshots/before/`, and verify the files exist.
- [x] 1.2 Add a note-neighborhood route builder to `routes.ts` for both modes (`<note path>/graph/`), remove `withBrainScope`, `withGraphContext`, `combinedRoutes`, `brainSelectionContext`, and `canonicalBrainSelection`, and verify `routes.test.ts` covers the neighborhood route under root and non-root base paths and asserts that no shareable route builder emits `?` or `#`.
- [x] 1.3 Simplify `not-found.ts` to infer scope from the namespaced Brain path only and recover to the full workspace graph otherwise, and verify `not-found.test.ts` covers Brain-path recovery, workspace-level recovery, and ignored `brains` query parameters.

## 2. Neighborhood Pages

- [ ] 2.1 Add `notes/[slug]/graph` pages for workspace and vault modes that render `GlobalGraph` with the note's composite ID as the initial focus attribute, and verify `npm run build` on the demo vault and demo workspace emits one `graph/index.html` beneath every note directory.
- [ ] 2.2 Teach `mountGlobalGraph` to take initial focus from the host attribute on neighborhood pages, keep that page's URL free of query state, navigate to another note's neighborhood page when focus moves there, and verify graph-interaction unit tests cover attribute focus, focus moves, and the absence of `replaceState` query writes on neighborhood pages.
- [ ] 2.3 Point the copied neighborhood link, the note page's Graph action, and the note's focused-neighborhood action at the neighborhood page path with in-session `?focus=` return context resolved to the originating note's page when valid, and verify unit or browser tests assert each emitted link is pathname-only under root and subpath bases.
- [ ] 2.4 Render the connected-domains list on workspace-mode neighborhood pages from the focused node's neighbors with mark, accent, title, count, dimmed-elsewhere state, and lens toggle, omit it in vault mode, and verify a workspace Playwright test checks chip contents for a note with cross-Brain neighbors and a vault Playwright test checks the list is absent.

## 3. Full Workspace Root and Brain Lens

- [ ] 3.1 Make the workspace root render the full workspace graph with the About disclosure, redirect `/graph` to the root, remove `graph.astro`'s combined branch and selection recovery card, and verify the workspace Playwright suite opens `/` cold and sees nodes from every configured Brain with no selection step.
- [ ] 3.2 Replace the Brain context switcher with a checkbox lens control listing every Brain in declared hierarchy with mark, accent, title, Enter action, and reset action, and verify Playwright tests cover unchecking, reset, the all-dimmed fallback, and that no `?brains=` appears in the URL after any interaction.
- [ ] 3.3 Persist the lens in `localStorage` keyed by site base with an in-memory fallback, apply it through the node and edge reducers as dimming with focus precedence, and verify graph-interaction unit tests cover dim-not-remove, focus-over-lens, filter-removes-before-lens, and storage-unavailable behavior, plus a Playwright test that reloads in the same context and finds the lens restored.
- [ ] 3.4 Update the legend and Brain control copy to describe dimming as emphasis rather than hiding and keep dimmed nodes hoverable and clickable, and verify a Playwright test hovers and opens a dimmed node.
- [ ] 3.5 Make graph search cover dimmed Brains on the full graph and verify a Playwright test finds and focuses a dimmed Brain's note at full emphasis.

## 4. Remove Selection Grammar and Aggregate Reports

- [ ] 4.1 Delete `WorkspaceRouteRedirect.astro` and render root `/tags`, `/recent`, and `/orphans` as workspace-wide aggregates with owner labels using the existing report components, and verify Playwright tests open each cold and see entries from more than one Brain with owners identified.
- [ ] 4.2 Remove `?brains=` propagation from note links, the quick switcher, tag, recent, and orphan links, default the quick switcher scope to the page's namespaced context with a workspace-scope toggle, and verify search unit and Playwright tests cover Brain-page default scope, note-page default scope, and workspace widening without query context.
- [ ] 4.3 Update shared navigation so Home opens the full workspace graph, workspace-level pages reveal workspace-wide Tags, Recent, and Orphans, and Graph outside note pages targets the page context's graph, and verify workspace and subpath Playwright tests assert each destination.
- [ ] 4.4 Retire `BrainChooser.astro` as the root page while keeping hierarchy, description, and accent presentation in the lens control panel, and verify a Playwright test confirms the control lists Brains in declared hierarchy order.

## 5. Verification and Documentation

- [ ] 5.1 Update README and docs URL examples to the neighborhood path form and remove combined-view and chooser instructions, and verify `grep -rn "brains=" README.md docs` returns nothing.
- [ ] 5.2 Add a route regression test that enumerates every generated shareable destination for the demo workspace and asserts none depends on query or fragment, and verify it passes.
- [ ] 5.3 Run `npm test` and resolve all unit and active-spec validation failures.
- [ ] 5.4 Run `npm run test:browser` and resolve all desktop, mobile, cold-link, lens, neighborhood, aggregate-report, and subpath regressions.
- [ ] 5.5 Run the stress suite against the demo workspace and a synthetic 2,000-note workspace with the full graph as the default load and verify pan and zoom stay within the existing performance assertions.
- [ ] 5.6 Run `npm run build` for the demo vault and demo workspace and verify no new unresolved-route warnings and a page count increase equal to the note count.
- [ ] 5.7 Capture after screenshots matching the before set into `openspec/changes/default-to-full-workspace-graph/screenshots/after/`, including the root full graph, the lens control, a neighborhood page with domain chips, and a neighborhood page opened with a dimmed Brain, and verify the files exist.
