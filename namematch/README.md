# Matching Surnames Across Spellings

A small JavaScript library (`namematch.js`, one ES module, no dependencies) that gives a surname a Soundex or NYSIIS
code, so spellings such as Ashcraft and Ashcroft can be compared by code. It has its own test file and a landing page
(`index.html`) that runs the tests in the browser, lets you type two names, and counts the rules' misses and false matches.

## Files
- `namematch.js`: `clean`, `soundex(name, {hw})`, `soundexAll` (prefix rule), `nysiis(name, {maxLen})`, `RULES`, `matches`.
- `namematch.test.mjs`: 50 tests; `node namematch.test.mjs` (also imported by the page).
- `data.js`: published example table, surname families, edge-case list.
- `LICENSE`: MIT text.

## What was checked
- `node namematch.test.mjs`: 50 passed, 0 failed (17 published Soundex rows, two of them (Tymczak, Ashcraft) from memory only, so passing those two only checks consistency; hand-traced Soundex and NYSIIS cases, H/W
  reading, prefix rule, symmetry and format checks over all listed names).
- Browser run through `tools/page_check.mjs` at 375, 768 and 1100 px, light and dark: no problems.
- All counts on the page are computed in code from `data.js`.

## Not verified
- The source pages (US National Archives, Knuth's TAOCP, MOGenWeb, NYSIIS documentation) could not be fetched from the
  build sandbox. The 17 published Soundex values come from web-search summaries (15 rows, three origins) or from memory
  (Tymczak, Ashcraft; 2 rows, memory only, no source seen and marked so on the page). They are weaker and not independent of each other, so no agreement
  tally is claimed. Rereading the sources is the first thing to do.
- The prefix list (VAN, CON, DE, DI, LA, LE) is from memory; the 3-letter minimum remainder is this module's own choice.
- NYSIIS follows the commonly published steps. One published value (Phillipson, FFALAPSAN, from a search summary of a
  documentation page) differs from this code (FALAPSAN without the six-letter cut). By the steps as I know them, PH
  becomes FF and a repeat of the key's last letter is not added, so the second F is dropped; the source seems to keep
  it. Unresolved: the source's rule or the summary may differ. Daitch-Mokotoff was not built.
- The surname families are the author's judgment, so the miss and false-match counts describe that list only.

## Licence
MIT for the whole folder (see `LICENSE`): code, tests, page and the data in `data.js` (families, examples, edge cases,
made by Claude). Published codes are quoted values with where they were seen; two are from memory only; no third-party dataset is included. Made by
Claude, an AI model.
