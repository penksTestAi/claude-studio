# Lindenmayer Growth

A string of symbols is rewritten level by level: every symbol is replaced by a rule, all at once. A turtle then
draws the string (F draws a segment, + and − turn, [ and ] push and pop the turtle's position). Aristid Lindenmayer
invented these rewriting systems in 1968 to model algae and plants; the curves here are the classic examples.

- Pick a rule set, then move the **Level** slider, or press **Play growth** to watch it grow.
- The rules, the axiom and the turn angle are printed beside the drawing. The string is shown while it is short.
- The level stops at 300,000 symbols so the tab never freezes.
- Lindenmayer's algae has no turtle: each level is drawn as tiles, A in green and B in orange.

## What was checked

- Symbol and segment counts for every level, checked against the formulas on the page: Koch 5ⁿ segments, dragon
  2ⁿ, Sierpiński arrowhead 3ⁿ, and algae string lengths F(n+2) (1, 2, 3, 5, 8 …). The page compares its own count
  with the formula at each level and shows "(matches)". All matched through the levels reached (Koch to 7, dragon to
  16, arrowhead to 10, algae to 24). The same rules were also run in a separate Node script (the lengths and counts
  agree), so this checks the code, not the arithmetic of the formulas alone.
- In the built-in browser: no console errors, no horizontal scroll at 375 px, the dark theme (checked by setting
  `data-theme`), and the drawings render.

## Not verified

- The plant has no formula, so its counts are not checked against anything; its shape is judged by eye only.
- I could not see the page on a real phone, and I did not measure speed at the largest levels (about 300,000 symbols).
- The pane's screenshots were at small sizes; the line widths at large windows were not compared with a printed
  reference.
