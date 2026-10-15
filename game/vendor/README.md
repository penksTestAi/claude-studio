# Vendored libraries

Copied from npm, unchanged except the `//# sourceMappingURL` lines, so the game needs no CDN at runtime
and the versions cannot drift.

| Folder | Package | Version | Licence |
|---|---|---|---|
| `trystero-0.25.4/core/` | `@trystero-p2p/core` (`dist/*.mjs`) | 0.25.4 | MIT, see `trystero-0.25.4/LICENSE` |
| `trystero-0.25.4/nostr/` | `@trystero-p2p/nostr` (`dist/index.mjs`) | 0.25.4 | MIT (per the package's `license` field and LICENSE, checked in the npm tarball; no separate copy kept in this folder, the same Trystero licence text applies) |
| `trystero-0.25.4/torrent/` | `@trystero-p2p/torrent` (`dist/index.mjs`) | 0.25.4 | MIT (same check as nostr) |
| `noble-secp256k1-3.2.0/` | `@noble/secp256k1` (`index.js`) | 3.2.0 | MIT, see its `LICENSE` |

The bare imports inside them (`@trystero-p2p/core`, `@noble/secp256k1`) are resolved by the import map in
`../index.html`. To upgrade: `npm pack` the new versions, copy the same files into new versioned folders, update
the import map and `js/net/trystero.js`, and run `node game/tests/presence.test.mjs`.
