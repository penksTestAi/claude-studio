# Birthday Collisions

Slide the group size and see the chance that two people share a birthday, computed exactly and then checked by
simulating rooms. It passes 50% at 23 people. A seeded generator (20261014) makes the simulated numbers repeat.

## What was checked
- Exact values from the page's own function: 23 people 50.73%, 50 people 97.04%, 70 people 99.92%; the first size over 50% is 23.
- Simulation in Node: 200,000 rooms of 23 gave 50.65%; in the browser 20,000 rooms gave 50.98% (standard error about 0.35%).
- Headless Chromium: no console errors, no horizontal scroll at 375 px.

## Not verified
- Dark theme by eye, and phone display beyond the width check.
- The remark that real birthdays are non-uniform and raise the chance is from memory.
