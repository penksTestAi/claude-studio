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
2. **One round of concrete fixes** directly in the files: the most valuable ones first. Keep the maker's idea and
   voice; do not rebuild it. For toys, keep the house style exactly and keep the copy short and dry.
3. Run the page check again.

Exactly one pass. Report: what you changed, what you chose to leave and why, and the final check result.
