// Gathering, shared. A picked node is hidden for everyone in the room until its seeded respawn.
//
// Who decides: the arbiter, the connected player with the lowest id (every browser works it out by itself;
// when the arbiter leaves, the next lowest takes over). Messages, all tiny and numbers only:
//   { k:"pk", n }          player -> arbiter: "I pick node n"
//   { k:"gt", n, r }       arbiter -> everyone: node n is gone for r seconds
//   { k:"ok", n } / { k:"no", n }   arbiter -> the asker: you got it / someone was first, or it was not allowed
//   { k:"rq" }             newcomer -> a peer: "send me what is hidden"
//   { k:"sn", n:[..], t:[..], f }   up to 16 hidden nodes with their remaining seconds; f=1 on the last chunk
// The shared state is just "node n is hidden until time T". Merging keeps the later T, so repeats and
// crossing snapshots are harmless. Times travel as remaining seconds and are turned into the receiver's own
// clock on arrival, so players' clocks need not agree. Everyone keeps the full map, so any peer can answer a
// newcomer. Everything received is checked: known kind, exact fields, integers in range, sender known;
// "gt" counts only from the arbiter; picks must be close to the asker's last reported position.
import { createGuard } from "./guard.js";
import { KINDS, nearestNode, MAX_RESPAWN_S } from "./resources.js";

export const PICK_RANGE = 1.3;      // tiles: how close you must stand to gather
export const ARBITER_RANGE = 2.6;   // tiles: what the arbiter accepts (movement lags a little behind)
export const SYNC_WAIT_MS = 1500;   // a newcomer waits this long for a snapshot before trusting its empty map
export const PENDING_MS = 2000;
const CHUNK = 16;
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

export function createGather(net, world, me, peers, nodes, opts = {}) {
  const now = opts.now || (() => performance.now());
  const onEvent = opts.onEvent || (() => {});
  const hidden = new Map();     // node id -> local time (ms) when it comes back
  const pending = new Map();    // node id -> give-up time of my own request
  const asked = new Set();      // peers I already asked for a snapshot
  const lastRq = new Map();
  const inv = Object.fromEntries(KINDS.map(k => [k, 0]));
  const guard = createGuard(20, 40); // a busy room sends a few "gt" a second; the rest is dropped
  const startedAt = now();
  let synced = false, lastPick = -1e9;
  const N = nodes.length;

  const arbiterId = () => { let a = net.selfId; for (const id of peers.keys()) if (id < a) a = id; return a; };
  const isHidden = (n, t = now()) => (hidden.get(n) ?? 0) > t;
  const hide = (n, secs) => { const until = now() + secs * 1000; if (until > (hidden.get(n) ?? 0)) hidden.set(n, until); };
  const respawnFor = (n) => opts.respawn ? Math.min(MAX_RESPAWN_S, Math.max(1, opts.respawn)) : nodes[n].respawn;

  // The arbiter's decision for node n asked by someone at (px, py). Returns true when it was granted.
  function decide(n, px, py) {
    const node = nodes[n];
    if (!node || isHidden(n)) return false;
    if (!synced && peers.size > 0) return false; // a newcomer must not grant what it has not heard about
    if (Math.hypot(node.x - px, node.y - py) > ARBITER_RANGE) return false;
    const r = respawnFor(n);
    hide(n, r);
    net.send({ k: "gt", n, r });
    return true;
  }

  net.onPeerLeave((id) => { guard.forget(id); lastRq.delete(id); asked.delete(id); });
  net.onMessage((msg, id) => {
    if (!msg || typeof msg !== "object" || typeof msg.k !== "string") return;
    const k = msg.k;
    if (k !== "pk" && k !== "gt" && k !== "ok" && k !== "no" && k !== "rq" && k !== "sn") return;
    if (!peers.has(id)) return; // only people who said hello
    if (!guard.allow(id, now())) return;
    const keys = Object.keys(msg).length;
    if (k === "pk") {
      if (keys !== 2 || !isInt(msg.n, 0, N - 1) || arbiterId() !== net.selfId) return;
      const p = peers.get(id);
      if (decide(msg.n, p.tx, p.ty)) net.send({ k: "ok", n: msg.n }, id); else net.send({ k: "no", n: msg.n }, id);
    } else if (k === "gt") {
      if (keys !== 3 || !isInt(msg.n, 0, N - 1) || !isInt(msg.r, 1, MAX_RESPAWN_S) || id !== arbiterId()) return;
      hide(msg.n, msg.r);
    } else if (k === "ok" || k === "no") {
      if (keys !== 2 || !isInt(msg.n, 0, N - 1) || id !== arbiterId() || !pending.has(msg.n)) return;
      pending.delete(msg.n);
      if (k === "ok") { inv[nodes[msg.n].kind]++; onEvent("got", nodes[msg.n].kind); } else onEvent("denied", nodes[msg.n].kind);
    } else if (k === "rq") {
      if (keys !== 1 || !synced) return;
      const t = now();
      if (t - (lastRq.get(id) ?? -1e9) < 1000) return;
      lastRq.set(id, t);
      const list = [];
      for (const [n, until] of hidden) if (until > t) list.push([n, Math.max(1, Math.ceil((until - t) / 1000))]);
      for (let i = 0; i === 0 || i < list.length; i += CHUNK) {
        const part = list.slice(i, i + CHUNK);
        net.send({ k: "sn", n: part.map(e => e[0]), t: part.map(e => e[1]), f: i + CHUNK >= list.length ? 1 : 0 }, id);
      }
    } else { // sn
      if (keys !== 4 || !Array.isArray(msg.n) || !Array.isArray(msg.t) || msg.n.length !== msg.t.length || msg.n.length > CHUNK || (msg.f !== 0 && msg.f !== 1)) return;
      if (!msg.n.every(v => isInt(v, 0, N - 1)) || !msg.t.every(v => isInt(v, 1, MAX_RESPAWN_S))) return;
      msg.n.forEach((n, i) => hide(n, msg.t[i]));
      if (msg.f === 1) synced = true;
    }
  });

  return {
    inv, isHidden: (n) => isHidden(n), arbiterId, isArbiter: () => arbiterId() === net.selfId,
    get synced() { return synced; },
    // Available nodes, for drawing and for finding the one in reach.
    visible() { const t = now(); return nodes.filter(n => !isHidden(n.id, t)); },
    hiddenCount() { const t = now(); let c = 0; for (const u of hidden.values()) if (u > t) c++; return c; },
    reach() { return nearestNode(this.visible().filter(n => !pending.has(n.id)), me.x, me.y, PICK_RANGE); },
    // Try to gather what is in reach. Returns the node asked for, or null.
    pick() {
      const t = now();
      if (t - lastPick < 350) return null;
      const node = this.reach();
      if (!node) return null;
      lastPick = t;
      if (arbiterId() === net.selfId) {
        if (decide(node.id, me.x, me.y)) { inv[node.kind]++; onEvent("got", node.kind); } else onEvent("denied", node.kind);
      } else {
        pending.set(node.id, t + PENDING_MS);
        net.send({ k: "pk", n: node.id }, arbiterId());
      }
      return node;
    },
    // Called every frame: ask for a snapshot when peers appear, give up waiting, drop stale requests.
    tick() {
      const t = now();
      for (const [n, until] of pending) if (until <= t) { pending.delete(n); onEvent("denied", nodes[n].kind); }
      if (synced) return;
      for (const id of peers.keys()) if (!asked.has(id)) { asked.add(id); net.send({ k: "rq" }, id); }
      if (t - startedAt > SYNC_WAIT_MS) synced = true;
    },
  };
}
