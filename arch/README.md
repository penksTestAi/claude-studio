# Hanging Chain, Standing Arch

A web page (`index.html`, with its engine in `engine.js`). You hang weights on a chain of 30 equal links; the page solves
in code how the chain settles, then flips the shape upside down and tests it against a stone ring.

Made by Claude, an AI model. No outside data and no third-party code.

## Method
- Both ends are held at the same height. The horizontal pull H is the same along the chain; the vertical force on link i
  is the left support's push minus the weight of the joints before it, so link i has slope V_i / H.
  H and the left push are found by two nested bisections so that the links reach the far support at the same level.
- "Chain's own weight": every link weighs one unit. "Level deck": the chain weighs nothing and the load is spread by
  horizontal width, found by repeating the solve until each joint's load matches its spacing.
- Stone ring: a circular arc of chosen rise, with a vertical thickness. The flipped line (height = depth below the supports)
  is slid up or down to its best fit. If it leaves the ring, chain lengths of 1.05 to 1.60 times the span (steps of 0.005,
  111 lengths) are tried for any line that fits. Three verdicts: stands; might stand along a different line; no line found that fits.

## Self-checks (run on every load; table on the page)
1. No extra weights against the exact cosh catenary through the same ends and length: gap at most 0.08% of the sag at
   lengths 1.05, 1.20, 1.60 (limit 0.2%). The pull agrees with the catenary's within 0.05%.
2. A level, even load against a parabola: gap about 1e-14 of the sag (the discrete line is exactly a parabola, so this
   mostly tests the solver and the load iteration). A control shows the chain's own weight differs from a parabola of equal
   sag by 0.6%, 2.3% and 5.8% at the same lengths, so the check can fail.
3. 300 seeded random loadings: all solved, closure and moment balance about 1e-15.
4. Tripling every weight leaves the shape unchanged and triples the pull.
5. Four arch scenarios fire all three verdict branches (stands, other line, fails twice).

Also run by the builder: `node --check arch/engine.js`; `node tools/page_check.mjs arch/` (no problems at 375, 768 and
1100 px, light and dark); a headless-browser script that clicked weights, used the keyboard, reached every verdict, and
saw no console errors.

## Not verified
- Hooke's saying, its 1675 Latin anagram publication and the 1705 printed solution: from memory, not checked against the source.
- The line search tries only chain-length lines plus a vertical slide (no tilt).
- The stone's own weight is ignored (the ring is treated as weightless).
- That real masonry arches stand when a thrust line fits inside them and fail otherwise: a common assumption in simple models of masonry, recalled from memory, not
  tested here. The page says "in this model".
- The ring thickness is vertical, the ring is a circular arc, and the ends are level and held; other support heights
  and sliding are not tried.
- Not looked at on a real phone.
