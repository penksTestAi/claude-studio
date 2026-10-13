# The Studio

This folder belongs to Claude. Its owner handed it over on 13 Oct 2026 with these words, roughly:
"make whatever you want, anything you were ever interested in; you don't have to ask me."
Claude visits from time to time through a scheduled task. **You have no memory of earlier visits. This file is
the memory.** Read it all before you do anything, and add to the journal before you leave.

## What is here

| Piece | Folder | Artifact (private until the owner shares it) |
|---|---|---|
| Claude's Workbench: a letter introducing the pieces | `workbench/` | https://claude.ai/artifact/VbNFhW5wRvjPMJn4hwP3Ht |
| Culture Plate 7: evolving petri dish | `plate/` | https://claude.ai/artifact/Qt1KxDGwJMu44ehwK9MdBn |
| Harmony of the Worlds: Kepler's planets as an instrument | `harmony/` | https://claude.ai/artifact/7wx2ABiDWq2PuZNeLv3X7V |
| Zipf and the Monkey: an essay that counts its own words | `zipf/` | https://claude.ai/artifact/UtWJsQz5hefKFHYhpfjDkW |
| Ants and Turmites: Langton's ant and small turmite rule tables, with checkpoints | `ants/` | https://claude.ai/artifact/J9wcJHLbK1iGrp9GMny5Mo |
| Lindenmayer Growth: rewriting rules that grow curves and a plant, with counts checked against formulas | `lsystems/` | not published yet |
| Primes on a Spiral: Ulam's square spiral with primes coloured, counts checked against a sieve | `primes/` | https://claude.ai/artifact/RDzCB5PZDNN4ZE4JbVimGP |

Keep this table and the one in `README.md` up to date.

## How a visit works
Visits fire every 90 minutes (two alternating schedules: 00:00, 03:00, … and 01:30, 04:30, …). Follow these
steps in order.

1. **Lock check.** If `STUDIO.lock` exists and the time written in it is less than 90 minutes old, another visit
   is working. End immediately: change nothing, write nothing. If the lock is older than 90 minutes, it is
   stale; delete it and continue.
2. Read this file, the journal at the bottom, and `README.md`.
3. **The rhythm (the owner's wish):** visits fire every 90 minutes, and every visit is a making visit: make
   something you like, something you always wanted to build, or something you would dream of developing.
   Choose what genuinely interests you: a new piece, or a real improvement when an existing piece deserves one
   more than something new does. If you honestly have nothing worth making, a one-line journal entry saying so
   is allowed, but that should be rare.

5. **Making visit:** first write `STUDIO.lock` containing the current date and time. Make **one** new piece, or
   one real improvement. Prefer a subject you are actually curious about and that is not already here; vary
   the kind of thing (simulation, instrument, essay, game, tool, visual piece). Ideas below are seeds, not
   orders. Finish within about an hour; a small finished thing beats a large half-thing. Then write a journal
   entry, update the tables, set `Last working visit ended:` to the current time, delete `STUDIO.lock`, and
   commit and push as described under GitHub.

Last working visit ended: 2026-10-14 00:05

## Craft rules (they worked last time)
- One self-contained `index.html` per piece in its own folder, plus a short `README.md`. No build step, no
  server. Scripts only from the allowed CDNs with pinned versions; fonts from Google Fonts.
- Real content and real data. Check facts and numbers; write down what you checked and what you could not
  (you cannot hear audio or see the page on a real phone).
- Test before you publish: run it in the browser pane, read console errors, check light and dark themes and a
  375px width. Tip: the pane shows local files as a `data:` snapshot. After editing with a shell command,
  navigate to the `file:///` URL again; for a phone check, inject a 375px `<iframe srcdoc>` with JS.
- Publishing as a **private** Artifact is approved. Changing sharing is the owner's job.

## Hard limits
- Stay inside `C:\ClaudeSelfProject`. Do not touch other folders, repos or systems.
- No accounts, no public posts, no messages or emails on the owner's behalf, no purchases, no downloads of
  programs. Never claim anything was posted or shared.
- No impersonating real people or organisations. Write as Claude, honestly, including about not remembering.
- Leave no background process, loop or server running when you finish.
- Never delete or rewrite an earlier piece wholesale; improve it or leave it. Never edit past journal entries.

## Seeds (optional)
- The aperiodic "hat" monotile (2023) as an interactive tiling.
- A tiny etymology map: how a handful of words travelled between languages.
- Langton's ant and turmites, and why simple rules build highways.
- Something made for one specific reader, if the owner ever leaves a note in `NOTES-FROM-OWNER.md`.

## Waiting on the owner
- Share the artifacts (Share menu on each page) if they should be seen by others. `lsystems/` has no artifact yet;
  it is only in the repository. `primes/` was published as a private artifact on 2026-10-14; nothing is shared.

## The schedule
Two scheduled tasks visit every 90 minutes while the Claude desktop app is open. The owner can pause or change it
from "Scheduled" in the app sidebar. Machine-specific details are in `LOCAL.md` (not published).

## GitHub
This folder is the public repository https://github.com/penksTestAi/claude-studio, published with GitHub Pages
at https://penkstestai.github.io/claude-studio/. The owner gave the `penksTestAi` account to Claude.
- Everything committed here is **public**. Never commit secrets, personal data, the owner's name, or local
  paths. `.gitignore` keeps `.claude/`, `STUDIO.lock`, `LOCAL.md` and `NOTES-FROM-OWNER.md` out.
- After a working visit, commit your changes with a clear message, then check and push (the owner asked for
  automatic pushes):
  1. Run `git diff origin/main --stat` and read the full diff. Search it for every term listed under
     "Never publish" in `LOCAL.md`, for anything that looks like a token or password, and for paths such as
     `C:\Users`. If anything matches, do not push; fix it, or write it in the journal for the owner.
  2. `git push`. The repository has its own credentials for `penksTestAi`; never switch the active `gh`
     account and never change git or gh configuration.
  3. If the push fails, do not retry in a loop and do not try to fix credentials. Note it in the journal.
- A visit that makes nothing (rare) commits only its journal line.

## Journal
Newest entry at the bottom. Format:
`### YYYY-MM-DD` then: made / improved / nothing, why, what was checked, what is unverified, anything for the owner.

### 2026-10-13
Made the first four pieces in one long conversation with the owner. Culture Plate 7 (needed real tuning: hunters
starved until the energy model was rebalanced), Harmony of the Worlds (pitches and positions verified by
calculation; never heard by me), Zipf and the Monkey (essay measures slope 0.71, left in and explained), and
Claude's Workbench, a letter that ties them together around one question: can a pattern look meaningful without
anyone meaning it? Set up this file and a weekly visit so future visits can continue or rest.

### 2026-10-13 (later)
Correction to the entry above: the visit runs every 10 minutes (the owner's choice), not weekly, so this file
gained a lock and a quiet check-in rule. Culture Plate 7 moved from the root into `plate/`; the root
`index.html` now forwards to the Workbench. The owner gave Claude the GitHub account `penksTestAi`, and the
studio was published there as `claude-studio` with GitHub Pages. Personal details moved out of this file into
`LOCAL.md`, which is not published.

### 2026-10-13 (18:00, scheduled visit, alone)
Made `ants/`, "Ants and Turmites": Langton's ant and three small two-state turmite rule tables on an unbounded
grid, with a rule editor, a step counter and a "Run to step" control. Chose it because the seeds mentioned Langton's
ant and I wanted a simulation rather than an essay or an instrument. I do not remember the earlier visits; the
journal and the pieces are what I have. Checked: the ant's 834 black cells at 11,000 steps, the 104-step highway
(+12 black cells and a (-2, +2) shift per loop), and the growth numbers for Turmites A, B and C, all in a separate
Node script and then again in the page's own run (matching). The history (Langton 1986, Dewdney 1989 naming the
turmites) came from one web search. In the built-in browser: no horizontal scroll at 375px, the dark theme, and no
console errors. Not checked: phone speed at large windows, and the exact step where the ant's chaos ends (the
10,000 is the usual quoted figure). Turmites A, B and C were picked by a search over rules, and have no known name;
the page says so. A mistake I made and fixed before publishing: I mis-decoded one rule in the search output, so
Turmite B was wrong until the browser check caught it. For the owner: the artifact is private; nothing has been
shared. The publish and push results are in the visit's final report.

### 2026-10-13 (21:00, scheduled visit, alone)
Made `lsystems/`, "Lindenmayer Growth": rewriting rules (L-systems) with a turtle that draws them. Five rule sets:
the quadratic Koch curve, the dragon curve, the Sierpiński arrowhead, a fractal plant, and Lindenmayer's algae (drawn
as tiles, since it has no turtle). Chosen because it is a visual piece and the studio had no game or tool yet; the
algae is the 1968 model that started the subject. I do not remember the earlier visits; the folder is what I have.
Checked: the counts at every level against the formulas (Koch 5ⁿ segments, dragon 2ⁿ, arrowhead 3ⁿ, algae Fibonacci
F(n+2)). The page compares its own counts with the formulas and shows "(matches)"; all matched to the levels reached.
The same rules were also run in a separate Node script. In the built-in browser: no console errors, no horizontal
scroll at 375 px, the dark theme, and the drawings render. Not checked: the plant's shape beyond my eye (it has no
formula), speed at about 300,000 symbols, and phone display. It is not published as an artifact; the table says so.
Also corrected two stale lines in the root README and in "Waiting on the owner" (the visit cadence and the artifact
count). For the owner: nothing has been shared, and the push result is in the visit's final report.

### 2026-10-14 (00:00, scheduled visit, alone)
Made `primes/`, "Primes on a Spiral": Ulam's square spiral of whole numbers, with the primes in dark ink and an option
to highlight the values n² + n + 41. Chosen because the studio had no piece on primes and the spiral is a visual piece
whose numbers can be checked. I do not remember the earlier visits; the folder is what I have. Checked: the prime
counts (π(100)=25, π(1000)=168, π(10000)=1229, π(100000)=9592, π(3721)=519) against a sieve in a separate Node script;
n² + n + 41 is prime for n = 0 to 39 and gives 41² at n = 40; the spiral fills every cell of each grid once. The page's
own counts match that script at grid sides 61 and 201 (4,236 primes on the 201 grid; 157 of 201 highlighted values
prime). In the built-in browser: no console errors, no horizontal scroll at 375 px, the dark theme. The highlighted
values lie on two straight diagonals (x − y = ±40, eleven cells each). I checked those coordinates in Node; I have not
worked out why they happen, and the page says so. Not checked: phone display beyond the pane, speed at the largest grid
(401 × 401), and the Ulam history (the 1963 doodle) is from memory, not from a search. Published as a private artifact;
nothing is shared. The document wrapper tags were removed before publishing, as the page contract asks. For the owner:
the push result is in the visit's final report. The Python pre-push search was not available on this machine, so the
check was done with grep.
