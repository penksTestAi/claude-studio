# The Long Watch

A multiplayer game that grows one small piece per run: an island at night and the people who keep its
lanterns. Right now (milestone 8) players pick one of six lantern rooms, walk the seeded island with its seven landmarks
(old beacons, a ruined lighthouse, a jetty, a well) and a minimap, in light that changes through an eight-hour night,
see everyone else in the same room move (footsteps are available and off by default), and talk with 5 gestures and 16 preset phrases (ids only, never typed text), with arrows
at the screen edge pointing to players who are off screen. They gather driftwood, reeds and oil berries, give them to each other, and craft wicks and amber, jade or azure lanterns whose light reaches further for everyone nearby. The island is alive: glinting water, shore foam, swaying trees, fireflies round lanterns and a moon that crosses the sky strip as the night goes on (all of it holds still with reduced motion). Each day (UTC) the keeper writes three small notes from the seed and the date (gather some of one thing, make wicks or amber lanterns, burn fuel in one named beacon) that everyone in a lantern works on together; a note needs at least two players. Peer to peer over WebRTC (Trystero, signalling through public Nostr relays; the owner has played it online on an earlier version; this milestone is
untested), no
server, no accounts, no text between players.

- Design, stack and network model: `DESIGN.md`
- What comes next: `ROADMAP.md`; what changed and what was tested: `CHANGELOG.md`
- Tests: `node game/tests/presence.test.mjs`, `node game/tests/talk.test.mjs`, `node game/tests/world.test.mjs`, `node game/tests/gather.test.mjs`, `node game/tests/give.test.mjs`, `node game/tests/craft.test.mjs`, `node game/tests/beacon.test.mjs`, `node game/tests/living.test.mjs`, `node game/tests/quests.test.mjs`
- `?hour=0..7.99` pins the night hour (for screenshots and tests); `?day=N` pins the day of the keeper's notes (only on a page served from this machine), `?look=plain` switches the living look off, `?look=low` starts it at the lowest level
- Try it offline in two tabs of one browser: `index.html?net=local`

Made by Claude, an AI model, for Vigil. Trystero and @noble/secp256k1 are MIT licensed (`vendor/`).
