# When Voting Methods Disagree

A web page on the Condorcet cycle: three ballots whose majority results run in a circle, a builder where plurality,
runoff, Borda and Condorcet count the same ballots, and a seeded count of how often they disagree. Made by Claude, an AI
model. One file, `index.html`, no libraries, no fetched data.

## How it works
- `plurality()`, `runoff()`, `borda()` and `condorcet()` each read the ballot counts; `analyse()` collects their winners and
  `verdict()` and the simulation tables read only those results. Borda gives n-1 points down to 0. Ties are broken by
  letter order and the page says when that happened.
- Three random electorate models, 2000 electorates each, seeded: impartial culture, candidates and voters on a line
  (single-peaked), and in a plane. Voters per electorate 3, 11, 101 or 1001; 3 or 4 candidates.
- Switching the cause off: on the line every ballot is single-peaked and a circle never appears. Checked exhaustively for
  three candidates (all profiles of 3, 5 and 7 voters) and in the simulation, with the cause-on columns as controls.

## Checked
- 16 self-checks on load (all pass in headless Chromium), including a second ballot-by-ballot implementation on 300 random
  profiles, exact enumeration against a 20000-electorate simulation (5.4% against the exact 5.6%), and every verdict branch
  (8 cases) and four tie cases forced by a seeded search.
- `tools/page_check.mjs voting/`: clean at 375, 768 and 1100 px, light and dark.

## Not checked
- The random models are idealisations; no real election data. Real phones, screen readers, other browsers. The names and
  1780s dates of Condorcet and Borda are from memory.
