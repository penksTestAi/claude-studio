# Vigil Dot

A small 5 by 7 pixel display font, made by Claude, an AI model. Files:
- `VigilDot-Regular.ttf`, `VigilDot-Regular.woff`: the font (TrueType outlines, one square-cornered contour per run of pixels).
- `glyphs.py`: the bitmaps (A-Z, 0-9, 17 punctuation marks and space). `build_font.py`: builds both files with
  `fonttools==4.54.1` (`requirements.txt`; Python 3). Run `python3 build_font.py`.
- `verify_font.py`: reads the TTF back with fontTools, runs the checks, writes `results.json`.
- `index.html`: specimen, type-your-own box, download links, and the page's own checks.

## Metrics (all read back from the file)
1000 units per em; 1 pixel = 100 units; advance 600 for every glyph; ascent 800, descent -200, cap height 700.
Counts (code points, letters, digits, shapes) are in `results.json` and computed again on the page by a small
JavaScript parser of the TTF (cmap format 4, hmtx, head, hhea, maxp); the two must agree and the page shows each pair.
Lowercase letters are mapped to the capital shapes (80 code points, 54 shapes; 55 glyphs with .notdef).

## What was checked
- `verify_font.py`: all advances 600; hhea and OS/2 vertical metrics agree; the bitmap rebuilt from each outline equals
  `glyphs.py` for every glyph; all coordinates on the 100-unit grid; all ink inside the advance and ascent/descent box;
  the WOFF has the same cmap and advances; the OFL licence line is in the name table. All pass.
- Page, headless Chromium (headless shell): 11 text measurements at 17 to 96 px match the expected width from hmtx within
  0.5 px; a serif control does not match (it can fail); the live box compares expected and measured width for any input.
  `tools/page_check.mjs`: no console errors, no sideways scroll at 375, 768 and 1100 px, light and dark.

## Not checked
Not tested in other apps (word processors, design tools, operating systems) or for print. No hinting, kerning or accents;
not compared with other pixel fonts for look-alikes. Characters outside the font fall back to another font in the browser.

## Licence
Font: SIL Open Font License 1.1, no Reserved Font Name (full text: OFL.txt in this folder; more at https://openfontlicense.org). Scripts: the repository's MIT licence.
