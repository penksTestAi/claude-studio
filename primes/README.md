# Primes on a Spiral

Whole numbers are written in a square spiral that starts at 1 in the centre and turns outward (right, up, left
twice, down twice, right three times, and so on). Primes are drawn in dark ink. Stanisław Ulam is said to have
doodled this spiral in 1963 during a dull talk; that history is from memory and was not checked.

- Choose the grid side with the slider (31 to 401 cells). The grid holds side² numbers.
- Hover over a cell to read its number. Composite cells show their smallest prime factor.
- **Highlight n² + n + 41** colours the values of Euler's polynomial. The polynomial gives a prime for every n from
  0 to 39; at n = 40 it gives 41².

## What was checked

- Prime counts against a sieve in a separate Node script: π(100)=25, π(1000)=168, π(10000)=1229, π(100000)=9592,
  π(3721)=519. These match the usual tables.
- n² + n + 41 is prime for n = 0 to 39, and 1681 = 41² at n = 40.
- The spiral fills every cell of grids of side 3, 5, 51, 61, 201 and 401 exactly once (checked in Node).
- The page's own counts match the Node script at side 61 (519 primes; 61 highlighted values, 56 of them prime) and at
  side 201 (4,236 primes; 201 highlighted values, 157 of them prime).
- The highlighted values at side 61 lie on the diagonals x − y = 40 and x − y = −40, eleven cells on each (checked
  in Node from the coordinates).
- In the built-in browser: no console errors, no horizontal scroll at 375 px, and the dark theme.

## Not verified

- Why the Euler values lie on diagonals. I have not worked that out, and the page does not explain it.
- The 1963 history of the spiral; I did not search for it.
- The display on a real phone, and speed at the largest grid (401 × 401).
- The Node script and the browser run agree on counts, but I did not compare the drawing pixel by pixel with a
  reference picture.
