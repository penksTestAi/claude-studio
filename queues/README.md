# Why the Other Line Moves Faster

A web page on queueing. A seeded shop sends the same customers into one shared line or into a line per till; the visitor sets
arrival rate, service rate, number of tills, the shape of service times and how people pick a line. The page measures waits over
many seeds, counts how often a later arrival is served first, and checks itself against Little's law, M/M/1 and Erlang C, then
shows where those formulas stop (load of 1 or more, service times that are not exponential). Made by Claude, an AI model.

## Files
- `index.html`: the page (no libraries, no fetched data). Every figure shown is computed in code; prose numbers come from constants.
- `queue-core.js`: the model and the formulas, used by the page and by the check script.
- `check.mjs`: `node queues/check.mjs [--seed0 N]` runs 33 checks (about 8 s) and exits 1 on any failure.

## How it works
- Common random numbers: arrival times and each customer's work come from one seeded stream and go to every arrangement.
- Shared line: the next customer takes the till that frees first. Separate lines: each customer picks a line on arrival (shortest
  count including the person at the till, ties at random, or uniformly at random) and never moves.
- Counting rule: a customer is overtaken if someone who arrived later starts earlier. Pair rule (separate lines only): pairs in
  different lines where the second arrives while the first waits; "the other line was faster" when the second starts first.
  The coin-flip reference is 50% and is only a reference (selection towards slow lines can push it above). Across seeds, "shared
  wins" is compared with the 95% range of a fair coin (exact binomial).
- Formulas, typed from memory: Little's law, M/M/1, Erlang C (by the Erlang B recursion), Pollaczek-Khinchine, the (1 + cv2)/2 rule
  of thumb for M/G/c, and a straight-line estimate of the wait under overload.

## Checked
- `check.mjs`, 33 checks, all pass; also run with 11 other first-seed values (123, 5000, 77777 and eight multiples of 911): 33 of 33 each time.
  - Erlang C by recursion equals a direct factorial sum (difference 3e-16); c = 1 gives rho; load 1 gives no answer.
  - The shared line equals a separate event-list simulation exactly (3 settings, 3000 customers each).
  - Separate lines are FIFO per line and "shortest" really picks a shortest line (brute force, 600 arrivals).
  - Overtaken and pair counts equal a brute-force count; the shared line overtakes nobody.
  - Little's law holds to about 4e-15 in 72 runs, including loads of 1 and 1.5.
  - 48 comparisons (4 shop sizes by 3 loads, 24 seeds of 20,000 customers) agree with Erlang C and M/M/1 within 4 standard errors:
    mean wait, chance of waiting, time in the shop, and random-line mean wait.
  - With constant and bursty service, Erlang C is off (simulated 0.78 and 3.27 against 1.49 at 4 tills, load 0.8) while the random-line
    simulation agrees with Pollaczek-Khinchine.
  - At load 1.2 the mean wait grows with run length (42.8, 166.8, 659.9 minutes at 500, 2,000 and 8,000 customers) and the
    straight-line estimate is within 10% at 8,000.
- The page repeats lighter versions on load: self-checks, a 12-row formula grid (16 seeds of 10,000 customers), the load table and
  the service-shape table.
- `node tools/page_check.mjs queues/` is clean at 375, 768 and 1100 px, light and dark. A headless-Chromium play-through at 375 px:
  c = 1, load above 1, bursty and constant service, 12 tills, the overtake button; no console errors.

## Unverified
- The formulas were typed from memory; their only check is this page's own simulation, which is not an independent source.
- No real shop data. Switching lines, balking, express lanes, rush hours are not modelled; the line-choice rules are guesses.
- The agreement rule (4 standard errors over seeds, first 20% of each run discarded) has not been tuned near load 1, where start-up
  bias is larger.
- Real phones, screen readers, other browsers, speed on slow devices.
