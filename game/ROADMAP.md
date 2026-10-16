# The Long Watch: roadmap

One milestone per run, in order. Each must work for several players at once and get a check in
`tests/presence.test.mjs` (or a sibling test). Mark the next one with **NEXT**. A roadmap review is due after
10 increments since the last one (last: 2026-10-16, after milestone 9); it may rewrite everything below "done", never the
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
  as one number and saved in your own browser. Crafted things cannot be given yet. (2026-10-15, local relay only)

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

- **9. The shades.** Waves of 0 to 4 slow hooded creatures (a pure function of the seed and the UTC clock, so nothing about
  where they are is sent) circle landmarks and snuff a lantern for 14 s; light-seconds put on a shade are a grow-only
  counter per player, a shade is driven off at 20 from at least 2 players (one alone adds at most 19), a friend's lit
  lantern on a shade holds it back, a friend nearby relights you, a lit beacon is safe ground. Drawn with a real figure
  (hood, eyes, arms, swaying hem, sparks where light burns it, a ring that fills). (2026-10-16, local relay only)

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

## Later (in rough order, each one run)
**Open problem before item 10:** on 2026-10-16 the game tester ran beacon.test.mjs 0 of 3; it fails the same WebRTC check every time ("link watchdog: the two pages find each other although one was deaf for 12 s"), local and node parts pass. Cause not found; the next run looks at it first. Earlier "beacon 5 of 5" notes are stale.

10. **NEXT: Progression, small and shared.** A "lamplighter" rank earned only by helping others: relighting a friend's
    snuffed lantern, light on a shade that is then driven off together, a gift that arrives, fuel in a beacon that lights
    with others, a keeper's note finished together. Counted and saved in your own browser; your rank (a small number)
    is told to the room and drawn as a trim on your lantern and a title beside the generated name (no text crosses the
    network, receivers clamp the number). Cosmetic only: a modified client can claim any rank, and the page says so.
11. **A look step: weather and the shades' sky.** Drifting mist and light rain from the seed and the clock, a sky strip
    that darkens when a wave of shades arrives; cheap on phones, still under reduced motion.
12. **Giving crafted things.** Wicks and lanterns go through the same offer, accept, commit and receipt as gathered
    items (kinds added to the saved lists, every cap tested full and expired, a peer leaving midway).
13. **A second way to find each other.** When the Nostr relays cannot be reached, try a second free signalling path
    with no sign-up (BitTorrent trackers or MQTT through Trystero), say on the page which one connected, and test the
    fallback locally; record whether the public ones were reachable.
14. **The long watch kept.** When all four beacons in a lantern are lit at once, the ruined lighthouse lights for
    everyone there until the room empties, and the shades stay away from its beam (derived, nothing new sent).
15. **A look step: people.** Better character figures with a walk cycle, lantern swing and gesture poses drawn in code.
16. **Roadmap review.** Read the CHANGELOG, rewrite this file from what was learned.

## Known problems
- `shades.test.mjs` failed once in a tester run (then passed) at "neither player was ever snuffed". The roadmap guessed
  the start spots; a check of every 50 ms of that slot's two shades against the test's spots (at the pinned hour,
  reach 3.6 tiles) found the friend's light always on the shade whenever it was within a tile of either player, so the
  spots and the rule were not the cause. What the test did not control: the pages loaded on the real clock and stood
  at the arrival point while connecting, where a shade of whatever slot the run fell in could snuff a lone page (about
  6 of 135 slots bring a shade within a tile of some arrival spot); the counter then failed the later check. Fixed in
  the test (pages load on a quiet stretch of the shades' clock and the test checks nobody was snuffed before it
  starts) and pages now keep the last few snuffs (slot, shade, where) for the failure message. The rule stays. After the fix:
  shades 5/5 (140 checks); give, craft, living, quests and shades were later run 3/3 by the tester and page_check passed, but beacon failed 0/3 at its WebRTC link-watchdog check (cause not found); the next run
  looks at the beacon failure first.
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

## Ideas parked (no order)
Fishing at the jetty; shades that follow a lone lantern slowly; a shade that can only be driven off by a lit beacon at the end of a long night; a shared music stone players can play together with preset notes; weather; a
world-changing event when every beacon in a room is lit; trading with fair offers; giving crafted lanterns (needs the same offer, accept and receipt rules, with kinds added to the saved lists); seasonal islands (a new
seed each month, the old ones kept as "past islands").
