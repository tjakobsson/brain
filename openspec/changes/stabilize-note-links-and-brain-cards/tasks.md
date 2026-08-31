## 1. Reproduction and Fixtures

- [x] 1.1 Start the site with `npx astro dev --background`, capture desktop baseline screenshots that visibly reproduce the mention/map order and wrapping-identifier card movement, add both labeled images to the change catalog before implementation, verify the catalog entries are viewable, then stop the server with `npx astro dev stop`
- [x] 1.2 Add public demo note content with a soft-wrapped local wiki-link and a page containing both mentions and a Connection map, then run `npx astro build` and verify the fixture remains valid plain Markdown with no unintended unresolved-link warning
- [x] 1.3 Add a valid long Brain ID to the public workspace fixture that wraps in the desktop chooser beside shorter IDs, then verify the workspace loads and the fixture reproduces the uneven identity layout before the style fix

## 2. Wrapped Wiki-Links

- [x] 2.1 Add shared parser tests for wrapped local, cross-brain, heading, alias, and unwritten links, normalized field values, preserved raw offsets, attachment exclusion, and rejected blank-line, hard-break, and block-boundary candidates; verify the focused test fails for the new valid cases before implementation
- [x] 2.2 Extend the shared wiki-link parser to accept only soft paragraph breaks and normalize them to spaces without changing `raw`, `index`, or `length`, then verify the focused parser tests pass
- [x] 2.3 Add remark-renderer and workspace-index coverage using the wrapped fixtures, including destinations, aliases, heading fragments, foreign and unwritten treatment, backlinks, and unlinked-mention suppression, then verify indexing and rendered output agree in the focused tests

## 3. Note and Chooser Presentation

- [x] 3.1 Move the existing mention component ahead of the conditional Connection map in document order and add browser coverage proving linked and unlinked sections precede the map while empty sections and empty maps remain omitted; verify the focused browser test passes
- [x] 3.2 Stabilize the desktop Brain-card identity region and card layout without truncating IDs or changing narrow natural flow, then add desktop and phone geometry assertions for aligned card boundaries, content and action landmarks, complete identifier text, and no horizontal page overflow

## 4. Early Visual Checkpoint

- [x] 4.1 Immediately after the first note and card presentation pass, run `npx astro dev --background`, capture fixed-viewport desktop screenshots of the corrected note order and mixed short/wrapped Brain cards, visually inspect source order, wrapping, spacing, and alignment, add the labeled result images to the change catalog for review before further polish, then stop the server with `npx astro dev stop`
- [x] 4.2 Address any discrepancy visible in the early catalog screenshots and recapture only the affected view, then verify the latest catalog image matches the delta specs and remains available for review

## 5. Contract Verification

- [x] 5.1 Run `npx astro build` and verify all demo Brain and workspace content generates with resolved wrapped links, backlinks, and unchanged routes
- [x] 5.2 Run `npm test` and verify unit tests plus active OpenSpec contract validation pass
- [x] 5.3 Run `npm run test:browser` and verify the full browser suite passes without desktop or mobile ordering, alignment, overflow, navigation, or graph regressions

## 6. Potential Links

- [x] 6.1 Add focused remark-renderer coverage proving indexed plain-text title matches receive non-clickable Potential-link markup while authored links, code, unrelated text, and already-linked source-target pairs remain unchanged
- [x] 6.2 Rename the note-page section to Potential links, add a subtle dotted underline and accessible explanation to qualifying inline matches, and add browser coverage for the label, static inline treatment, non-clickability, and unchanged section ordering
- [x] 6.3 Recapture the corrected mention/map screenshot with the Potential links label and inline treatment visible, replace the affected catalog image, and verify the catalog description matches the result
- [x] 6.4 Run `npx astro build`, `npm test`, and `npm run test:browser`, then verify OpenSpec validation and all existing link, mention, graph, desktop, and mobile behavior remain green
- [x] 6.5 Keep inline Potential links in prose color, add a help cursor and neutral explanatory badge on hover and keyboard focus, verify those states in focused browser coverage, recapture the inline catalog screenshot with the badge visible, and rerun required validation
