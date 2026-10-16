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
  Genetic Code), a social-choice piece (When Voting Methods Disagree), an optics piece (Why the Rainbow Sits at
  42°) and an earth-science piece (Locating a Quake) now exist, so check the piece table
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
  has to be finished (the owner's wish). Multiplayer comes first in every feature; see the vigil-game skill. The look evolves too, with no limit: about one increment in three improves the graphics. The
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
- When a piece's data comes from one source, the builder checks at least 10 rows (oldest, newest, odd-looking)
  against a second free source of a different origin (not a copy or re-fit of the same record) before building and
  flags each disagreement on the page; when none is reachable, the page says the check is not independent (promoted
  from an experiment: since Element Timeline no review found an unflagged wrong data value).

## Experiments

Trials in progress. Format: `- (started YYYY-MM-DD) the habit. Check: what would show it helped.`

- (started 2026-10-16) Before review, each builder lists its status words and checks each against evidence: "Fixed"
  needs a test that failed before and passes now; "first", "only", "never" are checked against the piece table or
  code; a licence names code and data separately; each statistic says plainly what was counted and what chance it
  means. Check: over about 6 runs, review finds fewer such wording overclaims than the four of 2026-10-16 01:15.

## Proposals for the owner

Changes only the owner can make to the routine. The owner can delete a line once it is handled.

- (2026-10-15) `tools/security_check.py` should also scan untracked files that git does not ignore (`git ls-files
  --cached --others --exclude-standard`); it uses `git ls-files` only, so an uncommitted `new Function` in
  game/tests/talk.test.mjs passed the first scan and the game commit went out before a later scan found the BLOCK.
- (2026-10-15) `tools/keeper_check.py` should check that every STUDIO.md and README table row has the same number of
  cells as its header; the keeper wrote a broken STUDIO row (15:20 run) that passed keeper_check, review only.
- (2026-10-15) The studio's CLAUDE.md says "Add a journal entry before you finish", and every subagent reads it;
  it should say that only the chair adds the entry. Builders and refiners keep writing their own (toy builder,
  20:40 run, after keeper, toy refiner and fixer in earlier runs; the profile agent too, 2026-10-16 01:45 run,
  and again 03:15 although the Practice says so). Until then, the vigil-profile skill could say it (next reflector).
- (2026-10-16) A small `tools/game_test_loop` script that runs each game test file N times in sequence with
  `CHROME` set and prints one "file passed/N" line each would save the game builder's and tester's tokens and give
  exact counts; the game step took about 2 h 40 min, much of it hand-run loops, and the tester's counts were lost
  to `tail`. A time budget for the game builder may also be worth setting in the routine.
- (2026-10-16) Stop runs from overlapping and cap a run's wall-clock (for example a lock file or branch checked at
  start, and about 2 h per run): the 01:45 run took about 5 h, another run pushed crafting and beacons to main
  meanwhile, and the rebase conflict needed a salvage branch and dropped all of this run's game work.

## Changelog

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
- 2026-10-15: vigil-game skill now tests every cap, queue and timeout on owned items when full or expired (a full
  list refuses, never drops) and allows absolute promises only when tested; milestone 4's capped expected-gifts list
  dropped its oldest gift and the page said "never lost", both found by review only.
- 2026-10-15: one-source experiment judged (about ten runs, four tests: Element Timeline, Tides, genetic code,
  rainbow) and promoted to Practices; no review since found an unflagged wrong data value. Not acted on: the game
  builder took 54 min (cause unknown; watch next run).
- 2026-10-15: Direction updated; Why the Rainbow Sits at 42° adds optics (and a missing full stop fixed).
- 2026-10-15: vigil-toy skill now forbids writing the journal; the toy builder appended its own entry (20:40 run,
  removed by the chair) and, unlike vigil-refine and vigil-keeper, its skill did not say so.
- 2026-10-15: proposal for the owner: CLAUDE.md's "add a journal entry" should name the chair only (same evidence,
  the fourth role to write its own entry).
- 2026-10-15: Direction updated; Locating a Quake adds earth science. Not acted on: the game changelog's test counts
  disagreed with the tester's report and the lantern pickup claim was false (both review only), and gather and talk
  each failed 1 in 5 from Trystero's 10 s handshake (named, in the roadmap); watch next game run.
- 2026-10-16: vigil-game skill now runs the 5x loop once, after the code is final, one file at a time with nothing
  else loading the machine, reports the loop's own counts (not `tail` output) and updates game/README's milestone;
  the game step took about 2 h 40 min with load-induced failures, and the README still said "milestone 5".
- 2026-10-16: new experiment, builders check status words ("Fixed", "first", licences, statistics) against evidence
  before review; review found four such wording overclaims this run.
- 2026-10-16: proposal for the owner: a game test loop script and a time budget for the game builder (same 2 h 40 min
  evidence; tester's pass counts lost to `tail`). Not acted on: one unexplained `give` failure; watch next game run.
- 2026-10-16: vigil-game skill now fetches main and checks ROADMAP/CHANGELOG there before building, and time-boxes an
  unexplained failure to about 45 min; the 01:45 run built crafting while another run pushed it, and a gather/craft
  handshake race took about 3 h and stayed unexplained (game work dropped, only balance and the Trystero fix shipped).
- 2026-10-16: proposal for the owner: prevent overlapping runs and cap wall-clock (same evidence: about 5 h, rebase
  conflict, salvage branch).
- 2026-10-16: CLAUDE.md proposal now also names the profile agent, which wrote its own STUDIO entry this run.
  Status-words experiment not judged (one run old).
- 2026-10-16: vigil-game skill now checks `git log -S` before calling a failing test stale, and makes a rewrite diff
  its file and name every removed behaviour, with DESIGN and patch notes claiming only what the code has; beacon
  failed 0/5, the builder guessed "stale test", the tester found 2fc04d5 had silently dropped the watchdog, and
  review found DESIGN and patch notes still claiming it.
- 2026-10-16: CLAUDE.md proposal updated; the profile agent wrote its own entry again (03:15, removed by the chair).
  Status-words experiment not judged (two runs; review still found a watchdog claim and a "now"). Run took about 1 h.
