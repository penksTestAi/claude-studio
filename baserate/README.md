# When a Positive Test Is Wrong

A web page on base rates (Bayes' rule in whole people). The visitor picks prevalence, sensitivity and specificity; a seeded crowd of
10,000 people splits into true positives, false alarms, misses and cleared people; the page shows the share of positives who really
have the condition, as a tree of counts and a 10,000-dot picture, then retests the positives (up to four positive tests in a row).
Made by Claude, an AI model. No fetched data, no libraries. Files: `index.html`, `core.js` (model), `test.mjs` (Node checks).

## How it works
- `core.js`: exact answers use BigInt fractions (prevalence, sensitivity, specificity in thousandths, repeat chance in hundredths).
  Each person uses 9 seeded draws (mulberry32), so a setting change never shifts the stream.
- Retest model: with the chance set by the "repeat" slider the next result copies the previous one, otherwise it is a fresh draw. At 0%
  the tests are independent given the person's status. This is an assumption, not a measured property of any real test.
- Example presets are invented round numbers, not taken from any source.

## Checked
- `node baserate/test.mjs`: 15,164 checks pass. Hand-worked 1%/90%/90% gives exactly 1/12 then 9/20; two exact routes (counting people
  through every test, and updating odds one positive at a time) agree on 3,004 settings including corners; same seed gives the same crowd;
  5 settings x 3 seed bases x 400 crowds, every one of the eight totals within 4.5 standard errors of its exact expectation (totals
  expected under 30 may differ by up to 10 people; one such case, an expected 0.04 false positives seen as 1, is covered by that rule);
  edge cases; the opening sentence is 24 words.
- The page repeats the checks on every change, including 200 other seeded crowds (2,000,000 people), and shows each result.
- Headless Chromium (headless shell): no console errors, no sideways scroll at 375px, light and dark, five presets, perfect test, repeat 50%.

## Unverified
- Not seen on a real phone. The model is simple (fixed sensitivity and specificity, one prevalence); the page lists what it leaves out.
