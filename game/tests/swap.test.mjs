#!/usr/bin/env node
// Milestone 23 tests for The Long Watch: fair trades (one item for one item) on the gift machinery.
//
//   node game/tests/swap.test.mjs            node checks, local transport, then real Trystero/WebRTC via a local Nostr relay
//   node game/tests/swap.test.mjs --local    skip the WebRTC part
//
// Part 0 (node): the saved hold list; then the real giving and trading code on a fake mesh where one message is dropped, or
// either player (or both) is killed and restarted from its saved state, after every message of a trade. After every
// delivered message each item kind must exist exactly once per copy (packs + set-aside + on-its-way not yet received), and
// once the players meet again and time passes the trade is all or nothing. Then every cap and timeout: full, expired, filled
// between steps, a peer leaving at each step, hostile messages.
// Then pages: an offer moves nothing until accepted, accept swaps one item each way, decline, withdraw and leaving end an
// offer with the item back in the pack, a page closed mid-trade comes back right.
// "Online play" here means a local relay on this machine, not the public relays.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startRelay } from "./nostr-relay.mjs";
import { ITEMS } from "../js/inventory.js";
import { createGive, OFFER_MS, RESEND_MS, GIVE_RANGE } from "../js/give.js";
import { createSwap, TRADE_MESSAGES } from "../js/swap.js";
import { cleanSave, adoptSave, emptyLedger, SOFT_STACK, MAX_OUT, MAX_EXP, MAX_HOLD } from "../js/inventory.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const onlyLocal = process.argv.includes("--local");

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failures++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const DW = 0, RE = 1, BE = 2, WICK = 3, AMBER = 4, OIL = 7; // item indexes
console.log(`# ${ITEMS.length} item kinds; trade messages: ${TRADE_MESSAGES.join(", ")}`);

// ---- 0a. the saved hold list ----
console.log("# saved hold list, in node");
{
  const c = cleanSave({ hold: [{ t: 5, i: 1, s: 7, r: 0 }, { t: 5, i: 1, s: 7, r: 0 }, { t: 6, i: 1, s: 7, r: 2 }, { t: 7, i: 99, s: 7, r: 1 }, { t: 0, i: 1, s: 7, r: 1 }, { t: 8, i: 1, s: -1, r: 1 }, { t: 9, i: 2, s: 3, r: 1 }, "x", null] });
  ok(c.hold.length === 2 && c.hold[0].t === 5 && c.hold[1].t === 9 && c.hold[1].r === 1, "a saved hold list drops duplicates, bad roles, bad kinds, bad ids, bad seeds and junk");
  ok(cleanSave({ hold: Array.from({ length: 50 }, (_, i) => ({ t: i + 1, i: 0, s: 1, r: 1 })) }).hold.length === MAX_HOLD, `the list is capped (${MAX_HOLD})`);
  ok(cleanSave(null).hold.length === 0 && cleanSave({ hold: "no" }).hold.length === 0 && emptyLedger().hold.length === 0, "no list, text and null give an empty list");
  const live = { driftwood: 0, reeds: 0, berries: 0, oil: 0 }, led = emptyLedger();
  adoptSave(live, led, { hold: [{ t: 3, i: 0, s: 9, r: 1 }] });
  ok(led.hold.length === 1, "adopting another tab's save copies the hold list in place");
}

// ---- 0b. node: a fake mesh ----
const G_SEED = 111, R_SEED = 222;
const NAMES = ["driftwood", "reeds", "berries", "wick", "amber", "jade", "azure", "oil"];
function makeWorld() {
  const w = { clock: 0, queue: [], players: new Map(), nextId: 1, hook: null, autoAccept: true };
  w.spawn = (seed, disk) => {
    const id = `${seed === G_SEED ? "g" : "r"}${w.nextId++}`;
    const st = cleanSave(JSON.parse(disk.json));
    const p = { id, seed, hs: [], leaves: [], me: { x: 5, y: 5 }, peers: new Map(), inv: st.inv, cr: st.cr, held: { lamp: st.lamp }, ledger: { out: st.out, exp: st.exp, got: st.got, hold: st.hold }, alive: true, events: [], sev: [], drops: 0 };
    const save = () => { disk.json = JSON.stringify({ inv: p.inv, cr: p.cr, lamp: p.held.lamp, out: p.ledger.out, exp: p.ledger.exp, got: p.ledger.got, hold: p.ledger.hold }); };
    p.net = {
      selfId: id, onMessage: h => p.hs.push(h), onPeerLeave: h => p.leaves.push(h), onPeerJoin() {},
      send(msg, to) { const m = JSON.parse(JSON.stringify(msg)); for (const [oid, o] of w.players) if (oid !== id && o.alive && (!to || to === oid)) w.queue.push({ from: id, to: oid, msg: m }); },
    };
    let swap = null;
    p.give = createGive(p.net, p.me, p.peers, p.inv, p.ledger, { now: () => w.clock, persist: save, cr: p.cr, held: p.held, onEvent: (t) => p.events.push(t), rand: () => 4242, busy: () => !!swap && swap.pending() });
    swap = p.swap = createSwap(p.net, p.me, p.peers, p.inv, p.ledger, { now: () => w.clock, persist: save, cr: p.cr, held: p.held, onEvent: (t, d) => p.sev.push(t + (d && d.why ? ":" + d.why : "")), rand: () => 777, onLampDropped: () => { p.lampDropped = true; }, busy: () => !!(p.give.outgoing || p.give.incoming) });
    p.disk = disk; p.save = save;
    w.players.set(id, p);
    return p;
  };
  w.link = () => { for (const a of w.players.values()) if (a.alive) for (const b of w.players.values()) if (b.alive && a !== b && !a.peers.has(b.id)) a.peers.set(b.id, { id: b.id, seed: b.seed, tx: b.me.x + 1, ty: b.me.y }); };
  w.kill = (p) => { p.alive = false; w.players.delete(p.id); w.queue = w.queue.filter(e => e.to !== p.id && e.from !== p.id); for (const o of w.players.values()) if (o.peers.delete(p.id)) o.leaves.forEach(h => h(p.id)); };
  w.step = () => {
    const e = w.queue.shift(); if (!e) return false;
    const to = w.players.get(e.to); if (!to || !to.alive) return true;
    const action = w.hook ? w.hook(e) : null;
    if (action === "drop") return true;
    to.hs.forEach(h => h(e.msg, e.from));
    return true;
  };
  w.run = (check) => { let n = 0; while (w.step() && n++ < 300) check && check(); };
  w.tickAll = () => { for (const p of w.players.values()) { p.give.tick(); p.swap.tick(); } };
  return w;
}
const pack = (o = {}) => JSON.stringify({ inv: { driftwood: 0, reeds: 0, berries: 0, oil: 0, ...(o.inv || {}) }, cr: o.cr || {}, lamp: o.lamp || 0, out: o.out || [], exp: o.exp || [], got: o.got || [], hold: o.hold || [] });
// How many of each kind exist for one player: pack, set aside, and on-its-way gifts whose receiver has not recorded them.
function census(w, players, disks) {
  const per = new Array(ITEMS.length).fill(0);
  const states = players.map((p, n) => p.alive ? { inv: p.inv, cr: p.cr, out: p.ledger.out, got: p.ledger.got, hold: p.ledger.hold } : cleanSave(JSON.parse(disks[n].json)));
  for (const [n, s] of states.entries()) {
    const other = states[1 - n], mySeed = players[n].seed;
    ITEMS.forEach((k, i) => { per[i] += (s.inv[k] ?? s.cr[k] ?? 0); });
    for (const h of s.hold) per[h.i]++;
    for (const o of s.out) if (!other.got.some(g => g.s === mySeed && g.t === o.t)) per[o.i]++;
  }
  return per;
}

console.log("# a trade with faults at every step, in node");
function runTrade(fault) {
  const w = makeWorld();
  const gd = { json: pack({ inv: { driftwood: 1 } }) }, rd = { json: pack({ inv: { reeds: 1 } }) };
  let G = w.spawn(G_SEED, gd), R = w.spawn(R_SEED, rd);
  w.link();
  let bad = null; const seq = [];
  const check = () => { const c = census(w, [G, R], [gd, rd]); if (c[DW] !== 1 || c[RE] !== 1) bad = bad || `driftwood ${c[DW]}, reeds ${c[RE]} after ${seq.join(">")}`; };
  let n = 0;
  w.hook = (e) => {
    const idx = n++; seq.push(e.msg.k);
    if (!fault || idx !== fault.at) return null;
    if (fault.kind === "drop") return "drop";
    if (fault.kind === "killG-before") { w.kill(G); G = w.spawn(G_SEED, gd); w.link(); return "drop"; }
    if (fault.kind === "killR-before") { w.kill(R); R = w.spawn(R_SEED, rd); w.link(); return "drop"; }
    w.after = fault.kind; return null;
  };
  const afterFault = () => { const k = w.after; if (!k) return; w.after = null; if (k === "killG-after") { w.kill(G); G = w.spawn(G_SEED, gd); } else if (k === "killR-after") { w.kill(R); R = w.spawn(R_SEED, rd); } else { w.kill(G); w.kill(R); G = w.spawn(G_SEED, gd); R = w.spawn(R_SEED, rd); } w.link(); };
  const pump = () => {
    for (let guard = 0; guard < 400; guard++) {
      const had = w.step(); check(); afterFault(); check();
      if (R.swap.incoming && !R.swap.__done) { R.swap.__done = true; R.swap.accept(); check(); }
      if (!had) break;
    }
  };
  check();
  G.swap.offer(DW, RE); check();
  pump();
  w.link();
  for (let s = 0; s < 70; s++) { w.clock += 1000; w.tickAll(); pump(); check(); }
  const swapped = G.inv.reeds === 1 && G.inv.driftwood === 0 && R.inv.driftwood === 1 && R.inv.reeds === 0;
  const unchanged = G.inv.driftwood === 1 && G.inv.reeds === 0 && R.inv.reeds === 1 && R.inv.driftwood === 0;
  const clean = G.ledger.hold.length === 0 && R.ledger.hold.length === 0 && G.ledger.out.length === 0 && R.ledger.out.length === 0 && G.ledger.exp.length === 0 && R.ledger.exp.length === 0;
  return { bad, swapped, unchanged, clean, seq, n };
}
{
  const base = runTrade(null);
  ok(!base.bad && base.swapped && base.clean, `an undisturbed trade swaps one driftwood for one reeds and leaves every list empty (${base.seq.join(" ")})`);
  const total = base.n;
  const kinds = ["drop", "killG-before", "killR-before", "killG-after", "killR-after", "killBoth-after"];
  const results = [];
  for (let at = 0; at < total + 2; at++) for (const kind of kinds) results.push({ at, kind, ...runTrade({ at, kind }) });
  const broke = results.filter(r => r.bad);
  ok(broke.length === 0, `${results.length} faults, one at each of the first ${total + 2} messages (drop, either player restarted before or after, both restarted): each item kind existed exactly once after every message${broke.length ? " | " + broke.slice(0, 3).map(r => `${r.kind}@${r.at}: ${r.bad}`).join(" | ") : ""}`);
  const mixed = results.filter(r => !r.swapped && !r.unchanged);
  ok(mixed.length === 0, `after both players are back and time passes, every one of them ends all-or-nothing (swapped or untouched)${mixed.length ? " | e.g. " + mixed.slice(0, 3).map(r => `${r.kind}@${r.at}`).join(", ") : ""}`);
  const dirty = results.filter(r => !r.clean);
  ok(dirty.length === 0, `and no set-aside, on-its-way or expected entry is left behind${dirty.length ? " | e.g. " + dirty.slice(0, 3).map(r => `${r.kind}@${r.at}`).join(", ") : ""}`);
  console.log(`  (${results.filter(r => r.swapped).length} swapped, ${results.filter(r => r.unchanged).length} untouched)`);
}

// ---- 0c. caps, timeouts, leaving and hostile messages ----
console.log("# caps, timeouts, leaving, hostile messages, in node");
const mk = (go = {}, ro = {}) => {
  const w = makeWorld();
  const gd = { json: pack({ ...go, inv: { driftwood: 1, ...(go.inv || {}) } }) }, rd = { json: pack({ ...ro, inv: { reeds: 1, ...(ro.inv || {}) } }) };
  const G = w.spawn(G_SEED, gd), R = w.spawn(R_SEED, rd); w.link();
  return { w, G, R, gd, rd };
};
const fill = (n, seed = 900) => Array.from({ length: n }, (_, k) => ({ t: 1000 + k, i: DW, s: seed + k }));
const counts = (p) => `${p.inv.driftwood}/${p.inv.reeds}`;
// 1. nothing moves before the answer, the item is set aside, a second use of it is refused
{ const s = mk();
  ok(s.G.swap.offer(DW, RE), "offer sent");
  ok(s.G.inv.driftwood === 0 && s.G.ledger.hold.length === 1 && s.G.ledger.hold[0].r === 0, "the offered item is set aside at once (hold, role 0)");
  ok(!s.G.give.offer(DW) && !s.G.swap.offer(DW, RE), "a set-aside item cannot be offered again, and gifts wait while a trade is open");
  s.w.run(); ok(!!s.R.swap.incoming && s.R.inv.reeds === 1 && s.R.ledger.hold.length === 0, "the other player sees the offer and nothing of theirs has moved");
  ok(!s.R.give.offer(RE), "and a gift offer is refused while a trade offer is shown");
  s.R.swap.accept(); ok(s.R.ledger.hold.length === 1 && s.R.ledger.hold[0].r === 1 && s.R.inv.reeds === 0 && s.R.ledger.exp.length === 1, "accepting sets their item aside (role 1) and writes the half they expect");
  s.w.hook = (e) => (e.msg.k === "cf" ? "drop" : null); s.w.run(); s.w.hook = null;
  ok(s.G.ledger.hold.length === 0 && s.G.ledger.out.length === 1 && s.G.ledger.exp.length === 1 && s.G.inv.driftwood === 0, "the offerer's hold became a gift on its way and the other half is expected");
  for (let n = 0; n < 6; n++) { s.w.clock += 1000; s.w.tickAll(); s.w.run(); }
  ok(counts(s.G) === "0/1" && counts(s.R) === "1/0" && s.G.sev.includes("committed") && s.R.sev.includes("paid") && s.G.events.includes("received") && s.R.events.includes("received"), "both halves arrived once, and both players were told"); }
// 2. the tro itself is refused for the right reasons
{ const sendTro = (s, over = {}) => { s.G.give.offer; s.R.hs.forEach(h => h({ k: "tro", t: 55, i: DW, j: RE, ...over }, s.G.id)); };
  const refusal = (s, over) => { s.w.queue.length = 0; sendTro(s, over); return s.w.queue.some(e => e.msg.k === "trn") && !s.R.swap.incoming; };
  { const s = mk(); ok(refusal(s, { j: BE }), "a player who does not have what is asked for declines at once"); }
  { const s = mk({}, { inv: { driftwood: SOFT_STACK } }); ok(refusal(s), `a player with ${SOFT_STACK} of what is offered declines at once`); }
  { const s = mk({}, { exp: fill(MAX_EXP) }); ok(refusal(s) && s.R.ledger.exp.length === MAX_EXP, "a full expected list declines and drops nothing"); }
  { const s = mk({}, { out: fill(MAX_OUT) }); ok(refusal(s) && s.R.ledger.out.length === MAX_OUT, "a full on-its-way list declines and drops nothing"); }
  { const s = mk({}, { out: fill(MAX_OUT - 2), hold: [{ t: 1, i: DW, s: 1, r: 1 }, { t: 2, i: DW, s: 2, r: 1 }] }); ok(refusal(s), "the on-its-way list and the set-aside items share one cap, so a list that is full counting both declines"); }
  { const s = mk({}, { hold: [1, 2, 3, 4].map(t => ({ t, i: DW, s: t, r: 1 })) }); ok(refusal(s), `${MAX_HOLD} items already set aside decline a fifth`); }
  { const s = mk(); s.R.swap.__x = 1; sendTro(s); ok(!!s.R.swap.incoming, "an ordinary offer is shown (control)"); }
  { const s = mk(); s.R.give.offer; s.R.hs.forEach(h => h({ k: "of", t: 5, i: DW }, s.G.id)); sendTro(s); ok(s.w.queue.some(e => e.msg.k === "trn") && !s.R.swap.incoming, "a trade offer while a gift offer is shown is declined"); }
  // the offerer's own caps
  { const s = mk({ inv: { reeds: SOFT_STACK } }); ok(!s.G.swap.offer(DW, RE) && s.G.inv.driftwood === 1, `no offer when the offerer's own stack of what they ask for is ${SOFT_STACK}`); }
  { const s = mk({ exp: fill(MAX_EXP) }); ok(!s.G.swap.offer(DW, RE), "no offer when the offerer's expected list is full"); }
  { const s = mk({ out: fill(MAX_OUT) }); ok(!s.G.swap.offer(DW, RE), "no offer when the on-its-way list is full"); }
  { const s = mk({ out: fill(MAX_OUT - 1) }); ok(s.G.swap.offer(DW, RE) && s.G.ledger.out.length + s.G.ledger.hold.length === MAX_OUT, "with one free place the offer is allowed and the set-aside item takes the last place of the shared cap"); s.w.run(); s.R.swap.accept(); s.w.hook = (e) => (e.msg.k === "cf" ? "drop" : null); s.w.run(); s.w.hook = null; ok(s.G.sev.includes("committed") && s.G.ledger.out.length === MAX_OUT && s.G.ledger.hold.length === 0, "and at the commit the hold turns into a gift on its way without needing another place"); }
  { const s = mk({ hold: [1, 2, 3, 4].map(t => ({ t, i: BE, s: t, r: 1 })) }); s.G.inv.berries = 0; ok(!s.G.swap.offer(DW, RE), `no offer with ${MAX_HOLD} items already set aside`); }
  { const s = mk(); ok(!s.G.swap.offer(DW, DW) && !s.G.swap.offer(DW, 99) && !s.G.swap.offer(-1, RE) && !s.G.swap.offer(1.5, RE) && !s.G.swap.offer("0", RE) && !s.G.swap.offer(BE, RE), "same kind, bad kinds and an item not owned are refused"); }
  { const s = mk(); for (const p of s.G.peers.values()) p.tx += GIVE_RANGE + 1; ok(!s.G.swap.offer(DW, RE), `no offer to a player farther than ${GIVE_RANGE} tiles`); }
}
// 3. caps that fill between the steps
{ // between offer and accept: the other side's stack of the offered kind fills
  const s = mk(); s.G.swap.offer(DW, RE); s.w.run(); s.R.inv.driftwood = SOFT_STACK;
  ok(!s.R.swap.accept() && s.R.sev.includes("refused:stack") && s.R.ledger.hold.length === 0 && s.R.ledger.exp.length === 0, "a stack that fills before Accept refuses at Accept: nothing set aside, nothing expected");
  s.w.run(); ok(s.G.ledger.hold.length === 0 && s.G.inv.driftwood === 1 && s.G.sev.includes("declined"), "and the offerer gets the item back"); }
{ const s = mk(); s.G.swap.offer(DW, RE); s.w.run(); s.R.inv.reeds = 0;
  ok(!s.R.swap.accept() && s.R.sev.includes("refused:none"), "the other player spending what was asked for before Accept refuses at Accept");
  s.w.run(); ok(s.G.inv.driftwood === 1 && s.G.ledger.hold.length === 0, "and the offerer gets the item back"); }
{ const s = mk(); s.G.swap.offer(DW, RE); s.w.run(); s.R.ledger.exp.push(...fill(MAX_EXP));
  ok(!s.R.swap.accept() && s.R.ledger.exp.length === MAX_EXP && s.R.sev.includes("refused:list"), "an expected list that fills before Accept refuses at Accept and drops nothing");
  s.w.run(); ok(s.G.inv.driftwood === 1, "the offerer has the item again"); }
{ const s = mk(); s.G.swap.offer(DW, RE); s.w.run(); s.R.ledger.out.push(...fill(MAX_OUT));
  ok(!s.R.swap.accept() && s.R.ledger.out.length === MAX_OUT && s.R.ledger.hold.length === 0, "an on-its-way list that fills before Accept refuses at Accept"); s.w.run(); ok(s.G.inv.driftwood === 1, "the offerer has the item again"); }
{ // between accept and the offerer's commit: the offerer's stack of what it asked for fills
  const s = mk(); s.G.swap.offer(DW, RE); s.w.run(); s.R.swap.accept(); s.G.inv.reeds = SOFT_STACK; s.w.run();
  ok(s.G.sev.includes("refused:stack") && s.G.ledger.hold.length === 0 && s.G.ledger.out.length === 0 && s.G.inv.driftwood === 1, "a stack that fills after the other side accepted: the offerer backs out at the commit, its item is back in the pack");
  ok(s.R.ledger.hold.length === 0 && s.R.ledger.exp.length === 0 && s.R.inv.reeds === 1 && s.R.sev.includes("returned"), "and the other side gets its item back and its expectation is cleared"); }
{ const s = mk(); s.G.swap.offer(DW, RE); s.w.run(); s.R.swap.accept(); s.G.ledger.exp.push(...fill(MAX_EXP)); s.w.run();
  ok(s.G.sev.includes("refused:list") && s.G.ledger.exp.length === MAX_EXP && s.G.inv.driftwood === 1 && s.R.inv.reeds === 1 && s.R.ledger.hold.length === 0, "an expected list that fills after the other side accepted: the offerer backs out at the commit, nothing is dropped, both items are back"); }
// 4. timeouts
{ const s = mk(); s.G.swap.offer(DW, RE); s.w.run(); s.w.clock = OFFER_MS + 1; s.w.tickAll(); s.w.run();
  ok(!s.G.swap.outgoing && !s.R.swap.incoming && s.G.inv.driftwood === 1 && s.G.ledger.hold.length === 0 && s.G.sev.includes("expired") && s.R.sev.includes("expired"), "an unanswered offer ends on both sides after the time limit and the item is back in the pack");
  ok(!s.R.swap.accept() && s.R.ledger.hold.length === 0, "a late Accept does nothing"); }
{ const s = mk(); s.G.swap.offer(DW, RE); s.w.run(); s.w.clock = OFFER_MS + 1; ok(!s.R.swap.accept() && s.R.sev.includes("expired") && s.R.inv.reeds === 1 && s.R.ledger.hold.length === 0, "Accept pressed after the time limit, before any tick, still refuses and sets nothing aside"); }
// 5. decline and withdraw
{ const s = mk(); s.G.swap.offer(DW, RE); s.w.run(); s.R.swap.decline(); s.w.run(); ok(s.G.inv.driftwood === 1 && s.G.ledger.hold.length === 0 && s.G.sev.includes("declined") && !s.G.swap.outgoing, "No thanks returns the item to the offerer"); }
{ const s = mk(); s.G.swap.offer(DW, RE); s.w.run(); s.G.swap.cancel(); s.w.run(); ok(!s.R.swap.incoming && s.G.inv.driftwood === 1 && s.G.ledger.hold.length === 0, "withdrawing removes the offer from the other player and returns the item"); }
{ const s = mk(); s.G.swap.offer(DW, RE); s.w.run(); s.R.swap.accept(); s.G.swap.cancel(); s.w.run();
  ok(s.G.inv.driftwood === 1 && s.R.inv.reeds === 1 && s.R.ledger.hold.length === 0 && s.R.ledger.exp.length === 0 && s.G.ledger.out.length === 0, "withdrawing just as the other side accepts: the late accept is answered with a withdrawal, both items are back, nothing is expected"); }
// 6. a peer leaving at each step
{ const s = mk(); s.G.swap.offer(DW, RE); s.w.kill(s.R); ok(!s.G.swap.outgoing && s.G.inv.driftwood === 1 && s.G.ledger.hold.length === 0 && s.G.sev.includes("lost"), "step 1, the other player leaves before seeing the offer: the item is back in the pack"); }
{ const s = mk(); s.G.swap.offer(DW, RE); s.w.run(); s.w.kill(s.G); ok(!s.R.swap.incoming && s.R.sev.includes("lost") && s.R.inv.reeds === 1 && !s.R.swap.accept(), "step 2, the offerer leaves while the offer is shown: it ends, nothing was set aside"); }
{ const s = mk(); s.G.swap.offer(DW, RE); s.w.run(); s.R.swap.accept(); s.w.kill(s.G);
  ok(s.R.ledger.hold.length === 1 && s.R.ledger.exp.length === 1 && s.R.inv.reeds === 0, "step 3, the offerer leaves after the other side accepted: the accepted item stays set aside (it cannot know whether the commit was sent)");
  const G2 = s.w.spawn(G_SEED, s.gd); s.w.link(); ok(G2.inv.driftwood === 1 && G2.ledger.hold.length === 0, "the offerer's page loads again with its item in the pack");
  s.w.clock += RESEND_MS + 1; s.w.tickAll(); s.w.run();
  ok(s.R.ledger.hold.length === 0 && s.R.ledger.exp.length === 0 && s.R.inv.reeds === 1 && G2.inv.driftwood === 1, "when they meet again the accepting side asks again, is told the trade is off, and has its item back"); }
{ const s = mk(); s.G.swap.offer(DW, RE); s.w.run(); s.R.swap.accept(); s.w.hook = (e) => e.msg.k === "tra" ? "drop" : null; s.w.run(); s.w.hook = null; // the accept never arrives, the offerer then leaves and returns
  ok(s.G.ledger.hold.length === 1, "(setup: the accept was lost, the offerer still waits)"); s.w.kill(s.G); ok(s.G.inv.driftwood === 0, "(the dead page's memory is gone)");
  const G2 = s.w.spawn(G_SEED, s.gd); s.w.link(); s.w.clock += RESEND_MS + 1; s.w.tickAll(); s.w.run();
  ok(G2.inv.driftwood === 1 && s.R.inv.reeds === 1 && s.R.ledger.hold.length === 0, "a closed page that had an open offer returns the item to its pack on load, and the other side is released"); }
{ const s = mk(); s.G.swap.offer(DW, RE); s.w.run(); s.R.swap.accept(); s.w.hook = (e) => (e.msg.k === "cf" ? "drop" : null); s.w.run(); s.w.hook = null; // G committed; its half has not arrived
  ok(s.G.ledger.out.length === 1 && s.R.ledger.hold.length === 1, "(setup: the offerer committed, its half is on the way)"); s.w.kill(s.R);
  ok(s.G.ledger.out.length === 1 && s.G.ledger.exp.length === 1, "step 4, the other side leaves after the commit: the offerer's half stays on its way and the other half stays expected");
  const R2 = s.w.spawn(R_SEED, s.rd); s.w.link(); for (let n = 0; n < 8; n++) { s.w.clock += 1000; s.w.tickAll(); s.w.run(); }
  ok(counts(s.G) === "0/1" && counts(R2) === "1/0" && s.G.ledger.out.length === 0 && s.G.ledger.exp.length === 0 && R2.ledger.hold.length === 0 && R2.ledger.out.length === 0, "when it comes back both halves arrive: the trade completes from the saved lists"); }
{ const s = mk(); s.G.swap.offer(DW, RE); s.w.run(); s.R.swap.accept(); s.w.hook = (e) => (e.msg.k === "cf" && e.from.startsWith("r") ? "drop" : null);
  for (let n = 0; n < 4; n++) { s.w.clock += 1000; s.w.tickAll(); s.w.run(); }
  ok(s.R.ledger.hold.length === 0 && s.R.ledger.out.length === 1, "(setup: the other side was paid and its half is on its way)"); s.w.kill(s.G); s.w.hook = null;
  ok(s.R.ledger.out.length === 1, "step 5, the offerer leaves before receiving the other half: that half stays on its way");
  const G2 = s.w.spawn(G_SEED, s.gd); s.w.link(); for (let n = 0; n < 8; n++) { s.w.clock += 1000; s.w.tickAll(); s.w.run(); }
  ok(counts(G2) === "0/1" && counts(s.R) === "1/0" && s.R.ledger.out.length === 0, "and arrives once the offerer is back"); }
// 7. a lantern being traded away: the lantern in hand falls back to the plain one
{ const s = mk({ inv: { driftwood: 0 }, cr: { amber: 1 }, lamp: 1 }); ok(s.G.held.lamp === 1 && s.G.swap.offer(AMBER, RE) && s.G.held.lamp === 0 && s.G.lampDropped, "setting aside the last lantern of the one in hand puts the plain lantern back in hand");
  s.G.swap.cancel(); ok(s.G.cr.amber === 1, "and withdrawing returns the lantern to the pack"); }
// 8. hostile messages
{ const s = mk(); const send = (to, msg, from) => to.hs.forEach(h => h(msg, from)); const before = JSON.stringify([s.G.inv, s.R.inv, s.G.ledger, s.R.ledger]);
  const bad = [{ k: "tro", t: 5, i: DW }, { k: "tro", t: 5, i: DW, j: RE, z: 1 }, { k: "tro", t: 5, i: DW, j: DW }, { k: "tro", t: 5, i: DW, j: 99 }, { k: "tro", t: "5", i: DW, j: RE }, { k: "tro", t: 5.5, i: DW, j: RE }, { k: "tro", t: 0, i: DW, j: RE }, { k: "tro", t: 4294967296, i: DW, j: RE }, { k: "tro", t: 5, i: -1, j: RE },
    { k: "tra", t: 5, z: 1 }, { k: "tra" }, { k: "trn", t: 5 }, { k: "trx", t: 5 }, { k: "trx", t: "x" }, "tro", 7, null, [], { k: 5 }, { k: "trz", t: 5 }];
  for (const m of bad) { send(s.R, m, s.G.id); send(s.G, m, s.R.id); send(s.R, m, "stranger"); }
  s.w.run();
  ok(JSON.stringify([s.G.inv, s.R.inv, s.G.ledger, s.R.ledger]) === before && !s.R.swap.incoming && !s.G.swap.outgoing, "forged or malformed trade messages (bad numbers, extra fields, same kind, unknown kinds, strangers) change nothing");
  ok(s.w.queue.every(e => e.msg.k === "trx"), "the only reply to an accept nobody waits for is a withdrawal"); }
{ const s = mk(); const send = (to, msg, from) => to.hs.forEach(h => h(msg, from));
  s.G.swap.offer(DW, RE); s.w.run(); s.R.swap.accept(); s.w.hook = (e) => (e.msg.k === "cf" ? "drop" : null); s.w.run(); s.w.hook = null; // committed, half not arrived
  const before = JSON.stringify([s.G.inv, s.R.inv, s.G.ledger.out, s.G.ledger.hold]);
  s.w.clock += 5000; send(s.G, { k: "tra", t: 777 }, s.R.id); send(s.G, { k: "trn", t: 777 }, s.R.id); send(s.G, { k: "tra", t: 888 }, s.R.id);
  ok(JSON.stringify([s.G.inv, s.R.inv, s.G.ledger.out, s.G.ledger.hold]) === before && s.G.ledger.out.length === 1, "a repeated accept or decline after the commit changes nothing");
  // a withdrawal for a gift (not a trade) never takes a gift expectation away
  const g = mk(); g.G.give.offer(DW); g.w.run(); g.R.give.accept(); const exp0 = g.R.ledger.exp.length;
  send(g.R, { k: "trx", t: 4242 }, g.G.id); ok(g.R.ledger.exp.length === exp0 && exp0 === 1 && g.R.ledger.hold.length === 0, "a withdrawal naming an ordinary gift's number leaves that gift expected"); }
{ const f = mk(); for (let i = 0; i < 500; i++) f.R.hs.forEach(h => h({ k: "tro", t: i + 1, i: DW, j: RE }, f.G.id)); f.w.run();
  ok(f.R.inv.reeds === 1 && f.R.ledger.hold.length === 0 && f.R.swap.incoming !== null && f.R.swap.incoming.t <= 20, "a flood of 500 trade offers moves nothing, sets nothing aside, and only one offer is ever shown (the first ones; the rest were dropped)"); }
{ const u = mk(); for (const p of u.R.peers.values()) p.tx += 50; u.R.hs.forEach(h => h({ k: "tro", t: 5, i: DW, j: RE }, u.G.id)); ok(!u.R.swap.incoming && u.w.queue.length === 0, "a trade offer from a player far away is ignored"); }
// 9. a gift and a trade at the same time
{ const s = mk({ inv: { driftwood: 2 } }); s.G.give.offer(DW); s.w.run(); ok(!s.G.swap.offer(DW, RE), "a trade cannot be offered while a gift offer of mine is open"); }

// ---- browser harness ----
const require = createRequire(import.meta.url);
let pw;
for (const id of ["playwright", "/opt/node-tools/node_modules/playwright", "playwright-core"]) { try { pw = require(id); break; } catch { /* next */ } }
if (!pw) { console.error("playwright not found"); process.exit(2); }
async function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = "/opt/pw-browsers";
  if (!existsSync(base)) return undefined;
  for (const d of (await readdir(base)).filter(d => d.startsWith("chromium")).sort().reverse())
    for (const rel of ["chrome-linux/chrome", "chrome-linux64/chrome"]) { const p = path.join(base, d, rel); if (existsSync(p)) return p; }
  return undefined;
}
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json" };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/favicon.ico") { res.writeHead(204).end(); return; }
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try { const body = await readFile(file); res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" }).end(body); }
  catch { res.writeHead(404).end("not found"); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/game/`;
const executablePath = await findChrome();
const shots = process.env.SHOTS;
const browser = await pw.chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ["--disable-features=WebRtcHideLocalIpsWithMdns"] });
const errors = [];
function watch(page, label) {
  page.on("pageerror", e => errors.push(`${label}: ${e.message}`));
  page.on("console", m => { if (m.type() === "error" && !/WebSocket connection to 'wss:/.test(m.text()) && !/User-Initiated Abort, reason=Close called/.test(m.text())) errors.push(`${label}: ${m.text()}`); });
}
async function waitFor(page, fn, arg, timeout = 10000) { try { await page.waitForFunction(fn, arg, { timeout, polling: 50 }); return true; } catch { return false; } }
const tv = (page) => page.evaluate(() => window.__longWatch.trade());
const STORE = "vigil.longwatch.v1";

async function scenario(label, mkPage, query, room, opts = {}) {
  console.log(`\n# ${label}`);
  const local = query.includes("net=local");
  const [pageA, pageB] = [await mkPage(), await mkPage()];
  const url = `${base}${query}#room=${room}`;
  await pageA.goto(url); await pageB.goto(url);
  // Give each player a pack through the saved state, then reload so the page reads it (the same path a returning player takes).
  const stock = async (page, inv) => { await page.evaluate(([key, local, inv]) => { const st = local ? sessionStorage : localStorage; const s = JSON.parse(st.getItem(key)); s.inv = { driftwood: 0, reeds: 0, berries: 0, oil: 0, ...inv }; st.setItem(key, JSON.stringify(s)); }, [STORE, local, inv]); await page.reload(); };
  await stock(pageA, { driftwood: 2, oil: 1 }); await stock(pageB, { reeds: 3 });
  const enter = async (...ps) => { for (const p of ps) await p.click("#enter"); };
  const meet = async () => await waitFor(pageA, () => window.__longWatch.peers().length === 1, null, opts.timeout) && await waitFor(pageB, () => window.__longWatch.peers().length === 1, null, opts.timeout);
  await enter(pageA, pageB);
  ok(await meet(), "each page sees exactly one other player");
  const seedA = (await pageA.evaluate(() => window.__longWatch.self())).seed, seedB = (await pageB.evaluate(() => window.__longWatch.self())).seed;
  const near = async (x, y) => {
    await pageA.evaluate(([x, y]) => window.__longWatch.teleport(x, y), [x, y]); await pageB.evaluate(([x, y]) => window.__longWatch.teleport(x, y), [x + 0.8, y]);
    return await waitFor(pageA, ([x, y]) => window.__longWatch.peers().some(p => Math.hypot(p.x - x, p.y - y) < 0.05), [x + 0.8, y], 8000) && await waitFor(pageB, ([x, y]) => window.__longWatch.peers().some(p => Math.hypot(p.x - x, p.y - y) < 0.05), [x, y], 8000);
  };
  const nodes = await pageA.evaluate(() => window.__longWatch.nodes());
  ok(await near(nodes[0].x - 0.2, nodes[0].y), "both stand together");
  ok(await waitFor(pageA, () => window.__longWatch.trade().target !== null, null, 5000) && await waitFor(pageB, () => window.__longWatch.trade().target !== null, null, 5000), "each is in reach of the other");
  let a = await tv(pageA), b = await tv(pageB);
  ok(a.panel && b.panel, "the Trade panel is shown while in a lantern");
  ok(a.inv.driftwood === 2 && b.inv.reeds === 3, "A has 2 driftwood and 1 lamp oil, B has 3 reeds");

  // 1. A offers driftwood for reeds by the real controls.
  await pageA.selectOption("#tradegive", "0"); await pageA.selectOption("#tradewant", "1");
  ok(await waitFor(pageA, () => !document.getElementById("tradego").disabled, null, 3000), "the Offer trade button is enabled");
  await pageB.selectOption("#tradegive", "1");
  await pageA.click("#tradego");
  ok(await waitFor(pageB, () => window.__longWatch.trade().incoming !== null && !document.getElementById("tradebox").hidden, null, 5000), "B sees the offer box");
  const text = await pageB.locator("#tradetext").textContent();
  ok(/offers you one driftwood for one of your reeds/.test(text), `the offer reads: ${text}`);
  a = await tv(pageA); b = await tv(pageB);
  ok(a.inv.driftwood === 1 && a.hold.length === 1 && b.inv.reeds === 3 && b.hold.length === 0, "A's driftwood is set aside, B has not moved anything");
  ok((await pageA.locator("#pack").textContent()).includes("Set aside for a trade: driftwood"), "A's pack line names the item set aside");
  ok(await pageA.evaluate(() => document.querySelector('#givebtns button[data-kind="0"]').disabled), "A's gift buttons wait while the trade is open");
  if (opts.shot && process.env.SHOTS) await pageB.screenshot({ path: path.join(process.env.SHOTS, `${opts.shot}-offer.png`) });

  // 2. B accepts: one driftwood goes to B, one reeds comes to A.
  await pageB.click("#tradeyes");
  ok(await waitFor(pageB, () => window.__longWatch.trade().inv.driftwood === 1 && window.__longWatch.trade().hold.length === 0 && window.__longWatch.trade().out.length === 0, null, 10000), "B received the driftwood and its own reeds left, confirmed");
  ok(await waitFor(pageA, () => window.__longWatch.trade().inv.reeds === 1 && window.__longWatch.trade().out.length === 0 && window.__longWatch.trade().exp.length === 0, null, 10000), "A received the reeds and nothing is left on its way");
  a = await tv(pageA); b = await tv(pageB);
  ok(a.inv.driftwood === 1 && a.inv.reeds === 1 && b.inv.driftwood === 1 && b.inv.reeds === 2 && a.inv.oil === 1, "A: 1 driftwood, 1 reeds; B: 1 driftwood, 2 reeds; nothing else changed");
  ok(a.hold.length === 0 && b.hold.length === 0 && b.got.length === 1 && a.got.length === 1, "no item is left set aside, and each side recorded the half it received");
  ok(await pageA.evaluate(([key, local]) => { const s = JSON.parse((local ? sessionStorage : localStorage).getItem(key)); return s.inv.reeds === 1 && s.inv.driftwood === 1 && s.hold.length === 0; }, [STORE, local]), "A's pack was saved at once");

  // 3. B offers reeds for oil; A says no thanks.
  await pageB.selectOption("#tradegive", "1"); await pageB.selectOption("#tradewant", "7");
  await pageB.click("#tradego");
  ok(await waitFor(pageA, () => window.__longWatch.trade().incoming !== null, null, 5000), "A sees B's offer");
  await pageA.click("#tradeno");
  ok(await waitFor(pageB, () => window.__longWatch.trade().outgoing === null && window.__longWatch.trade().hold.length === 0, null, 5000), "B's offer ends and its reeds are back");
  b = await tv(pageB); a = await tv(pageA);
  ok(b.inv.reeds === 2 && a.inv.oil === 1 && /turned down/.test(b.info), `declined: nothing moved ("${b.info}")`);

  // 4. A offers; B accepts while A's stack asked for... A withdraws before B answers.
  await pageA.selectOption("#tradegive", "0"); await pageA.selectOption("#tradewant", "1");
  await pageA.click("#tradego");
  ok(await waitFor(pageB, () => window.__longWatch.trade().incoming !== null, null, 5000), "B sees an offer again");
  await pageA.click("#tradecancel");
  ok(await waitFor(pageB, () => window.__longWatch.trade().incoming === null && document.getElementById("tradebox").hidden, null, 5000), "the offer disappears from B when A withdraws");
  a = await tv(pageA); ok(a.inv.driftwood === 1 && a.hold.length === 0, "A's driftwood is back in the pack");

  // 5. A offers; B leaves before answering.
  await pageA.click("#tradego");
  ok(await waitFor(pageB, () => window.__longWatch.trade().incoming !== null, null, 5000), "B sees the offer");
  await pageB.click("#leave");
  ok(await waitFor(pageA, () => window.__longWatch.trade().outgoing === null && window.__longWatch.trade().hold.length === 0, null, 8000), "A's offer ends when B leaves");
  a = await tv(pageA); ok(a.inv.driftwood === 1 && /Nothing moved/.test(a.info), "the driftwood is back in A's pack");

  // 6. A trade whose halves were saved mid-way: A committed (its driftwood is on its way, it expects reeds) and closed;
  // B accepted (its reeds are set aside, it expects the driftwood) and closed. Both come back: each half arrives once.
  await pageA.click("#leave");
  const T = 424242;
  await pageA.evaluate(([key, local, T, seedB]) => { const st = local ? sessionStorage : localStorage; const s = JSON.parse(st.getItem(key)); s.inv.driftwood = 0; s.inv.reeds = 1; s.out = [{ t: T, i: 0, s: seedB }]; s.exp = [{ t: T, i: 1, s: seedB }]; st.setItem(key, JSON.stringify(s)); }, [STORE, local, T, seedB]);
  await pageB.evaluate(([key, local, T, seedA]) => { const st = local ? sessionStorage : localStorage; const s = JSON.parse(st.getItem(key)); s.inv.reeds = s.inv.reeds - 1; s.hold = [{ t: T, i: 1, s: seedA, r: 1 }]; s.exp = [{ t: T, i: 0, s: seedA }]; st.setItem(key, JSON.stringify(s)); }, [STORE, local, T, seedA]);
  await pageA.reload(); await pageB.reload();
  const a0 = await tv(pageA), b0 = await tv(pageB);
  ok(a0.out.length === 1 && a0.exp.length === 1 && b0.hold.length === 1 && b0.hold[0].r === 1 && b0.exp.length === 1, "after the reload the lists are all still there (the offerer's none was lost, the accepting side's hold was kept)");
  const dwBefore = b0.inv.driftwood;
  await enter(pageA, pageB); await meet();
  const done = await waitFor(pageA, () => window.__longWatch.trade().inv.reeds === 2 && window.__longWatch.trade().out.length === 0 && window.__longWatch.trade().exp.length === 0, null, 20000);
  if (!done) { const dump = (p) => p.evaluate(() => ({ self: window.__longWatch.self(), peers: window.__longWatch.peers().map(q => ({ id: q.id, seed: q.seed })), t: window.__longWatch.trade() })); console.log("  diagnostics A", JSON.stringify(await dump(pageA)), "B", JSON.stringify(await dump(pageB))); }
  ok(done, "when both are back, the reeds reach A");
  ok(await waitFor(pageB, (d) => window.__longWatch.trade().inv.driftwood === d + 1 && window.__longWatch.trade().hold.length === 0 && window.__longWatch.trade().out.length === 0, dwBefore, 12000), "and the driftwood reaches B; B's hold and on-its-way list are empty");
  await sleep(RESEND_MS * 2 + 1000);
  a = await tv(pageA); b = await tv(pageB);
  ok(a.inv.reeds === 2 && a.inv.driftwood === 0 && b.inv.driftwood === dwBefore + 1 && b.inv.reeds === 1, "after the resends have run again each half was added exactly once");

  // 7. Local only: forged trade messages change nothing.
  if (opts.local) await forged(pageA, pageB, room);
  for (const p of [pageA, pageB]) await p.context().close().catch(() => {});
}

async function forged(pageA, pageB, room) {
  console.log("  hostile messages");
  const idA = await pageA.evaluate(() => window.__longWatch.self().id), idB = await pageB.evaluate(() => window.__longWatch.self().id);
  const E = await pageB.context().newPage();
  await E.goto(`${base}?net=local`);
  const post = (to, from, msgs) => E.evaluate(([room, from, to, msgs]) => { const ch = new BroadcastChannel(`vigil-long-watch:lantern-${room}`); for (const d of msgs) ch.postMessage({ k: "data", d, from, to }); ch.close(); }, [room, from, to, msgs]);
  const before = await tv(pageB), beforeA = await tv(pageA);
  await post(idB, idA, [{ k: "tro", t: 9, i: 0 }, { k: "tro", t: 9, i: 0, j: 0 }, { k: "tro", t: 9, i: 0, j: 99 }, { k: "tro", t: "9", i: 0, j: 1 }, { k: "tro", t: 9, i: 0, j: 1, z: 1 }, { k: "tra", t: 9 }, { k: "trn", t: 9 }, { k: "trx", t: 9 }, { k: "trz" }, "tro", 7], room);
  await post(idA, idB, [{ k: "tra", t: 9 }, { k: "trn", t: 9 }, { k: "trx", t: 9 }, { k: "cf", t: 9, i: 0 }], room);
  await post(idB, "stranger", [{ k: "tro", t: 77, i: 0, j: 1 }, { k: "trx", t: 77 }], room);
  await sleep(700);
  const after = await tv(pageB), afterA = await tv(pageA);
  ok(JSON.stringify(after.inv) === JSON.stringify(before.inv) && after.incoming === null && after.hold.length === before.hold.length && after.exp.length === before.exp.length, "forged or malformed trade messages give B nothing, set nothing aside and show no offer");
  ok(JSON.stringify(afterA.inv) === JSON.stringify(beforeA.inv) && afterA.hold.length === beforeA.hold.length && afterA.out.length === beforeA.out.length, "and change nothing for A either");
  await post(idB, idA, Array.from({ length: 300 }, (_, i) => ({ k: "tro", t: i + 1, i: 0, j: 1 })), room);
  await sleep(500);
  const flood = await tv(pageB);
  ok(JSON.stringify(flood.inv) === JSON.stringify(before.inv) && flood.hold.length === 0, "a flood of 300 forged trade offers sets nothing aside");
  await E.close();
}

// ---- 1. local ----
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
  const mkPage = () => ctx.newPage().then(p => (watch(p, "local"), p));
  await scenario("local transport (BroadcastChannel)", mkPage, "?net=local&respawn=8", 6, { local: true, shot: "swap-local" });
  await ctx.close();
}

// ---- 2. real WebRTC through a local Nostr relay ----
if (!onlyLocal) {
  const relay = await startRelay();
  const c = [await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true }), await browser.newContext({ viewport: { width: 1000, height: 900 } })];
  let i = 0;
  const mkPage = () => c[i++ % 2].newPage().then(p => (watch(p, "webrtc"), p));
  await scenario("Trystero over Nostr + WebRTC (relay on 127.0.0.1)", mkPage, `?net=nostr&respawn=8&relay=${encodeURIComponent(relay.url)}`, 5, { timeout: 30000, shot: "swap-webrtc" });
  for (const x of c) await x.close().catch(() => {});
  relay.close();
}

ok(errors.length === 0, `no console errors${errors.length ? ":\n  " + errors.join("\n  ") : ""}`);
await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
