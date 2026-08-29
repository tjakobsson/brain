## 1. Rendering Fixtures and Coverage

- [x] 1.1 Add linked demo Brain content containing a multi-row Markdown table plus neutral and warning callouts, then run `npx astro build` and verify the fixture builds without unresolved links or contract errors
- [x] 1.2 Add browser coverage for table cell boundaries, zebra rows, light and dark legibility, and contained phone-width overflow, then verify the focused rendering test passes
- [x] 1.3 Add browser coverage for callout title and body markup, semantic backgrounds, and the absence of accent-edge borders, outlines, and shadows, then verify the focused rendering test passes
- [x] 1.4 Extend code-block browser coverage for recognized-only line numbers, blank-line sequencing, keyboard copying, exact clipboard text without numbers, copied feedback, and JavaScript-disabled readability, then verify the focused test fails before implementation for the new behavior

## 2. Markdown Presentation

- [x] 2.1 Add light and dark prose tokens and style Markdown tables with compact spacing, complete cell borders, neutral zebra rows, and local horizontal overflow, then verify the table browser assertions pass at desktop and phone widths
- [x] 2.2 Restyle callouts against the plugin's emitted data attributes with compact tonal note, warning, and error treatments, then verify titles and normal body text remain distinct without decorative edge rules
- [x] 2.3 Refine inline and fenced code to use borderless muted fields and add CSS-counter line numbers to recognized Shiki line spans while leaving plain-text fallbacks unnumbered, then run `tests/browser/code-blocks.pw.ts` in light, dark, and phone-width cases
- [x] 2.4 Add a progressive top-right copy icon button to every fenced block using the Clipboard API, accessible labels, keyboard operation, and copied or failed feedback, then verify browser tests copy exact code and plain text without line-number decoration

## 3. Brain Visual Identity

- [x] 3.1 Create a dependency-free inline Brain mark component and a standalone favicon using the same simple SVG geometry, then verify both remain recognizable and legible at 16, 20, and favicon pixel sizes in light and dark modes
- [x] 3.2 Replace diamond markers in the Brain chooser and context switcher with the Brain mark while preserving adjacent titles or stable IDs and hidden decorative SVG semantics, then verify workspace browser tests locate every identity by text without relying on color
- [x] 3.3 Remove asymmetric accent borders from Brain cards, retain uniform neutral boundaries, and use full accent treatment only for checked cards, then verify unselected and selected computed styles and native checkbox state in the workspace browser tests
- [x] 3.4 Add browser coverage for the Brain favicon and shared mark geometry across the favicon, chooser, and contextual navigation, then verify the generated site contains no Astro favicon path

## 4. Visual and Contract Verification

- [x] 4.1 Run the site in background development mode with `npx astro dev --background`, inspect desktop and phone presentations in light and dark modes, exercise code copying, capture the table, numbered code, plain code, callout, chooser, and context-switcher views for design review, then stop the server with `npx astro dev stop`
- [x] 4.2 Run `npx astro build` and verify the demo Brain, favicon, static syntax highlighting, callouts, tables, and workspace assets generate successfully
- [x] 4.3 Run `npm test` and verify unit tests plus active OpenSpec contract validation pass
- [x] 4.4 Run `npm run test:browser` and verify the full browser suite passes without desktop or mobile overflow regressions
