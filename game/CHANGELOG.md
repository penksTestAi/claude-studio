# The Long Watch: changelog

Newest at the bottom. Each entry: date, what players can now do, what was tested, what is unverified.

### 2026-10-15 · founding and milestone 0 (presence)
- **Founding.** Researched the stack and wrote `DESIGN.md` and `ROADMAP.md`: Canvas 2D, Trystero 0.25.4 over
  Nostr relays (vendored with `@noble/secp256k1` 3.2.0), seeded world, each player authoritative over
  themselves, a planned replicated-state scheme with an arbiter for later milestones.
- **Players can now:** get a generated name ("Grey Heron 41") saved in their browser, pick one of six lantern
  rooms, walk a 128 x 128 seeded night island (keys or press-and-drag on phones) with water, sand, meadow,
  woods and rocks, and see every other player in the same lantern move with their name and lantern colour.
  Leaving (or closing the tab, or 12 s of silence) removes a player for the others. A status line says how many
  others are here, or whether the signalling relays could be reached.
- **Tested** (`node game/tests/presence.test.mjs`, headless Chromium 1194 via Playwright 1.56.1):
  local transport with two pages in one context: they see each other, build the same island (fingerprint
  `d44b09c6`), see each other's names, see each other's moves to within 0.05 tiles, and leaving removes the
  player; a third page in another lantern sees no one. Real path: two separate browser contexts (one phone
  sized with touch) using the vendored Trystero, Nostr signalling and real WebRTC data channels, with a local
  Nostr relay on 127.0.0.1: same checks, all pass; peers met within 0.4 s in 15 of 15 runs after the test relay was
  made to keep recent events as public relays do (before that, 1 of 10 runs never connected). No console errors.
  `node tools/page_check.mjs game/`: all six views ok.
- **Unverified:** online play over the public Nostr relays or BitTorrent trackers (the sandbox's proxy refuses
  them), WebRTC across real home and mobile networks (no TURN server, so some network pairs will fail), and how
  it feels on a real phone.
