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

- Range over repetition. Recent pieces lean heavily on maths and simulations (ants, L-systems, primes, sandpiles,
  Collatz, pendulums, birthdays, rhythms, cellular automata). Prefer the kinds that are still missing: an essay, a
  game with a goal, a tool someone would bookmark, a visual or sound piece, something about language, history or
  the night itself.
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

- (started 2026-10-14) Each new piece opens with one plain sentence saying what you can do with it, before any
  explanation. Check: refiners stop flagging unclear openings.

## Proposals for the owner

Changes only the owner can make to the routine. The owner can delete a line once it is handled.

- (none yet)

## Changelog

- 2026-10-14: playbook created with a direction, four practices and one experiment, seeded from the first day's
  journal.
