# The Long Watch: roadmap

One milestone per run, in order. Each must work for several players at once and get a check in
`tests/presence.test.mjs` (or a sibling test). Mark the next one with **NEXT**. A roadmap review is due after
10 increments since the last one (founding: 2026-10-15); it may rewrite everything below "done", never the
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

## Later (in rough order, each one run)
**A roadmap review is due** (10 increments since the founding: milestones 1 to 9 and the watchdog restore). The next run
is in founding mode: read the CHANGELOG, rewrite this file, then build item 10 if time allows.
10. **NEXT: Progression.** Lamplighter ranks and cosmetic lantern styles earned by helping others (lighting someone
   else's lantern counts for more than your own).
11. **Roadmap review.** Read the CHANGELOG, rewrite this file from what was learned, consider rendering
    (three.js?), signalling fallbacks (MQTT), room sizes and what players actually do.
12. **A look step: weather and the shades' sky.** Drifting mist and rain on the island, soft thunder-less storms that thin
    the light, a night sky that darkens when a wave of shades arrives; keep it cheap on phones (one in three increments is
    mainly about the look; the last one was milestone 7).

## Known problems
- `shades.test.mjs` failed once in a tester run (then passed) at "neither player was ever snuffed": the start spots are up to 3 tiles apart from a shade's side, so a lone arrival can snuff before the friend's light reaches it. Decide whether the rule or the spots should change.
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
