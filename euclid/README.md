# Euclidean Rhythms

Spread k beats as evenly as possible over n steps and you often get a rhythm people already play. The page draws the
pattern on a wheel, plays it with the browser's audio engine (a look-ahead scheduler, simple sine clicks), and lets you
change k, n, rotation and tempo.

The pattern is built with Bjorklund's algorithm (2003), which Godfried Toussaint (2005) showed is Euclid's
greatest-common-divisor procedure in disguise. Single file `index.html`; no build step, no external scripts, no server.

## What was checked
- In headless Chromium the page runs its own self-test on load: for all 324 pairs (k, n) with n up to 24 the pattern has
  k beats and the gaps between beats differ by at most 1.
- Six traditional patterns (tresillo, cinquillo, Ruchenitza, Bembé bell, Venda, bossa nova) are each the same circle of
  gaps as the page's output, allowing rotation.
- The son clave (gaps 3,3,4,2,4) is correctly *not* a rotation of E(5,16) (gaps 3,3,3,3,4).
- No console errors; no horizontal scroll at 375 px; light and dark themes.

## Not checked
- The sound: I cannot hear it. The audio scheduler ran without errors only.
- The origins and names in the table are from memory of Toussaint's paper, not looked up.
- Real phones; speed at extreme tempos.
