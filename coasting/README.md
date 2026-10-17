# Coasting After the Brakes

A made-up population keeps growing for decades after fertility falls to replacement, so these figures show the mechanism, not any real country's forecast.

A Jupyter notebook (`coasting.ipynb`, outputs saved) plus a landing page (`index.html`). Made by Claude, an AI model.

## What it does
Builds a stylised female population (Makeham-type mortality with an infant term, bell-shaped fertility, 20 five-year age
groups), takes its stable age structure at a net reproduction rate of 1.8, then divides the Leslie matrix's first row so
the dominant eigenvalue is exactly 1 and projects 300 years. The total grows from 1000 to about 1463 (momentum 1.463).
A table repeats this for six starting reproduction rates (1.1 to 3.0).

## Files
- `coasting.ipynb`: the notebook, with saved outputs and two figures. Cells tagged `plot` draw figures.
- `check.py`: runs every code cell of the notebook (numpy only; plot cells are skipped without matplotlib) so the notebook's own asserts run outside Jupyter. Last run: 10 assert statements in 8 code cells passed (2 plot cells skipped without matplotlib), plus 18 numbers on the landing page matched against the notebook.
- `index.html`, `fig1.png`, `fig2.png`: the landing page and its figures (taken from the notebook's outputs).

## Checks run
- Dominant eigenvalue of the Leslie matrix against the root of its own Euler-Lotka equation (bisection): differ by about 1e-15 (assert 1e-9). Against the continuous Euler-Lotka growth rate: 0.06 % apart (assert 1 %).
- Total population summed in code: each step equals births plus survivors, no negative counts, and the limit by reproductive value matches the projection to 1e-6.
- Projected momentum against Keyfitz's closed form `b e0 (R0-1) / (R0 r mu)`: 1.463 against 1.388 (5.1 % lower) at the main setting; 0.8 % to 9.4 % lower across the table. The formula is an approximation, so the asserts allow 8 % and 10 %.
- A population already at replacement has momentum 1.000000.
- `node tools/page_check.mjs coasting/`: no problems at 375, 768 and 1100 px, light and dark.

## Unverified
- All schedules are invented. No number describes a real population.
- Keyfitz's formula, including the definition of mu, came from search summaries of the literature (a paper writing b e0 (R0-1)/(r mu R0)), not from the 1971 paper. I confirmed only that it nearly equals `b e0 / sqrt(R0)` near R0 = 1 and lies within the stated gap of the projection.
- Outside figure (weaker, not independent, kept out of any agreement tally): a search summary of the UN's 2017 momentum variant, world about 7.4 billion in 2015 to about 9 billion, roughly +20 %. Not compared with the notebook.
- The notebook was run with Python 3.13, numpy 2.5.3, matplotlib 3.11.2 only; other versions untested. It was not opened in a Jupyter front end, only executed with nbclient.
- Female only, no migration, fixed mortality, fertility drops in one step.

## Licence
Code and text MIT, as the rest of the repository (see the repository `LICENSE`).
