# Moiré

Two line gratings, A and B, drawn over each other. Drag the picture to turn or shift B (or use the keys and sliders), and
the page shows the stripe (moiré fringe) spacing two ways: predicted from the settings, and measured from its own pixels.

## How it works
- Prediction: stripes are the beat of the two gratings, spacing 1 / |k_A - k_B|. For equal pitch d and angle θ that is
  d / (2 sin(θ/2)); for unequal pitches the page uses d1·d2 / sqrt(d1² + d2² - 2·d1·d2·cosθ).
- Measurement: the gratings are drawn to a hidden canvas (one canvas pixel per CSS pixel, up to 512), the pixels are read
  back, Hann-windowed and put through a 512x512 FFT; the strongest peak between 1.5 cycles per picture and 0.75 of the
  gratings' own frequency gives spacing and stripe angle (parabola-refined). Stripes too wide to resolve are reported so.
- The check button runs that for 12 fixed angles at the current pitches and tabulates it; focus moves to the results heading.
- Line counts and the pass tally are computed in code. No animation, so reduced motion changes only the scroll behaviour.

## Checked (headless Chromium, Playwright)
- Fresh load: predicted 71.7 px, measured 71.6 px at 8 degrees.
- 150 random settings (angle ±30, pitch 6-16, ratio 0.9-1.1): all 136 resolvable ones within 0.75% (worst); the 14 not
  resolved had predicted spacing of 163 px or more in a 512 px picture. Stripe angle within 0.2 degrees in 60 random cases.
- 300 px picture (close to phone size; phones now draw 280 px, not re-run): 150 random settings, 134 measured, all within 0.47% (worst).
- Keys (E, Shift+E, arrows), drag-turn, drag-shift, both views, 375 px (no sideways scroll), light and dark, no console errors.

## Not checked
- Real phones, high-density screens (browser enlarges the canvas), screen readers, browsers other than Chromium.
- Prediction and measurement come from one program, so agreement shows the drawing matches the formula, nothing more.
- Circle gratings are not included. "Stripes only" blurs heavily at large angles and is for looking, not measuring.
