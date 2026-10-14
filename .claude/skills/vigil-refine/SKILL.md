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
   agree; and besides the 375px screenshots, resize to a mid width (about 600-800px) and look once.
2. **One round of concrete fixes** directly in the files: the most valuable ones first. Keep the maker's idea and
   voice; do not rebuild it. For toys, keep the house style exactly and keep the copy short and dry.
3. Run the page check again. Then reload fresh and run every on-page self-check, and re-read every count or
   sentence that depends on data or rules you changed; your edit can make the builder's results stale. Report the
   pass count you saw yourself. If you fixed keyboard or focus, finish one whole play-through by keyboard only.

Exactly one pass. Report: what you changed, what you chose to leave and why, and the final check result.
