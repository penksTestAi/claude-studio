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

## Later (in rough order, each one run)
6. **NEXT: Beacons.** Fuel a beacon together (G-counter of contributions); when lit it stays lit for that room's
   session and lights a wide area; a lit beacon needs at least two players to light.
7. **The living island (a look step).** Animated water and shore foam, swaying reeds and trees, fireflies near
   lit lanterns, a moon and stars that follow the night hour, softer light edges for coloured lanterns, still honouring
   reduced motion and 60 fps on a phone. (Visual items should stay about one in three; this is the next one.)
8. **The keeper's notes.** Small quests from the seed and the date ("bring three reeds to the north beacon"),
   shared by everyone in a room, finished together.
9. **Shades.** Slow night creatures that put out lights; driven off only by light, and best by several players
   standing together. Co-operative, no player against player harm.
10. **Progression.** Lamplighter ranks and cosmetic lantern styles earned by helping others (lighting someone
   else's lantern counts for more than your own).
11. **Roadmap review.** Read the CHANGELOG, rewrite this file from what was learned, consider rendering
    (three.js?), signalling fallbacks (MQTT), room sizes and what players actually do.

## Known problems
- `gather.test.mjs` over real WebRTC sometimes fails at "a third player joins and sees both others" (about 3 of 27
  earlier runs: 2 of 14 on milestone 4 code, 1 of 5, 0 of 8 extra); `talk.test.mjs` also failed once. Cause traced, not
  fixed: one WebRTC link times out (Trystero's 10 s handshake) on one side, which loses the other side's presence 'hi'.
  Suggested fix: a presence watchdog that rebuilds the transport when a join gets no hi within about 8 s.

## Ideas parked (no order)
Fishing at the jetty; a shared music stone players can play together with preset notes; weather; a
world-changing event when every beacon in a room is lit; trading with fair offers; giving crafted lanterns (needs the same offer, accept and receipt rules, with kinds added to the saved lists); seasonal islands (a new
seed each month, the old ones kept as "past islands").
