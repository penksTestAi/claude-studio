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
- **Gathering protocol v1** (`js/gather.js`, nodes in `js/resources.js`, built in milestone 3): 42 nodes (14 each of
  driftwood, reeds, oil berries) come from the seed and are known by index only. `pk {n}` (ask the arbiter),
  `gt {n,r}` (arbiter to all: node n hidden for r seconds), `ok {n}` / `no {n}` (arbiter to the asker), `rq` and
  `sn {n:[..],t:[..],f}` (snapshot, at most 16 entries a chunk, `f`=1 on the last). The state is "node n is hidden
  until T"; merging keeps the later T; T travels as remaining seconds and becomes the receiver's own clock time, so
  clocks need not agree, and everyone holds the full map (any peer can answer `rq`). `gt` counts only from the
  arbiter as the receiver sees it; the arbiter refuses picks farther than 2.6 tiles from where it last saw the asker
  (players may only pick within 1.3), and a newcomer that has not yet heard a snapshot (1.5 s at most) refuses to
  decide. The pack is saved since milestone 4. Accepted weakness: a modified client that is the arbiter
  could grant itself everything; there is nothing to win from others. `?respawn=N` (1 to 600 s) shortens the
  respawn for tests.
- **Giving protocol v1** (`js/give.js`, saved state in `js/inventory.js`, milestone 4): `of {t,i}` offer, `ac {t}`
  accept, `dc {t}` decline, `cx {t}` take back, `cf {t,i}` commit, `rc {t}` receipt, all to one peer. The item leaves
  the giver only on `ac`, is saved in the giver's `out` list first, and goes to the receiver on `cf` only if it is in
  the receiver's saved `exp` list; `got` stops repeats. The giver repeats `cf` every 3 s to the same seed until `rc`.
  A gift whose receiver never returns stays in `out` (never given back, so never copied; it is lost only if storage is blocked or cleared). `exp` is never trimmed: a receiver with `MAX_EXP` (32) entries declines new offers and `accept()` refuses; `got` keeps the newest `MAX_GOT` (1000). Known limits: a peer can claim another player's public seed and so receive gifts meant for them; storage cleared after the hand-over loses the record. Saved key
  `vigil.longwatch.v1` now holds `inv`, `out`, `exp`, `got` next to seed and position, all checked on load.
- **Crafting protocol v1** (`js/craft.js`, saved fields in `js/inventory.js`, milestone 5): nothing about crafting
  itself crosses the network, because it only converts items in the player's own pack: `tryCraft` checks every
  ingredient and the result's stack (`CRAFT_STACK` = 999) first and changes the pack only if all of it can be paid, so
  a refused craft changes nothing and nothing is ever dropped. Recipes (wick: 2 reeds, 1 oil berry; amber: 1 wick, 2
  driftwood, 1 berry; jade: 2 wicks, 3 driftwood, 3 reeds, 2 berries; azure: 3 wicks, 4 driftwood, 4 reeds, 4
  berries) live in `RECIPES`, the lantern reach multipliers (1, 1.4, 1.8, 2.3 times the night's reach) and glow
  colours in `LAMPS`. The only message is `lt {l}` (the lantern held: 0 plain, 1 amber, 2 jade, 3 azure), sent on change,
  to each newcomer (after its `hi`) and to everyone every 5 s; a receiver needs the sender to have said hello, exactly
  two fields, `l` a whole number 0 to 3, and allows 4 a second per sender. Every browser draws each player's pool of
  light with that player's own reach, so everyone nearby sees the same reach. Saved key gains `cr` (wick, amber,
  jade, azure) and `lamp` (checked on load; you can only hold a lantern you own). Accepted weakness: a modified client
  can claim a bigger lantern than it owns, which only changes how it looks to others (no gameplay depends on it yet).
  Crafted items are not part of giving yet, so they cannot be copied that way.
- **Beacon protocol v1** (`js/beacon.js`, milestone 6): the island's four old beacons are fuelled together. The shared
  state is one whole number per player per beacon (that player's share of fuel), a grow-only counter keyed by the
  player's seed: merging keeps the larger number, so order, repeats and crossing messages never lose or lower a share.
  A beacon is lit when the shares add up to `BEACON_NEED` (12) and at least `MIN_PLAYERS` (2) players have a share,
  so it is derived, never sent, and (the counters only grow) stays lit while anyone who holds the state is in the
  room; a room that empties forgets it, and fuel a player spent stays spent. Driftwood is worth 1 fuel, oil berries 2
  (`WORTH`); a player must stand within `BEACON_RANGE` (2.5) tiles; one player's share is capped at `MAX_OWN` (16),
  so one player alone could reach the fuel but never lights it; a lit beacon takes no more. At most `MAX_ENTRIES`
  (24) players are counted per beacon, and a full list refuses new ones (it is always already lit, so a real player's
  item is refused before it is taken). Adding fuel changes the pack and saves it before anything is sent. Messages:
  `fu {b,n}` (my total on beacon b, sent on change, to each newcomer, every 5 s), `fq` (newcomer asks a peer) and
  `fs {b:[],s:[],n:[],f}` (up to 10 shares a chunk, so a snapshot also carries the shares of players who left); `fs`
  is accepted only from a peer asked and still being waited for (asked again at most twice, 2.5 s apart). Receivers
  need a known sender, exact fields, whole numbers in range and allow 8 a second per sender. The shares are not
  checked against where the sender stands (accepted weakness: a modified client can claim shares, and a claimed seed
  of someone else counts as another player; there is nothing to win from others). A lit beacon draws a flame and a
  wide pool of light (`LIT_RADIUS` 9 tiles) for everyone, and a warm mark on the minimap.
- **Presence watchdog** (milestone 6, in `js/presence.js`): over real WebRTC a link can come up on one side before the
  other and the single `hi` sent at that moment is lost, so the two never see each other. Now a peer we have greeted
  but not heard a `hi` from gets our `hi` again after 3 s (three repeats at most), a `hi` from a peer we have not
  greeted is answered with ours (once), and movement from an unknown peer makes us send our `hi` (once every 2 s, 64
  strangers at most). (Not in the game since commit 2fc04d5, which dropped it by accident; see ROADMAP.md, Known problems. What it did:) A second, lower watchdog was added to the Trystero transport (`js/net/trystero.js`): in a stress run
  of 150 three-player meshes two failed because a link came up on one side only (that side got a join event, the other
  side's handshake timed out and it never sent anything), and the first side stayed "joined" for ever. A peer that has
  been joined for `STALL_MS` (8 s) without any message from it (every client sends one at least every 2 s) makes the
  transport leave and rejoin its room (the game is told each peer left, then each that returns joins again), at most
  `MAX_REBUILDS` (3) times and `MIN_GAP_MS` (10 s) apart, so a silent hostile peer can cost a few reconnects but not a
  loop. `?mute=N` (also dropped in 2fc04d5; loopback pages only, 1 to 30 s) made a page neither send nor hear for N seconds, for the test.
- **Late joiners.** On `onPeerJoin` every existing peer sends its own `hi`; for room state, the newcomer asks the
  arbiter (falling back to any peer) for a snapshot, then merges using the rules above. Because the room's state
  lives only in the browsers present, a room that empties forgets everything shared in it; the landing page
  already says so. Personal progress (inventory, skills) is saved locally and survives.
- **Cheating.** Without a server, a modified client can lie about itself. Accepted: the game is co-operative,
  there is nothing to win from others, and peers bound what they accept (positions on the island, speeds within
  reason, preset ids only).

## The living look (milestone 7, `js/living.js` and `js/render.js`)
Everything is drawn by each browser on its own from the seed and the clock; no message carries any of it. Per frame, only
the visible tiles are walked, using two byte arrays built once (`classify`: which tile glints, grows grass or is a tree;
which sides of a shallow tile touch dry land). Trees keep their dark crown in the baked map; the lit crown and flecks are
drawn each frame offset by `sway`. Shore foam is a pair of short bars per wet edge washing in and out; glints are 2-pixel
bars that blink; grass blades are two strokes on 30% of grass tiles (at most 220 a frame, one path per colour); reeds
sway in `drawNode`. Fireflies are a pure function of time (`fireflies`): 7 round a lit beacon, 3 round a coloured lantern,
1 round a plain one. The sky strip (top centre) shows the moon crossing from dusk to dawn (highest at hour 4) and 30
fixed stars faded by the night's darkness. Coloured lanterns get a smoothstep falloff (`softStops`, 5 colour stops).
**Measured cost lesson:** a first version used 9 colour stops on the lantern gradients and cost about 6.5 ms a frame more
(headless Chromium, software canvas, 375 px at devicePixelRatio 2); with 5 stops the whole living layer costs about 1 ms.
Keep gradients at 5 stops or fewer. Reduced motion: sway, foam position, glints, fireflies and stars hold still (the
water and trees are still drawn, only not moving); the test compares six whole-canvas pictures and finds them identical.
The governor (`createGovernor`) lowers the level when 90 frames average over 34 ms and never raises it again in the
same visit; level 1 drops glints, grass and most fireflies, level 0 drops fireflies too. `?look=plain` is the old look
without any of it (also used to compare cost), `?look=low` starts at level 0. `window.__longWatch.perf()` returns frame
and draw times of the last 240 frames, `setLevel(n)` sets the level (tests).

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
  Nostr relay the test starts on 127.0.0.1 (the page accepts `?relay=` only for 127.0.0.1/localhost, and main.js ignores it entirely when the page itself is served from any other host, such as the live site). Only the
  public relays and NAT traversal across real networks remain unchecked.

## File map
```
game/
  index.html            landing, lobby, game panel, honest notes, import map for the vendored modules
  js/main.js            boot: identity and save, room choice, game loop, movement and collision, status line
  js/world.js           seeded island generation, landmarks (beacons, lighthouse, jetty, well), tile queries, surfaces, fingerprints
  js/names.js           generated names and lantern colours from a seed (no free text, ever)
  js/presence.js        presence protocol v1: hi / st / by, validation, smoothing, timeouts
  js/resources.js       seeded gathering spots (driftwood, reeds, oil berries), respawn times (pure)
  js/beacon.js          beacons: shares counter (G-counter), lighting rule, fuel messages, snapshot for newcomers
  js/craft.js           crafting recipes, lantern table (reach, glow), the `lt` lantern message (rules are pure)
  js/give.js            giving: offer, accept, commit, receipt; faults never copy or lose an item
  js/inventory.js       saved pack and gift lists: checks, caps, adopting another tab's save (pure)
  js/gather.js          shared gathering: arbiter, hidden-until map, snapshots, validation
  js/talk.js            gestures and preset phrases: lists, send, validated receive, cooldowns
  js/arrows.js          edge arrows toward off-screen players (pure maths)
  js/guard.js           per-peer rate limiter (token bucket)
  js/input.js           keyboard and drag-joystick input
  js/nightclock.js      the eight-hour night from the UTC clock: light, tint, lantern reach (pure)
  js/minimap.js         minimap drawing, compass words, nearest-landmark text
  js/sound.js           footsteps: stride counting, earshot gain, synthesised sounds (off by default)
  js/living.js          the living island, pure parts: which tiles glint, foam or sway, sway and foam motion, moon and stars by hour, fireflies, soft light edges, the slow-device governor
  js/render.js          canvas drawing: island, avatars, night layer with lantern light, names, and the living layer (water, foam, sway, fireflies, sky strip)
  js/net/transport.js   the transport interface, ?net= and ?relay= parsing
  js/net/local.js       BroadcastChannel transport (tests, offline)
  js/net/trystero.js    Trystero transport (nostr, torrent); the link watchdog is missing since 2fc04d5, see ROADMAP.md
  vendor/               Trystero 0.25.4 and @noble/secp256k1 3.2.0, with licences
  tests/presence.test.mjs  Playwright: local two-page test, room isolation, real WebRTC via local relay
  tests/talk.test.mjs      Playwright: phrases, gestures, cooldowns, forged messages, edge arrows (local and WebRTC)
  tests/world.test.mjs     node checks plus two local pages: landmarks, minimap, footsteps, light, reduced motion, size cap
  tests/gather.test.mjs    node checks of nodes and the arbiter on a fake mesh, then local and WebRTC pages: picks, contested picks, respawn, late joiner, arbiter leaving, forged messages
  tests/give.test.mjs      node checks of saved-pack rules and giving under faults, then local and WebRTC pages: offer, accept, reload, decline, take-back, leaving, gift on its way, forged messages
  tests/craft.test.mjs     node checks of recipes (conversion only, refusals, full stacks, saved data, the lantern message), then local and WebRTC pages: a second player sees the lantern's reach (drawn radius and ground brightness), late joiner, reload, full stack, forged messages
  tests/beacon.test.mjs    node checks of the shares, caps, fuel messages and the presence watchdog, then local and WebRTC pages: fuel shared, one player alone cannot light, simultaneous adds, light on the ground, late joiner, reload, leaving, empty room, forged messages
  tests/living.test.mjs    node checks of tiles, motion, moon, fireflies, governor, then local and WebRTC pages: B's fireflies follow the lantern A holds, levels, reduced motion holds every pixel still, sky differs by hour, `?look=` flags, measured frame times
  tests/nostr-relay.mjs    minimal Nostr relay used by the test
```
URL flags: `?net=local|nostr|torrent` (default nostr), `?mute=N` (tests only), `?hour=0..7.99` (pin the night hour), `?relay=ws://127.0.0.1:PORT` (tests only), `?look=plain|low` (turn the living look off or start it at its lowest level), `#room=N`.
`index.html` carries a Content-Security-Policy meta tag (scripts from 'self' plus the import map's hash; change the
import map and the hash must be recomputed). `window.__longWatch` exposes read-only copies of the world, self and peers for the tests.

## Testing
`node game/tests/presence.test.mjs`, `node game/tests/talk.test.mjs` and `node game/tests/world.test.mjs`, `node game/tests/gather.test.mjs`, `node game/tests/give.test.mjs`, `node game/tests/craft.test.mjs`, `node game/tests/beacon.test.mjs`, `node game/tests/living.test.mjs` (add `--local` to skip the WebRTC part,
`SHOTS=dir` for screenshots), then
`node tools/page_check.mjs game/`. Every new shared feature gets a check in the test: what one page does,
the other must see.

Note on vendoring: the vendored Trystero stays byte-identical but runs with an `rtcPolyfill` wrapper (`warmRenewals` in `js/net/trystero.js`) so that renewing an old pooled offer keeps its data channel; without it, late joiners after about a minute of idle often never connected. A rarer peer-join race remains unexplained.
