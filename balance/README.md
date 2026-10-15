# Balancing chemical equations

A web page (`index.html`, with its solver in `balance.js`) that balances a reaction you type, using exact integer
linear algebra, and checks its own answer. Made by Claude, an AI model, for Vigil.

## What it does
- Reads a reaction such as `Cr2O7^2- + Fe^2+ + H^+ -> Cr^3+ + Fe^3+ + H2O` (brackets, a hydrate dot, ion charges and
  `e^-` are supported; element symbols are checked against the 118 symbols).
- Builds the matrix with one row per element (plus one for charge) and one column per species, reactants plus and
  products minus. The balancings are the null space of that matrix.
- Row-reduces it with exact fractions (JavaScript BigInt), reads off a null-space basis and scales it to smallest whole
  numbers. The null-space dimension decides the verdict:
  0 = impossible; 1 = one balancing (if all signs agree), otherwise "a species is on the wrong side" or "a species cannot
  take part"; 2 or more = infinitely many balancings.
- For two or more, it finds the elementary balancings (null vectors with the smallest possible support, by trying every
  subset of at most rank + 1 species) that are non-negative. A strictly positive balancing exists exactly when these
  cover every species; the page shows one built as their sum, which is an arbitrary pick, plus the smallest few found by
  exhaustive search.
- No atomic masses, no fetched data, no libraries.

## What it checks on every answer
1. Atoms (and charge) recounted from the parsed formulas, left against right, for every row (this recount does not use
   the matrix).
2. Every coefficient a whole number of at least 1.
3. Greatest common divisor of the coefficients is 1.
4. If the null space has dimension 1, that is what makes the answer the smallest and the only one. An exhaustive search
   over every assignment of coefficients 1 to the largest found coefficient must find exactly that one balancing
   (skipped, and said so, when over 20 million combinations).
5. If the dimension is 2 or more, the exhaustive search counts how many balancings with coefficients up to a bound use
   every species (bound chosen so that at most 3 million combinations are tried).

Also on load: a self-test of 17 cases (11 reference answers typed from textbooks, 6 expected verdict kinds).

## Outside the page, in Node (not shipped)
- 3000 random reactions from a pool of 37 real species: every basis vector and every minimal balancing recounts as
  balanced, rank + nullity = species, and where the verdict was "impossible", "wrong side" or "cannot take part", the
  exhaustive search with coefficients up to 6 found nothing (about 2,760 impossible, 180 wrong side, 35 cannot take part,
  22 partial; only 2 reactions had a balancing, which is why the next test exists).
- 1500 reactions with a planted balancing (random compositions over H, C, N, O, Fe, Cl, with randomly chosen
  coefficients and a last product that closes the balance): all 1500 recovered as "unique", and every one equalled the
  planted coefficients divided by their gcd.
- 11 hand-counted formulas (including `[Cu(NH3)4]^2+`, `CuSO4.5H2O`, `K4Fe(CN)6`, `Co` against `CO`) parse to the
  counts and charge counted by hand; 7 malformed formulas give a readable message instead of a crash.

## Not verified
- The parser is shared by the solver and the recount, so a systematic parsing mistake in a kind of formula not in the
  test list would pass every check. It was tested only on the formulas listed above.
- Whether a balanced equation is chemistry. The page says this; `Na + Cl2 -> NaCl2` balances.
- The statements about why some reactions have two answers (NO and NO2 both forming, peroxide splitting) are written
  from memory of general chemistry, not from a source.
- Phone display beyond a 375 px headless-browser screenshot; no real device.
- Speed on a slow device for the largest exhaustive searches (about 0.25 s here for the dichromate example).
