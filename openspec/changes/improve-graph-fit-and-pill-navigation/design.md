## Context

See `proposal.md` for motivation and the delta specs for behavior. Both graphs use Sigma and the same node and label settings, but their camera paths differ. The global graph sends visible node centers to `GraphMotionController`, which builds a custom bounding box and targets a fixed camera state. A local graph relies on Sigma's initial fit plus a one-time margin adjustment and has no controls or motion controller.

Sigma exposes node centers and scaled marker radii in viewport coordinates. Its label canvas also exposes the active font and text measurement, but label selection and marker scale depend on the camera. A fit based only on graph coordinates therefore cannot reserve accurate screen space for the final labels and markers.

Navigation currently has separate desktop text links and a `details` menu. CSS turns the latter into the top-right pill for mobile, coarse pointers, and scrolled note pages. Note pages carry script state for switching between the two header modes.

## Goals / Non-Goals

**Goals:**
- Use one rendered-bounds fitting path for manual fits in both graph variants.
- Keep graph fitting independent from force-layout changes and preserve reduced-motion behavior.
- Use one navigation markup and interaction model across desktop, mobile, and coarse-pointer devices.
- Preserve all current destinations and base-path handling without adding an icon dependency.

**Non-Goals:**
- Change graph layout, label density, label typography, filtering, or neighborhood depth.
- Make a fixed-size label that is wider than the graph host fit without truncation or another label-design change.
- Change routes, the quick switcher, or the content of secondary navigation pages.

## Decisions

### Share a rendered-bounds camera fitter

Introduce one graph fitting utility that accepts a Sigma renderer and the included node IDs. It measures each included node in viewport coordinates using its displayed center and scaled radius. It measures candidate label text with the renderer's label canvas font and includes the label rectangle when Sigma renders that label at the fitted state.

The fitter first establishes a center-based candidate, then refreshes the renderer and measures actual screen extents. It applies a camera translation and ratio correction to move the measured union inside an inset host rectangle. A small bounded number of correction passes handles camera-dependent marker scale and label selection without risking an open-ended loop. The final pass verifies the rendered labels selected for that camera state. Empty graphs return to a safe default view.

This utility changes only the camera and custom bounding box. It does not move nodes or start layout work. The global motion controller delegates its camera fit to it after canceling earlier motion, and the local graph's initial and button-triggered fits use the same path. This keeps automatic global refits consistent with the manual action rather than maintaining two meanings of "fit".

Alternatives considered:
- Add a larger constant graph-space margin. This still fails for long labels because their width is measured in screen pixels.
- Include all label widths in a one-pass graph-space box. This overfits large graphs and still cannot predict the final camera-dependent marker scale accurately.
- Give local graphs a full motion controller. Local graphs do not settle, filter, or persist positions, so that would add unrelated state.

### Put local Fit view beside the connection-map link

Add a small control group to the connection-map header containing Fit view and Open full graph. Each local graph associates its control with its host so multiple mounted graphs would remain independent. Listener teardown follows the renderer lifecycle.

The graph remains hidden for isolated notes, and the server-rendered nearby-note links remain the accessible text alternative. Fit view changes only the camera.

### Use one fixed pill with native disclosure semantics

Replace the duplicated desktop navigation and scroll-compaction script with one fixed top-right pill. Its always-visible actions are an inline SVG Graph link, the existing quick-switcher Search button, and a disclosure summary with a chevron-style expand icon rather than three hamburger lines. The `details` element retains native pointer and keyboard behavior; the icon rotates or otherwise changes state when open. Accessible names live on the controls, and inline SVGs remain decorative.

The attached disclosure panel contains Tags, Recent, Orphans, and Search. Graph stays out of the panel because it is directly available. The full Search destination remains in the panel while the direct Search action continues to open the quick switcher, preserving both existing search entry points.

All internal links continue through the shared route and base-joining helpers. No icon package is warranted for three small inline icons.

Alternatives considered:
- Keep the full desktop header until scrolling. This conflicts with the chosen always-present desktop pill and retains two interaction modes.
- Build a custom popover with JavaScript. Native `details` already provides the required disclosure behavior with less state and a usable fallback.
- Keep Graph in the expanded menu as well. The duplicate adds no route and weakens the point of the direct shortcut.

### Treat the pill as an overlay at every breakpoint

Collapse the old header slot and remove `compactHeader` state. Standard content receives enough top and right breathing room to avoid starting under the fixed control. Full-bleed graph sizing uses the viewport rather than subtracting the former desktop header height. Graph controls and the pill keep distinct corners and tested stacking order. The same markup remains in use across breakpoints; media queries may change spacing, action dimensions, and disclosure-panel direction without hiding actions.

## Risks / Trade-offs

- [Label selection can change after the camera moves] -> Re-measure after renderer refreshes and cap correction passes, then verify the final selected-label bounds in browser tests.
- [Measuring every included node on a 2,000-note graph adds work to Fit view] -> Keep measurement synchronous and linear, reuse one canvas context, avoid layout work, and cover the supported vault size with timing-sensitive tests only where stable.
- [A title can be wider than a narrow host at the fixed label size] -> Treat that as outside camera fitting, document the individual-item constraint in the requirement, and avoid silent typography changes in this change.
- [A fixed desktop pill can cover page or graph content] -> Reserve content spacing, use an inset fit rectangle, and test wide, narrow, coarse-pointer, and full-bleed graph layouts.
- [Changing shared navigation can regress focus or disclosure state] -> Keep native disclosure semantics and add keyboard and accessibility assertions to browser tests.

## Migration Plan

Ship the graph fitter, local control, and unified navigation in one static-site release. There is no persisted-data or content migration. Existing session graph positions remain valid because node coordinates and cache formats do not change. Rollback restores the former layout, camera fitting, and local markup without data conversion.
