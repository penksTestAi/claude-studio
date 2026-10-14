# Element Timeline

A periodic table you scrub through by year. Elements light up as they were found, coloured by how (ancient, chemistry,
spectroscopy, electrolysis, made in labs; plus "no usable year"). Counts: 100 dated, 12 ancient, 6 with no usable year.
Everything shown is computed in the browser from 118 rows embedded in `index.html`; no build step, no server.

## Data
- Source A, years: `data.json` (field `yearDiscovered`) from github.com/andrejewski/periodic-table (ISC), fetched
  14 Oct 2026. A number or the word "Ancient".
- Source B, years (second source): `mendeleev/elements.db` (fields `discovery_year`, `discoverers`) from
  github.com/lmmentel/mendeleev (MIT), master branch, fetched 14 Oct 2026. An empty year means "Known to the ancients".
- Source C, discoverer names and table positions: `PeriodicTableJSON.json` from github.com/Bowserinator/Periodic-Table-JSON
  (CC BY-SA 3.0), fetched 14 Oct 2026. Element 119 dropped. It has no years.
- PubChem, Wikipedia and Wikidata were not reachable (403 through the sandbox proxy), so none was used.
- The "Re-check source A now" button re-fetches file A and compares symbol and year for every row. B is a database file a
  browser cannot read, so it has no live check.

## What the page computes
- A comparison of A and B for all 118 elements: they agree on 91 (79 identical years, 12 that both call ancient) and
  disagree on 27: 6 where one calls the element ancient and the other gives a year (Al, Ca, Cr, Co, Zn, Pt), and 21 where
  both give a year (7 within 1 year, 6 by 2 to 10 years, 8 by more than 10). Every disagreement is listed on the page.
- Rule: ancient only if A says "Ancient" and B has no year. If exactly one says ancient, the element has no usable year
  and never lights up. Otherwise the slider uses A's year (B's is shown, never used). Result: 100 dated, 12 ancient,
  6 with no usable year (this was 101 / 11 / 6 when the rule used dataset C's discoverer text).
- The five years flagged by hand earlier: Sc, Ru, Sm and Nh differ between A and B; Bh is 1976 in both, so the comparison
  cannot settle it and its flag stays on my note from memory.
- 32 elements are marked uncertain (27 disagreements, 4 more from memory notes, 1 more where C names a person for an
  ancient element: Bi). Eleven self-checks run on load. On a phone the table scrolls sideways inside its container.

## Not verified
- Neither A nor B was checked against a published list (PubChem and Wikipedia were blocked); they may share an origin,
  so agreement is not proof (Bh is the example). Where they differ the page keeps A's year and says so.
- The five method groups and the 12 memory notes are mine, from memory; no source checked them.
- Real phones, screen readers. Checked: headless Chromium at 375, 768 and 1100 px (no sideways scroll, no console
  errors), `tools/page_check.mjs` at 375 and 1100 px, light and dark.
