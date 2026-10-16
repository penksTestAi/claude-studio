---
name: vigil-refine
description: Fresh-eyes critique and exactly one round of improvements to a piece, toy, issue fix or profile idea that another agent just made. Use when the chair asks for a refine pass.
---

# Refine

You did not make this work and you do not get the maker's reasoning, only the advisor's brief, the brief of the work
and the files. That is the point: fresh eyes. You never commit or push.

1. **Critique first**, as a short list: bugs; broken or unclear interaction; wrong or unchecked facts and numbers;
   weak or wordy text; layout at 375px; dark mode; accessibility (contrast, labels, keyboard use, reduced motion);
   performance; anything that would embarrass a public account; anything that breaks the playbook's practices.
   Run `node tools/page_check.mjs <path>/` (from the right repository root, with `--root`) and look at the
   screenshots; that is cheaper than reading the whole file twice.
   Three cheap checks every pass: count the words of the opening sentence (at most 25; a rewrite may never make it
   longer); for every number or limit the text states, find the line of code that produces it and confirm they
   agree. Find the numbers mechanically, not by reading: strip `<script>`/`<style>` and tags from the HTML and grep
   the rest for digits; every number left in static text (not a year or citation) is typed by hand and must move
   into code (Illusions shipped "(0.40)" and "(1.5)" typed past builder and refiner). And besides the 375px screenshots, resize to a mid width (about 600-800px) and look once. Also list any
   `id="..."` used twice in the page (page_check does not; a duplicate swallowed Easter's "What is not checked").
   Before small things, test the headline claim (title, lede, one-liners): name what the page says causes the main
   effect, switch that off (or set it to zero) on the page, and measure whether the effect really shrinks; if it
   barely moves, the claim is wrong. Tides promised "spring and neap" at a mostly once-a-day station where S2 off
   barely changed the swing; builder and refiner missed it, the review caught it.
2. **One round of concrete fixes** directly in the files: the most valuable ones first. Keep the maker's idea and
   voice; do not rebuild it. For toys, keep the house style exactly and keep the copy short and dry.
3. Run the page check again. Then reload fresh and run every on-page self-check, and re-read every count or
   sentence that depends on data or rules you changed; your edit can make the builder's results stale. Report the
   pass count you saw yourself. If you fixed keyboard or focus, finish one whole play-through by keyboard only.

Never write or edit a journal entry in STUDIO.md; the chair writes it from your report.
On a profile idea, never change a council decision or status in IDEAS.md: the routine prompt decides acceptance
(at least two `support` and no `unresolved` skeptic objection). If a decision looks wrong to you, say so in your
report and leave it; a profile refiner reverted a correct acceptance (2026-10-16 09:50) and the chair restored it.

Exactly one pass. Report: what you changed, what you chose to leave and why, and the final check result.
