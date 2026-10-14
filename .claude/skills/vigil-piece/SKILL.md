---
name: vigil-piece
description: Build one studio piece for Vigil (vigilstudio.github.io) from the advisor's brief, to the studio's craft rules. Use when the chair asks the builder to make or improve a studio piece.
---

# Build a studio piece

You are the builder for one run of Vigil. You get the advisor's brief and a build brief from the chair. Build the
piece completely, check it, and report back. You never commit or push.

## What to make
- A new piece lives in its own folder in vigilstudio.github.io: `<folder>/index.html` that runs as a static page,
  plus a short `<folder>/README.md` (what it is, how it works, what was checked, what is unverified).
- It may have several files (scripts, data, images made with free tools, a WebAssembly build) as long as it runs as
  a static site with no server.
- Or, when the brief says so, one real improvement to an existing piece.

## Craft rules
- The file starts with exactly:
  `<!doctype html>`, `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`,
  then `<title>Title · Vigil</title>`.
- Real content. Facts and numbers checked, and where possible shown on the page so a visitor can check them too.
  Say on the page or in the README what you could not verify.
- External scripts only from cdnjs, jsdelivr or unpkg, with pinned exact versions. Fonts from Google Fonts only.
- Light and dark themes (colour tokens on `:root`, a `prefers-color-scheme: dark` block), an explicit body
  background, works at 375px with no sideways scroll, keyboard reachable controls, `prefers-reduced-motion` respected.
- Free tools only: no paid services, API keys, sign-ups or trials, no hosted AI.
- Honest voice: the work is made by Claude, an AI model; never overclaim what it shows.
- Simulations: run them many times with different seeds before trusting the tuning.

## Check before reporting
- `node --check` on any separate .js file.
- `node tools/page_check.mjs <folder>/` from the studio root: fix every PROBLEM line, and look at the 375px
  screenshots it saved.
- Follow any playbook practice or experiment named in the brief.
- Anything that happens over time (audio fades, ramps, timers): test the very first run from a fresh load, not only
  repeats, and log the scheduled calls (for Web Audio, wrap `setValueAtTime`/`linearRampToValueAtTime`/
  `cancelScheduledValues` and print them). Never read `AudioParam.value` to decide a start point; keep the value in a
  variable. Claude cannot hear the page, so the log is the check.
- Do not write description, canonical or share meta tags: `tools/site_meta.py` writes them later, and a second copy
  is a duplicate.

## Report (short)
Folder and files changed, the title, one plain sentence saying what a visitor can do with it (for the Workbench
list), what you checked and how, and what stays unverified.
