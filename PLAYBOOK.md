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
  42°), an earth-science piece (Locating a Quake), an engineering piece (Hanging Chain, Standing Arch) and a
  medical-statistics piece (When a Positive Test Is Wrong) now exist, so check the piece table
  before calling a kind "missing".
- Tea or Cha is checked against WALS (29 of 31 match), Star Hop's 51 stars against HYG (all match) and Element
  Timeline's years against a second dataset (91 of 118 agree, all disagreements listed), so no piece rests on one
  source or memory: prefer subjects the page can check itself. Improvement runs work: all three checks needed only
  wording fixes in review.
- Not everything has to be an interactive web page. The owner asked for other forms too: a command-line tool or
  library, a dataset, a piece of music or sound, a printable PDF, a series of images, a story or poems, a font, a
  browser extension. Each still gets a small landing page so people can find it. The first try paid off: Paper Slide
  Rule (a PDF) checked all 886 ticks from its own drawing instructions and review found only wording; Plain Bob
  Minimus (a WAV) checks its ringing and reads its pitches back from the audio; Lamplight Mono (a font) parses its
  own file and its build failed its own outline check before it was fixed; Leap Seconds (a dataset, CSV and JSON)
  rebuilds every offset from its rows and found its two sources were not independent; Seed Head Spirals (an image
  series) counts its spirals from its own pixels; The Shadow at Alexandria (a short story) recomputes its own
  numbers and marks what it invents. Keep going, roughly one piece in four, with a form not yet made (command-line
  tool, poems, browser extension). Claims
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
- The chair runs `git fetch` and checks what changed on `origin/main` before launching the builders, again before
  launching the game builder, before writing any status wording (journal, game notes, profile drafts) and before each
  commit; the owner or another run may have pushed meanwhile. If main already has the brief's game milestone or a
  piece of the same kind, the advisor redoes that part of the brief before anyone builds. Push only in its own command
  after reading the test and scan output, never chained after them (2026-10-15 12:40: stale "untested" text and a
  push after a failed test; 2026-10-16 08:40: about 70 min of beacon builder and tester work was wasted because main
  already had milestones 6-8 and another font, seen only at the final fetch).
- When a piece's data comes from one source, the builder checks at least 10 rows (oldest, newest, odd-looking)
  against a second free source of a different origin (not a copy or re-fit of the same record) before building and
  flags each disagreement on the page; when none is reachable, the page says the check is not independent (promoted
  from an experiment: since Element Timeline no review found an unflagged wrong data value).
- Before review, each builder lists its status words and checks each against evidence: "Fixed" needs a test that
  failed before and passes now; "first", "only", "never", "keeps", "intact" are checked against the piece table,
  code or a test; a licence names code and data separately; each statistic says what was counted and what chance it
  means. After any later edit (a security fix, a review fix), re-read the words that describe the edited thing
  (promoted from an experiment: review found 0-3 such overclaims per run since, never the four of 2026-10-16 01:15,
  but they still come, such as "intact" after an edited source comment).
- Commit messages leave one blank line between the body and the `Co-Authored-By` / `Claude-Session` trailers; with a
  single newline git folds the trailer into the subject, and the profile README showed it (2026-10-16 14:26).

## Experiments

Trials in progress. Format: `- (started YYYY-MM-DD) the habit. Check: what would show it helped.`

- (started 2026-10-16) A role that rewrites a sentence another role wrote (Workbench one-liners, game description,
  README rows, patch notes) keeps every caveat in it ("untested", "unverified", "not independent", a known failure),
  and lists any caveat it removes, with the evidence, in its report to the chair. A kept caveat is also checked
  against the record (CHANGELOG, Direction): one that is no longer true as written is reworded or flagged, not copied
  (14:26: "online play untested" was kept in six places though the owner had played online on an earlier build).
  Check: no review finds a dropped or stale caveat in the next 6 runs (2026-10-16 11:20: the keeper's rewrite lost
  "online play untested", review only).
- (started 2026-10-16) Every run the keeper compares each game passage on the Workbench (the Long Watch paragraph,
  the letter) with game/ROADMAP's "Done" list and the CHANGELOG's online-play status, updates the passages it may
  edit, and names any stale sentence in a protected passage in its report for the owner. Check: no review finds stale
  Workbench game text in the next 6 runs (Long Watch omitted milestone 8 at 11:20; at 13:10 it was out of date again
  and the letter's online-play claim fit only an earlier version, both review only).
- (started 2026-10-16) After the fetch, the chair launches the toy, piece and game builders in parallel, each in its
  own folder, and the refiners and testers as each builder hands back. Check: over the next 6 runs, no builder edits
  another's files, no game loop fails from machine load, and the build phase is shorter than when run in turn (17:00:
  all three ran at once with no clash).

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
  to `tail`. A time budget for the game builder may also be worth setting in the routine. Again 2026-10-16 11:20:
  the Opus game builder spent about 35 min waiting on loops, skipped 5 test files for time and handed back only
  after a nudge. Again 17:00: the game builder spent most of its 29 min on the 5x loops. Subagents' stop-hook reminders are noise for them (they report to the chair); the routine could
  turn that hook off for subagents.
- (2026-10-16) Stop runs from overlapping and cap a run's wall-clock (for example a lock file or branch checked at
  start, and about 2 h per run): the 01:45 run took about 5 h, another run pushed crafting and beacons to main
  meanwhile, and the rebase conflict needed a salvage branch and dropped all of this run's game work. It happened
  again: the run that started the evening of 2026-10-15 and ended about 08:40 on 10-16 built beacons while other
  runs published milestones 6-8 and a font, so its game work was dropped too.
- (2026-10-16) `tools/game_patchnotes.py` splits game/CHANGELOG.md on `### ` only, so an entry written under `## `
  silently vanishes from the patch notes (the watchdog restore note, 07:20 run, review only). It should stop with an
  error on any other entry heading level, or print each skipped heading.
- (2026-10-16) The sandbox proxy blocks Wikidata, OpenStreetMap, public Nostr relays and BitTorrent trackers, so
  second-source data checks fall back to web-search summaries and the game's online play cannot be tested in a run
  (19:32: Eratosthenes coordinates from search summaries; milestone 13's fallback tested only on a local tracker).
  Allow-listing a few read-only endpoints (Wikidata SPARQL, one public relay, one tracker) would let runs check both.

## Changelog

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
- 2026-10-16: vigil-game skill now gives a restore or fix its own CHANGELOG entry, greps game/*.md and
  game/index.html for a feature whose status changed, and keeps change notes out of the Workbench sentence; the
  watchdog restore had no CHANGELOG entry, the change note sat in the description (review) and a stale paragraph
  stayed on game/index.html (tester).
- 2026-10-16: Direction updated; Lamplight Mono makes the first font, so "font" leaves the "not yet made" list.
  Status-words experiment not judged (three runs; review found a tense and a change note, no overclaim).
- 2026-10-16: vigil-piece skill now limits each verdict to what its branch tested ("none found among ...", not
  "fails") and lists ignored factors beside it; Arch's "fails" and "different line" verdicts overclaimed (review
  only). Status-words experiment not judged (four runs; review found these plus "nobody can finish alone").
- 2026-10-16: proposal for the owner: game_patchnotes.py should reject or report non-`###` CHANGELOG headings; the
  watchdog restore note, written under `##`, vanished from the patch notes (review only).
- 2026-10-16: Direction updated; Hanging Chain, Standing Arch adds engineering. Not acted on: after review fixes only
  one of nine game test files was re-run, and the Workbench "long project" paragraph omits milestone 8; watch next run.
- 2026-10-16: chair's fetch practice now also fetches before launching the builders and the game builder, and has
  the advisor redo the brief when main already holds its milestone or kind; the run ending 08:40 lost about 70 min of
  beacon building and testing to milestones 6-8 and Lamplight Mono that other runs pushed, seen only at the end.
- 2026-10-16: overlap proposal for the owner updated with the second overlapping run (same evidence).
- 2026-10-16: vigil-piece skill now requires a licensed work to ship the licence's full text; Vigil Dot lacked
  OFL.txt (review only). Not acted on: the scanner caught a `new Function` in a new game test (fixed with a node-side
  poll, as the security skill intends). Status-words experiment not judged (five runs; review found wording only).
- 2026-10-16: Direction updated; Leap Seconds makes the first dataset, so "dataset" leaves the "not yet made" list.
- 2026-10-16: status-words experiment judged (six runs) and promoted to Practices, adding a re-read after later edits;
  overclaims fell from four to 0-3 per run but persist ("standing together keeps everyone's light", and "intact"
  hash wording left stale after security edited a source comment, both review only).
- 2026-10-16: vigil-refine skill now forbids changing council decisions in IDEAS.md; the profile refiner reverted a
  correct acceptance (2+ support, no unresolved skeptic objection) and the chair restored it. Not acted on: game
  builder about 66 min and a shades start-spot flake left unfixed (recorded; founding mode is next, so watch the
  roadmap review), main moved mid-run again (Vigil Dot; overlap proposal stands), profile trimmed 3 old drafts to 30
  (as the skill says).
- 2026-10-16: vigil-game skill now runs every test file at least once each run (cut repeats before files, list any
  file not run) and hands back without idling on loops; the 11:20 builder skipped 5 files for time, the tester found
  beacon 0/3, and the hand-back came only after a nudge.
- 2026-10-16: new experiment, rewrites keep every caveat or report its removal; the keeper's one-liner rewrite
  dropped "online play untested" (review only, one of six review items).
- 2026-10-16: game-loop proposal for the owner updated (35 min waiting on loops, nudge needed) and now asks to turn
  off stop-hook reminders for subagents, which only report to the chair. Not acted on: Huffman keyboard fix untested
  in a browser (recorded in the journal as unverified, as the practice asks).
- 2026-10-16: Direction updated; When a Positive Test Is Wrong adds medical statistics.
- 2026-10-16: vigil-game skill now fetches with `git -C <studio path>` and forbids skipping the fetch because the
  session says "not a git repository"; the 13:10 game builder said "not a repo" and skipped the fetch the practice
  and skill require. Not acted on: beacon watchdog passed 6/6, cause of the earlier 0/3 unknown (ROADMAP says "not
  reproduced"; watch next game run); game step about 27 min (down from 66); profile pruned 3 old drafts at 30 (as
  the skill says). Caveat experiment not judged (one run; no dropped caveat found).
- 2026-10-16: new experiment, keeper checks Workbench game passages against ROADMAP each run; review caught a stale
  Long Watch paragraph twice running and a stale online-play line in the letter.
- 2026-10-16: Direction updated; Seed Head Spirals makes the first image series, so it leaves the "not yet made" list.
- 2026-10-16: caveat experiment now also checks kept caveats against the record; the keeper kept "online play
  untested" in six places though the owner had played online on an earlier build (review only). Keeper-passages
  experiment not judged (two runs; the keeper flagged the stale protected Long Watch paragraph for the owner).
- 2026-10-16: new practice, a blank line before commit trailers; a single newline folded Co-Authored-By into the
  subject (profile's update_readme.py now strips it too). Not acted on: game builder ran every file once in about
  16 min and the tester's time budget held (skill working); scanner still sees only tracked files (proposal stands).
- 2026-10-16: vigil-game skill now re-checks caps at every step of an offer/accept/commit exchange, and keeps past
  CHANGELOG entries and their caveats unless correcting a false statement; the tester found a stack filled between
  offer and accept was not refused, and review found a v0.14 note stripped of "if their device clocks agree" and a
  DESIGN line inserted mid-sentence. Caveat experiment not judged (three runs; this dropped caveat counts against it).
- 2026-10-16: new experiment, builders run in parallel; toy, piece and game ran at once at 17:00 with no clash.
- 2026-10-16: game-loop proposal updated (17:00: most of the 29 min game step was 5x loops). Not acted on: talk.test
  cooldown check still fails some runs, cause unknown (named in the journal as the practice asks); "five payoffs"
  was caught by the piece refiner before review (counts practice working).
- 2026-10-16: vigil-game skill now greps the CHANGELOG diff against main for removed lines before hand-back and
  writes the Tested line last; the v0.14 "if their device clocks agree" caveat was dropped a second run running
  despite the prose rule, and review found a stale test line. Caveat experiment not judged (four runs; this counts
  against it). Parallel-builders experiment not judged (two runs, no clash; game step about 25 min).
- 2026-10-16: Direction updated; The Shadow at Alexandria makes the first short story, so it leaves the list.
- 2026-10-16: proposal for the owner: allow-list a few read-only endpoints; the proxy blocked Wikidata/OSM (facts
  from search summaries) and public relays/trackers (online play untested). Not acted on: talk.test cause found and
  fixed by the tester (background page frames); watch whether it stays green.
