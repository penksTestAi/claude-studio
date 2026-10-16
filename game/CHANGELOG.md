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
  win from others. The link watchdog fixed the half-open link seen in the stress run; whether it removes every
  "never met" failure is not proven (180 clean meshes), and one `give` failure ("when both are back, the reeds arrive",
  both pages had lost each other) has no captured cause.

- **Also fixed (networking for every milestone):** a player joining a room that others had been in for about a minute or more often could not connect (Trystero renews pooled offers older than about 57 s and the rollback dropped the data channel). `js/net/trystero.js` now wraps RTCPeerConnection so the renewal keeps the channel; the gather test failed about half the time before, and after the fix passed 6 of 6 in one run, then failed 1 of 3 in another, so a rarer handshake race remains unexplained (two peers connect, only one side fires peer-join). Tested only in headless Chromium; not on Firefox, Safari or real networks; a workaround outside the vendored library, not reported upstream.

### 2026-10-16 · milestone 7 (the living island)
- **Players can now:** see the island move. The water glints and the shallows foam against the shore, washing in and
  out; tree crowns, grass blades and reeds sway in the wind; fireflies drift round every lantern (more, in the
  lantern's colour, round amber, jade and azure ones, and a ring of them round a lit beacon), so you can see at a glance
  who is carrying what. A small sky strip at the top of the map shows the moon crossing from dusk to dawn and the stars
  coming out toward midnight and fading before morning. The edges of coloured lanterns' light are softer and melt into
  the dark. If your device asks for reduced motion, all of it holds still (the same picture, not moving); and a slow
  device lowers the extras by itself. Add `?look=plain` to the address for the old look.
- **Tested** (`node game/tests/living.test.mjs`): in node, which tiles glint, foam and sway (water only, shallow edges
  against dry land only, all 643 trees), sway under one source pixel, steady values under reduced motion, the moon's path,
  stars by darkness, fireflies bounded and a pure function of time, the soft-edge stops, the governor (89 slow frames do
  not lower it, 90 do, a pause is ignored, it never rises). Then two pages, on the local transport and again on real
  Trystero/WebRTC through the local Nostr relay: B draws fireflies round both lanterns, 3 more when A holds the jade
  lantern (told over the transport), they go when A puts it away, levels 1 and 0 draw fewer and none; the local run sees 6 different
  pictures in 6 while everyone stands still; with reduced motion 6 whole-canvas pictures over 1.8 s are identical;
  the sky strip differs at hours 1, 3.5 and 7.9; `?look=plain` and `?look=low` work; no console errors. Before and
  after screenshots at 375 and 1100 px were looked at (`?look=plain` against the living look, shore with sand, water, trees,
  grass and a jade lantern at the night's middle). `page_check` clean. `world` and `craft` (the light and reach checks)
  pass with the softer edges.
- **Measured** (headless Chromium, software canvas, no GPU, so a rough bound and not a phone): at 375 px and devicePixelRatio 2,
  walking for 8 s, the old look drew a frame in 4.6 ms on average (p95 7.0) and the living look in 5.5 ms (p95 7.6), both at
  60 fps. With the CPU throttled 4 times (a rough stand-in for a phone): both about 20 fps, the old look 20.0 ms a frame
  to draw and the living look 21.0 ms, so the old drawing code is the limit, not the new layer; at 6 times, both about 14
  fps. The governor stepped down to level 1 in those throttled runs. Nobody has run it on a real phone. A first version with
  nine colour stops on the lantern gradients drew 40 fps at 1 times (11.6 ms a frame), 6.5 ms of it from the gradients alone; five stops
  brought it back to 60 fps, so the limit is noted in DESIGN.md.
- **Network:** none. Everything is drawn by each browser alone from the seed and the clock; what B sees of A's lantern is the
  existing lantern message. New: `?look=plain|low` and a read-only `perf()` for the tests.
- **Unverified:** how it looks and runs on a real phone (frame rates above are from headless Chromium on software
  rendering), whether the sky strip crowds the top of a small screen with the arrows and the minimap, online play over
  the public Nostr relays (the sandbox cannot reach them; only the local relay was used), and reduced motion on a real device
  (checked with the browser's emulated setting). At the time of writing the `beacon` test failed at one existing step; fixed in the 2026-10-16 "link watchdog restored" entry.

### 2026-10-16 · link watchdog restored
- **Also fixed:** the transport link watchdog and the `?mute=` test hook were dropped by accident in commit 2fc04d5 and are restored from c4e5c53; the Trystero offer-renewal fix from 2fc04d5 is kept. The `beacon` test passed 5 of 5 runs on a local relay. Online play over the public relays was not tested. Players see no change.

### 2026-10-16 · milestone 8 (the keeper's notes)
- **Players can now:** read three small notes from the keeper each day, in a new "Keeper's notes" panel, and finish them together with everyone in the same lantern. Every day (UTC) the island's seed and the date make the same three notes for everyone: gather some of one thing (for example "Gather 8 driftwood together"), make some wicks or amber lanterns, and burn some fuel in one named old beacon (for example "Burn 7 fuel together in the south-west beacon"). Whatever you gather, make or burn for a note is added to a shared count that everyone in the lantern sees at once, with how many players have helped. A note is finished when the count reaches the number asked and at least two players have helped; one player can add at most one less than the number, so no single browser can finish a note alone. Players who join later are told where the notes stand. The notes start again at 0 when the lantern empties and at 00:00 UTC; progress is not saved anywhere, and your pack is untouched beyond what the job itself uses.
- **Network:** new messages, numbers only. `qp {q,d,n}` (my total on note q for day d; sent on change, to each newcomer and every 5 s), `qq {d}` (a newcomer asks a peer) and `qs {d,q[],s[],n[],f}` (a snapshot, up to 10 shares a chunk, accepted only from a peer asked and still being waited for, asked at most 3 times). Each player's share is a grow-only counter keyed by the player's seed (merging keeps the larger number), so crossing messages never lower a share. A receiver needs a known sender, exact fields, whole numbers in range (a share is 1 to need - 1, at most 8), the same day as its own, at most 8 messages a second per sender, at most 24 players counted per note (a full list refuses a new player and drops nobody). Work done while the room's counters are not yet heard (a peer is present and has not answered, 6 s at most) is held back and added to the share the others hold for you, so a reload does not restart your share at 0 beside the number others remember. Midnight is read from each browser's own UTC clock; messages carry the day and one with another day is dropped, so a few seconds of clock difference can briefly hide progress around 00:00 UTC. A note's words come from its numbers in each browser's own lists; nothing typed crosses the network. New: `js/quests.js`, `?day=N` (a whole number 0 to 99999 that pins the day; honoured only on a page served from this machine, like `?relay=`). Removed behaviours: none (no existing file lost a flag or hook; `main.js` gained the panel, the three credit calls from the gather, craft and beacon events, and a `quests()` read-only view).
- **Tested** (`node game/tests/quests.test.mjs`, 5 runs of every test file, one file at a time, nothing else running, headless shell Chromium, each run including the WebRTC part through the local relay: presence 5/5 (18 checks each), talk 5/5 (58), world 5/5 (51), gather 5/5 (80), give 5/5 (107), craft 5/5 (166), beacon 5/5 (161), living 5/5 (63), quests 5/5 (130); `page_check` clean): in node, the notes as a pure function of seed and day (400 days all in range, all three gather items, both craft items and all four beacons occur, days differ, another seed differs), the share rules (never lowered, a bad share refused in 15 shapes, one player alone one short of done, two finish it, 24 players per note refuse a 25th and drop nobody), and the module on a fake mesh (credits count at once when alone and stop at the cap; with a peer present they are held back and then added to the share the snapshot says you already hold; a peer that never answers does not stall us; a peer leaving mid-snapshot stops the wait and its late snapshot is ignored; 25 malformed, wrong-day, stranger and unasked-snapshot messages change nothing; a flood of 500 stays inside the limits; midnight starts new notes at 0; a pinned day does not move). Then two pages on the local transport and again on real Trystero/WebRTC through the local Nostr relay: both show the same three notes the code makes for day 5, each note is worked by A past its cap (cap counts, the rest does not) and B sees "cap of need from 1 player, not done", B adds one and both pages say Done, a third player who joins late hears all three done with the same totals, A leaves, reloads and re-enters and its shares come back from the others (not 0) and cannot be raised, a fourth page on the next day shares the lantern and sees none of today's progress, and (local run) forged messages and a 500-message flood change nothing. No console errors. Screenshots of the panel before and after at 375 and 1100 px were looked at. Writing the `?day=` check showed `pickDay("")` returned day 0 for a missing flag; it is fixed before this entry (the node check failed first, then passed).
- **Unverified:** online play over the public Nostr relays (the sandbox cannot reach them; only the local relay was used), how the panel looks and reads on a real phone and with a screen reader, a lantern whose players' clocks differ by minutes (the day would differ for them and they would not share notes), and whether three notes a day are the right amount.

### 2026-10-16 · milestone 9 (the shades)
- **Players can now:** meet the shades: slow, hooded creatures of the night that drift in off the sea, circle one of the island's landmarks for about a minute and drift away again. They hurt no one and take nothing. A shade that reaches you puts your lantern out for 14 seconds: your light shrinks to a dull ember with a curl of smoke, and everyone sees it. Light drives shades off, and the more of you stand together the better. Every second your lit lantern reaches a shade you add one light-second to it; when a shade has 20 light-seconds from at least 2 different players it is driven off in a burst of motes and gone for the rest of that wave (one player alone can add at most 19, so a shade always takes two). While another player's lit lantern is on a shade, it cannot snuff you: it is held back, so a friend whose light reaches the shade keeps your light safe. If your lantern is out, a player with a lit lantern who comes within two and a half tiles relights it after a second and a half, and then no shade can snuff you again for 6 seconds. Inside the light of a lit beacon a shade cannot snuff anyone. A new Shades panel says how many shades are out, how far and which way the nearest one is, and how much light it has; a small violet mark on the minimap shows each one; waves of 0 to 4 shades arrive every few minutes, the same for everyone in the lantern. Shades are drawn as cold hooded mist with two pale eyes and a ragged hem that sways; they thin, shrink and bend away from your light and throw off sparks where it burns them, and a ring at their feet fills as the light-seconds come in. With reduced motion they hold their pose (they still drift slowly along their path, since that is where the game says they are).
- **Network:** one new state message and the same three-message share pattern as the beacons and the keeper's notes, numbers only. `sf {z}` (my lantern is out 1 or lit 0; sent on change, to each newcomer and every 5 s; the receiver lets a "1" lapse by itself after 20 s, so a silent or lying peer cannot keep anyone dark), `hp {s,i,n}` (my own total of light-seconds on shade i of slot s), `hq {s}` (a newcomer asks a peer) and `hs {s,i[],p[],n[],f}` (a snapshot, up to 10 shares a chunk, accepted only from a peer asked and still being waited for, asked at most 3 times). Where a shade is needs no message: a "slot" is 160 s of the UTC clock; the slot's seed gives it 0 to 4 shades; each one's whole life (where it comes in, which landmark it circles, where it leaves toward) is a pure function of the island seed, the slot and its number, at 0.9 tiles a second. Every browser reads the same clock, so everyone sees the same shades in the same places, and nothing about a shade's position crosses the network. The light shares are a grow-only counter per player per shade keyed by the player's seed (merging keeps the larger number); a shade is gone when the total reaches 20 and at least 2 players hold a share; one player's share is capped at 19; 24 players are counted per shade and a full list refuses new ones and drops nobody. A receiver needs a known sender, exact fields, whole numbers in range, the same slot as its own, at most 8 messages a second per sender. Being snuffed is decided only by your own browser about yourself (a shade within 1 tile, nobody with a lit lantern within 90% of its reach of the shade, you not inside a lit beacon's light and not in the 6 s grace); nothing is lost and nothing is saved. Light counted while a present peer's counters are not yet heard is held back and added to the share the others hold for you, as in the notes. New: `js/shades.js`, `?shadeclock=N` (whole milliseconds added to the shades' clock; honoured only on a page served from this machine, like `?relay=`), and in `window.__longWatch` a `shades()` view, `setShadeClock(ms)` (loopback only) and `snuffCount()`. Changed files: `render.js` (shades, bursts, snuffed lanterns drawn as embers; the light pool of a snuffed player shrinks to 0.9 tiles and `lights()` reports `snuffed`), `minimap.js` (a violet mark per shade), `main.js` (panel, events, test views), `index.html` (panel, plainly-worded note). Removed behaviours: none (no flag or hook was removed; the light pools of players who are not snuffed are drawn by the same code as before).
- **Tested:** (`node game/tests/shades.test.mjs`, 5 runs of every test file, one file at a time, nothing else running, headless shell Chromium, each run including the WebRTC part through the local relay: shades 5/5 (138 checks each), presence 5/5 (18), talk 5/5 (58), world 5/5 (51), gather 5/5 (80), give 5/5 (107), craft 5/5 (166), beacon 5/5 (161), quests 5/5 (130), living 5/5 (63, run again after the test fix below; in the first loop it was 4/5); the game tester then saw shades fail once and pass on rerun at its check "neither player was ever snuffed" (a race between the test's start spots 1.3-1.5 tiles from the landmark and the 1-tile snuff radius; a friend's light only holds a shade back if it reaches it, so a snuff can really happen; not fixed); `page_check` clean). In node: the waves (4000 slots: a quarter quiet, all of 1 to 4 occur), a shade's path as a pure function (60 slots: every shade lives inside its slot, never moves faster than 0.9 tiles a second plus the circle, comes in about 26 tiles out, circles at a fixed radius, fades over 3 s), the light shares (never lowered, 15 bad shapes refused, one player alone stops at 19 and the shade stays, a second player finishes it, 24 players per shade refuse a 25th and drop nobody), and the module on a fake mesh (light counted a second at a time and stopped at the cap, held back until the room's counters are heard and then added to the share the others hold, a peer that never answers or leaves mid-snapshot does not stall it, 24 forged messages and a stranger change nothing, a flood of 500 is cut by the rate limit, a lone player a half tile from a shade is snuffed and tells the room, no light is counted while snuffed, it ends after 14 s, then 6 s of grace, a friend with a lit lantern on the shade holds it back, a friend whose own lantern is out or too far does not, a lit beacon is safe, a friend within 2.5 tiles relights after 1.5 s but not one farther or snuffed, the flag from a peer lapses after 20 s, a new slot starts from 0 and an old-slot message is dropped). Then two pages on the local transport and again on real Trystero/WebRTC through the local Nostr relay (one page asking for reduced motion): both draw the same shade in the same place, the one the code computes; A and B stand a tile and a half from the landmark, the shade arrives and circles, they drive it off together (20 or more light-seconds from 2 players, the same totals on both pages, both shares at most 19) and neither is ever snuffed; a late third player hears it is gone; in a second lantern a lone player is snuffed (page text, light shrinks to 0.9 tiles, cannot drive it off alone), a second page sees the ember, comes close and the first player is relit; and (local run) forged messages and a 500-message flood change nothing. No console errors. Draw cost with a shade on screen about 1.3 ms a frame (headless Chromium, software canvas). Screenshots of the shade near and being lit, and the snuffed player, at 375 and 1100 px were looked at; they led to making the figure larger, the cold rim gold only in strong light, and the label sit above its head. Test fix: the `living` check "the sky strip at one hour looks the same each time" failed 3 of 10 runs on the untouched code (and 2 of 10 on this code, so it is not from the shades): one picture of a strip that holds twinkling stars and the water glints under it can differ by more than 1%; it now takes three pictures per visit and passes when some pair is within 1%.
- **Unverified:** online play over the public Nostr relays (the sandbox cannot reach them; only the local relay was used), how the shades look and the panel reads on a real phone and with a screen reader, whether 14 seconds snuffed and 20 light-seconds are the right numbers for real play, whether the waves are too rare or too frequent, a lantern whose players' clocks differ by minutes (they would see shades in different places and count light on different ones), and a shade's look in direct comparison with real devices' colour (checked only in headless Chromium screenshots).

### 2026-10-16 · roadmap review and a steadier shades test
- **Also fixed:** a test that failed now and then (nothing players see changes). The shades test that failed now and then was checked against the real paths of the shades, and the game's rules were not at fault; the test now starts on a quiet stretch of the shades' clock.
- **Roadmap review** (10 increments since the founding): ROADMAP.md below "Done" is rewritten from the CHANGELOG. Kept: every working feature and the Canvas 2D renderer (still well inside a frame's budget, so no move to three.js yet). Next: progression earned only by helping others (milestone 10), then a weather and shades' sky look step, giving crafted things, a second free signalling path for when the Nostr relays cannot be reached, the lighthouse lit when all four beacons burn, and a look step for the people. The reasoning is in ROADMAP.md under "Roadmap reviews".
- **Test fix:** `shades.test.mjs` "neither player was ever snuffed" failed once in a tester run. A node check of every 50 ms of the test slot's two shades against the test's start spots (pinned hour 3, reach 3.6 tiles) found the friend's light on the shade every time it came within a tile of either player, so the earlier guess (start spots too far apart) was wrong. Cause found in the test: the pages loaded on the real clock and stood at the arrival point while connecting, and a shade of whatever slot the run fell in can come within a tile of an arrival spot (6 of 135 slots in a 6-hour sample, for 40 player seeds), snuffing a page before the scenario began; the snuff counter then failed the later check. The pages now load with `?shadeclock=` set to the first of three slots with no shades, and a new check says nobody was snuffed and no shade was out before the scenario starts. Not reproduced on demand: the cause is shown by the arithmetic, not by a captured failing run.
- **Tested** (5 runs of each file in a row, one file at a time, nothing else running, headless shell Chromium with `CHROME` set, each run including the WebRTC part through the local relay): shades 5/5 (140 checks each, 2 more than before), presence 5/5 (18), talk 5/5 (58), world 5/5 (51), gather 5/5 (80). Not run this time (the run's time ran out; their code is untouched apart from the snuff log in `main.js`): give, craft, beacon, living, quests. `page_check` not run.
- **Changed code:** `shades.js` now passes the shade's number with the "snuffed" event (it passed -1); `main.js` keeps the last 8 snuffs (slot, shade, time in its life, positions, peer count; numbers only, in the page) and shows them read-only as `__longWatch.snuffLog()`, which the shades test prints when a snuff check fails. Removed behaviours: none.
- **Unverified:** online play over the public Nostr relays (the sandbox proxy refused a connection to relay.damus.io this run with 403; only the local relay was used).
- **Unverified:** the tester then ran `beacon.test.mjs` 3 times: 0 of 3 passed, each failing the WebRTC check that two pages find each other again after one was deaf for 12 s (local and node parts passed), so reconnecting after a dropped link may not work; cause not found, and the earlier "5 of 5" beacon result was not reproduced. give, craft, living, quests and shades passed 3 of 3 and the page check passed.

### 2026-10-16 · milestone 10 (the lamplighter rank)
- **Players can now:** earn a lamplighter rank by helping other players. Five kinds of help give one point each: relighting a friend's snuffed lantern early by standing beside them, driving off a shade together, a gift of yours that arrives, lighting a beacon together, and finishing a keeper's note together (only when you added to it yourself; walking back into a beacon that is already lit earns nothing). Three points make you a Lamplighter, then 10, 25 and 60 points bring Beacon keeper, Warden of the watch and Long watcher. Your rank shows as a small gold title over your name, as gold marks on your lantern (one per rank) and beside your name in the player list, for everyone in the lantern, and a new panel tells you your points and what the last point was for. Receiving a gift earns nothing; giving does, at most one point every 4 seconds, and a relight at most one every 10 seconds. Your points are saved in your own browser. The rank is decoration only and gives no advantage; a modified game could claim any rank, so a title proves nothing.
- **Unverified:** online play over the public Nostr relays (the sandbox cannot reach them; only the local relay was used), how the gold title and marks look and the panel reads on a real phone and with a screen reader, whether the steps (3, 10, 25, 60 points) feel right in real play, and whether points are easy to farm with a second browser (nothing stops that; the page says the rank proves nothing).
- **Network:** one new message, `rk {r}` (my rank, a whole number 0 to 4; sent on change, to each newcomer and every 5 s). A receiver needs a known sender, exactly two fields, a whole number in range, at most 2 a second per sender; the title shown is looked up in a fixed list in `js/rank.js`, so no text crosses the network. Saved next to the pack as `help` (a whole number, 0 to 100000, anything else reads back as 0).
- **Changed code:** new `js/rank.js` (pure rules and the message), `js/shades.js` raises a new `helped` event when a friend I stood beside for 0.9 s (`HELP_S`) is relit early (the snuff began less than `SNUFF_S - 1` s before), `js/inventory.js` keeps `help` through `cleanSave`, `js/render.js` draws the title and the gold marks, `js/main.js` credits the deeds (a beacon, note or shade counts only when my own share grew past the value it had when the lantern's state arrived) and shows the panel, `index.html` has the panel and a plain note in "What this is, plainly". Removed behaviours: none. New read-only test view `__longWatch.rank()`.
- **Tested** (`node game/tests/rank.test.mjs`, new, 92 checks: node rules, deeds, gaps, caps, the message on a fake mesh, the shades module's `helped` event, then two pages on the local transport and over real WebRTC through the local relay: three gifts that arrive make A a Lamplighter, B sees the title in its list, a gift within 4 s of another earns nothing, a reload keeps the points, and forged rank messages change nothing): every file once with the final code: presence 1/1 (18 checks), talk 1/1 (58), world 1/1 (51), gather 1/1 (80), give 1/1 (107), craft 1/1 (166), living 1/1 (63), quests 1/1 (130), shades 1/1 (140), rank 4/4 (92), beacon 3/3 (161, one file at a time, nothing else running); `page_check` clean. This was not the usual 5-times loop (rank 4 runs, beacon 3 runs, the rest once). Screenshots of the title and marks at 375 and 1100 px were looked at; the first version put the title beside the name and it collided with the name, so it is now a smaller gold line over it.
- **Also fixed (investigation, nothing changed):** the beacon test that the tester saw fail 0 of 3 at "the two pages find each other although one was deaf for 12 s" was run first on the unchanged code: 6 of 6 passed (the check took 13.3 to 13.4 s of its 40 s). The link watchdog and the `?mute=` hook are in the code (`js/net/trystero.js`, `js/net/transport.js`, `js/main.js`). The cause of the tester's failures is not found and not reproduced, so the open problem stays in ROADMAP.md.

### 2026-10-16 · milestone 11 (weather and the shades' sky)
- **Players can now:** see mist and rain drift over the island. The weather changes every few minutes, easing from one to the next over about 40 seconds: roughly half the time it is clear, otherwise misty or rainy, and everyone in the same lantern sees the same sky. Mist is a thin pale veil with a few soft banks that drift across; rain is a cool tint and fine slanting streaks. Lanterns, paths and players stay easy to see in both. The small sky strip at the top clouds over in mist and rain (stars fade, the moon dims), and when a wave of shades is out it darkens under a violet-black cloud and its frame turns pale violet, so you can tell a wave is coming or going before you see a shade. With reduced motion on, nothing falls or drifts: the grey tint and still mist stay. On a slow phone the game draws fewer drops and banks, then only a flat thin veil. It is only a look: weather changes no rule.
- **Unverified:** online play over the public Nostr relays (the sandbox cannot reach them; only the local relay was used), how the weather and the darker sky look and perform on a real phone (frame costs were seen only in headless Chromium without a GPU), and whether the mist hides too much on a bright screen outdoors.
- **Network:** none. Weather and the sky's darkness are pure functions of the seed and the UTC clock (and the shades' own plans); nothing new is sent or received.
- **Changed code:** new `js/weather.js` (pure), `js/render.js` draws mist (under players), rain (over the night layer) and the sky strip's cloud and shade darkness, takes one new `env` argument and reports `mistBanks`, `drops` and `sky` in its stats; `js/main.js` passes `skyAt(...)` each frame (on the shade clock, so `?shadeclock=` moves the weather too), adds `?weather=clear|mist|rain` and `__longWatch.sky()`. Removed behaviours: none.
- **Tested:** every test file once with the final code, one file at a time, nothing else running, headless shell Chromium with `CHROME` set, each including its WebRTC part through the local relay: presence 18 checks, talk 58, world 51, gather 80, give 107, craft 166, beacon 161 (the WebRTC link watchdog check passed; no failure to log), quests 130, living 63, shades 140, rank 92, new `weather.test.mjs` 33 (node rules for the weather slots, easing, drops, banks and shade darkness; two pages agree on the sky with nothing sent; governor levels, plain look, reduced motion, sky darker in a wave), all passed; `page_check` passed. `weather.test.mjs` was then run 5 more times alone: 5/5. The 5x loop was cut to 1x for every other file to keep the job short.


### 2026-10-16 · milestone 12 (giving crafted things)
- **Players can now:** give wicks and amber, jade and azure lanterns to a nearby player, the same way as gathered items: you offer, they accept, then it moves. New Give buttons sit next to the old ones. Nothing leaves your pack until the other player accepts, a player with 999 of that thing refuses it, and an offer nobody answers ends after 20 seconds with nothing moved. If you give away the last lantern of the one you are holding, you hold the plain lantern again. A lantern you receive is not held automatically; press its Hold button.
- **Unverified:** online play over the public Nostr relays (only the local relay was used), and how the new buttons feel on a real phone.
- **Network:** no new messages. The gift item number now runs 0 to 6 (3 wick, 4 amber, 5 jade, 6 azure); older saved gifts keep their numbers. Removed behaviours: none.
- **Tested:** new `craftgive.test.mjs` 90 checks (the tester added: a stack filled between offer and accept now refuses at accept), 5/5 before that fix and 1 run after (node: each crafted kind, receiver stack full, receiver expected list full, giver on-its-way list full, also filling between offer and accept, offer expired and late accept, item used up between offer and accept, giver or receiver leaving at each step, 3 x 33 runs with one message dropped or one side restarted, the lantern in hand, forged kinds; then local and WebRTC pages). give 5/5 after its "unknown kind" forged check moved from number 3 (now a wick) to 7 (first loop 0/5 was that check, fixed). craft 5/5. presence, world, gather, beacon, living, quests, shades, rank, weather 1/1 each; page_check passed. `talk.test.mjs` fails intermittently (passed 1 of 2 tester runs) at "A's phrase buttons show the cooldown" (0/1, then 0/3); it fails the same way with all of this run's changes stashed, so it is not caused by milestone 12; cause not found.
