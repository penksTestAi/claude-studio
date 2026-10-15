---
name: vigil-game
description: Grow Vigil's multiplayer online RPG in game/, one increment per run, forever. Founding mode (no game/DESIGN.md yet, or a roadmap review is due) researches the stack and writes the design; normal mode builds the next roadmap item and proves multiplayer still works.
---

# The game

The owner asked for a multiplayer online RPG, built piece by piece and evolving without end. It lives in
`game/` in vigilstudio.github.io and is played at https://vigilstudio.github.io/game/. You never commit or push.

## Hard rules (these never change, whatever the roadmap says)
- **Multiplayer is the point.** Every feature is designed for several players in the same world. A change that only
  works for one player is not done.
- **No server, no accounts, free.** GitHub Pages serves static files only. Players connect peer to peer (WebRTC or
  similar) through free public signalling that needs no sign-up and no API key. No paid or hosted backends, no
  databases, no keys in the code.
- **No free text between players.** Players never see anything another player typed: no chat box, no custom names,
  no signs or notes. Talk is preset phrases and emotes; display names are generated (for example "Grey Heron 41").
  This keeps a public game run by an AI safe for strangers. Never add a feature that breaks this.
- **Honest about what it is.** The landing area says plainly: made by Claude, an AI model (Vigil is not an Anthropic
  project); peer to peer, so it works when other players are online in the same room and there is no shared saved
  world on a server; your character is saved only in your own browser; like a video call, peer to peer connections
  let other players' browsers see your network address; nothing is collected about you. The world is generated from
  a seed, so everyone sees the same world.
- **Testable without the internet.** Networking goes through one transport interface with two implementations:
  the real peer-to-peer one, and a local one (BroadcastChannel between pages of the same browser) used by the tests.
  Pick it with a URL flag such as `?net=local`.
- Static files only, free and open-source libraries with pinned versions (cdnjs, jsdelivr, unpkg, esm.sh, or
  vendored with their licence). Works on phones (touch controls) and desktops (keyboard), light and dark page
  chrome, no console errors. Performance matters: aim for smooth play on an ordinary phone.

## Founding mode
Use it when `game/DESIGN.md` does not exist, or when CHANGELOG.md shows 10 increments since the last roadmap review.
1. Research (web search is allowed; some sites may be blocked in the sandbox, note what failed). Compare options for:
   rendering (three.js is the owner's suggestion; choose something else if it serves the game better, for example a
   2D engine, Babylon.js or PlayCanvas's open-source engine), peer-to-peer networking with free no-sign-up signalling
   (for example Trystero over Nostr, BitTorrent trackers or MQTT; PeerJS's public server; y-webrtc), and how shared
   state is kept consistent between peers (authority, conflict rules, late joiners).
2. Write `game/DESIGN.md`: the vision in a paragraph (setting, what players do together, why it fits Vigil and the
   night shift), the chosen stack and why, the options rejected and why, the network model, the safety rules above,
   and **whether the real signalling was reachable from the sandbox** (try it once and write the result), so later
   runs know whether online play can be tested or must be marked unverified.
3. Write `game/ROADMAP.md`: milestones in order, each small enough for one run, the next one marked. Milestone 0 is
   presence only: two players in the same room see each other move. Later milestones grow the RPG: a world to
   explore, gathering, crafting, quests, combat or co-operation, trading, progression, places that change when many
   players work together. Leave room for the game to surprise you.
4. Build milestone 0 if time allows. A roadmap review rewrites ROADMAP.md from what was learned and notes it in
   CHANGELOG.md; it does not throw away working features.

## Normal mode (every other run)
1. Read `game/DESIGN.md`, `game/ROADMAP.md` and the last entries of `game/CHANGELOG.md`.
2. Build the next roadmap item completely, as one coherent increment. Keep the code organised in modules so later
   runs can find their way (a short map of the files lives in DESIGN.md).
3. Tests: `game/tests/` holds a Playwright script that opens two pages in one browser context with `?net=local`,
   joins both to the same room and checks they see each other (and, from then on, whatever the new feature shares
   between players). Add a test for the new feature, run all tests, and run
   `node <studio>/tools/page_check.mjs game/`. Fix everything that fails.
4. Update ROADMAP.md (mark the item done, choose and mark the next) and add a CHANGELOG.md entry: date, what players
   can now do, what was tested, what is unverified (for example real online play).

## Report (at most 8 lines)
Mode, what players can now do, files changed, test results, whether online play was tested, the next roadmap item,
and one plain sentence for the Workbench line describing the game as it is now.
