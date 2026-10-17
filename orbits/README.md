# Slow Down to Catch Up

Drag a burn onto a spacecraft orbiting Earth and see the orbit change; run a "brake to catch a target ahead" rendezvous;
plan a Hohmann transfer from Earth to Mars. The page integrates the motion (fourth-order Runge-Kutta, step set by the
local orbital time) and checks itself. Made by Claude, an AI model.

## Files
- `index.html`: the piece. `orbit.js`: physics (shared). `checks.js`: every check (shared). `check.mjs`: runs the same
  checks in Node: `node orbits/check.mjs` (about 4 s; prints one line per check, exits 1 on an unexpected failure).
- `data/source-a.json`: source A (see below), made by `data/fetch_source_a.mjs`.
- `vendor/astronomy-engine-2.1.19.min.js` + `vendor/LICENSE-astronomy-engine.txt`: Astronomy Engine 2.1.19 (MIT), used for source B.

## What is checked (last run of `node check.mjs`: 73 checks, 59 pass, 0 unexpected failures, 14 planet rows flagged)
- Integrated motion on 5 orbits, 10 laps each: speed against vis-viva (a from the *measured* apsides), measured period
  against Kepler's third law, energy and angular momentum conserved. Limits 1e-6, 1e-5, 1e-8, 1e-8; worst values seen are
  several orders smaller.
- Control: explicit Euler on the same orbit changes energy by about 0.24 (relative); the energy check flags it.
- Hohmann (Earth to Mars, circular coplanar, A's distances): integrated time, far-point radius, half-turn, circular result
  after the second burn, and arrival at the target flown for the formula's time.
- Catch-up (7000 km orbit, target 40 degrees ahead): braked laps end at the target; the forward burn re-circularises.
- Planets: 9 bodies, semi-major axis and period, source A against source B (below), plus Kepler's third law inside each
  source. Rule fixed before the first run: within 0.1% plus half of A's last printed digit.

## Planet sources and independence
- A: GitHub copy of NASA's Planetary Fact Sheet (devstronomy/nasa-data-scraper, `planets.csv`), retrieved 2026-10-16.
  A third-party copy of unknown date; no licence file found in that repository (NASA data; only 18 numbers kept).
- B: computed in the page from VSOP87 (Bretagnon and Francou) via Astronomy Engine (axis from the osculating energy, mean of
  20 samples over about 480 years; period from returns of the orbital angle). Earth is the Earth-Moon barycentre. Pluto
  uses the library's fitted table, so for Pluto B is not independent of JPL.
- Different origin, not fully independent: both rest on centuries of the same kind of observations. The library's own typed
  period table is shown too, but it is the same author as B.
- **Hand-typed numbers and formulas are not independent**: GM of Earth and Sun, Earth's radius and the AU are typed in
  `orbit.js`; vis-viva, Kepler III, Hohmann and phasing formulas were written by me and checked against the integrator
  (a different calculation by the same author with the same constants).

## Results to know about (all shown on the page)
Disagreements flagged: axis Saturn, Neptune, Pluto; period Uranus, Neptune; Kepler III inside A for Jupiter, Saturn,
Uranus, Neptune and inside B for Jupiter, Saturn, Uranus, Neptune, Pluto. For the three axis rows A lies inside the range
B's osculating axis wandered through. Causes were not established. The rule was not loosened after seeing these.

## Unverified
No comparison with a published Earth-to-Mars figure; real Mars orbit (oval, tilted), escape from and capture by planets,
and planetary masses not modelled; page seen only in scripted headless Chromium (375, 768, 1100 px, light and dark), not
on a touch screen or by eye on a real phone.
