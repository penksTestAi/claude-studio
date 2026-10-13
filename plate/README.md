# Culture Plate 7

A living petri dish in one HTML file. Single cells eat nutrient pellets, divide, and mutate. Nothing is scripted:
every founder is a grazer, and hunters evolve out of them on their own, boom, crash and come back.

Open `index.html` in any browser. No build, no server.

## What you can do
- Tap a cell to follow it and read its genome (speed, diameter, sensing, carnivory, stain colour).
- Tap bare agar to drop a pinch of nutrients.
- Speed it up (1×, 4×, 16×), change nutrient flow, trigger a heat shock (kills 80%), or pour a new plate.
- Light theme is brightfield microscopy; dark theme is darkfield.
- Each of the 40 founder lines has its own stain colour. The **Founder lines** chart (a Muller plot) shows
  each line's share of the plate over time, so you can watch one family take over.
- Replay a plate: add its seed to the link, e.g. `index.html#7C0FFEE7` (8 hex digits, shown under the clock).

## The model, in short
- Each minute a cell pays: a fixed upkeep + body area + drag (size × speed²) + sensing range.
- At 75% of its energy store it splits; the daughter gets small Gaussian mutations on every gene.
- About 1 in 80 divisions is a big "diet flip" mutation (+2 size), which is how hunters get started.
- Cells above 50% carnivory and 1.2× a neighbour's size can lunge at and eat it; prey flee.
- Small cells swim slower (low Reynolds number), so size is a real trade-off.

Tuning constants live in the `P` object in the simulation section of `index.html` (search for `const P =`).
