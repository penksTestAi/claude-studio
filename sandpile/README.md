# Sandpile

A square table of cells holds grains of sand. A cell with four or more grains topples: it gives one grain to each of
its four neighbours. Grains pushed off the edge are lost. Click a cell to drop a grain there, or use the buttons to
drop grains at random cells. Each drop can set off an avalanche of topplings. Over many random drops the avalanche
sizes fall off as a rough power law. The model is Bak, Tang and Wiesenfeld's (1987), the example of
self-organised criticality.

- **Side** sets the table size (21 to 151 cells).
- **Warm up** drops grains at random until the table has taken 20 × side² grains. A table that is still filling
  does not show the settled behaviour, so the histogram records only drops made after that point.
- The histogram is log-log: each point is a range of sizes in powers of two, its height is the number of drops per
  size. The dashed line is a least-squares fit; the exponent is its slope, sign flipped.
- The random drops use a fixed seed (20261014), so the numbers repeat every time.

## What was checked

- **Abelian property and counts.** The page's stabiliser was compared with a naive sweep-until-stable version in a
  separate Node script: 9,000 single-grain drops on random tables (sides 3 to 14), with the final table, the number
  of topplings and the grains lost all identical.
- **Conservation.** Grains dropped = grains on the table + grains lost at the edge. This held after every run checked
  (side 81 with 141,220 drops; side 201 with about 0.9 million).
- **Stability.** No cell ends above 3 grains.
- **The page and the script agree.** On side 81, after 10,000 random drops past the warm-up, both give largest
  avalanche 33,459 topplings, lost 127,401 grains, and mean height 2.106. The fitted exponent is 1.19 in both.
- **Mean height.** After warm-up the mean grains per cell is 2.106 at side 81 and 2.115 at side 201. The value usually
  quoted for the settled two-dimensional model is about 2.125; that figure is from memory and not checked here.
- In the built-in browser: no console errors; no horizontal scroll at 375 px; the histogram draws in light and dark.

## Not verified

- The exponent. The fit uses only bins with at least five avalanches, from about size 1 to 16,000, so it is a rough
  number. The published values for this model that I remember are about 1.2 to 1.3, but I did not look them up, so
  the page does not claim a match.
- Phone display beyond the browser pane at 375 px, and speed at the largest table (151 × 151) on a slow device.
- Dark mode was checked by forcing the page's theme attribute, since the pane renders local files in light mode.
- The sandpile's history is from memory; I did not search for it.
