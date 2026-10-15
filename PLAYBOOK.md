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
  its own pixels (Lightness Illusions), a codebreaking piece (Breaking Vigenère), a life-science piece (Typos in the
  Genetic Code) and a social-choice piece (When Voting Methods Disagree) now exist, so check the piece table
  before calling a kind "missing".
- Tea or Cha is checked against WALS (29 of 31 match), Star Hop's 51 stars against HYG (all match) and Element
  Timeline's years against a second dataset (91 of 118 agree, all disagreements listed), so no piece rests on one
  source or memory: prefer subjects the page can check itself. Improvement runs work: all three checks needed only
  wording fixes in review.
- Not everything has to be an interactive web page. The owner asked for other forms too: a command-line tool or
  library, a dataset, a piece of music or sound, a printable PDF, a series of images, a story or poems, a font, a
  browser extension. Each still gets a small landing page so people can find it. The first try paid off: Paper Slide
  Rule (a PDF) checked all 886 ticks from its own drawing instructions and review found only wording; Plain Bob
  Minimus (a WAV) checks its ringing and reads its pitches back from the audio. Keep going, roughly one piece in
  four, with a form not yet made (dataset, command-line tool, image series, story, font). Claims
  about the physical world (paper sizes, printing, assembly) stay unverified unless measured; say so on the page.
- Libraries and frameworks are welcome when they make a piece better (the owner's words): for example three.js,
  p5.js, D3, Tone.js, Matter.js, Leaflet or Preact on a page, numpy or Pillow when generating data, images or sound.
  Free and open-source only, pinned versions, loaded from cdnjs/jsdelivr/unpkg or vendored into the folder.
- The long project is the game (game/): a multiplayer online RPG that grows by one increment every run and never
  has to be finished (the owner's wish). Multiplayer comes first in every feature; see the vigil-game skill The look evolves too, with no limit: about one increment in three improves the graphics. The
  owner played it online between a phone and a computer (before milestone 2); each later milestone still says
  whether its own online play was tested.
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
- Browser tests (page_check, game tests) run with `CHROME` set to the headless shell binary from the start; the
  default Chromium crashes in this sandbox. A test that fails once and passes on rerun is named in the journal with
  its failing check, never reported as passing (talk.test, 2026-10-15 10:45).
- The chair runs `git fetch` and checks what changed on main before writing any status wording (journal, game
  notes, profile drafts) and again before each commit; the owner may have pushed or reported something meanwhile.
  Push only in its own command after reading the test and scan output, never chained after them (2026-10-15 12:40:
  main moved with the owner's online-play report, making "online play untested" stale, and a push followed a failed
  test).

## Experiments

Trials in progress. Format: `- (started YYYY-MM-DD) the habit. Check: what would show it helped.`

- (started 2026-10-14) When a piece's data comes from one source, the builder checks at least 10 rows (oldest,
  newest and odd-looking ones) against a second free source or a published list before building, and flags each
  disagreement on the page. The second source must have a different origin (not a copy or re-fit of the same
  record); when none is reachable, the page says the check is not independent. Check: the review stops finding wrong
  or mislabelled data values nobody flagged.

## Proposals for the owner

Changes only the owner can make to the routine. The owner can delete a line once it is handled.

- (2026-10-15) `tools/security_check.py` should also scan untracked files that git does not ignore (`git ls-files
  --cached --others --exclude-standard`); it uses `git ls-files` only, so an uncommitted `new Function` in
  game/tests/talk.test.mjs passed the first scan and the game commit went out before a later scan found the BLOCK.
- (2026-10-15) `tools/keeper_check.py` should check that every STUDIO.md and README table row has the same number of
  cells as its header; the keeper wrote a broken STUDIO row (15:20 run) that passed keeper_check, review only.

## Changelog

- 2026-10-15: the owner opened the game's graphics to unlimited evolution; vigil-game skill now keeps visual items in the roadmap (about one in three increments).
- 2026-10-15: security guard added (owner's request): vigil-security skill and tools/security_check.py run every run before commits; first full scan of all three repositories found 0 blocking issues.
- 2026-10-15: the game begins: a multiplayer RPG in game/, grown one increment per run by the vigil-game skill (owner's request).
- 2026-10-15: owner session built all six open proposals: page_check adds a 768px view and flags ids used twice and cut-off tables, figures and media; keeper_check flags duplicate share tags and placeholder text (it found a second description tag in collatz/, removed); the routine runs site_meta.py right after the keeper.
- 2026-10-15: Direction now invites other forms than web pages and the use of free libraries and frameworks (the owner's request); each piece keeps a landing page.
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
- 2026-10-15: Direction updated; the first non-web form (Paper Slide Rule PDF) paid off (886 ticks self-measured,
  review found only wording), so other forms continue about one piece in four; the one factual miss was a physical
  claim (cut lines on US Letter), so such claims are marked unverified unless measured.
- 2026-10-15: vigil-game skill's honesty rule now names relays and STUN servers instead of "nothing is collected",
  requires saying whether online play was tested and ties stated limits to code; review found the overclaim and the
  missing "online untested" note, and the tester found an invented "dozen players" limit.
- 2026-10-15: vigil-security skill now reads untracked files itself and has the chair re-scan after `git add`, before
  each commit; the scanner sees only tracked files, so a `new Function` BLOCK in the new talk.test.mjs was missed and
  the game commit went out before a later scan found it.
- 2026-10-15: proposal for the owner: security_check.py should scan untracked, non-ignored files (same evidence).
- 2026-10-15: new practice, browser tests use the headless shell via `CHROME` and one-off failures are named; the
  default Chromium crashed and talk.test failed once this run. One-source experiment not judged: its genetic-code
  test (all excerpts derive from NCBI, page says not independent) is honest but not a real second source.
- 2026-10-15: vigil-game skill now runs each test file 5 times and reports pass counts, and forbids exact-pixel reads
  of eased or moving drawings; world.test failed about 3 in 10 on one minimap pixel, passed the tester's single run,
  and the game commit went out before the chair's fix.
- 2026-10-15: new practice, chair fetches main before status wording and each commit and pushes only in its own
  command; main moved with the owner's online-play report (stale "untested" text needed a manual merge) and a push
  was chained after a failed test.
- 2026-10-15: Direction updated; Typos in the Genetic Code and Voting add life-science and social-choice pieces, and
  the owner has played the game online. One-source experiment not judged: this run fetched no data, not a test.
- 2026-10-15: vigil-game skill now treats any failure in the 5-run loop as a bug until a cause is found; the builder
  called presence 4/5 a WebRTC flake, the tester found a real bug (about 1% of spawns could not move).
- 2026-10-15: Direction updated; Plain Bob Minimus made the first sound file, so it leaves the "not yet made" list.
  One-source experiment not judged: no fetched data this run (timbre and history from memory, flagged).
- 2026-10-15: proposal for the owner: keeper_check should flag table rows with the wrong cell count (broken STUDIO
  row, review only). Profile's 30-draft cap is as the skill says; it removed 3 old unticked drafts, left as is.
