# The Long Watch: roadmap

One milestone per run, in order. Each must work for several players at once and get a check in
`tests/presence.test.mjs` (or a sibling test). Mark the next one with **NEXT**. A roadmap review is due after
10 increments since the last one (last: 2026-10-16, milestone 16, after milestone 15); it may rewrite everything below "done", never the
working features.

## Done
- **0. Presence.** Seeded island, generated names, six lantern rooms, walk with keys or a drag joystick, see
  everyone in the same room move, leave and timeout handling, local and real (Trystero/Nostr) transports.
  (2026-10-15)
- **1. Gestures and preset phrases.** Five gestures (wave, bow, point, cheer, sit) and 16 preset phrases, sent as
  integer ids only (unknown ids dropped), bubbles with a fading timer, cooldowns enforced on both sides, edge arrows
  to off-screen players, per-peer rate limit, peer cap, Content-Security-Policy. (2026-10-15)

- **2. The island worth walking.** Seven landmarks from the seed (four old beacons, a ruined lighthouse, a jetty, a
  well), a minimap with every player, footsteps off by default (own and nearby players'), light that follows a shared
  eight-hour night, reduced-motion respected, a byte-size cap on incoming messages. (2026-10-15)
- **3. Gathering, shared.** 42 seeded spots of driftwood, reeds and oil berries; picking one hides it for everyone
  in the lantern until its seeded respawn (90 to 150 s); the lowest-id player is the arbiter for contested picks;
  late joiners get a snapshot; a new arbiter takes over when the old one leaves. (2026-10-15)

- **4. Inventory and giving.** The pack is saved in the player's own browser (every change at once); hand one
  item to a player within 3 tiles by offer, accept, then a commit and a receipt; an item is never copied; when
  anyone leaves or a page closes it waits "on its way" until the two meet again. (2026-10-15, local relay
  only)

- **5. Crafting.** Wicks and amber, jade and azure lanterns made from gathered items (ingredients are used up, never
  copied; a full stack refuses the craft and drops nothing); the lantern you hold sets how far your light reaches and
  glows in its colour, and every nearby player sees that reach drawn around you; the held lantern is told to the room
  as one number and saved in your own browser. Crafted things can be given since milestone 12. (2026-10-15, local relay only)

- **6. Beacons.** Four old beacons fuelled together: driftwood and oil berries are burned, each player's share is
  counted in a grow-only counter, a beacon lights at 12 fuel from at least two players and then lights a wide area
  for everyone; one player's share is capped at 16. Also the presence watchdog (a lost first `hi` is repeated).
  (2026-10-15, local relay only)

- **7. The living island (a look step).** Glints on the water and shore foam that washes in and out, swaying tree
  crowns, grass blades and reeds, fireflies round every lantern (more round coloured ones) and round lit beacons, a
  small sky strip with the moon crossing from dusk to dawn and stars that come and go with the dark, softer edges on
  coloured lanterns' light, `prefers-reduced-motion` freezes all of it, and a governor turns the extras down on a slow
  device. Drawn by each browser alone, nothing new is sent. (2026-10-16; frame rates measured only in headless
  Chromium without a GPU, not on a phone)
- **8. The keeper's notes.** Three notes a day from the seed and the date (gather some of one thing, make wicks or amber
  lanterns, burn fuel in one named beacon), shared by everyone in a lantern: each player's share is a grow-only counter, a
  note is done at its number with at least two players, one player's share is capped at one less than the number; late
  joiners get a snapshot; progress is not saved and starts again at 0 when the lantern empties and at 00:00 UTC.
  (2026-10-16, local relay only)

- **10. The lamplighter rank.** Five kinds of help (relighting a friend early, driving off a shade together, a gift that
  arrives, lighting a beacon together, finishing a keeper's note together) give a point each, saved in your own browser; the
  rank (0 to 4) is told to the room as one number and shown as a gold line over the name, a list suffix and gold marks on
  the lantern. Cosmetic only. (2026-10-16, local relay only)

- **9. The shades.** Waves of 0 to 4 slow hooded creatures (a pure function of the seed and the UTC clock, so nothing about
  where they are is sent) circle landmarks and snuff a lantern for 14 s; light-seconds put on a shade are a grow-only
  counter per player, a shade is driven off at 20 from at least 2 players (one alone adds at most 19), a friend's lit
  lantern on a shade holds it back, a friend nearby relights you, a lit beacon is safe ground. Drawn with a real figure
  (hood, eyes, arms, swaying hem, sparks where light burns it, a ring that fills). (2026-10-16, local relay only)

- **10 (as planned). Progression, small and shared.** Done 2026-10-16, local relay only. A "lamplighter" rank earned only by helping others: relighting a friend's
  snuffed lantern, light on a shade that is then driven off together, a gift that arrives, fuel in a beacon that lights
  with others, a keeper's note finished together. Counted and saved in your own browser; your rank (a small number)
  is told to the room and drawn as a trim on your lantern and a title beside the generated name (no text crosses the
  network, receivers clamp the number). Cosmetic only: a modified client can claim any rank, and the page says so.
- **11. Weather and the shades' sky (a look step).** Done 2026-10-16. Drifting mist and light rain from the seed and the clock (4-minute
  weather slots: about 45% clear, 30% misty, 25% rainy, easing over 40 s), a sky strip that clouds over in mist and rain and
  darkens under a violet-black cloud while a wave of shades is out; cheap on phones (cached mist sprite, one batched stroke
  for the rain, fewer at governor level 1, only a flat veil at level 0), still under reduced motion (no falling drops, mist
  stands still). Nothing is sent. `?weather=clear|mist|rain` pins it for tests. Frame cost measured only in headless Chromium.
- **12. Giving crafted things.** Done 2026-10-16, local relay only. Wicks and lanterns go through the same offer, accept, commit and receipt as
  gathered items (item numbers 3 to 6 added to the saved lists, so old saves read as before). Giving away the last lantern of the one in hand puts the
  plain lantern back. Every cap tested full and expired (receiver stack, receiver expected list, giver on-its-way list, 20 s offer, late accept,
  pack emptied between offer and accept), a peer leaving at each step, and each message dropped or either side restarted (`craftgive.test.mjs`).
- **13. A second way to find each other.** Done 2026-10-16, local servers only. Default path `auto`: Nostr first, BitTorrent trackers (Trystero's torrent strategy) if no relay opens in 7 s; the page shows which path connected; players meet only others on the same path. Tested against a Nostr relay and a tracker on 127.0.0.1; neither public path is reachable from the sandbox (HTTP 403 from the proxy), so public-relay and public-tracker play is untested. Was: When the Nostr relays cannot be reached, try a second free signalling path
    with no sign-up (BitTorrent trackers or MQTT through Trystero), say on the page which one connected, and test the
    fallback locally; record whether the public ones were reachable.
- **14. The long watch kept.** Done 2026-10-16, local relay only. When all four beacons in a lantern are lit at once, the ruined lighthouse lights for
    everyone there (a pool of light 14 tiles wide, two slow beams, a lamp at the top, a mark on the minimap) until the lantern empties. It is worked out by each browser from the
    beacon state it already holds; nothing new is sent. Shades keep out of the beam: one making for the lighthouse fades away as the beam grows, one passing through is held at its
    edge, and nobody inside the beam can be snuffed. Tested in `watch.test.mjs`; the rule holds if players' device clocks agree (shades are placed by the clock).
- **15. People (a look step).** Done 2026-10-16, local relay only. Figures have two feet that step in turn, a head that leans, and a lantern on a swinging arm; bow, wave, cheer, point and sit have their own poses. Drawn by each browser from the walking flag and gesture it already holds; nothing is sent. Reduced motion stops the walk cycle and lantern swing; gesture poses still apply. Waving raises a hand (as before); cheering lifts the head. Tested in `figure.test.mjs`.
- **16. Roadmap review.** Done 2026-10-16: this file rewritten from the CHANGELOG (see "Roadmap reviews"); a test loop runner
  (`tests/loop.mjs`) added for the builders' and testers' counts.
- **17. The clock check.** Done 2026-10-16, local relay only. Each browser tells the lantern its device clock (one number, `ck`)
  and shows a plain note naming the player whose clock differs most from its own by 10 s or more (`CLOCK_WARN_S`), because shades,
  weather, the night hour and the keeper's day all assume clocks agree. It corrects nothing; it only says so. Tested in `clock.test.mjs`.
- **18. One room across both paths.** Done 2026-10-17, local relay and tracker only. The default `auto` joins the lantern through the Nostr
  relays and the BitTorrent trackers at once; a peer heard on both counts once (the first link wins and is the one sent on, the
  second is kept in case the first drops and carries a small keepalive); the page says which paths are open. A Nostr-only and a
  BitTorrent-only player still do not see each other (nothing is relayed); both see every player on both. Tested in
  `both.test.mjs` with three pages (and a fourth) against a relay and a tracker on 127.0.0.1; public relays and trackers are
  unreachable from the sandbox, so online play stays untested.
- **19. The jetty's fishing.** Done 2026-10-17, local relay only. Cast from the jetty or any shore (F), press again when a fish bites (2 s, 3.5 s with reduced motion). Fish are a pure function of the seed and the clock
  (up to `MAX_FISH` 8 present at once round the jetty's end, a slot is `FISH_SLOT_S` 24 s); nothing about them is sent, so none is taken from anyone else. The only new message is `fl`, the tile of a player's float. Two players whose floats are at most
  `SHOAL_RANGE` 4 tiles apart draw a shoal of `SHOAL_FISH` 3 in for both (worked out by each browser from the two floats; fish of the shoal bite from `SHOAL_BITE_R` 2.6 tiles, so a shore with no fish gets bites only from a shoal). A catch is one lamp oil (item 7, saved in the pack,
  3 fuel in a beacon, can be given). Caps tested full: the lamp oil stack (999: the fish is let go, also when it filled between bite and press), the gift machinery for lamp oil (receiver stack, receiver expected list, giver on-its-way list, each also when it fills between offer and accept), a beacon share
  (5 oil make 15, the sixth is refused at the cap of 16; mixed items reach exactly 16), a lit beacon, a line's 45 s limit, a walk away from the float, a shoal that lapses after 12 s of silence. Tested in `fishing.test.mjs`; the fish positions agree between players only if their device clocks agree.

## Roadmap reviews
- **2026-10-16 (after milestone 9, 10 increments since the founding).** What the CHANGELOG taught: (1) every shared
  feature reused one pattern that has held up: positions and timings as pure functions of the seed and the UTC clock
  (nothing sent), and player contributions as grow-only counters per player seed with a cap below "done" and a
  two-player minimum; new items should reuse it before inventing another. (2) Canvas 2D is not the limit yet (5.5 ms a
  frame with the living look, shades 1 to 3 ms, headless and software-rendered), so no move to three.js or WebGL now;
  revisit when a look step cannot be done in 2D or a phone measurement says otherwise. (3) Connections cost the most
  time: half-open WebRTC links, the 57 s offer renewal and late joiners took several runs; online play over the public
  relays has never been reachable from the sandbox, so a second free signalling path is now on the list. (4) Each run's
  5-times test loop over ten files takes most of an hour; keep increments small. (5) Players can help one another in
  many ways now (gifts, beacons, notes, shades, relighting) but nothing remembers it: that is the next step.
  Rooms stay at 12 players (`MAX_PEERS` 11 others); no evidence yet that more are needed.
- **2026-10-16 (milestone 16, after milestone 15; six increments since the last review, held at 16 as the last plan
  said).** What the CHANGELOG of milestones 10 to 15 taught:
  (1) The pattern from the last review held again and grew: weather, the lighthouse and the figures send nothing at all
  (each browser works them out from state it already has), and the rank reuses one clamped number. But four features now
  carry the same caveat, "if their device clocks agree" (weather, shades, the lighthouse's beam edge; the keeper's day
  too). That caveat was written into every patch note and once dropped twice; the cheapest honest answer is to measure
  it in the game, so the clock check came first (milestone 17).
  (2) Testing is the cost that grows: 16 files, about 12 minutes for one pass of all of them (measured this run), so
  the 5-times loop was cut to once in four of the last six runs. Two failures in those runs were the tests' own timing
  (a background tab painting late in `talk`; the fallback test reading its first status text once before the page had
  painted it, seen this run), not game bugs. A loop runner with exact counts now exists (`tests/loop.mjs`); new tests
  should wait for a condition instead of reading once.
  (3) Online play over the public relays and trackers is still untested from the sandbox (HTTP 403 again this run for
  relay.damus.io, nos.lol and tracker.webtorrent.dev); only the owner's single test on an early version covers it. The
  fallback (milestone 13) splits players between two paths that cannot meet; that is the largest multiplayer gap left
  that code can close.
  (4) Most of the game needs two players at once (beacons, notes, shades, gifts, the rank). With few players online, a
  lone visitor finds little to do together and nobody to meet; items that bring players into the same lantern, and
  something worth doing while waiting, now come before more two-player rules.
  (5) Look steps (7, 11, 15) kept to one in three and stayed cheap in Canvas 2D; still no phone measurement, so the next
  look steps stay in 2D and each says what it costs.
  Rooms stay at 12 players (`MAX_PEERS` 11 others).

## Later (in rough order, each one run)
**Open problem (not reproduced):** on 2026-10-16 the game tester ran beacon.test.mjs 0 of 3, failing the WebRTC check "the two pages find each other although one was deaf for 12 s". The next run (2026-10-16, milestone 10) looked first and ran the same file 6 times on the same code: it passed every time (the watchdog check took 13.3 to 13.4 s of its 40 s). The cause of the tester's 0 of 3 is not found; the check stays, and any new failure should be logged with `__longWatch.linkHistory()` and the machine's load.

20. **NEXT: Shadows and flame (a look step).** Trees, rocks and the landmarks throw short soft shadows away from nearby lanterns
    and lit beacons; beacon flames and the lighthouse lamp flicker; drawn by each browser alone, turned down by the
    governor, still under reduced motion. Measure the frame cost at 375 and 1100 px and say it in the notes.
21. **Where the others are.** The lobby says which lantern the most players chose in the last minutes, worked out
    without a server: a page that is in a lantern answers a newcomer's short lobby question with one number (its room)
    over a shared lobby room, numbers only, capped and rate-limited; the lobby suggests that lantern and says the count is
    a guess. Tested with three pages in two lanterns and a fourth in the lobby.
22. **The music stone (gameplay, sound).** A stone near the well plays one of 8 preset notes (ids only, off until sound
    is on, like footsteps); when three players play the stone's seeded tune of the night together within a beat, it glows
    for everyone and counts as help. Rate limits per sender, no recording, nothing saved.
23. **Fair trades.** A two-sided swap (one item for one item) on the offer, accept, commit and receipt machinery; both
    stacks and both on-its-way lists re-checked at each step; every cap tested full and expired, a peer leaving at each
    step, a stack that fills between steps refused.
24. **Dawn and dusk (a look step).** The whole map takes the sky's colour at the night's ends (a cool blue dusk, a grey
    dawn with long shadows), a thin line of horizon over the sea in the sky strip; nothing sent; reduced motion keeps it
    still; contrast of players, lanterns and paths checked in screenshots at both ends of the night.
25. **Weather that matters a little.** From the same seeded weather (nothing sent): in mist, names of players farther
    than a constant number of tiles fade (they stay on the minimap); in rain, shades move a fifth slower. The page states
    both numbers from the constants.
26. **Roadmap review.** Read the CHANGELOG, rewrite this file from what was learned.

## Known problems
- `shades.test.mjs` failed once in a tester run (then passed) at "neither player was ever snuffed". The roadmap guessed
  the start spots; a check of every 50 ms of that slot's two shades against the test's spots (at the pinned hour,
  reach 3.6 tiles) found the friend's light always on the shade whenever it was within a tile of either player, so the
  spots and the rule were not the cause. What the test did not control: the pages loaded on the real clock and stood
  at the arrival point while connecting, where a shade of whatever slot the run fell in could snuff a lone page (about
  6 of 135 slots bring a shade within a tile of some arrival spot); the counter then failed the later check. Fixed in
  the test (pages load on a quiet stretch of the shades' clock and the test checks nobody was snuffed before it
  starts) and pages now keep the last few snuffs (slot, shade, where) for the failure message. The rule stays. After the fix:
  shades 5/5 (140 checks); give, craft, living, quests and shades were later run 3/3 by the tester and page_check passed, but beacon failed 0/3 at its WebRTC link-watchdog check (cause not found; the milestone 10 run could not reproduce it, see "Open problem" above).
- Earlier: `gather.test.mjs` over real WebRTC sometimes failed at "a third player joins and sees both others" (about 3
  of 27 runs) and `talk.test.mjs` once. Cause traced: one WebRTC link times out (Trystero's 10 s handshake) on one side,
  which loses the other side's presence 'hi'. Milestone 6 measured it with a 3-player stress harness (2 failures in 150
  meshes) and found the real shape: a half-open link (a join event on one side only, the other side silent for ever).
  It added two watchdogs (repeat and answer `hi`; rejoin the room when a joined peer stays silent for 8 s, see
  DESIGN.md). In 180 further meshes with them none failed (no round was seen to need a rebuild, so this is
  encouraging, not proof; at the old rate, 2 in 150, 180 clean meshes would happen by chance about 1 time in 11).
  Still to watch: `give` step "when both are back, the reeds arrive" failed 3 times in about 100 WebRTC runs
  (both pages had lost each other; before link history existed), and a real network with TURN needs is untested.

- `living.test.mjs` "the sky strip at one hour looks the same each time" failed about 3 of 10 runs on the code before
  milestone 9 (not caused by it): the strip holds twinkling stars and the glints under it. The check now compares three
  pictures per visit (5 of 5 afterwards, 63 checks); if it fails again, look at which pixels differ.
- `fallback.test.mjs` "at first the page says it is trying Nostr" failed once in this run's first full pass (2026-10-16,
  milestone 16): it read the path text once, right after Enter, while the transport was still starting, and got the
  lobby wording. The test now waits up to 5 s for the first status paint (well inside the 7 s before a switch).
- The first frames after Footsteps is turned on stalled about 0.9 s in headless Chromium while the sound is set up
  (milestone 14); not checked on slow devices.

## Ideas parked (no order)
Shades that follow a lone lantern slowly; a shade that can only be driven off by a lit beacon at the end of a long night;
seasonal islands (a new seed each month, the old ones kept as "past islands"; saves and gift records must carry over);
when a lantern is full, suggest the next one (DESIGN's network model); a TURN-free way to tell players their network
pair cannot connect. Taken into the plan above from this list: fishing (19), the music stone (22), weather that changes
the game (25), trading (23). Done from this list: the world-changing event when every beacon is lit (milestone 14).
