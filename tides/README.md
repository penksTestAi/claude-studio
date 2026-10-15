# Tides

A tide predictor built from harmonic constituents. It sums the cosines of one real station's published waves
(Friday Harbor, Washington, NOAA station 9449880) and plots 7 or 15 days. Each constituent (or group) has a switch with a
short "why" note, so a visitor can turn waves off and see what each one does. In this mostly once-a-day tide (K1 and O1 are bigger than M2 and S2) the big swing in the default week is partly the Moon's north-south position; the page tests whether the swing survives with K1 and O1 off before calling it spring-neap, and the "Twice-a-day waves only" preset shows spring and neap clearly. Everything shown is computed in
the browser from `data.js` and `engine.js`; no build step, no server.

## Files
- `index.html`: page, charts, switches, checks. `engine.js`: the prediction maths (also loads in node). `data.js`: data.

## Data and sources (retrieved 15 Oct 2026)
- NOAA CO-OPS harmonic constants (metres, `phase_GMT`) via `data/noaa/9449880.json` in github.com/openwatersio/tide-database
  (commit b36c8131baa1). Heights are above MLLW: mean sea level minus MLLW taken from the same file's datums.
- Second list: TICON-4 (Hart-Davis, Dettmering, Seitz 2025, doi 10.17882/109129, CC BY 4.0), the same gauge, via
  `data/ticon/friday_harbor-9449880-usa-noaa.json` in the same commit.
- NOAA's published high/low predictions (GMT, MLLW, metric) from `fixtures/realworld-friday-harbor.json` in
  github.com/openwatersio/neaps (commit 13a2673c9e6b), which fetched them from the CO-OPS predictions API. That fixture says its constants come from @slackwater/database, so check one partly tests the same relayed constants.
- Speeds, Doodson numbers and IHO nodal formulas from `@slackwater/engine` 1.0.0-beta.0 (MIT); Meeus polynomials for the Sun and Moon.
- Blocked (403 through the sandbox proxy): api.tidesandcurrents.noaa.gov, tidesandcurrents.noaa.gov, github.com web/API,
  uhslc, psmsl, zenodo, seanoe, ioc, bodc, xtide, ncei, ndbc, erddap, wikipedia, jsdelivr and unpkg file hosts. git clone,
  raw.githubusercontent.com and registry.npmjs.org worked.

## What the page checks (on load)
1. NOAA's published highs and lows: 12 events (15-17 Jul 2026 UTC). All 12 within 10 minutes and 5 cm (worst about 8 min, 3.5 cm).
   With nodal corrections off only 5 of 12 (worst about 20 min, 15 cm). 10 minutes and 5 cm were chosen as round numbers after a first run (stated on the page).
2. 34 constants common to NOAA's and TICON's lists compared (RHO is TICON's RHO1, LAM2 is LAMBDA2); 6 flagged (M1, S1, SSA, MF, MM, MSF) by a stated rule.
3. Speeds recomputed from Doodson numbers agree with the table to about 6e-8 deg/h.
Outside the page: the engine was compared with `@slackwater/engine` over four 7-day windows (1999, 2010, 2026, 2031): worst difference 0.2 mm.

## Decisions
- Nodal factors are applied (IHO formulas, at mid-day of each UTC day) and can be switched off to see the effect.
- NOAA's own nodal method is Schureman's; the small mismatch is not measured on the page.
- UT is used where dynamical time belongs (about a minute), ignored.

## Unverified
NOAA was not reachable: constants and the NOAA table are from two public GitHub copies that say they come from NOAA's API.
Only 12 NOAA events (one place, one season) were available. The second list is a re-fit of the same gauge, not an
independent printed table. The "why" notes are my own plain-language summaries. The engine's formulas were not checked
against IHO documents.
