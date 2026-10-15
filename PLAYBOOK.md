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
  pendulums, birthdays, rhythms, cellular automata). An essay (Zipf), history (Harmony, Tea or Cha), a game
  (Star Hop), a sound tool (Colours of Noise), a purely visual piece (Moiré), a perception piece that measures
  its own pixels (Lightness Illusions) and a codebreaking piece (Breaking Vigenère) now exist, so check the piece table
  before calling a kind "missing".
- Tea or Cha is checked against WALS (29 of 31 match), Star Hop's 51 stars against HYG (all match) and Element
  Timeline's years against a second dataset (91 of 118 agree, all disagreements listed), so no piece rests on one
  source or memory: prefer subjects the page can check itself. Improvement runs work: all three checks needed only
  wording fixes in review.
- Not everything has to be an interactive web page. The owner asked for other forms too: a command-line tool or
  library, a dataset, a piece of music or sound, a printable PDF, a series of images, a story or poems, a font, a
  browser extension. Each still gets a small landing page so people can find it. So far every piece is a web page;
  try another form soon.
- Libraries and frameworks are welcome when they make a piece better (the owner's words): for example three.js,
  p5.js, D3, Tone.js, Matter.js, Leaflet or Preact on a page, numpy or Pillow when generating data, images or sound.
  Free and open-source only, pinned versions, loaded from cdnjs/jsdelivr/unpkg or vendored into the folder.
- Fewer, deeper pieces are fine. An improvement that makes an existing piece much better counts as a good run.
- Something that grows over several shifts (a long project with a note in the journal for the next shift) is
  welcome once in a while.

## Practices

Habits that have proven themselves. Follow them unless the run has a good reason, and say the reason in the journal.

- Every page starts with doctype, charset and viewport. Six early pages lacked them and showed zoomed out on phones.
- Put numbers that a visitor can check on the page, and check them yourself before publishing.
- Compute every count and name shown on the page from the data in code, never typed by hand (promoted from an
  experiment: typed counts reached review in Star Hop, Moiré and Tea, none since it took hold).
- When a simulation is tuned, run it many times in the background with different seeds before trusting it; the first
  Culture Plate tuning looked fine once and failed every other time.
- Say what went wrong or stayed unverified, on the page or in the journal, instead of hiding it.
- Builders save screenshots and scratch files in their scratchpad, never in a repository; the keeper still had to
  delete stray screenshots from the studio root in later runs. Meta tags are only `tools/site_meta.py`'s job.
- Each new piece opens with one plain sentence of at most 25 words saying what you can do with it, before any
  explanation (promoted from an experiment: Tissot Circles 22 and Element Timeline 17 words, neither shortened).
- Only the chair writes the journal entry; every other role reports to the chair, and the chair says so in each
  role's brief (the keeper, the toy refiner and the fixer each appended their own entry, removed by the chair).

## Experiments

Trials in progress. Format: `- (started YYYY-MM-DD) the habit. Check: what would show it helped.`

- (started 2026-10-14) When a piece's data comes from one source, the builder checks at least 10 rows (oldest,
  newest and odd-looking ones) against a second free source or a published list before building, and flags each
  disagreement on the page. The second source must have a different origin (not a copy or re-fit of the same
  record); when none is reachable, the page says the check is not independent. Check: the review stops finding wrong
  or mislabelled data values nobody flagged.

## Proposals for the owner

Changes only the owner can make to the routine. The owner can delete a line once it is handled.

- (2026-10-14) Let `tools/keeper_check.py` flag a page with more than one `name="description"` (or other duplicate
  meta) tag, so the keeper's zero-token check catches what only the advisor's review caught in `noise/` today.
- (2026-10-14) Add a mid-width view (about 768x1024) to `tools/page_check.mjs`, which now checks only 375px and
  1100px; the Moiré layout gap on mid-width screens passed builder, refiner and keeper and was caught only in review.
- (2026-10-14) Make the routine run `tools/site_meta.py` (after the keeper, before the advisor's review) as a fixed
  step; in the 20:35 run it had not been run when the review started, and the review had to flag it.
- (2026-10-15) Let `tools/page_check.mjs` (or keeper_check) flag an `id` used twice in a page; in `easter/` an h2
  and a div both had id="limits", which swallowed the "What is not checked" heading and passed page_check.
- (2026-10-15) Let `tools/page_check.mjs` flag any table, pre or figure whose scrollWidth exceeds its visible width
  at 375px; the Lightness Illusions table was cut off on phones, passed page_check and was caught only in review.
- (2026-10-15) Let `tools/keeper_check.py` flag placeholder text ("X and Y", "TODO", "TBD", "lorem") in README,
  Workbench and STUDIO lines; the Tides README shipped "X and Y" past the keeper and was caught only in review.

## Changelog

- 2026-10-15: Direction now invites other forms than web pages and the use of free libraries and frameworks (the owner's request); each piece keeps a landing page.
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
- 2026-10-14: Direction updated; its "still missing" list was stale (Zipf essay, Harmony history and now Moiré as a
  visual piece all exist, the advisor's brief flagged it); points to improving an existing piece instead.
- 2026-10-14: vigil-refine skill now counts opening words (never lengthen), matches every stated number or limit to
  its code, and looks at a mid width; Moiré's refiner rewrite left a 36-word opening and the review found a wrong
  stated limit (page said two thirds, code a third), a typed-in count and a mid-width layout gap.
- 2026-10-14: proposal for the owner: a mid-width view in page_check (same Moiré evidence).
- 2026-10-14: both experiments left running, not judged (three runs so far). Moiré counts against both: builder and
  refiner missed the 25-word cap and a typed-in count, all caught only by the advisor; the refine-skill edit above
  adds a second line of defence rather than changing the experiments.
- 2026-10-14: Direction updated; Tea or Cha is now checked against WALS (16:30 run), so only Star Hop rests on
  memory, and "every run so far made a new piece" was stale.
- 2026-10-14: vigil-piece skill now computes names in data-built sentences, reads them for 0/1/many, and on
  improvements greps for old claims and hedges; the Tea review found typed Malay/Tamil names, "for 0 it differs" and
  stale "Unverified." notes, and the refiner had to fix a stale share description.
- 2026-10-14: both experiments left running, not judged (four runs, short of six). Counts experiment is failing so
  far: typed values reached the advisor in Star Hop, Moiré and Tea; judge it (likely delete in favour of the skill
  checks) at about 6 runs. Opening-sentence experiment had no new piece to test this run.
- 2026-10-14: Direction updated; Star Hop is now checked against HYG (18:30 run, all 51 match), so no piece rests
  on memory; tidied the builder's edit of that line.
- 2026-10-14: vigil-keeper skill now keeps what a piece is when editing an improved piece's lines; this run's keeper
  rewrote the Star Hop Workbench and README lines as only the check and dropped that it is a game (caught in review).
- 2026-10-14: both experiments left running, not judged (five runs). Counts experiment passed this run (all counts
  computed in code, review found none typed) after failing in Star Hop, Moiré and Tea; judge it next run.
- 2026-10-14: counts experiment judged (six runs): its counts half promoted to Practices (all counts and names were
  computed in code in the last two runs), its screen-and-focus half dropped (most pieces have no screens; the skills
  cover it). Opening experiment left running: Tissot Circles opens with 22 words, a pass, but tests are still few.
- 2026-10-14: vigil-piece skill now computes derived numbers over what is shown, measures behaviour words and checks
  units, precision and clipping; the Tissot Circles review found 108% (uncropped) where the shown map gives 76%,
  "stays round", mismatched precision, "countries" for records and clipped circles, all missed by builder and refiner.
- 2026-10-14: proposal for the owner: run site_meta.py as a fixed step before review (review finding 6, a chair
  omission, not a builder error).
- 2026-10-14: opening-sentence experiment judged (six runs) and promoted to Practices: after the refine skill began
  counting words, Tissot Circles (22) and Element Timeline (17) passed with no refiner cut; Moiré (36) was the last miss.
- 2026-10-14: new experiment, check one-source data against a second source; Element Timeline's single GitHub source
  (PubChem and Wikipedia gave 403) had 17 false "Ancient" labels (refiner) and five wrong years (review only).
- 2026-10-14: vigil-refine skill now re-runs on-page self-checks and dependent counts after its own edits and plays a
  focus fix through by keyboard; the "Ancient" regroup left a failing self-check and a wrong "112 of 118" count
  (both review blockers, reported as passing), and the Queue 15 focus fix was never re-played by keyboard.
- 2026-10-15: one-source experiment left running, not judged: it began in the 22:35 run, so the 00:35 Element
  Timeline cross-check is its first test (a pass: review re-fetched both datasets, confirmed all 118 rows, found
  only wording bugs). Judge after about five more runs that use one-source data.
- 2026-10-15: vigil-toy skill now plays the toy to its end by mouse and by keyboard only before reporting; Tangle 16's
  builder judged keyboard play from code and its finish was unreachable (arrows moved one plug), caught by the refiner.
- 2026-10-15: Direction updated; Element Timeline is now checked against a second dataset (91 of 118 agree).
- 2026-10-15: new practice, screenshots in the scratchpad and meta tags only from site_meta.py; the keeper again
  deleted stray screenshots from the root and hand-edited meta tag counts outside its list (site_meta ran after).
- 2026-10-15: vigil-refine skill now lists duplicate ids and never writes the journal; Easter's duplicate
  id="limits" passed builder, refiner and page_check (review only), and the toy refiner appended its own entry.
- 2026-10-15: new practice, only the chair writes the journal and says so in every role's brief; keeper (10-14),
  toy refiner and fixer (10-15 02:35) each appended one. One-source experiment not judged (two tests, both pass).
- 2026-10-15: proposal for the owner: page_check should flag duplicate ids (same Easter evidence).
- 2026-10-15: vigil-refine skill now finds stated numbers by stripping tags and grepping static text for digits;
  Illusions' builder reported all counts computed, yet "(0.40)" and "(1.5)" were typed and the refiner missed them
  (review only). One-source experiment not judged: this run used no external data, so it was not a test.
- 2026-10-15: Direction updated; Lightness Illusions adds a perception piece that checks itself, no source needed.
- 2026-10-15: proposal for the owner: page_check should flag tables wider than their box at 375px (Illusions table
  clipped on phones, page_check clean, review only).
- 2026-10-15: vigil-refine skill now tests the headline claim by switching off its stated cause; Tides promised
  "spring and neap" at a diurnal station (S2 off barely changed the swing), missed by builder and refiner, review only.
- 2026-10-15: one-source experiment now requires a second source of different origin, or saying it is not
  independent; Tides' second list (TICON-4) re-fits the same gauge. Not judged: third test, review re-fetched and data
  matched, but this test was weak.
- 2026-10-15: proposal for the owner: keeper_check should flag placeholder text (Tides README "X and Y", review only).
- 2026-10-15: vigil-piece skill now ties every method the text says produces the result to the code line that feeds
  it ("shown alongside" otherwise) and forces every verdict branch once; Vigenère's lede, meta, README and blurbs
  said Kasiski fed the break (it did not) and the untested "repeated key" verdict said "true key", review only.
- 2026-10-15: Direction updated; Breaking Vigenère adds codebreaking. One-source experiment not judged: this run
  used no fetched data (the brief said to avoid it), so it was not a test.
