// The default transport (milestone 13): find each other through the Nostr relays, and if none of them can be reached
// within TRY_MS, through BitTorrent trackers instead (both are Trystero strategies, free, no sign-up). Whichever
// first opens at least one connection is kept ("connected"); if neither does, the two are tried in turn, up to
// MAX_SWITCHES times, so a network that wakes up later is still found.
// Players only meet others who found the room by the same path (a Nostr room and a tracker room are different
// rooms), so path() says which one this player is on and the page shows it.
// The game sees one object with the usual transport interface; its `kind` is the path currently tried.
import { emitter, capped } from "./transport.js";
import { createTrysteroTransport } from "./trystero.js";

export const ORDER = ["nostr", "torrent"];
export const TRY_MS = 7000, CHECK_MS = 500, MAX_SWITCHES = 5;

export async function createAutoTransport(room, opts = {}) {
  const onMsg = capped(emitter()), onJoin = emitter(), onLeave = emitter();
  const urlFor = (kind) => (kind === "nostr" ? opts.relay : opts.tracker) || undefined;
  const tried = []; // [{ kind, reached }] in the order tried
  let inner = null, lastId = null, idx = 0, switches = 0, startedAt = 0, connected = false, closed = false, busy = false;

  async function start() {
    busy = true;
    const kind = ORDER[idx % ORDER.length];
    const mine = await createTrysteroTransport(kind, room, { relay: urlFor(kind), mute: opts.mute });
    busy = false;
    if (closed) { mine.leave(); return; }
    inner = mine; lastId = mine.selfId; startedAt = performance.now();
    tried.push({ kind, reached: false });
    mine.onMessage((m, id) => { if (inner === mine) onMsg.emit(m, id); });
    mine.onPeerJoin((id) => { if (inner === mine) onJoin.emit(id); });
    mine.onPeerLeave((id) => { if (inner === mine) onLeave.emit(id); });
  }
  await start();

  const timer = setInterval(async () => {
    if (closed || busy || connected) return;
    if (!inner) {
      if (switches >= MAX_SWITCHES) return;
      switches++; idx++;
      try { await start(); } catch (e) { busy = false; console.error(e); }
      return;
    }
    const s = inner.status();
    if (s.relaysOpen > 0) { connected = true; tried[tried.length - 1].reached = true; return; }
    if (performance.now() - startedAt < TRY_MS || switches >= MAX_SWITCHES) return;
    const old = inner; inner = null; switches++; idx++;
    old.leave();
    try { await start(); } catch (e) { busy = false; console.error(e); }
  }, CHECK_MS);

  return {
    get kind() { return inner ? inner.kind : ORDER[idx % ORDER.length]; },
    get selfId() { return inner ? inner.selfId : lastId; },
    send(msg, peerId) { if (inner) inner.send(msg, peerId); },
    onMessage: onMsg.add, onPeerJoin: onJoin.add, onPeerLeave: onLeave.add,
    // `path`: "nostr" or "torrent" once connected, null while trying; `trying` is the path being tried now.
    status() {
      const s = inner ? inner.status() : { relays: 0, relaysOpen: 0 };
      return { ...s, dropped: onMsg.dropped(), path: connected ? inner.kind : null, trying: inner ? inner.kind : null, tried: tried.map(t => ({ ...t })), switches, exhausted: switches >= MAX_SWITCHES };
    },
    leave() { closed = true; clearInterval(timer); if (inner) inner.leave(); inner = null; },
  };
}
