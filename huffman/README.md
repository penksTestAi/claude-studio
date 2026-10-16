# Huffman Coding

A web page (`index.html`, with its logic in `huffman.js` and a Node test in `test.mjs`) that builds a Huffman code for
the bytes of any text you type, shows the tree being built merge by merge, then encodes the text and decodes it back.
Made by Claude, an AI model, for Vigil.

## What it does
- Reads your text as UTF-8 bytes and counts each byte value. Symbols are bytes, so the comparison with fixed 8-bit
  codes is exact (a character such as "é" is two symbols).
- Builds the tree: repeatedly joins the two lightest trees. The first one taken is the 0 side, the second the 1 side;
  ties go to the older tree. A slider, Back/Next and Play step through the merges.
- Encodes with the code table, packs the bits into bytes, then decodes from the packed bytes by walking the tree (the
  decoder does not use the table). A slider steps through the decoding, highlighting the path.
- Compares the size with fixed 8-bit codes, with fixed codes just wide enough for the alphabet, and (as an assumed
  layout, labelled as such) with the Huffman size plus a 16-bits-per-distinct-byte table.

## Self-checks run on every text (computed in `huffman.js`, `analyse`)
1. Round trip: all decoded bytes equal the original, lengths equal, all bits used.
2. Prefix-free: every ordered pair of code words compared; Kraft sum exactly 1 (2 or more distinct bytes).
3. Counts add up: byte counts, root weight and leaf weights all equal the text length.
4. Merge weights sum to the encoded bit length (2 or more distinct bytes).
5. Average bits per byte L is at least the entropy H.
6. L is below H + 1 (2 or more distinct bytes).
7. Not longer than fixed 8-bit codes.
8. A second tie-break rule (newest first) gives the same total size.

Checks that cannot apply show N/A, never PASS. A single repeated byte gets the code `0` by convention, so L = 1 =
H + 1 exactly: checks 2, 4 and 6 are N/A and the page says why. A uniform alphabet of 2^m symbols gives L = H = m.

## Tests (`node huffman/test.mjs`)
Run on this machine: 9,314 assertions, 0 failed. They cover fixed cases (empty, one byte, one repeated byte, two
symbols, uniform 3 and 4 symbols, a skewed text, a sentence, non-ASCII text, all 256 byte values once), 3,000 random byte
strings (round trip, bounds, tie-break), and a brute-force search over code lengths for 300 random alphabets of 2 to 5
symbols, where Huffman's total always equalled the best total found.

## Unverified
- Optimality is tested only on those small alphabets, not proved here (it is a standard theorem).
- The 16-bit-per-symbol table header is an assumption for the comparison, not a real file format.
- Phone behaviour was checked only in headless Chromium at 375 px, light and dark, by `tools/page_check.mjs`.
- Trees with more than 40 distinct bytes are not drawn.

No libraries, no network, no stored data. Licence: the studio's MIT licence.
