# Where the Current Goes

A web page. The reader edits a small network of batteries, resistors, capacitors and ideal wires (a netlist, presets, value
boxes) and sees every node voltage and part current update, with a charging curve when capacitors are present. Made by
Claude, an AI model. No libraries, no fetched data.

## Files
- `index.html`: the page.
- `circuit-core.js`: exact fractions, parser, solver, independent simulator and the checks; used by the page and by `check.mjs`.
- `check.mjs`: `node circuits/check.mjs [--seed0 N] [--count N]` runs the checks with more draws plus extras; exits 1 on failure.

## How it works
- Exact solve: nodal analysis (current out of each node sums to zero) with one extra unknown and equation per battery or wire,
  Gauss-Jordan on BigInt fractions. Capacitors are open at steady state; for the curve each capacitor is replaced in turn by a
  source, giving dv/dt = M v + g exactly, stepped with RK4.
- Closed forms (series, parallel, divider, balanced bridge, RC time constant) compared for exact equality on seeded values.
- Independent time-step simulator: tiny capacitance on every node, nodes joined by batteries or wires merged with fixed offsets,
  RK4 on the node voltages. It shares only the parser with the exact solver.
- Limits are detected, not hidden: a source loop that contradicts itself, a redundant loop (undetermined current split), a battery
  straight across a capacitor (no curve), a node reached only through capacitors (no steady voltage).

## Checked
- `node circuits/check.mjs`: 23 checks pass (default seed 1000, 24 draws each); also run with 20 other seeds (1 to 10946, 12
  draws): 23 of 23 each time. The page runs the 16 seeded checks (6 draws each) plus up to 4 checks on the network shown (4 for the RC preset), on load.
- `node tools/page_check.mjs circuits/`: no problems at 375, 768 and 1100 px, light and dark.
- Headless Chromium at 375 px: no sideways scroll on load, after each preset, value edit, slider move, play, adding a wire, a bad
  netlist and a rerun; no console errors.

## Unverified
- Not compared with SPICE (not installed) or a bench measurement.
- "Weaker, not independent": the textbook row (6 V and 12 V batteries aiding, 8 and 10 ohm, 1.0 A) comes from a web-search summary
  of a lecture slide; the slide itself could not be fetched, so battery orientation is my reading. No published worked example
  could be fetched (the sandbox blocked the hosts).
- Simulation agrees to stated tolerances (0.3 to 0.5% of the supply for curves, 1e-6 relative for steady state), not exactly.
- Only headless Chromium; no other browser, no screen reader.
- Licence: code and text by Claude, free to reuse.
