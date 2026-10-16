# A Small Dilemma Tournament

An interactive page on the repeated prisoner's dilemma. The visitor picks a field of strategies (Tit for Tat, Always Defect,
Always Cooperate, Grudger, Random, Pavlov, Tit for Two Tats), builds up to three of their own from a table of cooperation
chances, sets the number of rounds (10 to 500), noise (0 to 10%) and a seed, and sees a round-robin tournament scored in code.
Made by Claude, an AI model. No fetched data, no libraries. Files: `index.html` (page), `core.js` (model), `test.mjs` (Node checks).

**This is its own tournament. It does not reproduce Axelrod's 1980 tournament or its table, and that table was not checked
against a second source.**

## How it works
- Payoffs 5 (temptation), 3 (reward), 1 (punishment), 0 (sucker). The page checks T > R > P > S and 2R > T + S.
- Each match is seeded from the seed and the two strategy ids (a pair's match does not change when other strategies are added).
  Every round draws four numbers in a fixed order, so the stream does not depend on who plays. Noise flips a chosen move with the
  stated chance and the other player sees the flipped move.
- A strategy meets each other strategy once and, if ticked, a twin of itself (score = average of the two sides).
- Custom strategy: first move, chance of cooperating after CC, CD, DC, DD (mine first), optional grudge (defect for good after k
  defections by the other).
- "Other seeds" reruns the whole tournament 200 times; "finished first" counts ties for every tied strategy.

## Checked
- `node dilemma/test.mjs`: 8,356 checks, 0 failed. Nine hand-worked matches (for example Tit for Tat v Always Defect over 10
  rounds is 9 v 14; Pavlov v Always Defect over 10 rounds is 5 v 30), Tit for Tat v Always Defect at seven lengths, a second scorer
  that re-counts 2,000 matches (302,736 rounds) from the move logs, determinism, a pair's match not depending on the field, a table-built
  strategy matching each of five built-ins (80 pairings, with and without noise), Random v Always Defect (0.5 and 3.0 a round
  within 5 standard errors), noise rates, ranking ties, and that the opening sentence is at most 25 words (it has 23).
- The page repeats the settings-dependent checks on every change and shows each one.
- `node tools/page_check.mjs dilemma/`: no problems at 375, 768 and 1100 px, light and dark. Driven in headless Chromium: no console
  errors, one strategy, none, no twins, noise 5%, a custom Tit for Tat.

## Unverified
- Axelrod's tournament, its entrants and its table; the common payoffs 5, 3, 1, 0; and the claim that Tit for Tat did well there
  are from memory only. The page says so.
- The definitions of Pavlov and Tit for Two Tats are my reading; other sources differ slightly.
- The second scorer uses the same payoffs as the first, so a wrong payoff table would not be caught (the hand-worked cases are
  derived from the same four numbers).
- No real phone, no screen reader. The "other seeds" counts are a sample, not a proof.
