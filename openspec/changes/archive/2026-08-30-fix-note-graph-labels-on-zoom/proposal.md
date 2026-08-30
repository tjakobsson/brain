## Why

The v1.2.2 zoom-label fix works in the main graph but does not reliably reveal titles in note-page connection maps. Local graphs have topology- and host-dependent fitted camera ratios, so the shared absolute camera threshold can fail to represent how far the reader has zoomed from that graph's own overview.

## What Changes

- Reproduce the note-page connection-map failure with assertions about rendered titles, not only screenshot movement.
- Make detailed-title reveal relative to each local graph's fitted camera state so it works across neighborhood sizes and layouts.
- Restore selective labels when Fit view is used or the reader returns to the overview.
- Preserve the working main-graph behavior and existing local pan, touch, hover, click, and legend interactions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `graph-explorer`: Clarify that note-page local graphs determine detailed zoom from their own fitted overview and must prove visible title coverage in browser regression tests.

## Impact

- Affects local graph camera/label state in `src/lib/graph-view.ts` and potentially shared zoom-policy helpers in `src/lib/graph-style.ts`.
- Extends mobile browser coverage for note-page connection maps.
- No route, content, data-format, dependency, or desktop main-graph changes.
