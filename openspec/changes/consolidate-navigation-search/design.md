## Context

See `proposal.md` for motivation. `BaseLayout.astro` already emits the context switcher before Graph, Search, and the expand menu in DOM order, but `.context-switcher` is absolutely positioned outside the fixed three-rem-wide header, producing a second pill. The dedicated Search routes use Pagefind, while the always-present `QuickSwitcher.astro` uses the generated `search-index.json` and Fuse.js.

Removing the Search pages therefore crosses UI, route, generator, dependency, deterministic-output, smoke-test, and browser-test code. The quick-switcher index is independent of Pagefind and remains part of every build.

## Goals / Non-Goals

**Goals:**

- Represent the navigation and brain context as one responsive component with matching visual, DOM, and keyboard order.
- Preserve the context switcher's current destinations, active identity, accent, and accessible interaction.
- Remove Pagefind and all build/output assumptions that exist only for dedicated full-text Search pages.
- Keep quick-switcher title and tag search, scope selection, and keyboard operation unchanged.

**Non-Goals:**

- Add note-body content to quick-switcher results.
- Redesign graph-local search, which is a separate graph filtering control.
- Redirect removed Search URLs or retain a hidden full-text index for compatibility.
- Change brain selection, combined-view URL semantics, or note and tag routes.

## Decisions

### Make the existing header container size itself to unified content

Retain the current semantic order in `BaseLayout.astro`, but remove the absolute positioning and independent border, background, and shadow from the context summary. Let the header/pill contain the context switcher and icon actions as direct visual segments. Use responsive sizing and label truncation so the complete pill fits the viewport, with the context panel positioned relative to its integrated control and kept within viewport bounds.

This is preferred over moving the context switcher elsewhere in the DOM because the markup already has the required order and semantics. It is also preferred over merely offsetting page content because that would preserve two competing floating surfaces and remain fragile for long brain IDs.

### Keep one direct Search action and remove the menu link

The existing Search button remains the canonical pointer entry point and continues opening `QuickSwitcher`. Cmd+K/Ctrl+K remains the keyboard entry point. The expanded navigation menu no longer constructs a Search route or link.

This is preferred over linking the Search icon to a page because the requested retained variant is the pill dialog, and it remains available without navigation or a production-only index.

### Delete dedicated Search routes without redirects

Remove both Search page files and `SearchPage.astro`, then remove Search route fields from route contracts and combined-route generation. Builds will no longer emit `/search` or `/brains/:brainId/search`.

Redirects were considered but rejected because they would preserve routes for a feature being intentionally removed, require deciding a destination for a dialog-only interaction, and add compatibility behavior without a stated consumer requirement.

### Remove Pagefind from the generation pipeline

Remove the Pagefind dependency, post-Astro indexing pass, note indexing annotations, Pagefind route constants, and output-normalization machinery. Update generator rollback hooks, smoke tests, parity workflows, and deterministic-output tests to use the Astro output directly. Keep `search-index.json`, Fuse.js, and quick-switcher tests.

This is preferred over leaving Pagefind installed but unreachable because an unused index increases install size, build time, output size, and maintenance burden while no longer serving a user-visible feature.

### Verify behavior at component and generated-site boundaries

Route and generator tests will assert absence of dedicated Search and Pagefind outputs. Browser tests will cover the unified pill at narrow and desktop viewports, context switching, menu contents, quick-switcher scope, keyboard operation, and configured base paths.

After the Playwright checks pass, capture desktop and mobile screenshots showing the completed active-brain page with the unified pill, plus the retained quick switcher open. Store these review artifacts outside the repository under `/var/folders/2_/ftxsgry50r37hws_2rg86zhr0000gn/T/opencode/consolidate-navigation-search-screenshots/` and report their paths so they can be attached to a pull request without entering git history.

## Risks / Trade-offs

- [Quick switcher does not search note bodies] -> Make title-and-tag behavior explicit in the updated contract and retain clear placeholder/result labeling.
- [Long brain identifiers can make the unified pill too wide] -> Constrain and truncate the visible label while keeping the full identity available to assistive technology and in the context panel.
- [Removing Pagefind affects build determinism and container smoke coverage] -> Replace Pagefind-specific assertions and normalization with direct output checks, then run unit, build, and browser suites.
- [Removed Search bookmarks return not found] -> Treat route removal as an intentional breaking change and document the Search button and keyboard shortcut as migration paths.

## Migration Plan

1. Integrate and verify the context control in the navigation pill while retaining the existing quick switcher.
2. Remove Search links, pages, and route contracts.
3. Remove Pagefind generation, dependency, annotations, normalization, and associated assumptions from automation and tests.
4. Build the demo site and run unit and browser coverage at desktop, mobile, and configured-base-path viewports.
5. Capture and visually inspect the agreed Playwright screenshots outside the repository, then report their paths for pull-request attachment.

Rollback is a source revert that restores the Search routes, Pagefind pipeline, and former split-pill styling together; partial rollback would leave route or output contracts inconsistent.
