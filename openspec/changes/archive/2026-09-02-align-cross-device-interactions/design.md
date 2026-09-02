## Context

See `proposal.md` for motivation and the four delta specs for observable behavior. The current navigation already contains the mobile disclosure markup and state handling, but desktop CSS exposes its actions directly and substitutes a secondary flyout. Global graph controls similarly share markup but switch from separate text buttons to an icon pill only under narrow or coarse-pointer media queries.

Graph neighborhood emphasis is centralized in shared reducers. Those reducers currently replace unrelated node and edge colors, while label rendering uses one theme-wide color. Touch interaction supports node dragging and direct navigation but has no explicit long-press state. Code blocks retain the intended `0.88rem` declaration, but the intrinsic-width inner code box added for copy-control clearance can trigger WebKit text autosizing on a narrow viewport. The browser suite currently runs only Chromium.

## Goals / Non-Goals

**Goals:**

- Use one control structure and one state model across viewport and pointer types.
- Keep responsive rules responsible for placement and available space, not for changing which controls exist.
- Represent transient pointer hover and persistent touch inspection without duplicating graph reducers.
- Preserve current navigation destinations, graph geometry, tap navigation, dragging, code overflow, and copy behavior.
- Add focused coverage for the browser engine that exposed the code regression without multiplying the entire browser matrix.

**Non-Goals:**

- Redesign icons, graph filters, the quick switcher, graph layout, or code syntax themes.
- Add keyboard-driven graph-node traversal or persistent inspection across page loads.
- Change the nominal code font size to compensate for browser inflation.
- Add a runtime dependency.

## Decisions

### Make the existing disclosure viewport-neutral

Keep one four-dot launcher and one direct-action container in the shared layout, but remove the media-query branch that makes the container permanently expanded on desktop. Rename mobile-specific state and selectors where they would otherwise misdescribe behavior. The launcher controls the same expanded attribute, `aria-expanded`, `inert`, focus restoration, outside dismissal, and Escape handling on every viewport.

Tags, Recent, and Orphans remain direct actions inside the expanded container. Remove the desktop-only secondary flyout rather than nesting it inside the unified disclosure. Responsive CSS may still bound the pill to the viewport and adjust its inset, but it must not switch to another navigation structure.

This reuses the interaction already exercised on touch layouts. Keeping the desktop rail and merely restyling it as collapsed was rejected because it would retain two state paths and leave their dismissal and accessibility behavior free to diverge again.

### Promote graph icon-pill styling to the base layout

Move the horizontal pill container, separators, 44-pixel action geometry, visible icons, and visually hidden labels out of the narrow/coarse media query. Keep only viewport-specific positioning, sidebar composition, and popover bounds responsive. Use the controls' accessible labels as their pointer tooltip text so stateful controls can update both from one source.

The existing separate desktop text buttons were rejected because they are the inconsistency this change removes. Reducing desktop targets below the touch dimensions was also rejected because identical geometry simplifies layout and keeps the control comfortably clickable.

### Separate transient hover from pinned touch inspection

Represent pointer hover and touch-pinned inspection separately, with one derived active node used by the shared reducers. Pointer entry sets transient inspection and pointer exit clears it. A successful long press sets the pinned node. If both are present on a hybrid device, transient pointer inspection takes precedence while hovered and the pinned neighborhood resumes after pointer exit.

A touch-node press starts a timer. Movement beyond the existing drag tolerance or gesture completion before the timer fires cancels it. When the timer fires, it pins the node, refreshes visual reducers, and marks that press as consumed so release cannot navigate. The pinned node survives release. The next empty-stage tap clears it; a node tap uses existing navigation and needs no intermediate clear frame. Gesture timers and consumed state are cleared during renderer teardown.

Using Sigma's incidental touch hover events was rejected because it does not define hold duration, persistence, or navigation suppression. Ending emphasis on release was rejected because the reader's finger would cover the content during the only inspection window.

### Fade labels through the same reducer path

Extend graph themes with a faded label color chosen separately for light and dark backgrounds. Configure label rendering to read an optional per-node label-color attribute with the normal theme label as fallback. The neighborhood reducer assigns faded node and label colors only to unrelated nodes and assigns the faded edge color only to non-incident edges. It does not remove labels, alter visibility, or touch geometry fields.

Hiding unrelated labels was rejected because it removes orientation context and contradicts the requirement that unrelated content remain visible. Applying opacity to whole canvases was rejected because selected and unrelated graph elements share rendering layers.

### Constrain WebKit adjustment instead of shrinking code

Apply standard and WebKit-prefixed text-size adjustment at the fenced-block boundary with a `100%` value. This fixes the automatic inflation multiplier while retaining the declared font size and user-controlled page zoom. Keep the intrinsic-width code box and trailing padding that let content scroll clear of the fixed copy control.

Lowering `font-size`, removing trailing clearance, or using `text-size-adjust: none` were rejected. Those approaches would respectively make unaffected browsers too small, reintroduce obscured code, or impose a stronger accessibility restriction than needed.

### Run only the code-block suite in WebKit

Add a WebKit phone project restricted to the code-block browser suite and install WebKit alongside Chromium in browser CI. Assert the intended computed typography and existing overflow/copy geometry under the WebKit project. Keep all broad browser suites on their current Chromium projects.

Relying on another Chromium assertion was rejected because PR #16 already demonstrated that Chromium geometry coverage cannot detect this WebKit behavior. Running every browser test under WebKit was rejected because the issue needs one focused compatibility check, not a doubled suite.

## Risks / Trade-offs

- [Always-collapsed desktop navigation adds one activation before Graph or Search] -> Keep every destination in the first expanded layer, preserve keyboard shortcuts, and make expansion immediate and predictable.
- [The expanded action stack can exceed a short desktop viewport] -> Retain the bounded-height and internal overflow behavior already used for short touch viewports.
- [Native pointer tooltip timing differs by browser] -> Keep accessible names authoritative and test that every icon control exposes matching discoverable text rather than timing presentation.
- [Long press can conflict with drag or synthetic click events] -> Share the existing movement tolerance, consume only presses whose timer fired, and cover hold, drag, release, stage tap, and node tap separately.
- [Stronger fading can lose contrast against one color scheme] -> Define and test light and dark faded values independently while keeping unrelated elements visible.
- [Adding WebKit increases CI setup time] -> Restrict WebKit execution to the affected code-block file.

## Migration Plan

Ship navigation, graph controls, graph inspection, typography, specs, and their regression coverage in one pull request. No content, URL, storage, or dependency migration is required. Existing stored graph positions and filter state remain valid because inspection does not alter either.

Rollback restores the viewport-specific control CSS and navigation branch, removes pinned inspection state and WebKit adjustment, and drops the focused WebKit project. No persisted data needs conversion in either direction.
