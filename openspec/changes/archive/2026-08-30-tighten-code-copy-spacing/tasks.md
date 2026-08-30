## 1. Compact code-block layout

- [x] 1.1 Update the fenced-block padding so the first code line shares the copy control's top area while the control keeps its current interactive size, then verify the computed top padding no longer creates a separate control band.
- [x] 1.2 Add enough trailing scroll clearance for long lines to move past the fixed top-right control, then verify the existing narrow-viewport example can reveal its complete first line without widening the page.

## 2. Browser coverage

- [x] 2.1 Extend `tests/browser/code-blocks.pw.ts` with relative geometry checks for the first line and copy control at desktop and phone widths, then verify `npm run test:browser -- tests/browser/code-blocks.pw.ts` passes.
- [x] 2.2 Run `npm test` and `npx astro build` to verify the active OpenSpec contract, unit suite, and production build remain valid.
