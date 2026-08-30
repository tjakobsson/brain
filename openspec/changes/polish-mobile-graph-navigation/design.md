## Context

See `proposal.md` for motivation and the three delta specs for behavior. The global graph currently fits build-time coordinates, animates responsive node positions, and then starts a separate camera fit. Opening the desktop filter panel reaches the same sequence through `ResizeObserver`. The rendered-bounds fitter mutates the custom bounding box and camera while measuring fixed-size markers and labels.

On narrow graph pages, three text controls occupy the top-left while the persistent navigation rail occupies the right. Related foreign nodes set `forceLabel`, so every long ownership label participates in fitting even when fixed-pixel text cannot remain legible at the resulting zoom. The global graph has a detailed legend inside Filters; local graphs have no legend.

The shared navigation markup currently renders brain context, Graph, Search, and a directional secondary-menu action in a permanently expanded vertical rail. The desktop form is established and remains unchanged; only the narrow mobile presentation becomes collapsible.

## Goals / Non-Goals

**Goals:**

- End automatic node and camera movement together without weakening final rendered-bounds fitting.
- Give the mobile graph compact controls and readable related-brain compositions.
- Explain graph encodings concisely in both global and local contexts.
- Reclaim mobile space with one discoverable navigation launcher and one expansion layer.
- Preserve touch sizing, keyboard operation, focus continuity, and reduced-motion behavior.

**Non-Goals:**

- Changing force-layout targets, graph data, routes, or session cache formats.
- Redesigning desktop graph controls or desktop navigation.
- Adding continuous camera tracking, a new icon dependency, or a new general popover library.
- Changing graph click-to-navigate, search, filter-value, or drag semantics.

## Decisions

### Plan the final graph view before one coordinated transition

Refactor rendered fitting so it can produce a final view plan containing the custom bounding box and camera state without coupling that plan to a camera animation. When an initial or resize layout worker returns, the motion controller will synchronously stage target positions, derive the bounded rendered fit, and restore the source frame before the browser paints. Source and target camera states will be represented against the target bounding box so installing that box does not shift the first visible frame.

Initial and resize settling will interpolate node positions and camera state from one requestAnimationFrame timeline with one easing curve and completion point. The final frame applies exact targets and commits the session once. Cancellation freezes both halves at the same generation; reduced motion applies both immediately.

Independent node and camera animations were rejected because their callbacks can drift, race on interruption, and reproduce the visible second movement. Re-fitting every frame was rejected because repeated label measurement would scale poorly at 2,000 notes.

### Keep measured dimensions authoritative for filter-panel resizing

The filter toggle will not directly invoke graph motion. On desktop, its grid-width change continues through the resize debounce and starts one coordinated settle for the final measured dimensions. Rapid toggles replace pending or active generations. The mobile filter panel remains an overlay; because the graph dimensions do not change, it starts no settle or camera movement.

This avoids duplicate control-specific resize logic and preserves response to orientation, window, and other container changes.

### Use one mobile graph control pill with stable icon actions

At the existing narrow breakpoint, Filters, Fit view, Related brains, and Legend become four fixed-size icon actions in one horizontal capsule. Inline project-owned SVGs avoid a dependency. Text remains available through accessible names and optional tooltips, while `aria-expanded` and `aria-pressed` expose filter, legend, and related-brain state. The Related brains icon does not change geometry when its state changes.

Desktop retains the current text controls. The mobile capsule is sized from four touch targets plus internal separators or gaps, and its inset reserves the collapsed navigation launcher's right-side footprint. A wrapping or horizontally scrolling toolbar was rejected because it would consume vertical space or hide actions.

### Declutter foreign labels before fitting

On narrow viewports, foreign nodes will no longer force every ownership label. They participate in the same collision and density selection as other labels, with important nodes retaining normal size-based priority. Every foreign label that is selected keeps its brain mark and `@brain` text. The existing muted, smaller foreign-node treatment and cross-brain edge treatment remain visible and are explained by the legend, so identity does not depend on rendering all titles.

Rendered fitting continues to measure every label actually selected at the candidate camera state, but it does not reserve space for suppressed labels. Desktop can retain its existing foreign-label policy where space permits. Globally disabling foreign labels was rejected because ownership context remains useful on larger canvases; truncating labels was rejected because it would obscure note identity without solving collisions between many forced labels.

### Share a concise contextual legend popover

Create one reusable graph-legend presentation used by the global control pill and the local connection-map header. Its information icon opens an anchored, dismissible popover rather than permanently covering the canvas. Common rows explain `○` draft, `◇` developing, `◆` established, and larger nodes as more connected. Context adds related-note, cross-brain edge, and brain-ownership explanations only where those encodings can occur.

The existing detailed global legend may remain in Filters for deeper reference, but the concise legend is the immediate explanation on both graph types. A permanent legend strip was rejected because it would reduce already limited mobile graph space. The trigger and panel use existing disclosure patterns, close on Escape and outside interaction, and maintain visible focus.

### Collapse only the mobile navigation rail

Desktop keeps the current always-visible brain, Graph, Search, and secondary navigation controls. At the narrow breakpoint, a dedicated four-dot launcher is the pill's sole default-visible action. Four dots communicate an action launcher without using a hamburger, directional chevron, or generic close symbol.

Expanding the launcher reveals, in visual and DOM order, brain context when present, Graph when available, Search, and direct Tags, Recent, and Orphans actions when the active context supports them. Mobile does not retain a nested More flyout. Desktop continues to use its existing secondary panel, allowing one semantic destination model with viewport-specific presentation.

The launcher owns `aria-expanded` and the expanded action region. Escape and outside interaction collapse and return focus to the launcher. Following a destination or opening Search collapses before navigation or dialog presentation. Opening brain context keeps navigation expanded while its chooser is in use.

### Animate the mobile capsule as one disclosure

The capsule remains anchored at the top-right and expands downward from that origin. Its block size transitions over a short bounded duration while actions fade, translate, and scale into place with a subtle stagger; collapse reverses the sequence. The implementation will measure the conditional action region or otherwise animate between explicit sizes rather than relying on a non-interpolable `height: auto`. Pointer events and focusability follow the logical state, not intermediate opacity.

Under `prefers-reduced-motion: reduce`, size and action states update immediately. Large spring motion, bouncing, and icon morphs were rejected because this is persistent utility navigation rather than decorative content.

## Risks / Trade-offs

- [Temporarily staged target positions become visible] -> Stage, measure, and restore synchronously before requesting the first coordinated frame, then test source-frame continuity.
- [Changing the custom bounding box shifts the source view] -> Convert the source camera into target-box coordinates and compare viewport positions before and after installation.
- [Collision-managed labels hide a title a reader expects] -> Preserve labels on interaction, retain ownership in selected labels, and keep search and navigation paths available.
- [The icon toolbar becomes cryptic] -> Use conventional symbols, accessible names, visible focus, tooltips where supported, and the adjacent Legend action.
- [The expanded mobile rail exceeds a short viewport] -> Constrain it to safe-area-aware viewport height and allow its action region to scroll without moving the launcher.
- [Conditional navigation actions complicate animation height] -> Derive the expanded size from rendered actions and test vault, active-brain, workspace, and combined contexts.
- [Graph and navigation popovers compete] -> Opening one disclosure closes incompatible sibling disclosures and outside/Escape handling restores focus deterministically.

## Migration Plan

No data, route, dependency, or cache migration is required. Implement and verify graph fitting, graph presentation, and mobile navigation as separable steps behind existing responsive breakpoints, then run unit, browser, build, and stress suites. Capture phone screenshots for local graphs, per-brain graphs with related brains hidden and shown, collapsed navigation, expanded navigation, and both legends.

Rollback restores the former sequential automatic fit, text graph controls, forced foreign labels, detailed-global-only legend, and permanently expanded mobile rail without data conversion.
