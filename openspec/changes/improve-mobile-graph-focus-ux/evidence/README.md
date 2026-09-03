# Mobile focused-neighborhood evidence

The screenshots use a fresh Playwright context at device scale factor 1 and the
multi-axis `engineering/principles` neighborhood. The capture script replaces
only that browser response's focused title with a deterministic long title; it
does not modify the workspace fixture.

## Baseline

`mobile-focused-before.png` shows the original 390 CSS-pixel behavior. The
camera ratio is 953.89, marker radii are below 0.28 pixels, and all four markers
occupy less than one screen pixel. The focus card is 223.19 pixels tall. The
canvas label is clipped and the underlying two-dimensional neighborhood is not
readable.

## Final

- `mobile-focused-390-collapsed.png`: camera ratio 1.12, marker radii 6.65 to
  8.03 pixels, and collapsed bar height 57.19 pixels.
- `mobile-focused-390-expanded.png`: camera ratio 1.55. The lowest marker ends
  about 15 pixels above the measured expanded overlay. The complete focused
  title, Copy link action, and connected domains are visible.
- `mobile-focused-320-collapsed.png`: camera ratio 1.12, marker radii 6.65 to
  8.03 pixels, and collapsed bar height 57.19 pixels.

In both collapsed captures, the four markers retain clear horizontal and
vertical separation. The focused canvas label is shortened within its actual
right-side space, over-wide neighbor labels are omitted, and the remaining
labels do not clip or overlap each other. The focus bar title remains one line;
Open and disclosure controls remain distinct and unobscured. No capture has
horizontal page overflow or a marker hidden beneath the focus UI.
