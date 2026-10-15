# Why Easter moves

Pick a year to see its Gregorian and Julian (Orthodox) Easter, read a short essay on the Nicaea rule and the 1582 reform,
and watch the page count Easter dates over a full Gregorian cycle. Made by Claude, an AI model.

## How it works
- `easter.js`: Gauss's rule (with its two exceptions) and the Meeus / Jones / Butcher rule, for Gregorian and Julian
  calendars, plus day-number conversions. `reference.js`: published reference dates. `index.html`: the page.
- On load the page searches for the cycle length (multiples of 7600 years until the sequence repeats), runs both
  algorithms over every year of the cycle (5,700,000 for Gregorian; 532 for Julian), tests that every Easter is a
  Sunday, that dates stay in 22 March to 25 April, that no smaller cycle works, and that 4 and 15 October 1582 are
  consecutive days. All counts, names and the histogram come from that run (about one second).

## One-source experiment: checked before building
Wikipedia, USNO, ASSA, Tondering, timeanddate.com and the Royal Museums Greenwich page gave 403 or no route from the
build proxy. Source used (fetched 15 Oct 2026): the dateutil test suite (`tests/test_easter.py`: Gregorian and Orthodox
1990-2050, 40 Julian dates citing kevinlaughery.com) and PyMeeus (`Epoch.easter` docstring and tests: 1818, 1943, 1954,
1991, 1993, 2000, 179, 1243). All 170 rows agree with both algorithms; the page lists any disagreement (the flag path
was tested on a doctored copy). Years checked included 1818 (22 March), 1943 and 2038 (25 April), 1954 and 2049
(Gauss's 18 April cases), 2008 (23 March), 1994/2002 (Orthodox 1 and 5 May).

## Checked
Gauss = Meeus on all 5,700,000 Gregorian and Julian years; headless Chromium at 375, 700, 820 and 1100 px, light and dark, no
console errors, no sideways scroll; `node tools/page_check.mjs easter/`.

## Unverified
- 2285 (22 March) and most other extreme years have no published row; only the two algorithms vouch for them.
- The reference tables are copies in software test suites, not an almanac; the Julian rows only cite their origin.
- That the Julian date is what the Alexandrian rule gives for 326 to 1582, and that not every church followed it in
  the early centuries, is from memory.
- The history (Nicaea, Alexandria, Gregory XIII, Lilio and Clavius, "most Orthodox churches use the Julian computus"),
  and the year-length constants, are from memory.
- Julian-pair agreement is weak evidence (same formula rewritten). Real phones and screen readers not tried.
