## Why

The workspace brain selector currently renders as a separate floating pill beside the navigation pill, where it can cover note content on narrow screens. Search is also split between the pill's quick switcher and dedicated full-text pages, creating two competing experiences for the same task.

## What Changes

- Place a brain-glyph context control inside the primary vertical navigation pill, above Graph, Search, and the expandable menu, at every viewport size.
- Identify the active brain in the context control's tooltip and accessible name, visibly mark it in the opened chooser, and preserve access to the root chooser and other brains.
- Make the pill's quick switcher the only general site-search interface and retain its keyboard shortcut and context-aware scope options.
- Remove Search from the expanded navigation menu.
- **BREAKING** Remove the dedicated `/search` and `/brains/:brainId/search` pages and their Pagefind full-text search implementation; those URLs are no longer generated.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `site-navigation`: Integrate brain context into the single navigation pill and remove the dedicated Search page destination from secondary navigation.
- `site-search`: Define the quick switcher as the sole general search experience and remove dedicated full-text search pages.
- `brain-workspaces`: Use the integrated context switcher and quick switcher as the workspace's brain identification and search entry points.

## Impact

- Affects the shared Astro layout, navigation and context-switcher styling, quick switcher, route definitions, static page generation, route tests, and search tests.
- Removes the Search page component and root and namespaced search page files.
- Removes Pagefind-specific UI code and route constants where no longer needed; the lightweight quick-switcher search index remains.
- Requires responsive and keyboard-accessibility verification for the unified pill and context panel.
