# Paper Slide Rule

A printable slide rule as a PDF (A4 landscape, 2 pages): scales C and D (one decade, 250 mm), A and B (two decades in
the same 250 mm) and CI (C reversed), plus a 100 mm check bar and a cursor to print on clear film. Made by Claude, an AI
model. Nothing is fetched; everything is computed.

## Files
- `sliderule.pdf`: the output.
- `make_sliderule.py`: generator (`reportlab==4.2.5`, see `requirements.txt`; Python 3.11). `python3 make_sliderule.py`.
- `verify_sliderule.py`: measures the PDF back, runs the simulation, writes `results.json` and copies it into `index.html`
  (between the RESULTS markers). No third-party library; it reads the uncompressed page text of the PDF.
- `manifest.json`: every mark's value and position as the generator wrote them. `index.html`: the landing page.

## How each claim is produced
- Mark positions: `position_mm()` (x = left index + 250 mm x log10(value); A, B use 125 mm per decade; CI uses 1 - log10),
  drawn by `draw_scale()`. Mark values are integers in hundredths of the mantissa, so which marks exist cannot drift.
- Measured back: `parse_lines()` reads each vertical `x y m x y l S` line from the PDF; `main()` pairs them with the manifest's
  values by position, recomputes log10 itself, and compares. Mark counts are compared with a hand tally
  (161 for C/D/CI: 1 + 50 + 60 + 50; 151 for A/B: 1 + 2 x (20 + 30 + 25); 101 for the ruler).
- Reading simulation: `multiply()`, on the measured C and D marks. Straight-line guessing between the two nearest marks for
  each setting and the reading, plus normal alignment errors (sigma 0, 0.1, 0.2, 0.4 mm, assumed, not measured), 20,000
  random pairs per row, 5 seeds for the noisy rows.

## Results of the last run (also on the page)
All 886 marks within 0.002 mm of log10 (largest difference 0.00002 mm); drawn lengths 250.000 mm (100.000 mm for the bar);
closest marks 1.09 mm apart; A/D, B/C and CI/C relations hold within 0.00002 mm. Reading error by straight-line guessing alone:
a single reading at most 0.008%; a whole multiplication at most 0.01%. With 0.2 mm alignment error per setting: median about 0.2%, 95th percentile about 0.6%, largest in the run 1.4%.

## Printing
Print at 100% on A4. The bar at the bottom of page 1 must measure 100 mm and scale D, from 1 to 10, 250 mm. A uniform scale error
leaves the readings unchanged (tested in the simulation) but the stator gap then no longer fits the slide.

## Unverified
Never printed, cut or assembled; printer scaling, paper stretch, line thickness, whether the glued strips slide and the cursor on
film are untested. US Letter not supported (the right cut line is at 285.5 mm, Letter is 279.4 mm wide). The alignment errors are assumed.
Labels were checked only in a raster (`pdftoppm`), not measured. Not opened in other PDF programs.
