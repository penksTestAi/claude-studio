# Seed Head Spirals

Eight pictures of a model seed head, each drawn with a different turning angle, and a page that counts their spirals
from the pictures' pixels and checks the counts against Fibonacci numbers. Made by Claude, an AI model.

The model is Vogel's 1979 one: seed *i* (1 to 1,500) sits at distance c·√i from the centre, turned by i × angle.
All seeds have the same size (radius 6.5 px in a 1000 × 1000 picture). Only the angle changes.

## Files

- `make_seedheads.py` draws the PNGs (Pillow, numpy; no random numbers, so reruns give the same files), measures them
  and writes `manifest.json`. `python3 make_seedheads.py --check` also asserts the measurements and exits 1 on a failure.
- `golden.png` (137.5078°), `a1373.png` (137.3°), `a1377.png` (137.7°), `a1375.png` (137.5° exactly, 55/144 of a turn),
  `a135.png` (3/8), `a144.png` (2/5), `a120.png` (1/3), `a90.png` (1/4). Each is 1000 × 1000 pixels, 64-colour palette.
- `index.html` is the landing page. Open it over http (GitHub Pages, or `python3 -m http.server`); from a file the browser
  blocks reading pixels.

## How the counting works

1. Find every separate dark shape (connected pixels) and its weighted centre.
2. Order the shapes by distance from the centre: that order is the seed number.
3. For each seed in a ring, look at its 6 nearest neighbours and take the absolute difference of seed numbers. The three
   most common differences are the spiral families (a difference of 21 means 21 arms).
4. Rings: seeds 150-500, 500-900, 900-1350. Check each number against the Fibonacci list and whether each ring's three
   numbers run as a, b, a+b with a and b adjacent in the list.
5. If fewer than 97% of the seeds come out as separate shapes, step 3 is not used. The page counts dark runs on a circle
   at 0.9 of the radius instead; for a simple fraction p/q of a turn that should be q rays.

## What was checked

- Golden angle, 1,500 separate dots, differences 21, 34, 55 | 34, 55, 89 | 55, 89, 144: all Fibonacci, every ring a, b, a+b.
  The script (pixels), the page (pixels) and the true seed numbers with exact positions give the same triples.
- 3/8, 2/5, 1/3 and 1/4 of a turn: 8, 5, 3 and 4 rays counted, equal to the fractions' denominators.
- 137.5° exactly (55/144) gives the same counts as the golden angle at 1,500 seeds.
- 137.3° and 137.7°: the dots overlap (1,346 and 703 separate shapes), the page counts 83 and 87 dark runs on a circle,
  neither a Fibonacci number. The true-seed-number differences (21, 42, 97 ... and 34, 47, 68 ...) are not Fibonacci runs.
- In headless Chromium: no console errors, no sideways scroll at 375 px (`node tools/page_check.mjs phyllotaxis/`), the
  page's own measurements equal the script's for all 8 pictures, and typed angles 137.6, 99.5, 150 and 180 gave sensible
  verdicts (99.5: 29, 47, 76 | 47, 76, 123 ..., none Fibonacci; 150: 12 rays = 5/12; 180: 2 rays).
- The lede is 24 words; the page checks its own length.

## Not verified

- **No real seed head was measured.** Nothing here shows that a particular sunflower looks like these pictures.
- One head size (1,500 seeds), one dot size and three rings. Other sizes can give other numbers.
- 137.5° is exactly rational, so its pattern must differ from the golden angle's with enough seeds. That was not
  tried: no larger head was drawn.
- The dark-run count for 137.3° and 137.7° is not a proven count of spiral arms.
- The pictures and page were not seen on a real phone, and the page's own canvas (smoothed differently from the PNGs)
  was only tested at the four angles above.
- Licence: the pictures and code are MIT, as the rest of the repository.
