# Why Real Numbers Start With 1

A web page on Benford's law as a forensic test, made by Claude, an AI model. It draws first-digit histograms against
log10(1 + 1/d) for sequences computed with exact big integers (powers of 2, Fibonacci, factorials), for numbers other
Vigil pieces already ship (tide constituent amplitudes, star catalogue values, element discovery years, leap seconds),
and for counter-examples (bounded ranges, assigned ids, plain counting). It ends with chi-square and MAD tests and a
table showing how sample size changes the verdict.

## Files
- `index.html`, `app.js`, `core.js` (the maths, also loadable in node), `data.js`, `make_data.py`.
- `data.js` is built by `make_data.py` from `star-hop/index.html` (REF), `tides/data.js`, `elements/index.html` (ROWS)
  and `leapseconds/leapseconds.csv`. No value is typed by hand. Counts: 37 and 50 tide amplitudes, 51 stars,
  101 element years (source A gives a year for 101 of 118 rows; Element Timeline's own count of 100 "dated" uses an extra
  rule), 28 leap-second rows.

## What the page computes
Every count, share, statistic and verdict is computed in the browser. Chi-square uses 8 degrees of freedom with the exact
closed-form tail for even degrees; rejection is at p < 0.05. Repeated-sample tables use a seeded generator (mulberry32).

## What was checked (13 self-checks on the page, all passed in headless Chromium)
Benford shares sum to 1; sequence counts sum to 3000; powers of 2, Fibonacci and factorial first digits agree with a
logarithm-based computation for every term tested; the chi-square tail agrees with numerical integration at 5% and 1%
(critical values 15.507 and 20.090); the sampler stays within 0.005 of the shares over 200,000 draws; the false-alarm
rate at n = 1000 is 5.1% over 3000 samples; the data in `data.js` matches the source files re-read in the browser.
`node --check` on both scripts; `node tools/page_check.mjs benford/` with `CHROME` set to the headless shell: no problems at
375, 768 and 1100 px, light and dark. The self-checks are not independent of the author, and the browser re-reads use the
same files as the build script.

## Unverified
- The MAD bands are a convention recalled from the forensic-accounting literature, not checked and not counted.
- That the law holds for powers of 2 and Fibonacci because of an irrational logarithm step is quoted, not proved here.
- Factorial conformity is only observed. A not-rejected verdict is not proof of genuine data; a rejection is not proof of fraud.
- The studio lists are small and not random samples. No outside dataset or web search was used.
- Needs a web server (the checks fetch sibling folders); opened from `file://` those four checks report "not run".
