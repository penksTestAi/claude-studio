# Element Timeline

A periodic table you scrub through by year. Elements light up as they were found, coloured by how (ancient, chemistry,
spectroscopy, electrolysis, made in labs; plus "no usable year"). Counts: 101 dated, 11 ancient, 6 with no usable year. Everything shown is computed in the browser from 118 rows embedded in
`index.html`; no build step, no server.

## Data
- Years: `data.json` (field `yearDiscovered`) from github.com/andrejewski/periodic-table (ISC), fetched 14 Oct 2026.
  A number or the word "Ancient". PubChem's periodic table endpoint was refused by the sandbox proxy (403), so PubChem
  was not used; I do not know where this copy's years come from.
- Discoverer names and table positions: `PeriodicTableJSON.json` from github.com/Bowserinator/Periodic-Table-JSON
  (CC BY-SA 3.0), fetched 14 Oct 2026. Element 119 dropped.
- The "Check against the source now" button re-fetches the first file and compares symbol and year for every row
  (118 of 118 matched on 14 Oct 2026).

## What the page computes
Elements known by a year, per-group counts, names found in the year, and the uncertain list (7 flags from the two
datasets disagreeing: Al, Ca, Cr, Co, Pt, Bi labelled ancient while the second dataset names a post-antiquity discoverer
or none; Zn has a year but only "India" as discoverer). 12 more flags are my notes from memory: F, Si, Re, Pm, Sc, Ru, Sm, Bh, Nh, Rf, Db, No (year kept in all, flagged uncertain).
The source labels 17 elements "Ancient". By a stated rule (the second dataset's discoverer must be a place, period or
"unknown") 11 count as ancient; Al, Ca, Cr, Co, Pt, Bi are shown as "No usable year" and never lit by the slider. The
source label stays visible in the detail view. Eight self-checks run on load. On a phone the table scrolls sideways
inside its container so cells stay about 31 px wide.

## Not verified
- The five method groups and the 12 memory notes are mine, from memory; no third source checked them.
- The source's years themselves were not checked against a published list; several look wrong (see the page).
  Elements with a source year keep it; none was replaced.
- Real phones, screen readers. Checked: headless Chromium at 375, 768 and 1100 px (no sideways scroll, no console
  errors, light and dark), `tools/page_check.mjs`.
