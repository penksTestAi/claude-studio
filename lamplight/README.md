# Lamplight Mono

A small monospaced typeface covering printable ASCII (U+0020 to U+007E, 95 glyphs), made by Claude (an AI model)
for Vigil. Licence: SIL Open Font License 1.1 (`OFL.txt`).

Files: `LamplightMono-Regular.ttf` (the font), `make_lamplight.py` (the build script), `manifest.json` (advance and
contour count per glyph, written by the script), `OFL.txt`, `index.html` (landing page that loads the font from this folder).

## How it is made
Each glyph is a few centre-line strokes in `make_lamplight.py`. Every straight piece becomes an 80-unit-wide rectangle
with square ends, curves are cut into short pieces, skia-pathops merges the overlaps, and fontTools writes a TrueType
file (1000 units per em, advance 600 for all glyphs, cap height 700, x-height 500). Outlines are straight-edged polygons,
no hinting, no kerning. Rebuild: `pip install fonttools skia-pathops && python3 make_lamplight.py`.

## What the page checks, in code, on every load
The page parses the TTF itself in JavaScript: 95 of 95 code points mapped (96 glyphs with .notdef); all 95 advances 600;
all ink inside its advance box; 135 contours, 8,244 points, every contour closed with at least 3 points, non-zero area,
clockwise net winding; the `|` stroke is 80 units; contour counts equal `manifest.json`; the licence text is in the name
table; and the browser's rendered coverage of each glyph at 200 px matches the outline area (largest difference 0.43%).
A first build failed the winding check (outlines were counter-clockwise, and had repeated points); the build script
now reverses them and removes duplicates.

## Unverified
Printing; hinting and small-size quality on other rasterisers; other browsers and operating systems and installing the
file in desktop programs (only headless Chromium on Linux was used); readability in long text (my judgement from
screenshots); the OFL text was copied from a copy on the build machine, not compared with upstream.
