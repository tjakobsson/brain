## 1. Baseline and fit contract

- [x] 1.1 Reproduce the reported long-title focused neighborhood at 390 CSS pixels before implementation, save the baseline as `evidence/mobile-focused-before.png`, and verify the image shows the excessive zoom and tall focus card.
- [x] 1.2 Add fit tests for narrow marker-first framing, wide rendered-label framing, long fixed-pixel labels, and focus-bar insets, and verify the focused long-title case fails under the old behavior.

## 2. Narrow graph fitting and labels

- [x] 2.1 Separate narrow marker fitting from post-fit label selection without changing graph-space positions, and verify a long label cannot increase the marker-fit camera ratio.
- [x] 2.2 Include the visible focus bar's measured bounds in asymmetric graph fit insets, and verify included markers remain inside the unobscured viewport in collapsed and expanded states.
- [x] 2.3 Shorten the focused canvas label to available width and select neighbor labels at the fitted camera state while preserving detailed-zoom label reveal, and verify reducer and label-lifecycle tests cover long focused and neighbor titles.
- [x] 2.4 Preserve wide-viewport rendered-label fitting and camera-only manual Fit behavior, and verify existing desktop and motion tests remain unchanged in outcome.

## 3. Compact focus bar

- [x] 3.1 Replace the narrow focus card presentation with a collapsed title, direct Open action, and accessible disclosure control, and verify focus updates and note navigation still target the selected note.
- [x] 3.2 Add the expanded full title, Copy link, connected domains when present, and Clear when allowed, and verify disclosure, copy, domain, clear, and focus-preservation behavior with interaction tests.
- [x] 3.3 Style the collapsed bar to remain one row and no more than 72 CSS pixels tall at 320 and 390 CSS-pixel widths while keeping controls at least 44 by 44 CSS pixels, and verify there is no wrapping, clipping, or horizontal overflow.
- [x] 3.4 Verify keyboard and assistive-technology behavior for the disclosure state, accessible control names, focus retention, and hidden expanded content.

## 4. Visual and full verification

- [x] 4.1 Run `npm test` after the final code edits and verify all unit, integration, and active OpenSpec contract checks pass.
- [x] 4.2 Run `npx astro build` and verify the production site builds without new graph, content, or unresolved-link failures.
- [x] 4.3 Start the development server with `astro dev --background`, capture `evidence/mobile-focused-390-collapsed.png`, `evidence/mobile-focused-390-expanded.png`, and `evidence/mobile-focused-320-collapsed.png`, then stop the server and verify all evidence files are stored in this change directory.
- [x] 4.4 Inspect the baseline and final screenshot pixels for graph scale, two-dimensional node separation, label clipping and overlap, overlay occlusion, title treatment, touch-control placement, and collapsed bar height; document the result in the apply summary, and if any criterion is unclear or appears unsolved, leave this task unchecked and pause for the user's screenshot review before declaring the change complete.
