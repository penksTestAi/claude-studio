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

### 2026-10-15 · milestone 1 (gestures, preset phrases, edge arrows)
- **Players can now:** open Talk (button or `T`) and send one of 5 gestures (wave, bow, point, cheer, sit) or one of
  16 preset phrases ("Over here!", "Follow me", "Thank you", "Need light", "Goodnight", and 11 more). Others see a
  bubble over the avatar with a thin bar that runs down as it fades (4.5 s), or the gesture drawn on the avatar;
  the words also appear in a screen-reader line. Phrases cool down for 3 s and gestures for 1.5 s (buttons show it);
  sitting ends when you walk. Players who are off screen get an arrow at the edge of the map in their lantern colour
  with their distance in tiles.
- **Network:** only `{k:"say",p:id}` and `{k:"em",e:id}`; no text field exists. Unknown, non-integer or out-of-range ids,
  extra fields and unknown kinds are dropped; receivers re-check the cooldown and rate limit per peer. Also added for
  all messages: 30 per second per peer, at most 8 fields, at most 11 other players per room.
- **Also fixed:** `index.html` had no Content-Security-Policy (the design requires one); it now has one (scripts from
  'self' and the import map's hash, no eval, `object-src 'none'`, connections only to wss: and local test relays).
- **Tested** (`node game/tests/talk.test.mjs`): maths for the arrows and the receive path in node; then two pages, on
  the local transport and again on real Trystero/WebRTC through the local Nostr relay: a phrase and a gesture clicked
  on A appear as the same ids on B, a second one is refused during cooldown, B's words come from B's own list, both
  directions work, bubbles and gestures fade, sitting ends on walking, an edge arrow appears when B is off A's screen
  and points at B (angle within 0.2 rad, distance within 1 tile) and disappears when B is back. Local mode also
  forges hostile messages as if from A (bad ids, an extra field, strings, unknown kinds, a burst, a flood of 400 moves)
  and B drops them. `presence.test.mjs` and `node tools/page_check.mjs game/` pass; no console errors.
- **Unverified:** online play over the public Nostr relays or BitTorrent trackers (the sandbox's proxy refuses them) and
  across real home and mobile networks, so this is still marked "not yet verified" on the page; how the gestures and
  bubbles look and feel on a real phone; screen readers.
  Also open: incoming messages have no byte-size cap (fields are counted and validated, but a very large payload is still
  parsed first); the CSP is not confirmed free of violations in a real browser (headless Chromium logged none); the
  talk test failed one check once and passed on two reruns, cause not found.

### 2026-10-15 · milestone 2 (the island worth walking)
- **Players can now:** find seven landmarks on the island: four old beacons on the headlands (one in each quarter), a
  ruined lighthouse, a jetty out over the shallows and a well not far from where everyone arrives. Their names show when
  you get close, and the beacons, lighthouse and well are solid, so you walk around them. A minimap in the corner shows
  the whole island, the landmarks and every player in their lantern colour (button or `M` to hide it). A line under the
  map names the hour and the nearest landmark with its distance and direction. The night now has eight hours (Dusk,
  First watch, Deep night, Midnight, Small hours, Late watch, Grey before dawn, Dawn); the light gets darker toward
  midnight and your lantern reaches further when it is darkest. A night lasts 48 minutes of the clock (UTC) and then
  repeats, the same for everyone. Footsteps are available but off until you press Footsteps; when on, you hear your own
  steps (sand, grass, stone, shallow water and the jetty's planks all sound different) and, more quietly, players
  walking within about 8 tiles.
- **Also fixed:** the little walking bob of avatars (and the jump, wave and pointing movements of gestures) now stops
  when your device asks for reduced motion. Incoming messages that are too large are now ignored.
- **Network:** nothing new is sent. Landmarks and the night hour come from the seed and the UTC clock, so there is no
  message for them. All incoming messages are capped at 512 bytes of JSON (real ones are under 100); larger ones are
  dropped and counted before any game code sees them. The cap runs after Trystero has already decoded the message, so it
  keeps big objects away from the game but does not stop a peer from making the browser decode them (the vendored
  library is untouched). Only the local-test position jump used by tests is added to the read-only test view.
- **Tested:** `node game/tests/world.test.mjs` (new): in node, the island tiles are unchanged (fingerprint
  `d44b09c6`), landmarks are identical on every build (`5611da56`), 4 beacons in 4 quarters, all reachable on foot,
  solid ones block, the jetty is walkable and sounds like wood, the night hour wraps every 48 minutes, light is darkest
  at midnight and smooth between hours, `?hour=` accepts only 0 to under 8, stride and earshot maths, the walking bob is
  zero under reduced motion, the size cap accepts real messages and refuses oversize, non-JSON and circular ones. Then
  two pages on the local transport: same landmark fingerprint, minimap shown with 7 marks and the other player's dot
  in their lantern colour read from its pixels, `M` and the button toggle it, the status text names the well and the
  hour, walking into the well stops, B sees A beside it, footsteps off by default and silent when off, on they play
  steps for own walking and for a nearby player's, off again silences them, midnight is darker than dawn on the same
  pixel, the unpinned light follows the clock, two forged oversize `st` messages (valid except for padding, 6000 and
  600 bytes) are dropped and counted while the same move without padding is accepted, `prefers-reduced-motion` is seen
  by the page, no sideways scroll at 375 px. `presence.test.mjs` and `talk.test.mjs` (including real WebRTC through the
  local Nostr relay) and `node tools/page_check.mjs game/` pass; no console errors. Browser:
  `chromium_headless_shell-1194` (set `CHROME`).
- **Unverified:** online play of this milestone in particular (the sandbox's proxy refuses the public relays; the owner's
  separate test, noted below, covered basic play on the earlier version); the sound of the
  footsteps (Claude cannot hear them, and no audio output was checked, only that steps are scheduled); how the
  landmarks, light and minimap look on a real phone and in bright daylight; screen readers; the jetty is only two
  planks long on this island; the message cap does not stop decoding of a huge message.

> 2026-10-15, owner test (not a new version): the owner joined from a phone and from another computer, on different
> networks, through the public Nostr relays, and multiplayer worked. Basic online play is now verified.
