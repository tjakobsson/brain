## Why

Note pages currently bury linked mentions below the connection map, and wiki-links split across Markdown source lines remain plain text instead of becoming navigable links. The workspace chooser also lets a wrapping `@brain` identifier change individual card geometry on desktop, producing an uneven, distracting grid.

## What Changes

- Place Linked mentions and Potential links before the note-page Connection map while continuing to omit empty sections and empty maps.
- Present deterministic plain-text title matches as Potential links and mark each matching phrase in source prose with a subtle, non-clickable treatment so it cannot be mistaken for an authored wiki-link.
- Recognize valid wiki-links whose target, heading, or alias contains a soft source line break within one Markdown paragraph, rendering them as the same local, cross-brain, heading, alias, or unwritten link they would be without source wrapping.
- Keep desktop Brain chooser cards visually aligned when long `@brain` identifiers wrap, without hiding or truncating Brain identity.
- Add representative wrapped-link and long-Brain-ID fixtures and capture early desktop screenshots in the change catalog so the first visual implementation can be reviewed before final polish.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `link-intelligence`: Rename unlinked mentions to Potential links, distinguish their plain-text matches inline, and require both mention sections to appear before the Connection map on note pages.
- `inline-markup-rendering`: Extend wiki-link rendering across soft Markdown source line breaks.
- `brain-workspaces`: Require stable, aligned desktop Brain cards when identifiers wrap.

## Impact

The change affects note-page composition, the shared wiki-link parser and remark rendering path, plain-text title-match rendering, workspace chooser markup or responsive styles, public demo fixtures, and focused unit and browser coverage. It changes no routes, persisted data, public configuration, or dependencies.
