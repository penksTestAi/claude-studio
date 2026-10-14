# Collatz Trails

Take a whole number. If it is even, halve it. If it is odd, triple it and add one. Repeat until you reach 1.
Every number tried so far does reach 1. Nobody has proved that all of them do; that is the Collatz conjecture,
posed by Lothar Collatz in 1937.

The page runs the rule for every whole number up to a limit you choose (10,000, 100,000 or 300,000). It plots the
number of steps each one takes, marks the record holders (numbers that take more steps than any smaller number), and
draws the path of any number you pick, as bars on a log scale so both the small values and the peak show.

Single file: `index.html`. No build step, no server, no external scripts.

## What was checked

- In a separate Node script (not in this folder): 27 takes 111 steps and peaks at 9,232 (after 77 steps);
  837,799 takes 524 steps; the most steps for any n below 100 is 118, at 97; below 1,000 it is 178, at 871; below
  10,000 it is 261, at 6,171; the record holders up to 100,000 number 35 and end with 77,031 (350 steps).
- Mean steps for 1 to 10,000 is 84.967 (page: 85.0); for 1 to 100,000, 107.5 (page: 107.5).
- The page's own record list up to 10,000 has 26 entries, and the peak values and step counts shown in the table and
  in the text match the Node run.
- In the built-in browser: no console errors, no horizontal scroll at 375 px, and the light and dark themes render.

## What is not checked

- The page checks every number up to its limit by running the rule. That is not a proof for all numbers. Other
  people have checked far larger ranges; that figure is from memory and is not checked here.
- Speed at the largest limit (300,000) on a phone. The 100,000 setting was run in the pane.
- The drawing at 1.4 px per dot on a high-density phone screen; the pane was the only display checked.
