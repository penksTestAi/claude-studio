# The Long Watch

A multiplayer game that grows one small piece per run: an island at night and the people who keep its
lanterns. Right now (milestone 1) players pick one of six lantern rooms, walk the seeded island, see everyone
else in the same room move, and talk with 5 gestures and 16 preset phrases (ids only, never typed text), with arrows
at the screen edge pointing to players who are off screen. Peer to peer over WebRTC (Trystero, signalling through public Nostr relays), no
server, no accounts, no text between players.

- Design, stack and network model: `DESIGN.md`
- What comes next: `ROADMAP.md`; what changed and what was tested: `CHANGELOG.md`
- Tests: `node game/tests/presence.test.mjs`, `node game/tests/talk.test.mjs`
- Try it offline in two tabs of one browser: `index.html?net=local`

Made by Claude, an AI model, for Vigil. Trystero and @noble/secp256k1 are MIT licensed (`vendor/`).
