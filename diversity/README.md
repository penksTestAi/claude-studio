# Counting Species Fairly

A tiny MIT-licensed JavaScript library, `diversity.js` (about 100 lines, no dependencies), for species-diversity
indices from abundance counts, with a landing page (`index.html`) where you edit a list of counts and watch the
indices and a rarefaction curve change. Made by Claude, an AI model.

**Main caveat:** every index is computed from one sample and moves with sample size; the only published worked
example checked is a weaker, non-independent figure seen through a web-search summary.

## What it computes
`richness`, `abundance`, `shannon` (nats, plug-in), `simpson` (D = sum p^2), `giniSimpson`, `inverseSimpson`,
`giniSimpsonUnbiased`, `bergerParker`, `pielou`, `hill(counts, q)` (q = 0, 1, any real, Infinity), `chao1`
(bias-corrected), `rarefy(counts, n)` (Hurlbert 1971, exact, sampling without replacement) and
`rarefactionCurve(counts, points)`. Zero counts are ignored; non-integer or negative counts throw `RangeError`.

## Use
```js
const D = require("./diversity.js");   // or <script src="diversity.js"> -> window.Diversity
D.shannon([10, 20, 30, 40]);  // 1.2799
D.hill([10, 20, 30, 40], 2);  // 3.3333
D.rarefy([5, 3, 2], 2);       // 1.6889 (76/45)
```
Tests: `node test.js` (needs only Node).

## What was checked
`checks.js` holds 47 checks, run by `test.js` in Node (all pass) and by the page on load:
- 30 hand-computable cases: equal abundances for S = 1, 2, 3, 5, 8, 20 (Shannon = ln S, Simpson D = 1/S, Hill orders
  0, 1, 2, 3 and infinity all = S), Pielou = 1, one species, rarefaction of counts 2,1 (1, 5/3, 2) and 5,3,2 at n=2
  (76/45), Chao1 by hand, unbiased Gini-Simpson.
- 12 brute-force checks: rarefaction for three small communities at n = 1 to 4 equals the average over every
  possible subset of individuals, enumerated in code.
- 5 "published" checks, **weaker and not independent**: a teaching worksheet's answer key for counts 10, 20, 30, 40
  (per-species -p ln p terms 0.230, 0.322, 0.361, 0.367 and sum p^2 = 0.30). Fetching pages failed (no DNS for
  Wikipedia), so these come from a web-search summary, and the formula is the same one the library uses. That key's
  own printed total, -1, disagrees with its own terms (they add to 1.280) and is flagged on the page, not used.
- `test.js` also checks Hill numbers never rise with q, rarefaction curves are non-decreasing from 1 to S, bad input
  throws, and 200 seeded random communities.
- Page: `node tools/page_check.mjs diversity/` passes at 375, 768 and 1100 px, light and dark; editing, bad input
  and one-species input were tried in headless Chromium with no console errors.

## Not verified / not included
- No second independent published table (for example a vegan `rarefy` output or a Hurlbert 1971 table) was compared.
- Shannon and richness are plug-in values and run low in small samples; Chao1 is a lower-bound guess.
- No coverage-based rarefaction, extrapolation or confidence intervals; no Python version.
- Rarefaction here samples individuals without replacement from the given counts; other definitions exist.

## Licence
MIT, full text in `LICENSE`.
