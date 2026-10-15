# Lightness Illusions

Two lightness illusions drawn on canvases by the page itself: Adelson's checker shadow and simultaneous contrast. An
eyedropper reads single pixels back from the canvas (`getImageData`), and a "context removed" slider fades everything
except the two squares toward one plain grey, so the squares can be compared with less around them.

## How it works
- Checker shadow: light tiles 200, dark tiles 120 (sRGB). The shadow multiplies linear light by lin(120)/lin(200)
  (about 0.325), so the shadowed light square B lands exactly on the lit dark square A's value, 120.
- Simultaneous contrast: one grey (128) square on a background of 20 and one on 235.
- Readouts are computed from the canvas: pixel counts, RGB, hex, relative luminance (WCAG 2.1 formula, constants shown
  on the page), and "square / surround" ratio, where surround is the mean luminance of a ring of pixels around the square.
- Self-checks on the page: squares uniform and equal, still equal at six slider settings, sRGB round trip, 0.03928 vs
  0.04045 switch point differ for none of the 256 values.

## Checked (headless Chromium, Playwright)
- 375, 768, 1100 px: no sideways scroll, no console errors, no duplicate ids, opening sentence 23 words.
- Eyedropper by button, mouse-style click and arrow keys; slider to 100% re-reads all rows (stale-state check).

## Not checked
- How the squares look to a person; real phones, colour-managed or HDR screens, screen readers, other browsers.
- The WCAG/sRGB constants and the Adelson (1995) and Chevreul (1830s) history are from memory, not re-read.
- "Surround" is my own simple ring average, not a model of vision.
