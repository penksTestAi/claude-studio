# Check Digit Tool

A one-file Python command-line tool (standard library only) that tests the check digit of Luhn numbers (cards and many IDs), ISBN-10, ISBN-13, EAN-13 and IBAN, plus a landing page that finds out by trying which typos each scheme catches. Made by Claude, an AI model. MIT licence for the code. `reference_examples.json` is data copied from python-stdnum's test files (Arthur de Jong, LGPL-2.1+), credited in the file; the MIT licence covers this folder's code only.

Page: `index.html`. Files: `checkdigits.py` (the tool), `test_checkdigits.py` (13 unittest tests), `checkdigits.js` (a port of the same rules, used by the page), `reference_examples.json` and `make_reference.py` (the published examples and the script that extracted them).

## Use

    python3 checkdigits.py check 978-1-4200-4561-1 "GB29 NWBK 6016 1331 9268 19"
    python3 checkdigits.py check -s luhn 49927398710        # shows the corrected last digit
    python3 checkdigits.py complete -s isbn10 080442957     # prints 080442957X
    printf '%s\n' 79927398713 | python3 checkdigits.py check -
    python3 -m unittest -v test_checkdigits

`check` exits 0 if all values pass, 1 if any fails, 2 on a usage error; `--json` and `-q` are available. With no `-s` the scheme is guessed from the shape; ten digits are read as ISBN-10, so use `-s luhn` for a ten-digit card or ID number. A pass means the digits fit the arithmetic, not that the thing exists.

## What the page computes

For each scheme the page makes seeded random valid codes, then tries every single-symbol substitution and every adjacent swap of two different symbols on each, and counts how many the checker notices. It also switches off each stated cause (Luhn's doubling or its fold, ISBN-10's modulus 11, EAN-13's 1,3 weights, IBAN's modulus 97) and runs the same loop, and prints the computed facts behind each cause (the doubling table, whether the modulus is prime, the weights' common factor with 10). No count on the page is typed; sample size and seed are editable. Counts are over a sample of valid codes, not every valid code. The IBAN rows use one GB-like layout and same-class substitutions and swaps only.

## What was checked

- Published examples: 429 numbers copied by `make_reference.py` from the python-stdnum test files (separate project, own code; its IBAN lists are labelled IBAN-registry samples, its ISBN list "found online"). 419 agree, 10 disagree. All 10 are IBANs that the source rejects for country rules (wrong length, wrong characters, unknown country, Spanish national rule) while the mod-97 arithmetic passes; this tool checks arithmetic only. They are listed on the page and the unit test requires every disagreement to be of that kind.
- `python3 -m unittest`: 13 tests pass (Python 3.11).
- Python against the JavaScript port: in a scratch run (not shipped), 25,740 strings (every reference number, 12 random edits of each, run under all five schemes) gave the same verdict in both; the page's reference table therefore matches the script.
- `node --check checkdigits.js`, and `tools/page_check.mjs` at 375, 768 and 1100 px, light and dark.

## Unverified

- Wikipedia, swift.com and the ISBN agency were unreachable from the build sandbox, so the second source has one origin, and its "registry sample" and "found online" labels are its authors' statements.
- From memory, not checked against a standard: IBAN check digits run 02 to 98, ISBN-13 starts 978 or 979, EAN-13 weights, Luhn doubling order. All fit every published example.
- The tool checks no country rules, no issuer prefixes, no SBN (nine-digit) numbers and does no ISBN-10/13 conversion.
- Only Python 3.11 and Node 22 were used.
