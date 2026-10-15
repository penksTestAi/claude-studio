# Typos in the Genetic Code

Edit a short piece of DNA and watch the protein change; the page counts how many single-letter changes are silent,
missense or stop. Made by Claude, an AI model. One file, `index.html`, no libraries.

## How it works
- The table is NCBI translation table 1 (the standard code), typed as NCBI's 64-letter string. Everything else is computed:
  the protein (read from the first letter in threes to the first stop), the verdict wording (twelve branches), the
  counts, the wheel colours, the neighbour list.
- Counting: for each codon, every one of the nine single-letter changes is classed silent (same amino acid; this includes
  stop to stop), missense, stop gained (amino-acid codon to stop) or stop lost (stop to amino-acid codon).
  Whole code: 576 changes = 138 silent (4 of them stop to stop), 392 missense, 23 stop gained, 23 stop lost. The page
  computes these on load; the numbers here are for the README only. Your sequence is counted over the codons read.
- Wheel: rings are first, second, third letter and amino acid; click a sector to rewrite the selected codon.

## Checked
- The table against three copies embedded as excerpts (Biopython `Bio/Data/CodonTable.py`, BioPerl `CodonTable.pm`,
  BioJulia BioSequences `geneticcode.jl`, master branches, copied 2026-10-15), each parsed in its own format by the page:
  64 of 64 agree with all three. Corrupting one entry of the page's table makes the comparison report 63.
- **Not independent.** All three say they derive from NCBI's `gc.prt`; NCBI itself (and Wikipedia, EBI, UniProt) was not
  reachable from the build sandbox. The check catches a slip in my transcription, not an error in NCBI's table.
- Counts recomputed in a separate Python script from Biopython's dictionary: same four totals and same per-letter split.
- Amino-acid three-letter names against Biopython's `IUPACData`: all 20 match (not on the page).
- 14 self-checks on load, including: classes add to the total; stop gained equals stop lost; a table with one amino acid
  makes every change silent; all-distinct amino acids give zero silent; no stops gives zero stop changes; all verdict
  branches reached by test pairs. Headless Chromium: no console errors, no duplicate ids, no digits in static text,
  no sideways scroll at 375 px, light and dark.

## Not checked
- Other codes (mitochondrial etc.) are not offered. Real phones, screen readers, other browsers.
- The "globin-like start" preset was written from memory and not checked against a database. Mutation rates are not
  modelled: every letter change is counted equally.

Licences of the quoted excerpts: Biopython (Biopython License Agreement or BSD 3-Clause, see its LICENSE.rst), BioJulia BioSequences.jl (MIT). BioPerl's licence could not be read from the build environment; see its repository.
