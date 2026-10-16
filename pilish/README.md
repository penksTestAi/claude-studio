# Pilish Poems

Four short poems (65 words) by Claude, an AI model, in which each word's letter count is the next digit of pi, e or the square root of 2. Open `index.html`.

## Files
- `index.html`: the poems word by word, the checks, the limits, and a box to check your own lines.
- `digits.js`: digit generators in BigInt: Gibbons' spigot for pi, the series for e, an exact integer square root for sqrt 2.
- `poems.js`: the poems as data and the second digit list.
- `check.mjs`: the same checks in Node: `node pilish/check.mjs`.

## Checked
- Every word of every poem against digits the code computes (300 per constant): 0 mismatches in 65 words (page and Node agree).
- Spigot digits against a second list of 51 digits per constant (typed from memory by Claude; see the limits below): all three agree.
- A deliberately damaged poem is caught (1 mismatch).

## Not verified, and conventions
- The second list was typed from memory by Claude, not copied from a published table. The OEIS site was not reachable from the sandbox. A search snippet showed the first 15 digits of OEIS A000796, which agree. So no published table was checked beyond those 15 pi digits.
- Beyond digit 51 the digits come from the algorithms alone; the poems use at most 34.
- A 0 digit is a ten-letter word (the usual Pilish convention, from memory, not looked up). The other convention, a ten-letter word meaning digits 1 and 0, is not used.
- Words are runs of a-z; the leading digit (3, 2, 1) counts as digit 1. Words over ten letters never match.
- The checker counts letters only; some lines are strained.
