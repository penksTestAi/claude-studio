# Why the Rainbow Sits at 42°

An interactive page: drag the point where a ray enters a round water drop and watch the total turning angle go flat
at its minimum, so neighbouring rays bunch and the bow has an edge. Sliders for dispersion (red against violet) and
for the refractive index itself, a secondary bow, and Alexander's dark band between the bows. Made by Claude, an AI model.

Files: `index.html` (everything inline, no libraries, no network needed), this README.

## How it works
- Each ray is traced with vectors through a unit circle: Snell's law at entry, mirror reflection inside, Snell's law at
  exit. The total turning is summed from the signed angle at every step, not taken from a formula.
- Colours differ only through n(wavelength): Sellmeier fit of Daimon and Masumura (2007), water at 20.0 C. The
  dispersion slider scales the colour spread around the reference wavelength (589.3 nm); the index slider sets the
  reference index. Index is never allowed below 1.
- The sky picture and the bow angles use Descartes' closed form, cos^2 i = (n^2 - 1) / (k (k + 2)), which the checks
  hold against the scan.

## What the page checks (all computed in code, on load and when a slider moves)
1. Primary and secondary bow, red / reference / violet: scan 90,000 rays (entry angle in 0.001 degree steps) for
   minimum turning, compare with the closed form (tolerance 0.001 degree in turning, 0.01 degree in entry angle).
2. The same with the cause switched off (n = 1): the scan's minimum is at the end of the range and the closed form has
   no solution. Both must say "no bow".
3. The vector trace at the current entry point against the formula k x 180 + 2i - 2(k+1)r.
4. Index of water, 17 rows (400 to 800 nm) against Hale and Querry (1973), 25 C table.
5. The number in the title against the computed primary bow at 589.3 nm.
6. Fault drills, run once on load: each check is given a deliberate fault (wrong divisor, missing guard, nudged index,
   changed table row, too few rows, wrong title number) and must not say it agrees. Plus two controls.

## Result of the index check, and what it is worth
The two tables are different papers, temperatures and methods, so this is a real second source, not a re-fit. But both
were read from one database (refractiveindex.info, public domain), so a transcription error there would affect both:
the check is not independent of the database. Rows were fetched at build time and typed into the page as data.
Result: rows from 575 nm up agree within 0.0015; rows from 400 to 550 nm do not (largest 0.0046 at 400 nm, which would
move the primary bow's violet edge by about 0.65 degrees). The page flags this and keeps the Daimon and Masumura fit,
a modern direct measurement; I did not look at why Hale and Querry differ in the blue. The 0.0015 allowance is table
rounding (0.0005) plus 5 K x about 0.0001 per K (dn/dT from memory) plus a margin of 0.0005, chosen by me.

## Measured in a headless browser
All bow checks agree at real water, at n = 1 with no dispersion, at n = 2.1 (secondary bow only) and with the index
set just under 2. All six fault drills are caught. `tools/page_check.mjs`: no problems at 375, 768 and 1100 px, light
and dark.

## Not verified / not modelled
- Brightness, diffraction (supernumerary bows, blurred edges), polarisation, non-spherical or mixed-size drops, the
  Sun's size. Light reflected off the outside of the drop is not drawn, so the dark band is darker, not black.
- The history (Descartes 1637, Alexander of Aphrodisias in antiquity) is from memory.
- Dragging was tested with a mouse in a headless browser, not on a real phone.
