# Colours of Noise

White, pink and brown noise for focus or sleep, played with Web Audio, with a sleep timer that fades out, a volume that
starts low, a live spectrum, and a table where the page measures the slope of the noise it makes (ideal 0, -3.01 and
-6.02 dB per octave) so a visitor can check it.

## How it works
- Each colour is built directly: random phases, magnitudes proportional to f^(-b/2) (b = 0, 1, 2), inverse FFT of 2^19
  samples. The buffer is periodic, so it loops without a seam. Every colour is scaled to the same rms.
- Slope: Blackman-windowed 16384-point FFT, mean power in third-octave bands from 100 Hz to 10 kHz, in dB, least-squares
  line against log2(frequency). The page measures (a) the generated samples and (b) the live signal read from an
  AnalyserNode (tapped before the volume control), averaged since the colour settled. Pass marks are 0.20 and 0.50 dB/octave.
- Audio starts only on the Play press, fades in over 3 s. Timer: off, 1 to 120 minutes; fade-out over the last
  min(60 s, half the timer). Choosing a new colour crossfades. Volume maps 0 to 100 onto a 30 dB range, default 20.
- Reduced motion: the spectrum refreshes twice a second instead of every frame.

## Checked (headless Chromium, Playwright)
- Buffer slopes 0.00, -3.01, -6.01 dB/octave (fit scatter 0.01). Live slopes after about 8 s each: -0.01, -3.00, -6.01.
- A 1-minute timer announces the fade at 30 s, stops at 0:00, the button returns to "Play" and focus stays on it.
- No console errors; no sideways scroll at 375 px; light and dark; controls come before the chart on phones.

## Not checked
- The sound itself (I cannot hear it), speakers and headphones, real phones, and whether a locked phone keeps playing.
- Any claim that noise helps focus or sleep; the page makes none.
