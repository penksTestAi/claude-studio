# The Long Watch: design

Founded 2026-10-15. Read this, `ROADMAP.md` and the end of `CHANGELOG.md` before changing anything.

## Vision
An island at night, and the people who keep its lanterns. Every player arrives carrying a small light; the
dark is the only enemy at first. Together players walk the island, gather what the shore and the woods give
(driftwood, reeds, lamp oil, glass), make lanterns and wicks, and relight the old beacons on the headlands.
Some things one player can do alone; the beacons and the bigger works need several people at once, and when a
lantern room has worked together the island visibly changes: lit paths, rebuilt jetties, a lighthouse that
shines for everyone who enters that room. It fits Vigil because Vigil is a night-shift studio: a vigil is
staying awake to keep watch, and this is a game about keeping watch together, made a little more each night.
It is slow, kind and co-operative by design; competition, if it ever comes, is friendly (who keeps the most
lights burning), never player against player harm.

## Hard rules (from the skill; they never change)
- Multiplayer is the point: every feature works for several players in one room.
- No server, no accounts, free: static files on GitHub Pages, peer to peer, public signalling with no keys.
- **No free text between players.** No chat box, no typed names, no signs. A peer sends numbers and preset ids
  only; every browser turns them into words from its own lists. Names are generated from a 32-bit seed
  (`js/names.js`). Talk will be preset phrases and emotes. The receive path validates every message and has
  no field that is ever rendered as text from the network.
- Honest landing area (in `index.html`, section "What this is, plainly"): made by Claude, an AI model (Vigil is
  not an Anthropic project); peer to peer, so it only works with others online in the same room and there is
  no shared saved world on a server; character saved only in this browser; peers can see your IP address, as
  in a video call; nothing collected; the island comes from a seed.
- Testable without the internet: one transport interface, a local BroadcastChannel implementation, `?net=local`.
- Pinned, vendored, open-source libraries; phones and desktops; light and dark chrome; no console errors.

## Chosen stack
| Part | Choice | Why |
|---|---|---|
| Rendering | Plain Canvas 2D, no engine | A top-down tile island is the right shape for a slow co-operative RPG on phones: it is cheap to draw, needs no assets, no build and no download. three.js (the owner's suggestion) was considered; see below. |
| Networking | Trystero 0.25.4 (MIT), vendored in `vendor/` | Serverless WebRTC with pluggable public signalling, end-to-end encrypted data channels, rooms, targeted sends, peer join/leave events. One small ES-module library with one dependency (`@noble/secp256k1` 3.2.0, MIT, for signing Nostr events). |
| Signalling | Nostr relays (Trystero default, 5 of ~30 public relays at once) | Many independent public relays, no sign-up, no key; the most redundant of the free options per Trystero's own advice. `?net=torrent` switches to public BitTorrent WebSocket trackers as a fallback. |
| Shared world | Generated from a fixed seed (`js/world.js`) | Everyone gets the same island without sending it. Only exactly-rounded arithmetic is used (no `Math.sin`/`exp`/`pow`), so the tiles are identical in every JS engine; the tests compare a fingerprint. |
| Save | `localStorage` key `vigil.longwatch.v1` (seed and position) | "Saved only in your browser", as the landing promises. `?net=local` uses `sessionStorage` so two test tabs are two different players. |

Libraries are vendored rather than loaded from a CDN because jsdelivr is blocked from the build sandbox (so
tests could not load them) and because vendoring pins the exact bytes. See `vendor/README.md`.

## Options rejected (for now)
- **three.js / Babylon.js / PlayCanvas engine.** A 3D world would cost far more per increment (models, camera,
  lighting, phone performance) and add a large dependency, while the game's interest lies in what players do
  together, not in 3D. A later roadmap review may revisit it, for example three.js with an orthographic camera
  over the same tile data; the world, presence and net modules are independent of the renderer.
- **2D engines (Phaser, PixiJS, Kaboom).** Useful for sprites, physics and scenes we do not need yet; plain
  canvas keeps every file readable by the next run. Revisit if sprite animation or many particles arrive.
- **PeerJS public server.** One shared broker run by the PeerJS project (a single point of failure we
  do not control), and PeerJS has no rooms: discovery would need its own scheme.
- **y-webrtc (Yjs).** Excellent CRDT documents, but its default signalling servers are a few community WebSocket
  servers and it is built for documents, not 10 Hz movement. Its ideas (CRDT state, awareness) inform the
  shared-state plan below, without the dependency.
- **MQTT brokers via Trystero.** Trystero ranks MQTT second for robustness, but the public brokers are few
  and their terms for this use are less clear than Nostr's open relays. Easy to add as `?net=mqtt` later by
  vendoring `@trystero-p2p/mqtt`.
- **Supabase / Firebase strategies.** Need an account and a project key: against the rules.
- **Hosted game servers, TURN relays with credentials.** Cost or sign-up. Consequence: two players whose
  networks both block direct WebRTC (some corporate or mobile networks with symmetric NAT) cannot meet. The
  landing page's status line says when no one is reachable; the game cannot fix this without a TURN server.

## Network model
- **Rooms.** Six "lanterns" (`lantern-1` … `lantern-6`), chosen on the landing page and kept in the URL hash
  (`#room=3`). Trystero's `appId` is `vigilstudio-long-watch-v1`; bump the suffix if the protocol breaks
  compatibility. Every browser in a room connects to every other (full mesh), so a room is comfortable up to
  about a dozen players. Later: when a room is full, suggest the next lantern.
- **Transport interface** (`js/net/transport.js`): `send(msg, peerId?)`, `onMessage`, `onPeerJoin`,
  `onPeerLeave`, `status()`, `leave()`. Messages are small JSON objects; one Trystero action `"m"` carries them,
  with a kind field `k`. Implementations: `local.js` (BroadcastChannel), `trystero.js` (Nostr or torrent).
- **Authority.** Each player is the sole authority over their own avatar and inventory. Others draw what that
  player last reported (eased toward it, snapping if it jumps more than 4 tiles). No one can move or change
  someone else's character.
- **Presence protocol v1** (`js/presence.js`): `hi` (seed, position, facing; to every new peer), `st` (position,
  facing, moving flag; 10 Hz while moving, every 2 s standing still), `by` (leaving). A peer that is silent for
  12 s is dropped. All fields are validated and clamped; movement from a peer that has not said `hi` is ignored.
  Every peer is also limited to 30 presence messages per second (`js/guard.js`), at most 8 fields per message, and
  `MAX_PEERS` = 11 others per room.
- **Talk protocol v1** (`js/talk.js`): `say` (`{k:"say",p:id}`, one of 16 preset phrases) and `em` (`{k:"em",e:id}`,
  one of 5 gestures). Ids are integers; the words live in each browser's code. A message with any other field, a
  non-integer or out-of-range id, or from a peer that has not said `hi`, is dropped. Cooldowns (3 s phrases, 1.5 s
  gestures) are enforced by the sender and again by every receiver (with 20% slack), plus a 6/s rate limit per peer.
- **Shared world state (from milestone 3 on).** Things that belong to the room, not to a player (a gathered
  bush, a beacon's progress), are kept as a replicated map of small records, each with a version
  `(lamport, peerId)`. Rules: highest version wins (last writer wins with a deterministic tie-break); counters
  that many players add to (beacon fuel) are per-player grow-only counters summed by everyone (a G-counter CRDT,
  so concurrent contributions never get lost). Contested one-off actions (two players picking the same bush in
  the same instant) are settled by the **arbiter**: the connected peer with the lowest id, which every peer
  can work out by itself; if the arbiter leaves, the next lowest takes over. Resource respawns are derived from
  the seed and wall-clock time, so they need no messages.
- **Late joiners.** On `onPeerJoin` every existing peer sends its own `hi`; for room state, the newcomer asks the
  arbiter (falling back to any peer) for a snapshot, then merges using the rules above. Because the room's state
  lives only in the browsers present, a room that empties forgets everything shared in it; the landing page
  already says so. Personal progress (inventory, skills) is saved locally and survives.
- **Cheating.** Without a server, a modified client can lie about itself. Accepted: the game is co-operative,
  there is nothing to win from others, and peers bound what they accept (positions on the island, speeds within
  reason, preset ids only).

## Signalling from the build sandbox (checked 2026-10-15)
- Public Nostr relays (relay.damus.io, nos.lol, relay.mostr.pub, purplerelay.com, yabu.me, nostr.data.haus) and
  BitTorrent trackers (tracker.openwebtorrent.com, tracker.webtorrent.dev, tracker.btorrent.xyz) were **not
  reachable**: the sandbox's egress proxy refuses the connection (HTTP 403 to CONNECT). jsdelivr is refused too;
  npm is allowed (that is how the libraries were fetched).
- So real online play could not be tested from the sandbox. **Confirmed by the owner on 2026-10-15 (milestone 1):**
  a phone and a separate computer joined the same lantern over the public Nostr relays and saw each other and
  played together. Later entries need not mark basic online play as unverified; still unverified are networks that
  need TURN (some strict mobile or corporate networks) and each new feature over the real network until a person
  tries it.
- What *is* tested: the full real code path (vendored Trystero, Nostr signalling messages, WebRTC data channels
  in Chromium) between two separate browser contexts, with signalling through `tests/nostr-relay.mjs`, a tiny
  Nostr relay the test starts on 127.0.0.1 (the page accepts `?relay=` only for 127.0.0.1/localhost). Only the
  public relays and NAT traversal across real networks remain unchecked.

## File map
```
game/
  index.html            landing, lobby, game panel, honest notes, import map for the vendored modules
  js/main.js            boot: identity and save, room choice, game loop, movement and collision, status line
  js/world.js           seeded island generation, tile queries, spawn points, fingerprint
  js/names.js           generated names and lantern colours from a seed (no free text, ever)
  js/presence.js        presence protocol v1: hi / st / by, validation, smoothing, timeouts
  js/talk.js            gestures and preset phrases: lists, send, validated receive, cooldowns
  js/arrows.js          edge arrows toward off-screen players (pure maths)
  js/guard.js           per-peer rate limiter (token bucket)
  js/input.js           keyboard and drag-joystick input
  js/render.js          canvas drawing: island, avatars, night layer with lantern light, names
  js/net/transport.js   the transport interface, ?net= and ?relay= parsing
  js/net/local.js       BroadcastChannel transport (tests, offline)
  js/net/trystero.js    Trystero transport (nostr, torrent)
  vendor/               Trystero 0.25.4 and @noble/secp256k1 3.2.0, with licences
  tests/presence.test.mjs  Playwright: local two-page test, room isolation, real WebRTC via local relay
  tests/talk.test.mjs      Playwright: phrases, gestures, cooldowns, forged messages, edge arrows (local and WebRTC)
  tests/nostr-relay.mjs    minimal Nostr relay used by the test
```
URL flags: `?net=local|nostr|torrent` (default nostr), `?relay=ws://127.0.0.1:PORT` (tests only), `#room=N`.
`index.html` carries a Content-Security-Policy meta tag (scripts from 'self' plus the import map's hash; change the
import map and the hash must be recomputed). `window.__longWatch` exposes read-only copies of the world, self and peers for the tests.

## Testing
`node game/tests/presence.test.mjs` and `node game/tests/talk.test.mjs` (add `--local` to skip the WebRTC part,
`SHOTS=dir` for screenshots), then
`node tools/page_check.mjs game/`. Every new shared feature gets a check in the test: what one page does,
the other must see.
