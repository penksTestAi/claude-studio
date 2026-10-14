---
name: vigil-keeper
description: Wire a new studio piece into the Workbench, README and STUDIO tables, and keep the Workbench (Vigil's front page) correct, complete and good-looking using the check scripts. Use every run, after the studio piece is built.
---

# Workbench keeper

Runs every run, even when no piece was made. Scripts do the checking; you do the small edits they point to.
You never commit or push. Work in the vigilstudio.github.io root.

## 1. Wire in this run's piece (if there is one)
The chair gives you: folder, title and one plain sentence. Take the time from the clock, never from memory:
`TZ=Europe/Bratislava date '+%-d %b · %H:%M'` (earlier runs wrote wrong local times and broke the order).
- `workbench/index.html`: add one `<li>` to the list `id="later"` directly above the line that starts with
  `<!-- LATER-VISITS`, in exactly the format of the items above it:
  `<li><a href="../<folder>/index.html">Title</a><span class="when">14 Oct · 12:00</span><span class="what">One sentence.</span></li>`
- `README.md`: add a row to the pieces table in the same format as the others:
  `| **Title** | one line | [\`<folder>/\`](<folder>/) |`
- `STUDIO.md`: add a row to the "What is here" table.

## 2. Check
- `python3 tools/keeper_check.py --fix`. It adds missing doctype/charset/viewport lines by itself; fix every other
  CHECK line by hand (a missing item, a duplicate, the wrong order, an old name or address such as penksTestAi,
  claude-studio, funStylePage or penkstestai.github.io). Never touch earlier journal entries.
- `node tools/page_check.mjs workbench/`: no PROBLEM lines, and the count it prints matches keeper_check's number.
  Look at the 375px light and dark screenshots.
- Masthead links: ../toys/, ../feed.xml, https://x.com/vigilstudio, https://github.com/vigilstudio, the avatar
  ../brand/avatar.svg.

## 3. Words (rarely)
You may update the short factual passages ("How the shifts work", the line under "Made on later shifts", the
signature date line) when the facts changed, in Vigil's voice and as few words as possible. Never rewrite the opening
paragraphs, "The first three" cards or "The question underneath"; put suggestions for those in your report for the
owner instead. The letter must keep saying plainly that Claude, an AI model by Anthropic, is behind Vigil and that
Vigil is not an Anthropic project.

About once a week (when the playbook or journal shows no keeper polish in the last 7 days) you may make one small
visual polish in the existing style, checked at both widths and both themes.

## Report (at most 8 lines)
What you wired in, the script results, what you fixed, anything left for the owner.
