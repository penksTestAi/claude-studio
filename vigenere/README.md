# Breaking Vigenère

A page that encrypts a message with a Vigenère cipher and then tries to break its own cipher text, in two steps:
the index of coincidence (IC) picks the key length, then frequency matching finds each key letter. Kasiski repeats are
computed and shown alongside for comparison; they do not feed the break.
Sliders set the text length and the key length, and a grid shows where the break works and where it fails.

## How it works
- Plain text: a stretch of a short story kept in the script,
  or the visitor's own message. Letters only, A to Z (accents are dropped, and so are ß and Œ).
- Key length: IC (average column IC; first length reaching 70% of the way from random to the highest bar) is the pick
  the break uses. Kasiski (distances between repeated 3+ letter groups, count above chance for each length 2 to 20)
  is shown alongside for comparison.
- Key letters: for each column, the shift whose decrypted letters score best (sum of log frequencies) under a model.
- Models: the letters of the page's own essay (counted on load), a published English table typed from memory, and a
  scrambled copy of the essay table as a negative control.
- The grid runs 24 seeded trials per cell on 10 key lengths and 6 text lengths for all three models. Every count and
  stated number on the page, IC values included, is computed in code.
- Self-checks on load: the LEMON test vector, round trips, models sum to 1, short text plus long key fails, long text
  plus short key breaks, scrambled model fails.

## Checked
- Node run of the core code, then headless Chromium at 375, 768 and 1100 px: no console errors, no sideways scroll,
  no duplicate ids, 24-word opening sentence, all self-checks pass.
- The cause switched off: 50 letters with a 16-letter key breaks in none of 24 trials; the scrambled model breaks none
  in the whole grid.

## Unverified
- The published letter table and the history (Bellaso 1553, Vigenère 1586, Babbage, Kasiski 1863, Friedman 1920s) are
  from memory, not checked against a source.
- The essay and the story share an author, so the model is not independent of the message's style.
- The IC rule (70%) was chosen after a first rule (halfway to the English value) failed on short keys; other rules
  would shift the grid. Real phones, screen readers and other browsers were not tried.
