// Giving: hand one item (gathered or crafted: wick, lanterns) to a nearby player. Two people confirm, and an item is never copied.
//
// Messages, all tiny and numbers only (t = a random gift number, i = kind index):
//   { k:"of", t, i }   giver -> receiver   "I offer you one item of kind i"       (confirmation 1: the giver offers)
//   { k:"ac", t }      receiver -> giver   "I accept"                              (confirmation 2: the receiver accepts)
//   { k:"dc", t }      receiver -> giver   "no thanks" (or busy, or pack full)
//   { k:"cx", t }      giver -> receiver   "I take the offer back" (before the item has left the pack)
//   { k:"cf", t, i }   giver -> receiver   "it has left my pack: it is yours"       (sent only after an accept)
//   { k:"rc", t }      receiver -> giver   "received and saved"
//
// Why nothing is copied, and why a gift waits instead of vanishing, with no server to ask:
//  - Until the giver sees "ac", the item never leaves the giver's pack. A leave, a timeout, a cancel or a decline just
//    ends the offer and the pack is untouched.
//  - On "ac" the giver takes the item out of the pack and writes it into its saved `out` list before sending "cf".
//    From then on the item exists in exactly one place: that list, until the receiver confirms with "rc".
//  - The receiver adds the item only for a gift it accepted (its saved `exp` list), only once (its saved `got` list),
//    and saves before it answers "rc". A repeated "cf" is answered with "rc" and adds nothing.
//  - If a player leaves or the page closes after the item left the pack, the saved lists survive. The giver keeps
//    re-sending "cf" to the same receiver (known by seed) whenever they meet again, so the item arrives later, once.
//    Until then it is "in transit": not in anyone's pack, kept in the saved list (unless storage is blocked or cleared). If the receiver never returns it stays there;
//    giving it back would risk a second copy, which is the worse failure.
// A modified client can still cheat for itself (invent items); there is nothing to win from others.
import { createGuard } from "./guard.js";
import { ITEMS, CRAFTED, LAMP_KEYS, MAX_OUT, MAX_EXP, MAX_GOT, SOFT_STACK, isGiftId, isKindIndex } from "./inventory.js";

export const GIVE_RANGE = 3;        // tiles: how close a giver must stand to offer (own view of the other player)
export const RECEIVE_SLACK = 2.5;   // a receiver accepts offers from a little farther (movement lags behind)
export const OFFER_MS = 20000;      // an offer that nobody answers ends after this long
export const RESEND_MS = 3000;      // how often a sent-but-unconfirmed gift is announced again to its receiver

// Items are gathered kinds (counted in `inv`) or crafted things (counted in `cr`); i indexes ITEMS. Wicks and lanterns
// go through exactly the same offer, accept, commit and receipt as gathered items.
export function createGive(net, me, peers, inv, ledger, opts = {}) {
  const cr = opts.cr || Object.fromEntries(CRAFTED.map(k => [k, 0]));
  const held = opts.held || { lamp: 0 };
  const onLampDropped = opts.onLampDropped || (() => {});
  const countOf = (i) => (CRAFTED.includes(ITEMS[i]) ? cr : inv)[ITEMS[i]];
  const addTo = (i, d) => { (CRAFTED.includes(ITEMS[i]) ? cr : inv)[ITEMS[i]] += d; };
  const now = opts.now || (() => performance.now());
  const onEvent = opts.onEvent || (() => {});
  const persist = opts.persist || (() => {});
  const busy = opts.busy || (() => false);   // a trade (swap.js) is open: gifts wait, so only one exchange is open at a time
  const heldCount = () => (ledger.hold ? ledger.hold.length : 0); // items set aside for trades share the room of the on-its-way list
  const rand = opts.rand || (() => { const a = new Uint32Array(1); crypto.getRandomValues(a); return (a[0] % 4294967295) + 1; });
  const guard = createGuard(10, 20);
  const lastResend = new Map(); // "seed.t" -> time of the last "cf"
  let outgoing = null;          // { t, i, to, seed, at } offer waiting for an answer
  let incoming = null;          // { t, i, from, seed, at } offer shown to this player

  const dist = (p) => Math.hypot(p.tx - me.x, p.ty - me.y);
  const peerSeed = (id) => { const p = peers.get(id); return p ? p.seed : null; };
  const same = (e, s, t) => e.s === s && e.t === t;

  function endOutgoing(type) { const o = outgoing; outgoing = null; if (o) onEvent(type, { kind: o.i, seed: o.seed }); }
  function endIncoming(type) { const o = incoming; incoming = null; if (o) onEvent(type, { kind: o.i, seed: o.seed }); }

  net.onPeerLeave((id) => {
    guard.forget(id);
    if (outgoing && outgoing.to === id) endOutgoing("lost");      // item never left the pack: nothing to undo
    if (incoming && incoming.from === id) endIncoming("lost");
  });

  net.onMessage((msg, id) => {
    if (!msg || typeof msg !== "object" || typeof msg.k !== "string") return;
    const k = msg.k;
    if (k !== "of" && k !== "ac" && k !== "dc" && k !== "cx" && k !== "cf" && k !== "rc") return;
    const p = peers.get(id);
    if (!p) return; // only people who said hello
    if (!guard.allow(id, now())) return;
    const keys = Object.keys(msg).length;
    if (!isGiftId(msg.t)) return;
    const t = msg.t;
    if (k === "of") {
      if (keys !== 3 || !isKindIndex(msg.i)) return;
      if (incoming && now() - incoming.at > OFFER_MS) endIncoming("expired");
      if (dist(p) > GIVE_RANGE + RECEIVE_SLACK) return;
      if (incoming || busy() || countOf(msg.i) >= SOFT_STACK || ledger.exp.length >= MAX_EXP || ledger.exp.some(e => same(e, p.seed, t)) || ledger.got.some(e => same(e, p.seed, t))) { net.send({ k: "dc", t }, id); return; }
      incoming = { t, i: msg.i, from: id, seed: p.seed, at: now() };
      onEvent("offered", { kind: msg.i, seed: p.seed });
    } else if (k === "ac") {
      if (keys !== 2 || !outgoing || outgoing.t !== t || outgoing.to !== id) return;
      commit();
    } else if (k === "dc") {
      if (keys !== 2 || !outgoing || outgoing.t !== t || outgoing.to !== id) return;
      endOutgoing("declined");
    } else if (k === "cx") {
      if (keys !== 2) return;
      const at = ledger.exp.findIndex(e => same(e, p.seed, t)); // accepted a moment before the giver took it back
      if (at >= 0) { ledger.exp.splice(at, 1); persist(); }
      if (incoming && incoming.t === t && incoming.from === id) endIncoming("cancelled");
    } else if (k === "cf") {
      if (keys !== 3 || !isKindIndex(msg.i)) return;
      const at = ledger.exp.findIndex(e => same(e, p.seed, t) && e.i === msg.i);
      if (at >= 0) {
        ledger.exp.splice(at, 1);
        addTo(msg.i, 1);
        ledger.got.push({ t, s: p.seed });
        while (ledger.got.length > MAX_GOT) ledger.got.shift();
        persist();                                  // saved before the receipt goes out
        net.send({ k: "rc", t }, id);
        if (incoming && incoming.t === t) incoming = null;
        onEvent("received", { kind: msg.i, seed: p.seed });
      } else if (ledger.got.some(e => same(e, p.seed, t))) {
        net.send({ k: "rc", t }, id);               // already added once: confirm again, add nothing
      }
    } else { // rc
      if (keys !== 2) return;
      const at = ledger.out.findIndex(e => same(e, p.seed, t));
      if (at < 0) return;
      const e = ledger.out.splice(at, 1)[0];
      lastResend.delete(`${e.s}.${e.t}`);
      persist();
      onEvent("delivered", { kind: e.i, seed: e.s });
    }
  });

  // The receiver said yes: take the item out of the pack, save, and only then tell the receiver.
  function commit() {
    const o = outgoing;
    if (countOf(o.i) < 1 || ledger.out.length + heldCount() >= MAX_OUT) { net.send({ k: "cx", t: o.t }, o.to); endOutgoing("cancelled"); return; }
    addTo(o.i, -1);
    const lampNo = LAMP_KEYS.indexOf(ITEMS[o.i]) + 1;
    const dropLamp = lampNo > 0 && held.lamp === lampNo && cr[ITEMS[o.i]] < 1; // the lantern in hand was the last of its kind
    if (dropLamp) held.lamp = 0;
    ledger.out.push({ t: o.t, i: o.i, s: o.seed });
    persist();
    if (dropLamp) onLampDropped();
    outgoing = null;
    lastResend.set(`${o.seed}.${o.t}`, now());
    net.send({ k: "cf", t: o.t, i: o.i }, o.to);
    onEvent("sent", { kind: o.i, seed: o.seed });
  }

  return {
    get outgoing() { return outgoing ? { ...outgoing } : null; },
    get incoming() { return incoming ? { ...incoming } : null; },
    // The nearest other player within reach, or null.
    target() {
      let best = null, bd = GIVE_RANGE;
      for (const p of peers.values()) { const d = dist(p); if (d <= bd) { bd = d; best = p; } }
      return best;
    },
    // Step 1, the giver's confirmation: offer one item of kind index i to the nearest player. Returns true when sent.
    offer(i) {
      if (!isKindIndex(i) || outgoing || busy() || countOf(i) < 1 || ledger.out.length + heldCount() >= MAX_OUT) return false;
      const p = this.target();
      if (!p) return false;
      outgoing = { t: rand(), i, to: p.id, seed: p.seed, at: now() };
      net.send({ k: "of", t: outgoing.t, i }, p.id);
      onEvent("offering", { kind: i, seed: p.seed });
      return true;
    },
    cancel() {
      if (!outgoing) return false;
      net.send({ k: "cx", t: outgoing.t }, outgoing.to);
      endOutgoing("cancelled");
      return true;
    },
    // Step 2, the receiver's confirmation.
    accept() {
      if (!incoming) return false;
      if (now() - incoming.at > OFFER_MS) { endIncoming("expired"); return false; }
      if (ledger.exp.length >= MAX_EXP || countOf(incoming.i) >= SOFT_STACK) { net.send({ k: "dc", t: incoming.t }, incoming.from); endIncoming("declined"); return false; } // never drop an expected gift; a stack filled since the offer also refuses
      const o = incoming;
      ledger.exp.push({ t: o.t, i: o.i, s: o.seed });
      persist();
      incoming = null; // stays in `exp` until the item arrives
      net.send({ k: "ac", t: o.t }, o.from);
      onEvent("accepted", { kind: o.i, seed: o.seed });
      return true;
    },
    decline() {
      if (!incoming) return false;
      net.send({ k: "dc", t: incoming.t }, incoming.from);
      endIncoming("declined");
      return true;
    },
    // Every frame: end unanswered offers, and announce sent gifts again to their receivers when they are here.
    tick() {
      const t = now();
      if (outgoing && t - outgoing.at > OFFER_MS) { net.send({ k: "cx", t: outgoing.t }, outgoing.to); endOutgoing("expired"); }
      if (incoming && t - incoming.at > OFFER_MS) endIncoming("expired");
      for (const e of ledger.out) {
        const key = `${e.s}.${e.t}`;
        if (t - (lastResend.get(key) ?? -1e9) < RESEND_MS) continue;
        for (const p of peers.values()) if (p.seed === e.s) { lastResend.set(key, t); net.send({ k: "cf", t: e.t, i: e.i }, p.id); break; }
      }
    },
    inTransit() { return ledger.out.map(e => ({ kind: e.i, seed: e.s })); },
  };
}
