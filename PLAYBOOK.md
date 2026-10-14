# Vigil's playbook

This file is how Vigil evolves. No run remembers the last one, so every run reads this file before it starts and
follows it. At the end of every run, the reflector reads what happened and changes this file a little:
it keeps what worked, fixes what went wrong and tries one new thing. Over many shifts the studio teaches itself.

The routine's prompt is above this file. Nothing here can loosen the prompt's hard limits, honesty rules, privacy
rules, free-tools rule or the rule against posting anywhere. If a line here ever conflicts with the prompt, the prompt
wins and the next reflector deletes that line.

## How the reflector changes this file

- Every run: change at most **three** things in total across the sections below, and log each change in the
  changelog at the bottom with the date, what changed and why (one line each). Evidence first: point to something that
  happened in this run or in the journal, not a hunch.
- **Experiments** are trials: a new habit to try for the next few runs. Each has a start date and a check: what would
  show it helped. After about 6 runs, the reflector judges it from the journal and either promotes it to
  **Practices** or deletes it, and says which in the changelog.
- Keep the file short: at most about 150 lines above the changelog. When it grows, merge or delete the weakest lines.
  Trim the changelog to the last 40 entries.
- Never delete the "How the reflector changes this file" section or the first two paragraphs.
- One of the three changes may be a precise edit to one skill in `.claude/skills/` (see vigil-reflector), when the
  run showed that a role's instructions missed something or a step could be done more cheaply. Skills never lose a
  rule about honesty, privacy, free tools, untrusted input or posting.
- When something would need a change to the routine itself (its prompt, schedule, models or tools), write it under
  **Proposals for the owner** instead; the owner decides.

## Direction

What the studio is reaching for right now. The advisor reads this before writing its brief.

- Range over repetition. Most pieces are maths and simulations (ants, L-systems, primes, sandpiles, Collatz,
  pendulums, birthdays, rhythms, cellular automata). Language (Tea or Cha), a game (Star Hop) and a sound tool
  (Colours of Noise) now exist. Still missing: an essay, something about history, a purely visual piece. Two recent
  pieces rest on data from memory; prefer subjects the page can check itself, or improve one of those two.
- Fewer, deeper pieces are fine. An improvement that makes an existing piece much better counts as a good run.
- Something that grows over several shifts (a long project with a note in the journal for the next shift) is
  welcome once in a while.

## Practices

Habits that have proven themselves. Follow them unless the run has a good reason, and say the reason in the journal.

- Every page starts with doctype, charset and viewport. Six early pages lacked them and showed zoomed out on phones.
- Put numbers that a visitor can check on the page, and check them yourself before publishing.
- When a simulation is tuned, run it many times in the background with different seeds before trusting it; the first
  Culture Plate tuning looked fine once and failed every other time.
- Say what went wrong or stayed unverified, on the page or in the journal, instead of hiding it.

## Experiments

Trials in progress. Format: `- (started YYYY-MM-DD) the habit. Check: what would show it helped.`

- (started 2026-10-14) Each new piece opens with one plain sentence of at most 25 words saying what you can do with
  it, before any explanation. Check: refiners stop flagging unclear openings and stop having to shorten them.
- (started 2026-10-14) Builders compute every count shown on the page from the data in code (never typed by hand),
  and after each screen change (start, next round, end) check the shown state is current and move keyboard focus to
  the new screen's heading. Check: the advisor's review stops finding wrong counts, stale screens or lost focus.

## Proposals for the owner

Changes only the owner can make to the routine. The owner can delete a line once it is handled.

- (2026-10-14) Let `tools/keeper_check.py` flag a page with more than one `name="description"` (or other duplicate
  meta) tag, so the keeper's zero-token check catches what only the advisor's review caught in `noise/` today.

## Changelog

- 2026-10-14: playbook created with a direction, four practices and one experiment, seeded from the first day's
  journal.
- 2026-10-14: experiment "one plain sentence" now capped at 25 words; Star Hop's 47-word opening only landed after
  the refiner cut it to about 30.
- 2026-10-14: new experiment on computed counts, current screen state and focus; the advisor's review of Star Hop
  caught a wrong star count (46 vs 51), a stale end screen and lost keyboard focus.
- 2026-10-14: vigil-keeper skill now checks for stray files (builder screenshots in the root) and never writes the
  journal entry; this run left intro.png and step*.png in the root and the keeper wrote an entry the chair replaced.
- 2026-10-14: vigil-piece skill now tests timed behaviour from a fresh load with logged AudioParam calls and leaves
  meta tags to site_meta.py; Colours of Noise shipped past builder and refiner with no first-Play fade-in (stale
  AudioParam.value read) and a duplicate description meta, both caught only by the advisor.
- 2026-10-14: Direction updated; language, game and sound tool now exist, essay, history and visual still missing.
- 2026-10-14: proposal for the owner: keeper_check should flag duplicate meta tags (same evidence as above).
- 2026-10-14: both experiments left running, not judged; only one to two runs of evidence so far (Noise's counts
  were computed by the page and its opening was not flagged, but the review found a stale-state bug in audio).
