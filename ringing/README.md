# Plain Bob Minimus (a sound file)

A WAV file of four bells ringing the 24-row extent of Plain Bob Minimus, with a landing page (`index.html`) that
checks the rows and then measures the bell pitches back from the audio. Made by Claude, an AI model.

Files: `plain_bob_minimus.wav` (mono, 16-bit, 22,050 Hz, 34.1 s, 1.50 MB), `make_ringing.py` (the generator; numpy),
`manifest.json` (the generator's own list of rows, design pitches and scheduled blow times), `requirements.txt`.

## Make it again
`pip install -r requirements.txt` then `python3 make_ringing.py`. No network. The noise tick uses a seeded generator,
so the file comes out the same each time.

## How it works
- The rows come from place notation (`x 14 x 14 x 14 x 12`, one lead of 8 changes, rung three times), not from a typed list.
- The bell is an additive model: a long low hum, a prime at the design pitch, some inharmonic partials with
  different decay times, a 3 ms noise tick for the clapper and a loud, quick strike. Bells are C5, B4, A4, G4
  (treble first). Rows are 0.28 s per bell with one blow-length extra pause after every second row (the hand-stroke gap).

## What the page checks, all computed in code on load
1. every row is a permutation; 2. no bell moves more than one place per change; 3. the first 24 rows are all
different and 24 = 4! (the extent), and the 25th row is rounds again; 4. the page's own rows equal `manifest.json`;
5. the audio holds 100 blows (25 rows x 4); 6. the rows read back from the audio (found by the noise tick, bell
identified by pitch, the first row, rounds, naming the four pitches) equal the rows; 7. each bell's mean measured
pitch is within 25 cents of its design pitch. A selector puts a fault into the rows (a repeated row, a two-place
jump, a duplicated bell) so each failing wording can be seen.

Measured in a headless browser: all checks pass. The first version read every bell 10 to 14 cents sharp (2048-sample
window starting 4 ms after the blow). Cause found: the loud quick strike (same pitch as the prime, different phase,
tau 35 ms) is still fading inside a short early window and pulls the peak; the window is now 4096 samples starting
50 ms after the blow, and the bias is under 3 cents. One bell alone read the same as the mix, so it is not
overlap. The last cent or two is not traced.

## Unverified
- The bell sound is from memory and not fitted to any recording; nothing says how real bells measure.
- History (change ringing in 1600s England, Fabian Stedman) is recalled, not looked up; the hand-stroke gap is a choice.
- Nobody (including Claude) has listened to the file; only the measurements above back it.
- Page checks ran in headless Chromium only, not on a phone or with sound output.
