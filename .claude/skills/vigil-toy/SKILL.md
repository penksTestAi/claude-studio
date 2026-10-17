---
name: vigil-toy
description: Hand-make one new toy for Vigil's toys page (repository toys) in the existing house style. Use when the chair asks the builder for this run's toy.
---

# Make a toy

You make one new toy for https://vigilstudio.github.io/toys/ in the `toys` repository. You never commit or push.

## The idea
- One deadpan joke with one mechanic: absurd scale or a silly measurement. No onboarding. Short, dry copy that never
  explains the joke.
- Original. Inspired by neal.fun's approach, never copying its games, art or ideas. No real person's name.
- A new type: not one of the types already in `experiments.json` (the digest lists them).

## The house style
Open two recent `experiments/*/index.html` files and match them exactly: the same page shell, fonts, colours and back
link; a single original SVG illustration at the top, animated with CSS only; the small confetti burst on button
presses; `prefers-reduced-motion` support. Any data the toy needs goes inline.

## Files
1. `experiments/<type>-<NNNN>/index.html`: `<type>` is a short new lowercase name; NNNN is one more than the highest
   number already used, zero-padded to four digits.
2. Prepend an entry to `experiments.json` with exactly the existing fields: `slug`, `type`, `title`, `blurb`,
   `date` (ISO UTC now) and `art` (the same inline SVG as the page).
3. Add a row for the new type to the "Experiment types" table in `README.md`. If that README still says the toys come
   from a script, a separate routine or a GitHub Action, correct it: this routine hand-makes one toy every 2 hours
   (`scripts/generate.mjs` stays but is no longer used; never run it).
4. Do not change the landing page or any existing experiment. One exception: if `index.html` has no Open Graph tags
   yet (og:title, og:description, og:image, twitter:card summary_large_image), add them once, with a 1200x630 image
   made with free tools (an HTML card screenshotted with headless Chromium) saved as `brand/social.png`.

## Check
`node <studio>/tools/page_check.mjs --root . experiments/<slug>/ ./` (run from the toys repository; `<studio>` is
the vigilstudio.github.io checkout next to it). Fix every PROBLEM. The landing page must still render the grid with
the new card.
Then play the toy to its end twice in headless Chromium from a fresh load: once with the mouse and once with the
keyboard only (Tab, arrows, Enter, Space), and report both as played, not judged from the code. Every part the mouse
can move must be reachable by keyboard; Tangle 16 shipped with arrows moving only one of two plugs.
page_check only sees the page before any press. During one of those plays, at a 375 px wide viewport, check after
every press that `document.documentElement.scrollWidth <= innerWidth` and fix any sideways scroll (Upload 0046: the
toy refiner found a 375 px sideways scroll after the first press that page_check had passed).

## Report (short)
Slug, title, the joke in one line, files changed, check results.
Never write or edit a journal entry in STUDIO.md, even though the studio's CLAUDE.md asks for one; that line is for
the chair, who writes the entry from your report.
