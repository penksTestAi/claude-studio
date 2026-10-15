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

### 2026-10-15 · milestone 3 (gathering, shared)
- **Players can now:** gather driftwood on the shore, reeds at the water's edge and oil berries near the woods. The
  island holds 42 spots, 14 of each. Stand next to one (a ring and its name appear) and press `E` or the Gather
  button to pick it. The plant disappears for everyone in your lantern and grows back after one and a half to two
  and a half minutes. If two of you reach for the same one at the same moment, only one of you gets it and the other
  is told someone was first. If you arrive late, you see the spots that are already picked as empty. Your pack
  (driftwood, reeds, oil berries) is shown under the map; for now it is only kept while you stay on the page, and
  nobody else sees it.
- **Network:** new small number-only messages: pick (node index), granted (index, seconds), ok/no to the asker,
  snapshot request and snapshot (up to 16 hidden nodes per message, under the 512-byte cap). The arbiter is the
  player with the lowest id, worked out by each browser alone; when it leaves the next lowest takes over. Hidden
  state merges by "later return time wins"; times travel as remaining seconds, so clocks need not match. Picks must
  be near the asker's last reported position; forged grants from anyone but the arbiter, bad indexes, extra fields,
  out-of-range seconds and oversize snapshots are dropped; 20 gather messages per second per peer.
- **Tested** (`node game/tests/gather.test.mjs`, new): in node, the node list is identical on every build, 14 of each
  kind, no two closer than 4 tiles, all on open ground, and the real gather code runs on a fake mesh of three
  players: two contested picks give one winner and tell the loser, the node returns at its seeded time, a pick
  from a position the arbiter does not believe is refused, forged messages change nothing, 40 hidden nodes go out
  as three snapshot chunks under the size cap. Then on the local transport and again on real Trystero/WebRTC
  through the local Nostr relay: a pick by the E key hides the node for the other page and the other player gets
  nothing, it grows back (respawn pinned to 8 s by `?respawn=`), three contested picks give exactly one winner each
  time, a third player who joins late sees the hidden node, and when the lowest-id player leaves the next one
  becomes arbiter and picks still work. Local mode also forges hostile messages. Browser:
  `chromium_headless_shell-1194` (set `CHROME`).
- **Unverified:** gathering over the public Nostr relays and across real home and mobile networks (the sandbox's
  proxy refuses them; only the local relay was used), how the new plants look and feel on a real phone, screen
  readers. A modified client that is the arbiter could hand itself everything; accepted for now (nothing to win).

### 2026-10-15 · milestone 4 (inventory and giving)
- **Players can now:** keep what they gather. Your pack of driftwood, reeds and oil berries is saved in your own
  browser, so it is still there when you come back, and it is saved the moment it changes. Stand within three tiles
  of another player and press Give driftwood, Give reeds or Give oil berries: they see your offer and one item moves
  only if they press Accept. They can say No thanks, you can take the offer back, and an offer nobody answers ends
  after 20 seconds; in all of those the item stays in your pack. If either of you leaves or closes the page halfway,
  the item is never copied: if it had already left your pack it shows as "on its way" and arrives, once,
  the next time the two of you are in the same lantern (if your browser blocks or clears its saved data, that record is lost). A player who already holds 999 of a kind politely declines more.
- **Network:** new number-only messages: offer (gift number, kind), accept, decline, take-back, commit (gift number,
  kind) and receipt, all addressed to one player and under the 512-byte cap. The item leaves the giver's pack only
  after an accept, and is written to the giver's saved "on its way" list before the commit goes out; the receiver
  adds it only for a gift it accepted and has not received before, and saves before it sends the receipt. The giver
  repeats the commit every 3 seconds to the same receiver (known by seed) until the receipt arrives; repeats add
  nothing. An item whose receiver never returns stays "on its way" for ever, because giving it back could create a
  second copy. Everything from peers is validated (exact fields, integers in range, sender known, giver within about
  5 tiles, 10 messages a second per peer, one offer shown at a time). Everything read back from storage is
  checked and clamped, lists are capped, and another tab of the same browser that saves the character is adopted
  instead of overwritten (that last path is not browser-tested). Storage access is wrapped in try/catch; if it is
  blocked the pack lasts only while the page is open.
- **Tested** (`node game/tests/give.test.mjs`, new): in node, saved-pack rules, then the real giving code on a fake mesh
  with 24 faulted runs (each of the 4 messages dropped, or the giver, the receiver or both killed and restarted from
  their saved state just before or just after it): after every delivered message the item exists exactly once, at the
  end it exists once and nothing is left on its way; a giver away for a long time, repeated commits, a lost receipt,
  timeouts, declines, take-backs, a full pack, range, one offer at a time, and 25 kinds of hostile message. Breaking the
  code on purpose (no save before the commit; no record of received gifts) makes the tests fail. Then two pages on the
  local transport and again on real Trystero/WebRTC through the local Nostr relay: gather two items, an offer moves
  nothing until accepted, accept moves one item and both are told, the pack survives a reload, decline, take-back and
  the receiver leaving move nothing, a gift that was on its way when pages closed arrives once and still once after
  more repeats, and (local only) forged messages change nothing. Browser: `chromium_headless_shell-1194` (set `CHROME`). The existing `talk.test.mjs` edge-arrow check was unreliable (failed 1 of 8 runs on the unmodified code, 3 of 8 with this change): it walked a player toward and away from the other, and water or trees could block the walk. It now teleports to the farthest landmark and back; 8 of 8 and then 5 of 5 pass. Run 5 times each: give 5/5, presence 5/5, world 5/5, gather 5/5, talk 5/5 (after that fix); `page_check` clean.
- **Unverified:** giving over the public Nostr relays and across real home and mobile networks (the sandbox's proxy
  refuses them; only the local relay was used), how the new buttons look and feel on a real phone, screen readers, and two
  tabs of one real browser sharing a saved pack. A modified client can still invent items for itself (nothing to win from
  others). Also limited: if storage is blocked or cleared after the hand-over, the record of a gift on its way is lost; a peer can claim another player's public seed, so a gift meant for one player could be taken by someone using the same seed; a receiver with 32 gifts still expected declines new offers; only the newest 1000 received-gift records are kept.


### 2026-10-15 · milestone 5 (crafting)
- **Players can now:** turn what they gathered into a wick and into amber, jade and azure lanterns. A new Craft panel
  lists the costs (a wick takes 2 reeds and 1 oil berry; the lanterns take wicks plus driftwood, reeds and oil
  berries, more for the brighter ones). Making something uses up its ingredients and gives you the one new thing; it
  never makes extra. If you are missing anything, or the stack you would add to is full (999), nothing is made and
  nothing is used. The lantern you hold decides how far your light reaches (the plain one as before, amber 1.4 times
  as far, jade 1.8, azure 2.3) and it glows in its own colour. Everyone standing near you sees that wider pool of light
  on the ground around you, and sees your lantern's colour in your hand, including players who join later. A
  lantern brighter than the one you hold is picked up as soon as you make it; the Hold buttons switch between the ones you own, and the plain
  lantern, which stays in your pack. Wicks and lanterns are saved in your own browser with the rest of your pack.
  They cannot be given to other players yet.
- **Network:** one new number-only message, the lantern you hold (0 to 3), sent when it changes, to each newcomer and
  every 5 seconds. Receivers drop anything that is not exactly that, from a known player, at most 4 a second. Crafting
  itself stays in the player's own pack and sends nothing. Saved data gains the crafted counts and the held lantern,
  both checked on load (you cannot hold a lantern you do not own).
- **Tested** (`node game/tests/craft.test.mjs`, new): in node, every recipe takes exactly its ingredients and makes
  exactly one thing, each ingredient one short refuses without changing anything, a full stack refuses without using
  or dropping anything (and one below full still works), unknown recipe names including `__proto__` are refused, 400
  random crafts use exactly the raw items they cost, saved data is cleaned, and the lantern message is validated on a
  fake mesh (bad numbers, extra fields, strangers, a flood). Then two pages, on the local transport and again on real
  Trystero/WebRTC through the local Nostr relay: the crafter makes wicks and the three lanterns with the real
  buttons and the pack is checked after each step (it ends with exactly 1 of each raw item left and one lantern of
  each colour); the second player sees the crafter hold each lantern, the light drawn around the crafter at 1.4, 1.8
  and 2.3 times the plain reach, and the ground 5 tiles from the crafter (outside the plain reach) clearly brighter on
  the second player's screen (brightness 84 plain, 125 jade, 173 azure), back to dim when the plain lantern is held;
  the lantern and pack survive a reload and the second player sees it again; a late third player sees it at once and
  a player with 999 wicks is refused without losing anything; when the crafter leaves its light disappears. Local
  only: forged lantern messages change nothing. Before and after screenshots at 375 and 1100 px were checked by eye.
  Browser: `chromium_headless_shell-1194` (set `CHROME`). Runs of each file, 5 in a row: craft, presence, world and give 5/5; talk 4/5 and gather 4/5 (each failed once). The gather failure ("a third player joins and sees both others") is not from this change. Cause found, not fixed: one WebRTC link times out (Trystero's 10 s handshake) on one side, which loses the other side's presence 'hi'. It was observed in about 3 of 27 earlier gather runs (2 of 14 on milestone 4 code, 1 of 5, 0 of 8 extra). While building this test, two early failures of its own were test bugs (reading a page's connection id before it had rejoined; counting an old connection that lingers a few seconds after a reload), fixed by waiting for the new connection; craft then passed 6 of 6 and 5 of 5.
- **Unverified:** crafting and lantern light over the public Nostr relays and across real home and mobile networks (the
  sandbox's proxy refuses them; only the local relay was used), how the glow looks and feels on a real phone and
  whether it still reads well in bright daylight screens, screen readers. A modified client can claim a lantern it
  never made; that only changes how it looks to others.


### 2026-10-15 · milestone 6 (beacons)
- **Players can now:** fuel the island's four old beacons together. Stand within 2.5 tiles of a beacon and a Beacon
  panel appears: add driftwood (1 fuel) or oil berries (2 fuel) and it is burned (used up and gone from your pack). Each
  player's share is counted, and everyone sees the beacon's fuel (a label on the beacon, an ember glow that grows with
  the fuel, and a mark on the minimap). A beacon lights at 12 fuel, but only when at least two different players have
  added some: one player alone can put in up to 16 and it still stays dark until someone else adds even 1. A lit beacon
  burns with a flame and lights a wide area (9 tiles) for everyone who can see it, and takes no more fuel. If two of you
  add at the same moment nothing is lost; late joiners are told what is already in; if you leave and come back your share
  is remembered and you cannot go past your 16. A lit beacon stays lit while anyone is in the lantern; when the last
  player leaves the lantern, the beacons go dark again (nothing is kept on a server), and fuel you spent stays spent.
- **Also changed:** now and then two players in the same lantern never saw each other, because their connection came up
  on one side only; the game now repeats its hello, answers a hello it had not expected, and, if a player stays silent
  for 8 seconds, rejoins the lantern (everyone reconnects briefly; at most 3 times). Measured on a local relay only; not
  proven to remove every case.
- **Network:** three number-only messages. `fu {b,n}` is a player's own total on beacon b (0 to 3); sent when it changes,
  to each newcomer, and every 5 s. `fq` asks a peer for the shares it knows and `fs {b[],s[],n[],f}` answers in chunks
  of at most 10 (each share is beacon, player seed, total), so shares of players who have left also reach newcomers; `fs`
  is accepted only from a peer we asked, while we still wait for that answer (asked again at most twice). Shares are a
  grow-only counter per player (merge keeps the larger): `lit` is derived (sum at least 12 and at least 2 players), so
  nothing about "lit" crosses the network. Limits, each from a constant in `js/beacon.js`: `BEACON_NEED` 12,
  `MIN_PLAYERS` 2, `MAX_OWN` 16 per player per beacon, `MAX_ENTRIES` 24 players counted per beacon (a full list refuses
  new players and never drops one; 24 players hold at least 24 fuel, so such a beacon is already lit and refuses more
  before an item is taken), `BEACON_RANGE` 2.5 tiles to add, `LIT_RADIUS` 9 tiles, worth driftwood 1 and oil berries 2
  (reeds do not burn). Receivers need a known sender, exact fields, whole numbers in range and allow 8 a second per
  sender; the 512-byte message cap is checked for the biggest possible `fs` chunk. Accepted weakness: shares are not
  checked against where the sender stands, and a modified client can claim shares or use another player's seed.
  Watchdogs: presence (`hi` repeated after 3 s up to 3 times; a `hi` from a peer we have not greeted is answered once;
  movement from a stranger makes us send our `hi` once every 2 s, 64 strangers at most) and transport (a peer joined for
  8 s with no message at all makes the transport leave and rejoin the room, at most 3 times, at least 10 s apart).
- **Tested** (`node game/tests/beacon.test.mjs`, new): in node, the shares are a grow-only counter (smaller numbers and
  repeats ignored, 30 shuffled copies with repeats end identical, bad beacons/seeds/amounts such as 0, 17, 1.5, "3" and
  NaN refused), one player alone with 16 fuel does not light a beacon and a second player's 1 fuel does, a lit beacon stays
  lit, 24 counted players refuse a 25th without dropping anyone, the 16 cap refuses a 2-fuel item at 15 and fits a 1-fuel
  one, a missing item or an unknown item (`__proto__`, reeds) is refused without changing the pack, 200 random adds equal
  exactly the fuel the items were worth. On a fake mesh: one item per add and the pack saved in the same step, messages of
  three numbers under the size cap, out of range or too far refused (range 2.5, just inside works), the lit event fires
  once for each page, 21 kinds of bad message and a stranger change nothing, snapshots are chunked and answered to the
  asker only (and a repeat within a second not answered), the biggest chunk fits the cap, 30 forged snapshot seeds make
  at most 24 shares. Presence watchdog on a fake mesh: hi resent after 3 s, three repeats then stop, repeats stop when
  their hi arrives, a hi from an ungreeted peer answered once (no ping-pong), a late join event sends nothing more, 5
  moves from a stranger make 1 hi, 300 strangers cause at most 65. Then two pages, on the local transport and again on
  real Trystero/WebRTC through the local Nostr relay: the Beacon panel is hidden away from beacons and refuses far adds;
  real button presses burn one driftwood; 12 fuel from A alone does not light it on either page and the ground 6 tiles away stays dark;
  B's 2 fuel lights it on both pages (14 fuel, 2 players) and the ground becomes clearly brighter on B's screen
  (brightness 83 to 163); a lit beacon refuses more fuel; A and B each add 6 at the same moment on the second beacon and
  both pages show exactly 12 from 2 players; A's 20 tries on the third beacon add exactly 16 and are refused 4 times
  (also oil berries at the cap) and 16 fuel from one player is still dark; a late third player is told all shares at once
  and its single driftwood lights the third beacon on all three pages; after a reload A is told its old shares back (12, 6
  and 16, so it cannot exceed the cap) and the pack is as saved; after A leaves the beacons stay lit for B and C; after
  everyone leaves a new player finds no fuel. Local only: forged and flooded messages change nothing (a snapshot not asked
  for, extra fields, strings, a stranger; a claimed 16 on a fourth beacon is one player and does not light it). Link
  watchdog (WebRTC): a page that is deaf for 12 s after joining is found by its partner, whose transport rebuilds once.
  A 3-player stress harness (not kept in the repository) opened 150 meshes on the old code (2 failed: a link up on one side
  only, found from the joins and leaves of the two sides) and 180 on the new code (all connected; none needed a rebuild).
  Browser: `chromium_headless_shell-1194` (set `CHROME`). Runs of each file, 5 in a row (two files at a time, the same way as for earlier milestones): beacon 5/5, presence 5/5, talk 5/5, world 5/5, gather 5/5, give 5/5, craft 5/5. An earlier set of runs on the same code had give 3/5 (step "when both are back, the reeds arrive": both pages had lost each other, no link history yet), gather 4/5 (the first connection never completed) and craft 4/5 (a third player never saw both others); those are the half-open links described above (captured in the stress harness) or load, not proven for each; the gather late-joiner failures were the test's 8 s clock (see below).
  Before and after screenshots at 375 and 1100 px were looked at (ember and lit beacon). `page_check` clean.
- **Test fixes (not game bugs):** `gather.test.mjs` failed 7 of 36 runs under 6 parallel runs at "the late joiner's map already hides that node": the node's pinned 8 s respawn had run out before the third player finished connecting (it took 5.5 to 34 s under that load), measured by a new diagnostic line. The WebRTC run now pins 20 s and no longer waits for contested nodes to grow back. `give`, `gather` and `craft` tests now print both pages' peers and link history when a connection check fails.
- **Unverified:** beacons over the public Nostr relays and across real home and mobile networks (the sandbox's proxy
  refuses them; only the local relay was used), how the panel, flame and light look on a real phone, screen readers. A modified
  client can claim shares it did not add, or another player's seed (so "two players" can be faked); there is nothing to
  win from others. The link watchdog fixes the half-open link seen in the stress run; whether it removes every
  "never met" failure is not proven (180 clean meshes), and one `give` failure ("when both are back, the reeds arrive",
  both pages had lost each other) has no captured cause.
