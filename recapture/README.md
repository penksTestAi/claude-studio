# Mark and Recapture

A web page on estimating a population from two catches. The visitor tags fish in a seeded pond, nets a second sample and gets a
Lincoln-Petersen and a Chapman estimate. The page knows the true count, so it repeats the experiment over many seeded ponds,
measures its own error, and switches off each assumption in turn (closed population, equal catchability, tags that stay on).
Made by Claude, an AI model. One file, `index.html`, no libraries, no fetched data.

## How it works
- The model code is the first `<script id="core">`: `newPond`, `tagStep`, `driftStep`, `catchStep` (the same functions drive the
  visitor's pond and every trial), `estimate`, `summarise` and `predict`. Nets take a fixed number of fish, drawn by an
  exponential race (the n smallest of -ln(u)/weight), which is uniform when weights are equal.
- Broken worlds (constants in `P`, page text built from them): 20% of fish leave and 50% of the original count arrive
  untagged; 30% of fish are bold with weight 6 in both nets; each tag falls off with chance 30%.
- Section 2 reports mean error against the count at tagging time (and, for the open pond, against the count at the second net),
  the middle 80% of estimates, and how often the normal 95% interval holds the truth. "Rough prediction" is a large-sample
  calculation from the constants alone.

## Checked
- 15 self-checks on load (they run in slices so the page stays responsive), all pass in headless Chromium: same seed gives the same result; the net always holds the requested
  number of distinct present fish; equal-weight inclusion is uniform (worst fish 2.9 standard errors); bold fish are netted
  4.6 times as often as shy; the exact hypergeometric sum gives Chapman unbiased when n1+n2 >= N (30, nets of 20) and matches
  a 4,000-trial simulation for a pond of 100; m = 0 handling; control bias within 3 standard errors of zero; every broken world
  moves the estimate and lands within 6 points of its prediction.
- At the defaults (pond 600, nets of 100, 2,000 trials) over three first-seed values run in Node (1000, 5000, 77777):
  control error +0.6, +0.2, -0.8%; open pond +61 to +63% (prediction +62.5%); unequal catchability about -41%
  (prediction -40.8%); tags falling off +41 to +44% (prediction +42.9%).
- Flake test in Node, 60 shifted seed sets: the control-bias, inclusion and exact-expectation checks failed 0 of 60 times; the
  coverage check, then accepted 90% to 99% with a true value of about 92%, failed 1 of 60. The band is now 88% to 99% (a
  check on "close to 95%", not "exactly 95%"); over 300 shifted seed sets coverage ran 90.1% to 93.8% and the new band
  failed 0 of 300. The page's fixed seeds pass.
- Trials and checks run in slices of about 30 ms with progress text, so the buttons and scrolling stay live. In headless
  Chromium (desktop CPU, 375 px window) the longest stall during a 25,000-trial run was 79 ms.
- Play-through in headless Chromium at 375 px: m = 0, m = n1 = n2 and all-broken branches each fired and read correctly; no console
  errors. `node tools/page_check.mjs recapture/` is clean at 375, 768 and 1100 px, light and dark.

## Not checked
- Real fish: the model is identical points, with no places, schools or size-selective nets. Real surveys often fix effort, not catch.
- The prediction for unequal catchability is an approximation; other settings (other nets, other constants) were not swept.
- The Chapman interval is the normal approximation; its coverage was measured only at the settings above.
- Real phones, screen readers, other browsers, and the speed on a slow phone: the default run (10,000 trials plus the net-size table) took 5.2 s in headless Chromium here, the largest (25,000) 10.4 s, so a phone will be slower.
- The formulas are standard; the history and names behind them were not looked up.
