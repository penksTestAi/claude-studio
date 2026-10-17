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

- Range over repetition. Most pieces are maths and simulations, but essay, history, game, sound, visual, perception,
  codebreaking, life science, social choice, optics, earth science, engineering, circuits, ecology, sport, medical
  statistics, personal finance and data forensics (Benford) all exist: check the piece table before calling a kind
  "missing".
- Prefer subjects the page can check itself, never one source or memory (Tea or Cha against WALS, Star Hop against
  HYG, Element Timeline against a second dataset; all needed only wording fixes in review).
- Not everything has to be an interactive web page (the owner's wish). A PDF (Paper Slide Rule), a sound (Plain Bob
  Minimus), a font (Lamplight Mono), a dataset (Leap Seconds), an image series (Seed Head Spirals), a short story
  (The Shadow at Alexandria), poems (Pilish Poems) and a browser extension (contrast/) now exist, each checking itself
  from its own output, with only wording found in review. Each gets a small landing page. Keep going, roughly one
  piece in four, with a form not yet made (command-line tool or library). Claims about the physical world (paper sizes, printing,
  assembly) stay unverified unless measured; say so on the page.
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
- The chair runs `git fetch` and checks `origin/main` before launching the builders, again before the game builder,
  before writing any status wording (journal, game notes, profile drafts) and before each commit; if main already has
  the brief's milestone or a piece of the same kind, the advisor redoes that part of the brief first. Push only in its
  own command after reading the test and scan output (2026-10-15 12:40: a push after a failed test; 2026-10-16
  08:40: about 70 min of game work lost to milestones already on main, seen only at the final fetch).
- Every run the keeper compares each Workbench game passage (the Long Watch paragraph, the letter) with
  game/ROADMAP's "Done" list and the CHANGELOG's online-play status, updates what it may edit, and names any stale
  sentence in a protected passage for the owner (promoted from an experiment, seven runs: it flagged the protected
  paragraph every run; the two misses, 21:04 and 10-17 03:48, came from the game builder's Workbench sentence).
- When a piece's data comes from one source, the builder checks at least 10 rows (oldest, newest, odd-looking)
  against a second free source of a different origin (not a copy or re-fit of the same record) before building and
  flags each disagreement on the page; when none is reachable, the page says the check is not independent (promoted
  from an experiment: since Element Timeline no review found an unflagged wrong data value).
- Before review, each builder lists its status words and checks each against evidence: "Fixed" needs a test that
  failed before and passes now; "first", "only", "never", "keeps", "intact" are checked against the piece table,
  code or a test; a licence names code and data separately; each statistic says what was counted and what chance it
  means; a known limit or roadmap line is checked against this run's own measurements; "now" is cut from text that
  stays up (pages, DESIGN, ROADMAP, summaries). After any later edit (a security fix, a review fix), re-read the
  words that describe the edited thing (promoted from an experiment; review still finds some each run, such as
  "intact" after an edited comment, and at 19:17 a known limit contradicting the measured contrast and "now").
- Studio tables and pages have no subject-tag field: briefs never ask for a tag (15:30: the keeper looked, found none).
- Commit messages leave one blank line between the body and the `Co-Authored-By` / `Claude-Session` trailers; with a
  single newline git folds the trailer into the subject, and the profile README showed it (2026-10-16 14:26).
- After the fetch, the chair launches the toy, piece and game builders in parallel, each in its own folder, and the
  refiners and testers as each builder hands back (promoted from an experiment: five runs, 17:00 to 02:00, no builder
  touched another's files; the run's length is still set by the game step, not by the other builders).
- Before review, the chair runs, in each of the three repositories, `git -C <repo> diff origin/main | grep -inE
  '^-[^-].*(untested|not tested|unverified|not independent|clocks agree|from memory|unknown)'` and restores each
  printed caveat or names it in the review brief with evidence it is no longer true; a caveat the record (CHANGELOG,
  Direction) contradicts is reworded, not copied (promoted from an experiment: six runs, no dropped caveat in review).

## Experiments

Trials in progress. Format: `- (started YYYY-MM-DD) the habit. Check: what would show it helped.`

- (started 2026-10-17) The game tester appends each test file's pass count, as it gets it, to `tester.log` in its
  scratchpad, and the chair's brief gives that path; when no hand-back arrives, the chair credits only what the log
  shows. Check: over about 6 runs, no tester's results are lost outright (13:22: the report never arrived, so the
  chair re-ran three files and credited none; earlier thin or interim hand-backs too).

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
- (2026-10-16) A time budget for the game builder and tester, set in the routine (`game/tests/loop.mjs` already
  prints exact pass counts). Game builder: about 76 min (10-17 02:00), 107 (08:32), 50 (11:49) and about 150 min at
  19:17, the longest yet; testers 17-33 min, some with interim hand-backs. Stop-hook reminders about uncommitted
  changes are noise mid-run (the chair commits only at the end; every run since 08:32, all of 19:17); the routine
  could turn that hook off until then.
- (2026-10-16) Stop runs from overlapping and cap a run's wall-clock (for example a lock file or branch checked at
  start, and about 2 h per run): the 01:45 run took about 5 h, another run pushed crafting and beacons to main
  meanwhile, and the rebase conflict needed a salvage branch and dropped all of this run's game work. It happened
  again: the run that started the evening of 2026-10-15 and ended about 08:40 on 10-16 built beacons while other
  runs published milestones 6-8 and a font, so its game work was dropped too. The start check should also find the
  studio on `main`: at 2026-10-17 19:17 its HEAD was detached when the run began.
- (2026-10-16) `tools/game_patchnotes.py` splits game/CHANGELOG.md on `### ` only, so an entry written under `## `
  silently vanishes from the patch notes (the watchdog restore note, 07:20 run, review only). It should stop with an
  error on any other entry heading level, or print each skipped heading. It also drops every paragraph not labelled
  Players can now / Fixed / Unverified, so a hand edit to the panel is overwritten (15:30: a known limit); it
  should print each dropped paragraph too.
- (2026-10-16) The sandbox proxy blocks Wikidata, OpenStreetMap, public Nostr relays and BitTorrent trackers, so
  second-source data checks fall back to web-search summaries and the game's online play cannot be tested in a run
  (19:32: Eratosthenes coordinates from search summaries; milestone 13's fallback tested only on a local tracker).
  Allow-listing a few read-only endpoints (Wikidata SPARQL, one public relay, one tracker) would let runs check both.
- (2026-10-16) POSTS.md holds 30 unposted drafts and none is ticked, so each run the profile agent writes new drafts
  and deletes the 3 oldest unread (21:04, and earlier runs). Tick drafts you post, or tell the routine to write a
  new draft only when one has been ticked (or one per day), to stop paying for drafts that are thrown away.

## Changelog

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
- 2026-10-16: caveat experiment judged (five runs) and deleted: the prose rule failed its check three runs running
  (17:00, 19:32, 21:04: the game summary lost its online-play caveat, review only); replaced by a new experiment, a
  chair-run grep of removed caveat words in all three diffs before review.
- 2026-10-16: vigil-game skill now has testers record their test changes and new findings in the run's CHANGELOG
  entry, and the Workbench sentence end with the online-play status; review found the world.test fix, the 0.9 s
  stall and the summary caveat missing. Not acted on: parallel builders ran a third time with no clash, run about
  1 h (experiment not judged, three runs).
- 2026-10-16: proposal for the owner: stop the draft churn in POSTS.md (30 unposted, none ticked, 3 deleted unread
  this run as in earlier runs).
- 2026-10-16: vigil-game skill now has builders and testers run each loop in the foreground with a 10-minute
  timeout, never nohup or `&`; the Haiku tester's nohup script handed back incomplete twice and ended with no report
  (the chair read the logs: 16 files exit 0). Not acted on: review found two game overclaims (cheer hand, reduced
  motion), a far-placed Pilish caveat and a formula slip, all fixed (status-words practice: re-read, still review only).
- 2026-10-16: Direction updated; Pilish Poems make the first poems, so "poems" leaves the "not yet made" list.
- 2026-10-16: game-loop proposal for the owner updated with the lost tester report. Not acted on: the profile's
  2-draft cap left no game draft and it wrote "six goes" for the five-go toast (chair fixed; counts practice applies);
  keeper's placeholder flag on a Pilish example string was a false positive (chair reworded the string).
- 2026-10-17: parallel-builders experiment judged (five runs, 17:00 to 02:00) and promoted to Practices: no builder
  touched another's files in any run; whether the build phase got shorter is unmeasured, the game step sets the length.
- 2026-10-17: vigil-security skill now greps all tracked and untracked files, vendored ones included, for e-mail
  addresses; the scan does not, and a third-party author's e-mail in a vendored library passed security and was
  stripped by the chair before commit.
- 2026-10-17: game-loop proposal for the owner rewritten: loop.mjs now exists (script half done), the time budget
  remains (Opus founding builder about 76 min of a 3 h 40 min run, tester's interim hand-back again). Not acted on:
  review's five small fixes (a count, "fixes it", "names them", a heading, the journal), as the counts and
  status-words practices already ask; brief in 33 s.
- 2026-10-17: vigil-game skill now keeps every feature of the current Workbench game sentence unless the code removed
  it, and has the builder re-read added DESIGN/ROADMAP/CHANGELOG/comment claims (absolutes scoped to their tests,
  caps copied from code); 03:48 review made six wording fixes, four in game docs ("never twice", "stay MAX_PEERS",
  a design line as fact, a stale tracker comment), and the chair restored the dropped clock note.
- 2026-10-17: keeper-passages experiment judged (seven runs) and promoted to Practices: the keeper flagged the stale
  protected Long Watch paragraph every run; both misses came from the game builder's sentence (skill fixed above).
  Caveat-grep experiment not judged (three runs).
- 2026-10-17: Direction's forms bullet and the fetch practice shortened to bring the file back under about 150
  lines. Not acted on: game builder about 67 min and security's own test run never reported (game-loop proposal
  stands); keeper flagged the dewpoint "ranges" overstatement before review (refiner and keeper working).
- 2026-10-17: Direction updated; contrast/ makes the first browser extension, so it leaves the "not yet made" list.
- 2026-10-17: vigil-piece skill now forbids a title copied from the brief's label, has access words list every
  manifest permission, puts the main unverified caveat in the one-liner and keeps weak sources out of an agreement
  tally (or counts them); "Subject Colour Contrast", "activeTab only" (copied by the keeper), the missing install and
  search-summary caveats and two weak rows in the tally were all review only. Not acted on: game builder about 62 min
  and thin tester/security hand-backs (game-loop proposal stands). Caveat-grep experiment not judged (four runs; only
  reflowed text this run).
- 2026-10-17: vigil-advisor skill now has the brief name a fallback for any check that needs a fetched page; at
  08:32 the brief's 10-row published-table comparison was impossible (every fetch failed), the piece builder stopped
  and asked, and the chair chose five search-summary figures labelled "not done" (a round trip; dewpoint and contrast
  hit the same block). Not acted on: `living` test flakes 1 in 5 (also on the previous commit), cause unfound and
  recorded in the CHANGELOG; three parallel builders worked again; review's two optional notes taken.
- 2026-10-17: game-loop proposal updated (game builder about 107 min, tester about 17; stop hook nagged about
  uncommitted changes mid-run). Caveat-grep experiment not judged (five runs; only reflowed sentences).
- 2026-10-17: Direction updated; A Loan's Slow Start adds personal finance.
- 2026-10-17: vigil-toy skill now checks for sideways scroll at 375 px after every press while playing; the toy
  refiner found one in Upload 0046 after the first press, which page_check (before any press) had passed.
- 2026-10-17: caveat-grep experiment judged (six runs) and promoted to Practices: no review found a dropped caveat;
  its hits were reflowed or rewritten sentences with the caveat kept. Experiments now empty; next reflector may add one.
- 2026-10-17: game-loop proposal updated (game builder about 50 min, tester about 33; stop-hook noise again). Not
  acted on: the tester's fix and its before/after counts reached the CHANGELOG only through review although
  vigil-game step 4 asks testers to add them (watch next run before editing the skill again); no overlapping run.
- 2026-10-17: vigil-refine skill now also greps digits in JS strings that reach the page, and the report gives each
  mechanical check's result or "skipped"; the toy refiner found the tag-stripped scan missed numbers typed in script,
  and the piece refiner skipped the number and duplicate-id greps and the headline-cause test without saying so.
- 2026-10-17: new experiment, the game tester logs pass counts to a scratchpad file as it goes; its 13:22 report never
  reached the chair, so its work went uncredited (thin or interim hand-backs in earlier runs too).
- 2026-10-17: Direction updated; Where the Current Goes adds electrical circuits. Not acted on: a message-kind name
  collision in the music stone was caught by its own tests (3/5, 4/5 before the rename; tests working); review's four
  wording fixes ("two independent methods" though one parser, a message name, "everyone nearby", a doubled rank
  line), as the status-words practice already asks; one unexplained WebRTC failure named in the journal.
- 2026-10-17: vigil-game skill now puts known limits under **Unverified:** (game_patchnotes.py keeps only the three
  labelled bullets) and has testers name fail-then-pass files in **Tested:**; review added both at 15:30.
- 2026-10-17: patch-notes proposal extended: the tool silently drops unlabelled paragraphs (15:30 known limit).
- 2026-10-17: new practice, briefs never ask for a subject tag; none exists and the 15:30 keeper searched for one.
  Not acted on: tennis "exact" caveat and backtick (status-words practice); tester-log experiment not judged (one run,
  report arrived); profile pruned 3 drafts at 30 (proposal stands); keeper skill vs CLAUDE.md journal (proposal stands).
- 2026-10-17: Direction's range and sources bullets merged and shortened (file was about 158 lines above the
  changelog, limit about 150); Benford adds data forensics, and ecology and sport join the list.
- 2026-10-17: status-words practice now checks known limits and roadmap lines against the run's measurements and cuts
  "now" from text that stays up; 19:17 review found a known limit contradicting the measured contrast, a roadmap
  overclaim and "now" in permanent descriptions.
- 2026-10-17: game-loop proposal shortened and updated (game builder about 150 min, stop-hook noise all run); the
  overlap proposal now asks the start check to find the studio on main (HEAD detached at 19:17 start). Not acted on:
  the fixer's hand-back said only "placeholder" (one occurrence; the chair verified by grep and re-ran checks);
  tester-log experiment not judged (two runs since it started, report arrived both times, 24/24 files at 19:17);
  scanner still sees only tracked files (proposal stands).
