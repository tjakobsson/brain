## Why

Published tables lack the grid and row contrast needed for quick scanning, while code blocks, callouts, and Brain cards use inconsistent container treatments. Brain identity is also represented by a generic diamond and the shipped favicon still carries the Astro mark rather than a Brain mark.

## What Changes

- Render Markdown tables with a compact GitHub-style grid, alternating neutral body rows, and contained horizontal overflow on narrow screens.
- Refine fenced and inline code styling around the existing GitHub syntax themes, using simple muted backgrounds, a top-right copy control on every fenced block, and line numbers for recognized code fences.
- Replace accent-edge callout cards with restrained semantic backgrounds and correctly styled titles and bodies.
- Remove decorative accent rules from Brain cards and identify each Brain with a reusable brain-shaped SVG glyph tinted by that Brain's configured accent.
- Reuse the Brain glyph in contextual navigation and as the generated site's favicon while preserving non-color identity text.
- Add representative demo content and browser coverage for the revised Markdown and Brain identity presentation in light, dark, desktop, and mobile contexts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `note-publishing`: Define readable table presentation and refine the visual contract for Brain callouts.
- `code-block-rendering`: Align fenced and inline code presentation with the requested GitHub-style document treatment.
- `brain-workspaces`: Require the chooser and contextual navigation to use the Brain glyph without relying on color alone.
- `brain-product-interface`: Extend the public Brain identity to the generated site's favicon and reusable visual mark.

## Impact

The change affects shared prose and workspace styles, code-block enhancement behavior, the Brain chooser, contextual navigation, the public favicon asset, demo fixtures, and browser tests. Markdown syntax, workspace configuration, generated routes, and source Brain files remain compatible. No new runtime dependency is expected because the copy behavior can use the browser Clipboard API and the Brain mark can be an owned SVG component and favicon asset.
