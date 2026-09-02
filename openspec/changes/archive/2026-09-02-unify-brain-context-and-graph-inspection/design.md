## Context

See `proposal.md` for motivation and the four delta specs for observable behavior. The shared layout currently places the Brain context switcher inside the collapsed navigation actions, while the combined graph renders a second, full-width text overlay and also exposes Brain checkboxes in Filters. Combined selection state is already canonicalized from the URL and distributed through `brain-selection-change`, but ownership is split across page, layout, and graph scripts.

Global and local Sigma renderers share visual reducers and touch title hit-testing. Pointer inspection still relies on Sigma's node-marker enter and leave events, so crossing from a marker onto its canvas-rendered title ends inspection. Responsive label media changes and host resize observations also have separate settling entry points; browser zoom can trigger both around the same breakpoint. The implementation must retain static generation, shareable selection URLs, existing graph performance, and user-controlled zoom without adding a runtime dependency.

## Goals / Non-Goals

**Goals:**

- Keep one canonical selected-set state and expose it where it directly changes the full graph.
- Identify note ownership in note metadata without competing with note titles or shared navigation.
- Preserve compact graph space while making combined mode perceivable visually and through assistive technology.
- Give global and local graphs one neighborhood-label and title-target model across pointer and touch input.
- Funnel each effective viewport change through one responsive graph update.
- Produce repository-visible visual evidence alongside automated regression coverage.

**Non-Goals:**

- Turn the generated site into an installable PWA or add a manifest, service worker, or offline cache.
- Change note identity, graph data, layout algorithms, Brain accents, or the general four-dot navigation disclosure.
- Add keyboard traversal among canvas graph nodes.
- Persist graph inspection or an unapplied context selection across page loads.
- Add a browser or rendering dependency solely for screenshot capture.

## Decisions

### Scope Brain identity and selection to their useful surfaces

Remove the Brain selector from shared navigation. On note pages, render the owning Brain as metadata alongside type, status, and tags, with visible text and the shared Brain mark. This communicates ownership without suggesting that changing the selected set will transform the current note.

On full workspace graphs, place the Brain selector as the rightmost segment of the left graph-control pill. Its panel uses one selected-set model initialized from the current route. Brain rows support selecting a set and an explicit action applies it: no selected Brains returns to the root chooser, one opens that Brain's graph, and two or more open the canonical combined graph. On an existing combined graph, applying another valid multi-Brain set updates the canonical URL and graph context together; transitions to zero or one follow their canonical routes. General graph Filters retain type, status, and tag controls and do not duplicate Brain selection.

Keeping the selector in shared navigation was rejected because it consumes title space and has little in-place value on note pages. A separate graph selector was rejected because Brain selection behaves like graph filtering and belongs with the other graph controls. Duplicating the selector in Filters was rejected because two controls would own the same selected set.

### Remove the combined banner and derive every consumer from canonical selection

Delete the permanent combined-context overlay and its responsive positioning. Centralize current selection parsing and route derivation so the full-graph Brain control, graph context, quick switcher, and applicable navigation links consume the same canonical selection. Reuse the existing selection-change event for same-page combined updates, but make its payload the result of canonicalization rather than independent checkbox state. Update graph fitting only for overlays that remain.

Retaining the banner only on desktop was rejected because it would preserve two responsive identity models. Keeping hidden Brain checkboxes in Filters as a second state source was rejected because their persisted or event state could diverge from the context control.

### Hide unrelated titles in the shared inspection reducer

Change the shared node reducer so unrelated nodes retain their faded marker attributes but receive an empty rendered label and no forced-label state during active inspection. The inspected node and immediate neighbors retain their normal marker and title attributes and force their titles through density selection. Ending inspection restores the normal global or local label policy, including responsive progressive reveal and foreign ownership labels.

Fading unrelated titles was rejected because dense graphs still leave the inspected neighborhood buried under overlapping text. Hiding unrelated nodes was rejected because their markers provide useful spatial orientation and would make inspection resemble filtering.

### Share canvas title geometry across pointer and touch

Extract one screen-space target calculation for visible node markers and rendered titles, including foreign-mark width and viewport clipping. Touch long press, touch navigation, pointer inspection, and pointer click fallback use that calculation. Pointer movement from a marker into its title retains the same active node; movement onto another eligible marker or title transfers inspection; movement outside every target clears transient inspection. Pinned touch inspection remains independent and resumes after transient pointer inspection on hybrid devices.

The active neighborhood's titles are forced before target geometry is evaluated, preventing the target from disappearing because collision selection changed during inspection. No reducer changes position, size, hidden marker state, or camera attributes.

Expanding only the node radius was rejected because it would not cover long titles and would create ambiguous overlap in dense graphs. DOM overlays for labels were rejected because the current canvas renderer already supplies the needed geometry and a second label layer would introduce synchronization and accessibility complexity.

### Funnel resize and label-policy changes through one scheduler

Use one per-renderer responsive scheduler fed by host `ResizeObserver` notifications and narrow-label policy changes. It records the latest dimensions and policy, debounces the burst, resizes the renderer once, applies final label settings once, and requests at most one coordinated settle/refit. Global and local renderers use the same scheduling invariant while retaining their existing layout and fitted-label differences.

Pointer inspection cancels genuinely in-flight automatic motion as it does today, but cannot enqueue responsive work. Browser zoom that changes CSS viewport dimensions, device scale, or crosses the responsive breakpoint therefore converges before hover into one stable frame. Tests exercise effective viewport and fractional-scale changes around the breakpoint; an actual Microsoft Edge `Ctrl-+` capture records the reported browser behavior for review.

Running resize settling and media-query settling independently was rejected because both can represent the same browser operation. Disabling responsive settling for every proportional resize was rejected because it would weaken the existing viewport-aware composition contract and make browser-specific zoom detection part of application behavior.

### Store visual review evidence with the change

Create `screenshots/README.md` plus before and after images under this change directory. Record browser, viewport, browser zoom, color scheme, route, and interaction state for each image. Cover an iPhone-sized standalone presentation of combined mode, desktop dense-graph inspection with a long title, and the large graph in Microsoft Edge at increased browser zoom. Keep source images at reviewable resolution and reference them from the README with relative paths so local and pull-request rendering use the same artifacts.

Relying only on transient CI attachments was rejected because they are not durable or visible while reviewing the planning change and pull request.

## Risks / Trade-offs

- [Adding Brain selection to graph controls can crowd the left pill on phones] -> Keep the control as one compact rightmost segment and verify it does not overlap navigation or graph content at the smallest supported width.
- [Brain ownership metadata can become visually noisy] -> Reuse the existing compact metadata treatment and keep the Brain title or stable ID visible.
- [Selecting Brains in a compact panel can be applied accidentally] -> Use an explicit apply action, reflect the current selected set on open, and keep canonical route transitions deterministic for zero, one, or many selections.
- [Hiding unrelated titles removes some orientation context] -> Preserve every unrelated marker and restore normal titles immediately when inspection ends.
- [Overlapping canvas titles can create ambiguous targets] -> Prefer the nearest eligible title or marker using one deterministic hit-test order and cover dense overlap with browser tests.
- [Browser zoom cannot be reproduced identically by every CI browser] -> Automate effective viewport, breakpoint, and fractional-scale invariants in Chromium and retain an actual Edge capture with documented zoom metadata.
- [Responsive coalescing can delay a required fit] -> Keep the existing bounded debounce behavior and verify one completion occurs for the final dimensions.

## Migration Plan

Ship the context-control consolidation, graph inspection changes, responsive scheduler, tests, and screenshots together. No data or dependency migration is required. Existing combined URLs remain canonical and existing stored graph positions remain valid because selection identities and graph-space coordinates do not change.

Rollback restores the combined banner, Brain filters, former reducer treatment, marker-only pointer hover, and separate responsive triggers. No persisted content requires conversion in either direction.
