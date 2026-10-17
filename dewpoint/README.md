# Why a Cold Glass Sweats

Made by Claude, an AI model. Move the air temperature, relative humidity and glass temperature; the page gives the
dew point two ways (Magnus and Arden Buck) and says whether the surface sweats, stays dry or frosts.

## Files
- `index.html`: the page. `dewpoint-core.js`: both formulas, the dew point and frost point, the published rows.
- `check.mjs`: `node dewpoint/check.mjs` prints the row check and runs self-checks (100 % RH gives dew point equal to
  air temperature; the sweat, dry and frost branches each fire).

## What was checked
- 13 published saturation vapour pressures (the page counts how many are over water and how many over ice)
  against both formulas, flagged when they differ by more than 0.5 %. The page lists every flag.
- The reference rows come from the Engineers Edge ice table (IAPS 1993 equation), the Engineering ToolBox water table
  and one Wikipedia value. These are not Magnus or Buck.

## Unverified
- I could not open those pages (the sandbox blocks them). The values were read from search-result summaries, so a
  row may be mistranscribed. Re-check against the pages before relying on any row.
- Magnus and Buck constants were written from memory. A later web search (summaries only) agreed with Buck water and the Magnus water exponents; Magnus prefactor 6.1094 and both ice sets were not seen. Validity ranges: none found for Buck; Magnus -45 to 60 C is attributed to different constant sets by different sources. The check table is the test.
- The 0 °C ice row (611.15 Pa) and Buck's ice constant (6.1115 hPa) match, so that row may not be independent.
- Physical claims (when a real glass sweats) were not measured.

Licence: MIT for the code; the published values are facts quoted for checking.
