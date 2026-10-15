// Real transport: Trystero 0.25.4 (MIT, vendored in ../../vendor/). Signalling (finding each other) goes
// through public Nostr relays or BitTorrent trackers; after that, game messages travel directly between
// browsers over encrypted WebRTC data channels. No server of ours, no keys, no sign-up.
import { APP_ID, emitter, capped } from "./transport.js";

const MODULES = {
  nostr: "../../vendor/trystero-0.25.4/nostr/index.mjs",
  torrent: "../../vendor/trystero-0.25.4/torrent/index.mjs",
};

// Trystero keeps a pool of ready offers and, once one is older than ~57 s, renews it: roll back the pooled
// offer, restart ICE, make a new offer. Rolling back the very first offer also throws away the data channel it
// created, so the renewed offer is an empty description (no m= line, no ICE credentials) and the peer it goes
// to can never connect. The result: a player who joins a room that others have been in for about a minute or
// more is often unable to connect to them (the third player in the gather test never saw the first two, about
// half the time). This subclass makes that rollback a no-op (the new offer simply replaces the old one, the
// channel stays), and holds the renewed offer back until its fresh candidates are gathered or a short while
// has passed, because the first candidates of a restart are otherwise emitted before anyone listens.
const RENEW_GATHER_MS = 2500;
function warmRenewals(Base) {
  return class extends Base {
    restartIce() { this._renewing = true; } // createOffer({ iceRestart: true }) restarts by itself; the real call would also fire a second, racing negotiation
    async setLocalDescription(...args) {
      const type = args[0]?.type;
      if (type === "rollback" && this.signalingState === "have-local-offer" && !this.remoteDescription) { this._renewing = true; return; }
      const renewing = this._renewing && type === "offer";
      if (renewing) this._renewing = false;
      const result = await super.setLocalDescription(...args);
      if (renewing && this.iceGatheringState !== "complete") {
        await new Promise((done) => {
          const finish = () => { clearTimeout(timer); this.removeEventListener("icegatheringstatechange", check); done(); };
          const check = () => { if (this.iceGatheringState === "complete") finish(); };
          const timer = setTimeout(finish, RENEW_GATHER_MS);
          this.addEventListener("icegatheringstatechange", check);
        });
      }
      return result;
    }
  };
}

export async function createTrysteroTransport(kind, room, opts = {}) {
  const lib = await import(MODULES[kind] || MODULES.nostr);
  const config = { appId: APP_ID, relayConfig: { warnOnRelayFailure: false } };
  if (typeof RTCPeerConnection === "function") config.rtcPolyfill = warmRenewals(RTCPeerConnection);
  if (opts.relay) config.relayConfig.urls = [opts.relay];
  const r = lib.joinRoom(config, room);
  const action = r.makeAction("m");
  const onMsg = capped(emitter()), onJoin = emitter(), onLeave = emitter();

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
      return { relays: socks.length, relaysOpen: socks.filter(s => s && s.readyState === 1).length, dropped: onMsg.dropped() };
    },
    leave() { r.leave().catch(() => {}); },
  };
}
