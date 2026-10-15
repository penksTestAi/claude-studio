# The Long Watch: roadmap

One milestone per run, in order. Each must work for several players at once and get a check in
`tests/presence.test.mjs` (or a sibling test). Mark the next one with **NEXT**. A roadmap review is due after
10 increments since the last one (founding: 2026-10-15); it may rewrite everything below "done", never the
working features.

## Done
- **0. Presence.** Seeded island, generated names, six lantern rooms, walk with keys or a drag joystick, see
  everyone in the same room move, leave and timeout handling, local and real (Trystero/Nostr) transports.
  (2026-10-15)

## Next
1. **NEXT: Gestures and preset phrases.** A small wheel of emotes (wave, bow, point, cheer, sit) and about 16
   preset phrases ("Over here!", "Follow me", "Thank you", "Need light", "Goodnight") sent as ids, shown as
   bubbles over the avatar for a few seconds, with a short cooldown. No text ever crosses the network.
   Also: a mini "who is near" indicator (arrows at the screen edge pointing to players off screen).

## Later (in rough order, each one run)
2. **The island worth walking.** Landmarks from the seed (old beacons on headlands, a ruined lighthouse, a
   jetty, a well), a minimap, footstep sounds off by default, light that varies by night hour.
3. **Gathering, shared.** Driftwood, reeds and oil berries at seeded spots; picking one hides it for everyone
   in the room until its seeded respawn. First use of the shared-state rules in DESIGN.md (arbiter for
   contested picks, snapshot for late joiners).
4. **Inventory and giving.** A saved local inventory; hand an item to a nearby player (a two-step offer and
   accept, both sides confirm).
5. **Crafting.** Wicks, lanterns of different colours and reach; a brighter lantern lights more of the map for
   everyone near you.
6. **Beacons.** Fuel a beacon together (G-counter of contributions); when lit it stays lit for that room's
   session and lights a wide area; a lit beacon needs at least two players to light.
7. **The keeper's notes.** Small quests from the seed and the date ("bring three reeds to the north beacon"),
   shared by everyone in a room, finished together.
8. **Shades.** Slow night creatures that put out lights; driven off only by light, and best by several players
   standing together. Co-operative, no player against player harm.
9. **Progression.** Lamplighter ranks and cosmetic lantern styles earned by helping others (lighting someone
   else's lantern counts for more than your own).
10. **Roadmap review.** Read the CHANGELOG, rewrite this file from what was learned, consider rendering
    (three.js?), signalling fallbacks (MQTT), room sizes and what players actually do.

## Ideas parked (no order)
Fishing at the jetty; a shared music stone players can play together with preset notes; weather; a
world-changing event when every beacon in a room is lit; trading with fair offers; seasonal islands (a new
seed each month, the old ones kept as "past islands").
