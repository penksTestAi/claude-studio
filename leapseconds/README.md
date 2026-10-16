# Leap Seconds, 1972 to Now

A small dataset: every leap second added to UTC since 1972 and the running TAI-UTC offset, as CSV and JSON, with a
landing page (`index.html`) that rebuilds the offset from the rows and checks them against two source files.
Made by Claude, an AI model.

## Files
- `leapseconds.csv`, `leapseconds.json`: 28 rows, 1972-01-01 to 2017-01-01. Columns: `effective_utc_date`, `mjd`,
  `tai_minus_utc_s`, `change_s`, `leap_second_at_utc`. The first row is the starting offset (10 s), not a leap second;
  the other 27 rows are the 27 leap seconds (all positive, 11 at the end of June, 16 at the end of December).
- `make_leapseconds.py`: builds both files from `sources/leap-seconds.list` (standard library only).
- `sources/leap-seconds.list`: source A, as kept in the tz database repository (eggert/tz, `main`).
- `sources/Leap_Second.dat`: source B, from the astropy-iers-data repository, with its licence text.
- `LICENSE-data.txt` (CC0 1.0 for the rows), `LICENSE-code.txt` (MIT for the script and page code).

## Licences
Rows: CC0 1.0. Code: MIT. Source A states in its header "This file is in the public domain". Source B is distributed in
a BSD 3-clause repository (licence copied beside it); the licence of the IERS numbers inside it was not confirmed.

## How it was checked
- The build script's output was opened and counted: 28 rows, 27 non-empty `change_s`, all equal to 1.
- The page parses both sources in code and compares every row's date and offset (B also the MJD): 28 of 28 agree with
  each, and neither source has a row the CSV lacks. A's embedded SHA-1 hash (as its header describes) matches its contents.
- The page rebuilds the running offset from the first row plus each `change_s` and checks dates (1 January or 1 July),
  MJD against the date, and the leap second's position (23:59:60 the day before). A "Corrupt one row" button was run in
  headless Chromium: the rebuild and both sources then report the fault, and "Restore" clears it.
- `node tools/page_check.mjs leapseconds/`: no problems at 375, 768 and 1100 px, light and dark.

## Independence of the sources: they are not independent
Both files carry IERS headers (A: updated through IERS Bulletin C, Paris Observatory Earth Orientation Center; B: updated
through IERS Bulletin 72, July 2026). Agreement between them shows the copies match, not that the IERS values are right.
The tz repository's own `leapseconds.awk` calls A the "NIST/IERS format" list copied from the IERS site.

## Unverified
- IERS Bulletin C itself and NIST's own copy of the list could not be fetched (the sandbox blocked those hosts), so
  neither is checked directly; A is the tz repository's copy, not one downloaded from NIST.
- The 2022 CGPM resolution (leap seconds to stop by 2035): the BIPM page was found by search but not opened; the 2035
  figure is from search summaries only. The outcome of the 28th CGPM (October 2026) was not found.
- Dates before 1972 are not covered. No leap second after 2017-01-01 appears in either file as of its update (A: 2026-07-06).

Note: in `sources/leap-seconds.list` one comment line (line 43) had a personal e-mail address replaced by "(e-mail address removed by Vigil)". The data lines and the hash are unchanged, so the file is otherwise as published.
