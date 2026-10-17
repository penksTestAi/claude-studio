# How a Point Edge Becomes a Match

A web page. The visitor drags the chance of winning a point on serve and on return, and sees the chance of winning a service
game, a return game, a tiebreak, a set and a best-of-3 or best-of-5 match, a graph of how those curves steepen around an even
match, and a momentum slider that shows how much streaky points could move the answers. Made by Claude, an AI model. No
libraries, no fetched data.

## Files
- `index.html`: the page.
- `tennis-core.js`: the maths and the checks, used by the page and by `check.mjs`.
- `check.mjs`: `node tennis/check.mjs [--seeds N]` runs every check on six serve/return settings and N seeds, including the
  best-of-5 Markov chain, counts the lede's words, and exits 1 on failure.

## How it works
Four routes to the same numbers: (1) exact fractions (BigInt) by recursion over scores, with deuce and six-all in a tiebreak
summed as a geometric series; (2) the same rules as a point-by-point score machine, run forward as a Markov chain; (3) the
closed-form game formula; (4) the score machine played with a seeded random number generator. Route 1 shares no code with 2 and
4; routes 2 and 4 share the score machine, so a rules mistake there would show in both (it would still disagree with route 1).
The opponent's chances are the complements of the visitor's. Scoring: advantage games, a seven-point tiebreak at six games all
in every set, serving 1-2-2-2 in tiebreaks.

## Checked
- `node tennis/check.mjs --seeds 12`: 1080 counted rows (6 settings, 12 seeds, 15 rows each), 0 failures; largest simulation gap
  3.76 standard errors (the pass limit is 4). The page runs 14 of the 15 rows (it skips the best-of-5 Markov chain, which takes
  about 3 s).
- Exact game value against the closed form at 25 point chances: largest gap about 2e-16. Markov chain against exact: gaps below
  1e-13.
- Equal players (return chance = 1 minus serve chance): tiebreak, set, best of 3 and best of 5 are exactly 1/2 as fractions.
- Tiebreak and set chances are the same fractions whichever player serves first.
- Lede is 19 words (counted in `check.mjs`).
- `node tools/page_check.mjs tennis/`: no problems at 375, 768 and 1100 px, light and dark. In headless Chromium, no sideways
  scroll at 375 or 1000 px after moving the sliders and no console errors.

## Unverified
- Not tested against any real match data; independence of points is an assumption, not a finding.
- The momentum rule is my own simple choice. It does not hold the serve and return point chances exactly (the page measures the
  drift and prints it), so part of a shift can be drift rather than streaks.
- Weaker, not independent, not counted in the tally: "about 0.62 for a game at p = 0.55" (Newton and Keller) came with the brief
  from search summaries. Fetching sources failed in this sandbox and my own search returned no number; the page gives 0.6231.
- Only headless Chromium; no real phone or screen reader.

## Licence

Code and text by Claude, free to reuse.

