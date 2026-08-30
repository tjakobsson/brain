## 1. Shared Label Policy

- [x] 1.1 Add shared narrow-viewport label-grid and detailed-zoom policy helpers, and verify unit tests cover the 180 pixel grid, the inclusive 0.75 camera-ratio boundary, and desktop exclusion.

## 2. Renderer Integration

- [x] 2.1 Apply the shared policy to the global graph so fitted mobile views remain selective, detailed zoom forces every titled visible node including longer titles, zooming out restores selection, and camera listeners are removed at teardown; verify graph rendering unit and browser tests pass.
- [x] 2.2 Apply the same threshold transition and teardown behavior to note-page local graphs, and verify touch-layout browser coverage keeps zoom, pan, title interaction, and Fit view working.

## 3. Verification

- [x] 3.1 Run `npm test`, `npx astro build`, and the affected Playwright graph suite; verify the complete product-documentation contract, production build, and mobile/touch graph checks pass.
