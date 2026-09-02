## Why

Links into a Brain workspace can currently depend on context established in the sender's browser, so a first-time recipient may be sent to the Brain chooser instead of the intended destination. Opening a note from a pinned graph neighborhood also loses that pinned focus when the reader uses the note's Graph navigation, making shared and exploratory paths unreliable.

## What Changes

- Make links to context-dependent workspace destinations carry enough canonical Brain scope to open the intended destination for a recipient with no prior site state.
- Preserve the originating pinned graph neighborhood when navigating from a focused graph to a note, and restore it when the note's Graph action is used.
- Keep direct note visits context-aware without fabricating prior graph focus: they continue to use the owning Brain and an unpinned graph destination.
- Move the note-page Graph action out of the expandable right-side navigation and place it beside Home in one visible two-icon pill.
- Add route and browser-level regression coverage for first-visit shared links, focused graph round trips, and the note-page navigation arrangement.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `brain-workspaces`: Require shared workspace links to resolve their destination from canonical URL context without prior browser state.
- `graph-explorer`: Preserve a pinned neighborhood as navigation context when opening a note and returning through Graph navigation.
- `site-navigation`: Present Home and context-aware Graph together as a visible two-action pill on note pages and define when Graph restores an originating focus.

## Impact

This affects logical route/query handling, global-graph note links, note-page context propagation, shared navigation markup and styling, and route/navigation tests. Generated URLs may gain an explicit graph-focus return parameter, but canonical note identity and note ownership routes remain unchanged. No new runtime dependency or content-format change is expected.
