// The one networking interface the game uses. Two kinds of implementation:
//   local   - BroadcastChannel between tabs of one browser (tests, offline development)
//   nostr   - Trystero over public Nostr relays, real WebRTC between browsers (the default)
//   torrent - Trystero over public BitTorrent WebSocket trackers (fallback strategy)
//
// Every transport returns the same object:
//   { kind, selfId,
//     send(msg, peerId?)        msg is a small plain JSON object; no peerId means everyone in the room
//     onMessage(fn(msg, peerId)), onPeerJoin(fn(peerId)), onPeerLeave(fn(peerId)),
//     status()                  { relays, relaysOpen } for the connection line in the UI
//     leave() }
// Game code never imports Trystero or BroadcastChannel directly.

export const APP_ID = "vigilstudio-long-watch-v1";
export const KINDS = ["nostr", "torrent", "local"];

export function pickKind(search) {
  const k = new URLSearchParams(search).get("net");
  return KINDS.includes(k) ? k : "nostr";
}

// A test-only relay override: accepted only for a relay on this machine, so a shared link cannot point
// a player at someone else's server.
export function pickTestRelay(search) {
  const r = new URLSearchParams(search).get("relay");
  if (!r) return null;
  try {
    const u = new URL(r);
    if ((u.protocol === "ws:" || u.protocol === "wss:") && (u.hostname === "127.0.0.1" || u.hostname === "localhost")) return u.href;
  } catch { /* ignore */ }
  return null;
}

// Test-only: seconds (1 to 30) during which a page neither sends nor hears anything, imitating a half-open link.
// Like ?relay=, main.js uses it only on a page served from this machine.
export function pickTestMute(search) {
  const v = Number(new URLSearchParams(search).get("mute"));
  return Number.isInteger(v) && v >= 1 && v <= 30 ? v : 0;
}

export async function createTransport(kind, room, opts = {}) {
  if (kind === "local") {
    const { createLocalTransport } = await import("./local.js");
    return createLocalTransport(room);
  }
  const { createTrysteroTransport } = await import("./trystero.js");
  return createTrysteroTransport(kind, room, opts);
}

// The biggest message the game will look at, measured as JSON bytes. Real messages are under 100 bytes;
// anything bigger is dropped before any game code sees it. (Trystero has already decoded it by then, so this keeps
// big objects away from the game, it does not stop a peer from making the browser decode them.)
export const MAX_MESSAGE_BYTES = 512;
export function withinSizeCap(msg, max = MAX_MESSAGE_BYTES) {
  try {
    const s = JSON.stringify(msg);
    return typeof s === "string" && s.length <= max && new TextEncoder().encode(s).length <= max;
  } catch { return false; }
}
// Wraps an emitter so oversize messages never reach listeners; `dropped()` counts them.
export function capped(inner, max = MAX_MESSAGE_BYTES) {
  let dropped = 0;
  return {
    add: inner.add,
    emit(msg, id) { if (withinSizeCap(msg, max)) inner.emit(msg, id); else dropped++; },
    dropped: () => dropped,
  };
}

// Small helper both implementations use for their listener lists.
export function emitter() {
  const fns = new Set();
  return { add: fn => (fns.add(fn), () => fns.delete(fn)), emit: (...a) => fns.forEach(fn => { try { fn(...a); } catch (e) { console.error(e); } }) };
}
