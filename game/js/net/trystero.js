// Real transport: Trystero 0.25.4 (MIT, vendored in ../../vendor/). Signalling (finding each other) goes
// through public Nostr relays or BitTorrent trackers; after that, game messages travel directly between
// browsers over encrypted WebRTC data channels. No server of ours, no keys, no sign-up.
import { APP_ID, emitter } from "./transport.js";

const MODULES = {
  nostr: "../../vendor/trystero-0.25.4/nostr/index.mjs",
  torrent: "../../vendor/trystero-0.25.4/torrent/index.mjs",
};

export async function createTrysteroTransport(kind, room, opts = {}) {
  const lib = await import(MODULES[kind] || MODULES.nostr);
  const config = { appId: APP_ID, relayConfig: { warnOnRelayFailure: false } };
  if (opts.relay) config.relayConfig.urls = [opts.relay];
  const r = lib.joinRoom(config, room);
  const action = r.makeAction("m");
  const onMsg = emitter(), onJoin = emitter(), onLeave = emitter();

  r.onPeerJoin = (id) => onJoin.emit(id);
  r.onPeerLeave = (id) => onLeave.emit(id);
  action.onMessage = (data, ctx) => onMsg.emit(data, ctx.peerId);

  return {
    kind,
    selfId: lib.selfId,
    send(msg, peerId) { action.send(msg, peerId ? { target: peerId } : undefined).catch(() => {}); },
    onMessage: onMsg.add, onPeerJoin: onJoin.add, onPeerLeave: onLeave.add,
    status() {
      const socks = Object.values(lib.getRelaySockets?.() || {});
      return { relays: socks.length, relaysOpen: socks.filter(s => s && s.readyState === 1).length };
    },
    leave() { r.leave().catch(() => {}); },
  };
}
