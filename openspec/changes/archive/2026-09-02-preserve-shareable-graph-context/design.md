## Context

See `proposal.md` for motivation. Workspace note paths already encode owning-Brain identity, while `brains` and `focus` query values encode selected graph scope and persistent graph focus. Global-graph note links currently retain `brains` but discard `focus`; note-page Graph navigation is then reconstructed from Brain scope alone. The static output cannot use request-time server state, so all first-visit restoration must be derivable in the browser from validated path and query data.

`BaseLayout.astro` owns both the always-visible workspace Home action and the expandable navigation. `graph-view.ts` owns focused graph state and creates note destinations, while `routes.ts` provides canonical query serialization and validation primitives.

## Goals / Non-Goals

**Goals:**

- Use one canonical URL representation for selected Brain scope and originating graph focus across graph-to-note-to-graph navigation.
- Validate return context against the published Brain registry and graph identities before exposing a focused graph destination.
- Keep note ownership in the namespaced path and treat query values only as browsing and return context.
- Render note Home and Graph as one accessible, responsive control without duplicating Graph in the expandable menu.

**Non-Goals:**

- Persist graph filters, camera coordinates, dragged positions, transient hover, or local connection-map state.
- Change Markdown links, note slugs, canonical owning-Brain routes, or the Brain chooser's selection workflow.
- Replace browser Back behavior or add a client-side router.

## Decisions

### Carry originating focus in the note URL

When global graph focus exists, every note navigation initiated from that graph will append the canonical selected Brain set and the focused composite note to the destination note URL. The focus value remains the graph's pinned subject even when the reader opens one of its neighbors. When no graph focus exists, note links retain only the selected Brain scope.

This uses URL state because it survives copying, a fresh browser session, static hosting, and browser history. Keeping focus only in `history.state`, session storage, or a referrer was rejected because recipients and new tabs would lose it. Encoding a complete return graph URL as one opaque parameter was rejected because it duplicates route parsing and makes canonical validation harder.

### Treat note-page focus as return context, not note identity

The note page will parse the selected scope and originating focus independently from its namespaced owner path. It will build the visible Graph destination only after validating that the Brain selection is canonical and the focus exists within the graph context allowed by that selection. Invalid focus is dropped while valid scope is retained; invalid scope follows existing invalid-context recovery behavior. The note's metadata, canonical route, and current-note focused-neighborhood action continue to use the note itself.

This separation prevents a neighboring note opened from a pinned neighborhood from accidentally becoming the new focus. Reusing the opened note as the return focus was rejected because it changes the reader's pinned exploration state.

### Centralize context-preserving route composition

Route utilities will compose and parse Brain scope plus optional graph focus in a deterministic order while preserving fragments and the configured base path. All graph note exits and other audited context-dependent workspace links will use those utilities rather than manually concatenating query strings. Unit tests will cover canonical order, encoding, malformed duplicates, unknown IDs, and focus validation.

Extending the existing route layer is preferred over page-specific string handling because the reported first-visit failure is a URL contract issue shared by generated and copied links.

### Render a dedicated note navigation pill in the shared layout

`noteContext` will cause the shared layout to render a left-side two-segment pill containing Home and the context-aware Graph link. The expandable right-side actions will omit Graph only for note pages; non-note pages retain current Graph placement. Existing action sizing, tooltip, focus, reduced-motion, and base-path conventions will be reused, with responsive styles ensuring the left pill and right launcher do not collide with note content.

Keeping this in the shared layout avoids duplicating navigation markup in note templates. Moving the entire expandable launcher beside Home was rejected because the request concerns direct graph return, while Search and reports remain secondary navigation.

## Risks / Trade-offs

- [Copied note URLs become longer because they include selection and focus context] -> Keep only canonical Brain IDs and one composite focus ID; do not encode filters, camera, or layout data.
- [Using `focus` outside graph routes could be confused with current-note focus] -> Document and test it as originating graph return context on note routes, and keep the current-note action generated separately.
- [Static HTML initially contains a fallback Graph URL before client validation] -> Make the fallback safe and unpinned, then update only after validated URL parsing; browser tests must verify first-visit behavior after page initialization.
- [The new left pill can crowd narrow note headers] -> Reuse 44-pixel compact actions, test supported phone widths, and keep it in the fixed header slot rather than the title flow.
- [Some context-dependent links may still be built outside the graph] -> Audit all generated workspace destinations and add regression assertions that no valid scoped destination depends on storage or history.

## Migration Plan

1. Add route-level context composition and validation while retaining current unscoped URL behavior.
2. Update graph-created note destinations to include originating focus only when persistent focus exists.
3. Update note-page Graph destination resolution and shared navigation markup/styles.
4. Build the static site and exercise direct, combined, focused, invalid-context, base-path, desktop, and phone cases.

No persisted data migration is required. Rollback consists of reverting the route propagation and layout changes; note URLs carrying the extra recognized query value remain valid note paths and degrade to the previous unpinned behavior when the logic is absent.
