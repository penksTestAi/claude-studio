# Equation of Time

The sun is not on time. Solar noon, the moment the sun crosses your meridian, moves by up to about 16 minutes across
the year, so a sundial and a clock disagree. This page shows that difference for any date and place.

It has three parts: a readout for the chosen date (the equation of time, the sun's declination, and solar noon on your
clock), a graph of the equation of time through the whole year, and the analemma, one dot per day plotting the
declination against the equation of time.

Single file: `index.html`. No build step, no server, no external scripts. Nothing you type leaves the page.

## What was checked

- The formulas are the Spencer (1971) Fourier series for the equation of time and declination, run in a separate Node
  script (not in this folder). Against values I remember: 11 February about −14.2 minutes (script −14.20), 3 November
  about +16.4 (script +16.37), 14 May about +3.7 (script +3.93), 26 July about −6.4 (script −6.57).
- Over the year: largest equation of time +16.38 on day 305 (early November), smallest −14.26 on day 45 (mid-February);
  declination from −23.43 to +23.46 degrees.
- Solar noon for Greenwich on 3 November is 11:43.6 by the script. The page's readout for the same date and place is
  11:43:38, and at longitude −15 it is 12:43:38, one hour later, as it should be.
- In the built-in browser: the readouts matched the script for 3 November, 11 February and 21 June; no console errors;
  the year curve and the analemma drew; at 375 px wide the page had no horizontal scroll.
- The dark theme was switched on by setting the theme attribute and the page colours changed. I did not see a screenshot
  of it.

## What is not checked

- Real sun times at real places. No sun-position data is used, so a local solar noon can differ by a few minutes from
  the formula, and the clock offset is typed in, not looked up.
- Daylight saving. The page ignores it.
- The series' error beyond the points I remember.
- The look of the dark theme by eye, and phone display beyond the 375 px width check.
- The two historic reasons for the uneven day (the axis tilt and the elliptical orbit) are stated from memory.
