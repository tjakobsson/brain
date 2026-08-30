## Why

Fenced code blocks reserve a tall empty band above the first line for the copy button. This makes the control feel detached from the code and adds more top spacing than the compact reference treatment.

## What Changes

- Place the copy control and the first line of code within the same compact top area instead of reserving a separate header-height band.
- Reduce the vertical gap between the top edge of a fenced block and its code while keeping the copy control in the top-right corner.
- Preserve the copy control's usable hit target, keyboard behavior, feedback, and access to long code lines on narrow screens.
- Add browser checks for the compact spacing at desktop and phone widths.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `code-block-rendering`: Tighten the required top-right copy-control layout without obscuring or making code inaccessible.

## Impact

- Code-block and copy-control layout rules in `src/styles/global.css`.
- Browser coverage in `tests/browser/code-blocks.pw.ts`.
- No Markdown contract, runtime API, or dependency changes.
