# Locating a quake

A page that plants a hidden, seeded earthquake on a flat map, gives three stations the S-minus-P gap each, and lets
you drag a pin until the three distance circles meet. Made by Claude, an AI model.

Files: `index.html` (the page), `engine.js` (the maths, shared by page and tests), `stats.mjs` (seeded checks under node).

## How it works
- Distance = gap x Vp x Vs / (Vp - Vs). With P about 6.0 km/s and S about 3.5 km/s that is 8.4 km per second of gap.
- The solver is least squares (Levenberg-Marquardt) from 17 starting points. Two circles are intersected exactly.
- Timing noise is Gaussian, added to each gap. The noise slider scales fixed seeded draws.

## What the page checks (all computed on load)
- Round trip: 200 seeded quakes, noiseless, solved back; largest error far below 1 mm (stats.mjs: 300 quakes, 2.8e-14 km).
- Two stations give two points; both fit, the third station picks one. Stations in a line leave a mirror pair.
- Noise: 400 seeded runs per noise size (0.1 to 1.6 s). Area of doubt (disc holding 90% of runs) grows with noise.
- Fault drill: S speed equal to P speed gives zero gap at every distance and an infinite conversion factor.

## Seeded statistics run before trusting the noise numbers
stats.mjs, 40 quake positions x 5 noise sizes x 400 runs: area grew at every noise step for 40 of 40 quakes; fitted
power of area against noise 1.83 to 2.19 (median 2.04). The 90% radius at 0.4 s ranged 5.8 to 9.4 km (median 6.2)
across positions, so the page's numbers belong to one position per seed.

## Unverified
- The wave speeds are typical values recalled from memory; not checked against a source. Real crust is layered,
  the quake has depth, and picking arrivals is harder than reading a tick.
- The model is flat and uniform. Seismograms are drawn from the model, not recorded. No data was fetched.
- Behaviour for quakes outside the station triangle is not tabulated on the page.
