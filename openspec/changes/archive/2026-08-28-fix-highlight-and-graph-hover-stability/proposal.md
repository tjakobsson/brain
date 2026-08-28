## Why

Valid Obsidian highlights remain literal text when the highlighted sentence crosses a soft line break. On large graphs, hovering a node can also make the rendered graph shift under the pointer, which makes the intended node difficult to click.

## What Changes

- Render valid `==highlighted text==` spans that cross soft line breaks while preserving the highlighted text and break.
- Audit the other custom inline Markdown transforms for assumptions about line breaks inside or around delimiters, and add regression coverage for their intended Obsidian-compatible behavior.
- Keep global and local graph positions, layout state, and camera state unchanged when pointer hover starts, changes nodes, or ends.
- Keep hover neighborhood emphasis and title display usable on dense graphs without enter/leave refresh loops moving the target away from the pointer.
- Add focused parser and browser-level regression tests for both failures.

## Capabilities

### New Capabilities
- `inline-markup-rendering`: Defines reliable rendering of supported Obsidian inline syntax within multiline Markdown paragraphs.
- `graph-interaction-stability`: Defines stable graph geometry and click targets during hover interactions.

### Modified Capabilities

None.

## Impact

- Affects the custom remark text transforms and their unit tests, chiefly `src/lib/remark-highlights.ts` and related inline parsers.
- Affects Sigma hover handling and reducers in `src/lib/graph-view.ts`, plus graph browser tests.
- Does not change vault syntax, generated routes, public configuration, or stored graph layout formats.
- No new dependency is expected.
