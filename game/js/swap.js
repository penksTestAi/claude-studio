// Fair trades (milestone 23): one item for one item between two nearby players, built on the gift machinery of give.js.
//
// Messages, numbers only (t = a random trade number chosen by the player who offers; i, j = kind indexes):
//   { k:"tro", t, i, j }  offerer -> other  "I give one of kind i for one of kind j"        (step 1)
//   { k:"tra", t }        other -> offerer  "accepted: my j is set aside for you"            (step 2)
//   { k:"trn", t }        other -> offerer  "no thanks" (or busy, or I cannot take it now)
//   { k:"trx", t }        offerer -> other  "withdrawn" (before anything was sent), also the answer to a "tra" nobody is waiting for
// The two halves then travel as ordinary gifts with the same number t (give.js: "cf" commit, "rc" receipt, both re-sent
// until confirmed), so a half is never copied and never counted twice.
//
// Order, and why neither side can end up paying without being paid:
//  1. The offerer sets its item aside at once (saved `hold` entry, r = 0). Nothing has been sent yet, so it can always go back
//     to the pack: on a decline, a withdrawal, a timeout, the other player leaving or the page loading again.
//  2. The other player re-checks everything (has the item, room for the offered one, list room), sets its own item aside
//     (hold entry, r = 1) and writes the half it expects into its saved `exp` list, then answers "tra".
//  3. The offerer re-checks its own room (stack, expected list) and, if all is well, turns its hold into a gift on its way
//     ("cf" with the same t) and expects the other half. If something filled up meanwhile it answers "trx" instead and the
//     other side gets its item back. This is the only moment the offerer can still back out.
//  4. When the other player has received that half (give.js saved it in `got`), its hold becomes a gift on its way to the offerer.
//     That is checked every frame and again on load, so a page closed between the two steps still pays.
// The accepting side keeps its hold until the offerer's half arrives or "trx" comes. It re-sends "tra" to the offerer
// whenever the offerer is in the room, so an offerer who left and returned either commits or answers "trx". If the offerer
// never returns, that one item stays set aside (shown as "set aside for a trade"): giving it back could mean the other
// half was sent. A modified client can lock up to MAX_HOLD items of another player this way by accepting and never going on.
import { createGuard } from "./guard.js";
import { ITEMS, CRAFTED, LAMP_KEYS, MAX_OUT, MAX_EXP, MAX_HOLD, SOFT_STACK, isGiftId, isKindIndex } from "./inventory.js";
import { GIVE_RANGE, RECEIVE_SLACK, OFFER_MS, RESEND_MS } from "./give.js";

export const TRADE_MESSAGES = ["tro", "tra", "trn", "trx"];

export function createSwap(net, me, peers, inv, ledger, opts = {}) {
  const cr = opts.cr || Object.fromEntries(CRAFTED.map(k => [k, 0]));
  const held = opts.held || { lamp: 0 };
  const onLampDropped = opts.onLampDropped || (() => {});
  const now = opts.now || (() => performance.now());
  const onEvent = opts.onEvent || (() => {});
  const persist = opts.persist || (() => {});
  const busy = opts.busy || (() => false); // a gift offer is open
  const rand = opts.rand || (() => { const a = new Uint32Array(1); crypto.getRandomValues(a); return (a[0] % 4294967295) + 1; });
  if (!ledger.hold) ledger.hold = [];
  const guard = createGuard(10, 20);
  const lastTra = new Map();    // "seed.t" -> time of the last "tra"
  let outgoing = null;          // { t, i, j, to, seed, at } my offer, waiting for an answer
  let incoming = null;          // { t, i, j, from, seed, at } an offer shown to this player (i = what I would get, j = what I give)

  const countOf = (i) => (CRAFTED.includes(ITEMS[i]) ? cr : inv)[ITEMS[i]];
  const addTo = (i, d) => { (CRAFTED.includes(ITEMS[i]) ? cr : inv)[ITEMS[i]] += d; };
  const dist = (p) => Math.hypot(p.tx - me.x, p.ty - me.y);
  const same = (e, s, t) => e.s === s && e.t === t;
  const roomFor = (n) => ledger.out.length + ledger.hold.length + n <= MAX_OUT; // holds turn into gifts on their way, so they share MAX_OUT
  const ev = (type, d) => onEvent(type, d);

  // Take one item out of the pack into a hold entry; the lantern in hand falls back to the plain one if it was the last of its kind.
  function setAside(t, i, seed, r) {
    addTo(i, -1);
    const lampNo = LAMP_KEYS.indexOf(ITEMS[i]) + 1;
    const dropLamp = lampNo > 0 && held.lamp === lampNo && cr[ITEMS[i]] < 1;
    if (dropLamp) held.lamp = 0;
    ledger.hold.push({ t, i, s: seed, r });
    return dropLamp;
  }
  function release(seed, t) { // put a held item back in the pack (only ever called when nothing was sent for it)
    const at = ledger.hold.findIndex(e => same(e, seed, t));
    if (at < 0) return false;
    const e = ledger.hold.splice(at, 1)[0];
    addTo(e.i, 1);
    persist();
    return true;
  }
  function endOutgoing(type, extra = {}) { const o = outgoing; outgoing = null; if (o) { release(o.seed, o.t); ev(type, { i: o.i, j: o.j, seed: o.seed, ...extra }); } }
  function endIncoming(type, extra = {}) { const o = incoming; incoming = null; if (o) ev(type, { i: o.i, j: o.j, seed: o.seed, ...extra }); }

  // A page that closed in the middle of an offer comes back with the item still set aside and nothing sent: return it.
  { let any = false;
    for (const e of [...ledger.hold]) if (e.r === 0) { ledger.hold.splice(ledger.hold.indexOf(e), 1); addTo(e.i, 1); any = true; }
    if (any) persist(); }

  net.onPeerLeave((id) => {
    guard.forget(id);
    if (outgoing && outgoing.to === id) endOutgoing("lost");
    if (incoming && incoming.from === id) endIncoming("lost");
  });

  function commitOffer() { // step 3
    const o = outgoing, e = ledger.hold.find(x => same(x, o.seed, o.t));
    const why = !e ? "gone" : countOf(o.j) >= SOFT_STACK ? "stack" : ledger.exp.length >= MAX_EXP ? "list" : !peers.has(o.to) ? "away" : null;
    if (why) { net.send({ k: "trx", t: o.t }, o.to); endOutgoing("refused", { why }); return; }
    ledger.hold.splice(ledger.hold.indexOf(e), 1);
    ledger.out.push({ t: o.t, i: e.i, s: o.seed });
    ledger.exp.push({ t: o.t, i: o.j, s: o.seed });
    persist();
    outgoing = null;
    net.send({ k: "cf", t: o.t, i: e.i }, o.to);
    ev("committed", { i: o.i, j: o.j, seed: o.seed });
  }

  net.onMessage((msg, id) => {
    if (!msg || typeof msg !== "object" || typeof msg.k !== "string") return;
    const k = msg.k;
    if (!TRADE_MESSAGES.includes(k)) return;
    const p = peers.get(id);
    if (!p) return;
    if (!guard.allow(id, now())) return;
    const keys = Object.keys(msg).length;
    if (!isGiftId(msg.t)) return;
    const t = msg.t;
    if (k === "tro") {
      if (keys !== 4 || !isKindIndex(msg.i) || !isKindIndex(msg.j) || msg.i === msg.j) return;
      if (incoming && now() - incoming.at > OFFER_MS) endIncoming("expired");
      if (dist(p) > GIVE_RANGE + RECEIVE_SLACK) return;
      if (incoming || outgoing || busy() || countOf(msg.j) < 1 || countOf(msg.i) >= SOFT_STACK || ledger.exp.length >= MAX_EXP || !roomFor(1) || ledger.hold.length >= MAX_HOLD ||
          ledger.exp.some(e => same(e, p.seed, t)) || ledger.got.some(e => same(e, p.seed, t)) || ledger.hold.some(e => same(e, p.seed, t))) { net.send({ k: "trn", t }, id); return; }
      incoming = { t, i: msg.i, j: msg.j, from: id, seed: p.seed, at: now() };
      ev("offered", { i: msg.i, j: msg.j, seed: p.seed });
    } else if (k === "tra") {
      if (keys !== 2) return;
      if (outgoing && outgoing.t === t && outgoing.to === id) commitOffer();
      else if (!ledger.out.some(e => same(e, p.seed, t)) && !ledger.got.some(e => same(e, p.seed, t))) net.send({ k: "trx", t }, id); // nobody is waiting for it: let the other side take its item back
    } else if (k === "trn") {
      if (keys !== 2 || !outgoing || outgoing.t !== t || outgoing.to !== id) return;
      endOutgoing("declined");
    } else { // trx
      if (keys !== 2) return;
      const mine = ledger.hold.find(e => e.r === 1 && same(e, p.seed, t));
      if (mine) {
        const at = ledger.exp.findIndex(e => same(e, p.seed, t));
        if (at >= 0) ledger.exp.splice(at, 1);
        release(p.seed, t);
        ev("returned", { i: mine.i, seed: p.seed });
      }
      if (incoming && incoming.t === t && incoming.from === id) endIncoming("cancelled");
    }
  });

  // Step 4, also run every frame: for every accepted trade whose other half has arrived, send mine.
  function settle() {
    for (const e of [...ledger.hold]) {
      if (e.r !== 1 || !ledger.got.some(g => same(g, e.s, e.t))) continue;
      ledger.hold.splice(ledger.hold.indexOf(e), 1);
      ledger.out.push({ t: e.t, i: e.i, s: e.s });
      persist();
      ev("paid", { i: e.i, seed: e.s });
    }
  }
  settle();

  return {
    get outgoing() { return outgoing ? { ...outgoing } : null; },
    get incoming() { return incoming ? { ...incoming } : null; },
    pending() { return !!(outgoing || incoming); },
    held() { return ledger.hold.map(e => ({ kind: e.i, seed: e.s, r: e.r })); },
    target() {
      let best = null, bd = GIVE_RANGE;
      for (const p of peers.values()) { const d = dist(p); if (d <= bd) { bd = d; best = p; } }
      return best;
    },
    // Step 1: offer one item of kind i for one of kind j to the nearest player. Returns true when sent.
    offer(i, j) {
      if (!isKindIndex(i) || !isKindIndex(j) || i === j || outgoing || incoming || busy()) return false;
      if (countOf(i) < 1 || countOf(j) >= SOFT_STACK || ledger.exp.length >= MAX_EXP || !roomFor(1) || ledger.hold.length >= MAX_HOLD) return false;
      const p = this.target();
      if (!p) return false;
      const t = rand();
      if (setAside(t, i, p.seed, 0)) onLampDropped();
      persist();
      outgoing = { t, i, j, to: p.id, seed: p.seed, at: now() };
      net.send({ k: "tro", t, i, j }, p.id);
      ev("offering", { i, j, seed: p.seed });
      return true;
    },
    cancel() {
      if (!outgoing) return false;
      net.send({ k: "trx", t: outgoing.t }, outgoing.to);
      endOutgoing("cancelled");
      return true;
    },
    // Step 2: the other player says yes (everything is checked again, because time has passed).
    accept() {
      if (!incoming) return false;
      const o = incoming;
      const fail = (type, extra) => { net.send({ k: "trn", t: o.t }, o.from); endIncoming(type, extra); return false; };
      if (now() - o.at > OFFER_MS) return endIncoming("expired"), false;
      if (!peers.has(o.from)) return endIncoming("lost"), false;
      if (countOf(o.j) < 1) return fail("refused", { why: "none" });
      if (countOf(o.i) >= SOFT_STACK) return fail("refused", { why: "stack" });
      if (ledger.exp.length >= MAX_EXP || !roomFor(1) || ledger.hold.length >= MAX_HOLD) return fail("refused", { why: "list" });
      if (setAside(o.t, o.j, o.seed, 1)) onLampDropped();
      ledger.exp.push({ t: o.t, i: o.i, s: o.seed });
      persist();
      incoming = null;
      lastTra.set(`${o.seed}.${o.t}`, now());
      net.send({ k: "tra", t: o.t }, o.from);
      ev("accepted", { i: o.i, j: o.j, seed: o.seed });
      return true;
    },
    decline() {
      if (!incoming) return false;
      net.send({ k: "trn", t: incoming.t }, incoming.from);
      endIncoming("declined");
      return true;
    },
    // Every frame: end unanswered offers, pay accepted trades whose other half arrived, and ask again for the other half.
    tick() {
      const t = now();
      if (outgoing && t - outgoing.at > OFFER_MS) { net.send({ k: "trx", t: outgoing.t }, outgoing.to); endOutgoing("expired"); }
      if (incoming && t - incoming.at > OFFER_MS) endIncoming("expired");
      settle();
      for (const e of ledger.hold) {
        if (e.r !== 1) continue;
        const key = `${e.s}.${e.t}`;
        if (t - (lastTra.get(key) ?? -1e9) < RESEND_MS) continue;
        for (const p of peers.values()) if (p.seed === e.s) { lastTra.set(key, t); net.send({ k: "tra", t: e.t }, p.id); break; }
      }
    },
  };
}
