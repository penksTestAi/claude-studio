// Local transport: BroadcastChannel between pages of the same browser. Used by the tests (?net=local)
// and for trying the game without the internet. It imitates Trystero's room semantics: peers announce
// themselves, get a join event for each other, and may address one peer or everyone.
import { emitter } from "./transport.js";

export function createLocalTransport(room) {
  const selfId = Math.random().toString(36).slice(2, 12);
  const ch = new BroadcastChannel(`vigil-long-watch:${room}`);
  const peers = new Set();
  const onMsg = emitter(), onJoin = emitter(), onLeave = emitter();
  let open = true;

  const post = (o) => { if (open) ch.postMessage({ ...o, from: selfId }); };
  const join = (id) => { if (!peers.has(id)) { peers.add(id); onJoin.emit(id); } };

  ch.onmessage = (ev) => {
    const m = ev.data;
    if (!m || typeof m !== "object" || m.from === selfId || typeof m.from !== "string") return;
    if (m.to && m.to !== selfId) return;
    if (m.k === "hello") { post({ k: "here", to: m.from }); join(m.from); } // "here" first, so it arrives before any data
    else if (m.k === "here") join(m.from);
    else if (m.k === "bye") { if (peers.delete(m.from)) onLeave.emit(m.from); }
    else if (m.k === "data" && peers.has(m.from)) onMsg.emit(m.d, m.from);
  };
  const bye = () => post({ k: "bye" });
  addEventListener("pagehide", bye);
  post({ k: "hello" });

  return {
    kind: "local",
    selfId,
    send(msg, peerId) { post(peerId ? { k: "data", d: msg, to: peerId } : { k: "data", d: msg }); },
    onMessage: onMsg.add, onPeerJoin: onJoin.add, onPeerLeave: onLeave.add,
    status: () => ({ relays: 1, relaysOpen: 1 }),
    leave() { bye(); open = false; removeEventListener("pagehide", bye); ch.close(); peers.clear(); },
  };
}
