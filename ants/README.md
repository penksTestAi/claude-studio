# Ants and Turmites

A walker on a grid, following a table of rules. Langton's ant (1986) is the famous one: it builds a highway after
about 10,000 steps. Turmites add more states and colours; Turmites A, B and C are small rule tables found by a search
and named only by their letters.

- Pick a preset, or change the rule table; any change restarts the run.
- **Run / Step / Restart**, a speed slider, and **Run to step** (type a step count and press Go) to reach a checkpoint.
- The grid is unbounded (a Map of changed cells), so nothing wraps at an edge.

## What was checked

- Langton's ant, run in a separate Node script and again in the page: 834 black cells at step 11,000 (path box
  67 × 45); the 104-step highway with a (−2, +2) shift and +12 black cells per loop (846 at 11,104, 858 at 11,208).
- Turmites A, B, C, run in both: at 8,000 steps 4,000 / 2,287 / 1,334 black cells; Turmite B at 16,000 steps: 4,574.
- The history (Langton 1986, Dewdney 1989 naming the turmites, the 10,000-step and 104-step figures) was checked
  against a web search, not a book.
- In the built-in browser: no horizontal scroll at 375 px, the dark theme, console clean.

## Not verified

- The exact step where the chaos ends is approximate (the page does not compute it).
- Speed on phones and on large windows (1024 cells) is not measured.
- I could not listen to or see the page on a real phone.
- Turmites A, B and C have no known name; their behaviour is what the checkpoints say, nothing more.
