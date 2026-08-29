## 1. Unified Navigation Pill

- [x] 1.1 Update the shared header and navigation styles so the brain context control is visually contained before Graph, Search, and expand actions in one pill; verify DOM and focus order matches visual order.
- [x] 1.2 Constrain and truncate long context labels and position both context and navigation panels within the viewport; verify the pill and panels do not cover note content or hide controls at desktop and narrow mobile widths.
- [x] 1.3 Preserve the brain mark, active label, accents, chooser link, and brain-switch links in the integrated context control; verify pointer and keyboard context switching still reaches the expected routes.

## 2. Single Search Experience

- [x] 2.1 Remove the Search link from the expandable navigation menu while retaining the direct quick-switcher Search button and Cmd+K/Ctrl+K shortcut; verify both retained entry points open the dialog on chooser, active-brain, and combined pages.
- [x] 2.2 Delete the root and namespaced Search pages and the shared Search page component; build the site and verify `/search` and `/brains/:brainId/search` outputs are absent.
- [x] 2.3 Remove dedicated Search fields and Pagefind paths from route contracts and combined-route generation; update route and page-path tests to verify all remaining routes still honor configured base paths.
- [x] 2.4 Retain `search-index.json`, Fuse.js, title and tag matching, scope selection, brain ownership labels, and keyboard result navigation; verify focused quick-switcher browser coverage passes for active, selected, and all-brains scopes.

## 3. Remove Pagefind Pipeline

- [x] 3.1 Remove Pagefind from the generator and package dependencies, including the lockfile, late-failure hooks, and note indexing annotations; run a clean install and production build and verify no `pagefind/` output is generated.
- [x] 3.2 Remove Pagefind-only output normalization code and fixtures and simplify source, Action, and distribution parity commands; verify deterministic output and parity tests compare Astro output successfully without Pagefind flags.
- [x] 3.3 Replace Pagefind-specific generator, stress-build, container smoke, and browser assertions with checks for the quick-switcher index and removed Search outputs; run the affected focused test files and verify they pass.

## 4. Integration Verification

- [x] 4.1 Add or update browser tests for one-pill geometry, non-overlap, action order, menu contents, context panels, visible focus, and quick-switcher behavior at desktop and mobile viewports; run the affected Playwright projects and verify they pass.
- [x] 4.2 Run `npm test`, `npx astro build`, and the full required browser suite; verify the OpenSpec contract checks, production build, navigation, configured subpath behavior, and search behavior all pass.
- [x] 4.3 Use Playwright to capture desktop and mobile screenshots of an active-brain page showing the unified pill and the open quick switcher, save them outside the repository under `/var/folders/2_/ftxsgry50r37hws_2rg86zhr0000gn/T/opencode/consolidate-navigation-search-screenshots/`, visually inspect the images, and report their paths for later pull-request attachment without committing them.
