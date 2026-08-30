## Context

See `proposal.md` for motivation and `specs/code-block-rendering/spec.md` for the layout contract. Fenced blocks normally have `1rem` vertical padding, but `.code-block > pre` overrides the top padding to `2.75rem` after the client script wraps each block and adds the absolute-positioned copy control. That override creates the empty band visible in the current design.

The copy control must remain easy to click or tap, retain its focus treatment and feedback, and stay fixed at the block's top-right while long code scrolls horizontally.

## Goals / Non-Goals

**Goals:**

- Restore compact top spacing so the control and first code line share the top area.
- Keep every part of a long line reachable when the overlaid control occupies the top-right corner.
- Lock the intended geometry in browser coverage at desktop and phone widths.

**Non-Goals:**

- Redesign the copy icon, colors, background, hover state, or feedback.
- Change code-block typography, line numbering, syntax themes, or Markdown output.
- Reduce the copy control's interactive target merely to make it look smaller.

## Decisions

### Remove the reserved control band, not the control padding

Use the fenced block's normal top padding for the first line and keep the control absolutely positioned near the top-right edge. This matches the reference, where the icon shares the first line's vertical area. Shrinking the button itself would reduce the hit target but would leave the extra code inset in place, so it does not solve the actual spacing problem.

### Preserve horizontal clearance for overlaid content

Keep sufficient trailing scroll space so a long first line can move fully clear of the fixed control. This permits the compact overlay without hiding the end of a line. Moving the control into the scrolling element was rejected because the button would disappear when the reader scrolls horizontally.

### Test observable geometry and existing behavior

Extend the browser suite to verify that the first line starts in the normal top-padding area at desktop and phone sizes, the button stays inside the top-right corner, and overflowing code can still scroll clear of the button. Existing clipboard and keyboard assertions continue to cover interaction behavior.

## Risks / Trade-offs

- [A long first line can initially pass behind the copy control] -> Retain enough horizontal scroll clearance for the reader to reveal the covered segment.
- [Reducing the button instead of the empty band could hurt touch use] -> Leave the control's interactive dimensions unchanged.
- [Exact pixel assertions can become brittle under font changes] -> Assert relative element positions and computed padding rather than text baselines tied to one font.

## Migration Plan

Ship the CSS and browser assertions together. No content or data migration is needed. Rollback restores the previous top-padding override and its matching geometry assertions.
