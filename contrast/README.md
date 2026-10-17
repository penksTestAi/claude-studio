# Subject Colour Contrast

A Manifest V3 browser extension. Press the toolbar button, then Scan: it lists the foreground/background contrast
ratio of each text element on the current tab by the WCAG 2 formula and marks AA and AAA failures. Made by Claude, an
AI model. MIT licence (`LICENSE`).

- `subject-contrast-1.0.0.zip` is the extension (built from `extension/`). Rebuild:
  `cd extension && zip -X -9 ../subject-contrast-1.0.0.zip manifest.json contrast.js popup.html popup.css popup.js icon16.png icon48.png icon128.png LICENSE`
- Permissions: `activeTab` and `scripting`. No host permissions, no network (the extension CSP also sets
  `connect-src 'none'`), no storage, nothing sent. The scanner runs only on the tab where you pressed the button.
- `extension/contrast.js` holds the formula and the scanner; the popup and the landing page (`index.html`) use the
  same file. Page text is shown with `textContent`, never as HTML.
- Install: Chrome or Edge, Load unpacked on the unzipped folder; Firefox, Load Temporary Add-on on `manifest.json`.

## How it measures
Computed text colour against the nearest opaque ancestor background (layers with alpha are composited on the way;
white is assumed if none is found). Large text is 24 px, or 18.66 px and bold: 3:1 AA, 4.5:1 AAA; otherwise 4.5:1 and
7:1. The raw ratio is compared with the threshold; the displayed value is cut, not rounded, to two decimals (so
#777777 on white shows 4.47, where tools that round show 4.48). Elements sharing colours and size class are grouped.

## What was checked
- `node contrast/tests/test.mjs` (from the studio root): 25 checks, formula facts (21:1, 1:1, symmetry, both sRGB
  knees equal for all 256 values), threshold boundaries, parsing, and the scanner in headless Chromium on a fixture
  (nesting, large and bold text, gradient, translucent background, oklch colour, hidden elements, grouping).
- `node contrast/tests/popup_stub.mjs`: the popup in headless Chromium with a stub of the extension API, light and
  dark, no console errors; the popup scanned by its own code has no AA failure apart from its colour swatches.
- The landing page checks 11 facts from the WCAG definitions (11 agree) and 14 published pairs (11 agree, 3 flagged:
  #777777 4.47 vs ours 4.478, which looks like cutting; and two figures from one calculator page, #666666 5.25 and
  #999999 3.07, that match nothing we compute, background not stated).
- `node tools/page_check.mjs contrast/`: no problems at 375, 768, 1100 px, light and dark.

## Unverified
- A real install in Chrome or Firefox, the toolbar click and the `activeTab` grant (no extension-API run outside a stub).
- Transparency (one simple composite checked), element opacity (flagged, not applied), gradients and background
  images (reported as not measured), text over images, video or canvas, iframes, shadow DOM, pseudo-elements.
- The second-source figures came from search-tool summaries; the pages themselves could not be opened here, and none
  of them is a second program that was run. The WCAG facts are from memory of the standard, not re-read.
