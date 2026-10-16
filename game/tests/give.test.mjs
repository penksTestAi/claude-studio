#!/usr/bin/env node
// Milestone 4 tests for The Long Watch: the saved pack, and giving (offer, accept, move) without copying or losing.
//
//   node game/tests/give.test.mjs            node checks, local transport, then real Trystero/WebRTC via a local Nostr relay
//   node game/tests/give.test.mjs --local    skip the WebRTC part
//
// Part 0 (node): the saved-pack rules, then the real giving code on a fake mesh where every message of a gift is
// dropped, or either player (or both) is killed and restarted from its saved state, at every step. After every
// delivered message the item must exist exactly once (giver's pack + giver's "on its way" list + receiver's pack = 1),
// and after the players meet again it must arrive once. Hostile messages change nothing.
// Then pages: an offer moves nothing until it is accepted, accept moves exactly one item, the pack survives a reload,
// decline, take-back and a player leaving end an offer with nothing moved, and a gift that was on its way when a page
// closed arrives once after both come back (checked again after the resends have repeated).
// Local only: forged messages. "Online play" here means a local relay on this machine, not the public relays.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startRelay } from "./nostr-relay.mjs";
import { KINDS } from "../js/resources.js";
import { createGive, GIVE_RANGE, OFFER_MS, RESEND_MS } from "../js/give.js";
import { cleanSave, adoptSave, emptyLedger, SOFT_STACK, HARD_STACK, MAX_OUT, MAX_EXP, MAX_GOT } from "../js/inventory.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const onlyLocal = process.argv.includes("--local");

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failures++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---- 0a. node: what is read back from a save is checked ----
console.log("# saved pack rules, in node");
{
  const c = cleanSave({ inv: { driftwood: 3, reeds: -1, berries: 1.5, extra: 9 }, out: [{ t: 5, i: 1, s: 7 }, { t: 5, i: 1, s: 7 }, { t: 0, i: 1, s: 7 }, { t: 6, i: 9, s: 7 }, { t: 6, i: 1, s: -1 }, "x", null], exp: "no", got: [{ t: 9, s: 1 }, { t: 9, s: 1 }, { t: "9", s: 1 }] });
  ok(c.inv.driftwood === 3 && c.inv.reeds === 0 && c.inv.berries === 0 && !("extra" in c.inv), "bad numbers in a saved pack become 0 and unknown kinds are ignored");
  ok(c.out.length === 1 && c.out[0].t === 5 && c.exp.length === 0 && c.got.length === 1, "saved gift lists drop duplicates, bad ids, bad kinds, bad seeds and junk");
  ok(cleanSave(null).inv.reeds === 0 && cleanSave("zap").out.length === 0 && cleanSave({ inv: { reeds: HARD_STACK + 1 } }).inv.reeds === 0, "null, text and an absurd count give an empty pack");
  const big = cleanSave({ out: Array.from({ length: 80 }, (_, i) => ({ t: i + 1, i: 0, s: 1 })), exp: Array.from({ length: 80 }, (_, i) => ({ t: i + 1, i: 0, s: 1 })), got: Array.from({ length: MAX_GOT + 400 }, (_, i) => ({ t: i + 1, s: 1 })) });
  ok(big.out.length === MAX_OUT && big.exp.length === MAX_EXP && big.got.length === MAX_GOT, `the lists are capped (${MAX_OUT}, ${MAX_EXP}, ${MAX_GOT})`);
  const live = { driftwood: 1, reeds: 1, berries: 1 }, led = emptyLedger();
  adoptSave(live, led, { inv: { driftwood: 4, reeds: 0, berries: 2 }, out: [{ t: 3, i: 0, s: 9 }] });
  ok(live.driftwood === 4 && live.reeds === 0 && live.berries === 2 && led.out.length === 1, "adopting another tab's save changes the live pack in place");
}

// ---- 0b. node: giving on a fake mesh, with faults at every step ----
console.log("# giving with faults, in node");
const G_SEED = 111, R_SEED = 222;
function makeWorld() {
  const w = { clock: 0, queue: [], log: [], players: new Map(), nextId: 1, hook: null, delivered: 0 };
  // A "browser": its saved state lives in `disk` (what a reload would find); everything else dies with it.
  w.spawn = (seed, disk) => {
    const id = `${seed === G_SEED ? "g" : "r"}${w.nextId++}`;
    const state = cleanSave(disk.json ? JSON.parse(disk.json) : { inv: disk.inv });
    const p = { id, seed, hs: [], leaves: [], me: { x: 5, y: 5 }, peers: new Map(), inv: state.inv, ledger: { out: state.out, exp: state.exp, got: state.got }, alive: true, events: [] };
    const save = () => { disk.json = JSON.stringify({ inv: p.inv, out: p.ledger.out, exp: p.ledger.exp, got: p.ledger.got }); };
    p.net = {
      selfId: id,
      onMessage: h => p.hs.push(h), onPeerLeave: h => p.leaves.push(h), onPeerJoin() {},
      send(msg, to) { const m = JSON.parse(JSON.stringify(msg)); for (const [oid, o] of w.players) if (oid !== id && o.alive && (!to || to === oid)) w.queue.push({ from: id, to: oid, msg: m }); },
    };
    p.give = createGive(p.net, p.me, p.peers, p.inv, p.ledger, { now: () => w.clock, persist: save, onEvent: (t, d) => p.events.push(t), rand: () => 4242 });
    p.disk = disk; p.save = save;
    w.players.set(id, p);
    return p;
  };
  w.link = () => { // everyone alive sees everyone else alive, with their seed, standing close
    for (const a of w.players.values()) if (a.alive) for (const b of w.players.values()) if (b.alive && a !== b && !a.peers.has(b.id)) a.peers.set(b.id, { id: b.id, seed: b.seed, tx: b.me.x + 1, ty: b.me.y });
  };
  w.kill = (p) => { // the page closes or the browser dies: memory is gone, peers see it leave
    p.alive = false; w.players.delete(p.id);
    w.queue = w.queue.filter(e => e.to !== p.id && e.from !== p.id);
    for (const o of w.players.values()) { if (o.peers.delete(p.id)) o.leaves.forEach(h => h(p.id)); }
  };
  w.step = () => { // deliver one message; returns false when the queue is empty
    const e = w.queue.shift(); if (!e) return false;
    const to = w.players.get(e.to); if (!to || !to.alive) return true;
    w.delivered++;
    const action = w.hook ? w.hook(e) : null;
    if (action === "drop") return true;
    to.hs.forEach(h => h(e.msg, e.from));
    return true;
  };
  w.run = (check) => { let n = 0; while (w.step() && n++ < 200) check && check(); };
  w.tickAll = () => { for (const p of w.players.values()) p.give.tick(); };
  return w;
}
// What exists, read from the two saved states plus the live players (live state is the saved state after a persist).
function snapshot(w, G, R) {
  const read = (p) => p.alive ? { inv: p.inv, out: p.ledger.out, got: p.ledger.got } : cleanSave(JSON.parse(p.disk.json));
  const g = read(G), r = read(R);
  // A way-list entry whose gift the receiver already recorded as received is a stale record (the receipt is still on its way), not an item.
  const live = g.out.filter(e => !r.got.some(x => x.s === G_SEED && x.t === e.t));
  return { gInv: g.inv.driftwood, gOut: live.length, rInv: r.inv.driftwood, total: g.inv.driftwood + live.length + r.inv.driftwood };
}
const KIND0 = 0; // driftwood
// One run: G holds one driftwood, offers it, R accepts. `fault` says what goes wrong at message number `at`.
function runScenario(fault) {
  const w = makeWorld();
  const gd = { inv: { driftwood: 1, reeds: 0, berries: 0 } }, rd = { inv: { driftwood: 0, reeds: 0, berries: 0 } };
  gd.json = JSON.stringify({ inv: gd.inv, out: [], exp: [], got: [] }); rd.json = JSON.stringify({ inv: rd.inv, out: [], exp: [], got: [] });
  let G = w.spawn(G_SEED, gd), R = w.spawn(R_SEED, rd);
  w.link();
  let bad = null, seq = [];
  const check = () => { const s = snapshot(w, G, R); if (s.total !== 1 || s.rInv > 1) bad = bad || `total ${s.total} (giver pack ${s.gInv}, on its way ${s.gOut}, receiver ${s.rInv}) after message ${seq.join(">")}`; };
  let n = 0;
  w.hook = (e) => {
    const idx = n++; seq.push(e.msg.k);
    if (!fault || idx !== fault.at) return null;
    const restartG = () => { w.kill(G); G = w.spawn(G_SEED, gd); };
    const restartR = () => { w.kill(R); R = w.spawn(R_SEED, rd); };
    if (fault.kind === "drop") return "drop";
    if (fault.kind === "killG-before") { restartG(); return "drop"; }
    if (fault.kind === "killR-before") { restartR(); return "drop"; }
    w.after = fault.kind; // "...-after": deliver this message, then restart whoever (done in pumpUntilQuiet)
    return null;
  };
  check();
  G.give.offer(KIND0); check();
  R.events.length = 0;
  // let the offer reach R and have R accept by hand when it shows
  const pumpUntilQuiet = () => {
    for (let guard = 0; guard < 300; guard++) {
      const had = w.step();
      check();
      if (w.after) { const k = w.after; w.after = null; if (k === "killG-after") { w.kill(G); G = w.spawn(G_SEED, gd); } else if (k === "killR-after") { w.kill(R); R = w.spawn(R_SEED, rd); } else if (k === "killBoth-after") { w.kill(G); w.kill(R); G = w.spawn(G_SEED, gd); R = w.spawn(R_SEED, rd); } w.link(); check(); }
      if (R.give.incoming && !R.give.__accepted) { R.give.__accepted = true; R.give.accept(); check(); }
      if (!had && !R.give.incoming) break;
    }
  };
  pumpUntilQuiet();
  // Apply the "after" kinds that fire inside w.hook through w.after: handled above. Now both come back and time passes.
  w.link();
  for (let s = 0; s < 40; s++) { w.clock += 1000; w.tickAll(); pumpUntilQuiet(); check(); }
  const end = snapshot(w, G, R);
  return { bad, end, seq, gotEvent: R.events.includes("received"), giverOut: end.gOut };
}
{
  const base = runScenario(null);
  ok(base.bad === null && base.end.rInv === 1 && base.end.gInv === 0 && base.end.gOut === 0, `no fault: one item moves, giver 0, receiver 1, nothing left on its way (messages ${base.seq.join(">")})`);
  const kinds = ["drop", "killG-before", "killR-before", "killG-after", "killR-after", "killBoth-after"];
  const N = base.seq.length;
  let runs = 0, broken = [], gone = [], dup = [], stuck = [];
  for (let at = 0; at < N; at++) for (const kind of kinds) {
    // "drop" of a message that does not exist in this order is skipped by construction (at < N)
    const r = runScenario({ at, kind }); runs++;
    if (r.bad) broken.push(`${kind}@${at}: ${r.bad}`);
    // The item must end up in exactly one place, and after the players meet again, in the receiver's pack unless the offer ended before it left the giver.
    if (r.end.total !== 1) gone.push(`${kind}@${at}: total ${r.end.total}`);
    if (r.end.rInv > 1) dup.push(`${kind}@${at}`);
    if (r.end.gOut !== 0) stuck.push(`${kind}@${at}`);
  }
  ok(broken.length === 0, `${runs} faulted runs (each of ${N} messages dropped or a player killed and restarted around it): the item existed exactly once after every message${broken.length ? "\n  " + broken.slice(0, 5).join("\n  ") : ""}`);
  ok(stuck.length === 0, `in all ${runs} runs nothing was still "on its way" 40 s after both players were back${stuck.length ? ": " + stuck.slice(0, 5).join(", ") : ""}`);
  ok(gone.length === 0 && dup.length === 0, `in all ${runs} runs the item still existed exactly once at the end and never twice${gone.concat(dup).length ? "\n  " + gone.concat(dup).slice(0, 5).join("\n  ") : ""}`);
}
// A sent gift whose receiver was away is delivered once when they return, even though the giver keeps announcing it.
{
  const w = makeWorld();
  const gd = { json: JSON.stringify({ inv: { driftwood: 0, reeds: 0, berries: 0 }, out: [{ t: 99, i: 0, s: R_SEED }], exp: [], got: [] }) };
  const rd = { json: JSON.stringify({ inv: { driftwood: 0, reeds: 0, berries: 0 }, out: [], exp: [{ t: 99, i: 0, s: G_SEED }], got: [] }) };
  const G = w.spawn(G_SEED, gd); w.clock = 10 * RESEND_MS; w.tickAll(); w.run();
  ok(G.ledger.out.length === 1, "with the receiver away, the gift stays on the giver's way list (not in the pack, not dropped)");
  const R = w.spawn(R_SEED, rd); w.link();
  for (let s = 0; s < 12; s++) { w.clock += RESEND_MS; w.tickAll(); w.run(); }
  ok(R.inv.driftwood === 1 && G.ledger.out.length === 0 && R.ledger.got.length === 1 && R.ledger.exp.length === 0, "the receiver comes back: exactly one item arrives and the giver's list clears");
  // a lost receipt: the giver hears nothing back, announces again; the receiver adds nothing more
  const before = R.inv.driftwood;
  G.ledger.out.push({ t: 99, i: 0, s: R_SEED }); w.clock += RESEND_MS * 2; w.tickAll(); w.run();
  ok(R.inv.driftwood === before && G.ledger.out.length === 0, "a repeated announcement of an already received gift adds nothing and is confirmed again");
}
// A receiver whose expected-gifts list is full never drops an entry: it declines new offers and accept() refuses.
{
  const w = makeWorld();
  const full = Array.from({ length: MAX_EXP }, (_, i) => ({ t: 1000 + i, i: 0, s: 333 }));
  const gd = { json: JSON.stringify({ inv: { driftwood: 1, reeds: 0, berries: 0 }, out: [], exp: [], got: [] }) }, rd = { json: JSON.stringify({ inv: { driftwood: 0, reeds: 0, berries: 0 }, out: [], exp: full, got: [] }) };
  const G = w.spawn(G_SEED, gd), R = w.spawn(R_SEED, rd); w.link();
  G.give.offer(0); w.run();
  ok(!R.give.incoming && !G.give.outgoing && G.inv.driftwood === 1 && R.ledger.exp.length === MAX_EXP, "a receiver with a full expected-gifts list declines the offer; nothing is dropped from the list");
  R.ledger.exp.length = MAX_EXP - 1; w.clock += 1000; G.give.offer(0); w.run();
  ok(!!R.give.incoming, "with room in the list the offer is shown");
  R.ledger.exp.push({ t: 5, i: 0, s: 333 }); // the list fills up before the player presses Accept
  const first = R.ledger.exp[0];
  ok(!R.give.accept() && R.ledger.exp.length === MAX_EXP && R.ledger.exp[0] === first && !R.give.incoming, "accept() refuses when the list is full and drops no entry");
}
// Timeouts, declines, busy, range, full packs and hostile messages: nothing moves.
{
  const mk = () => {
    const w = makeWorld();
    const gd = { json: JSON.stringify({ inv: { driftwood: 1, reeds: 1, berries: 0 }, out: [], exp: [], got: [] }) }, rd = { json: JSON.stringify({ inv: { driftwood: 0, reeds: 0, berries: 0 }, out: [], exp: [], got: [] }) };
    const G = w.spawn(G_SEED, gd), R = w.spawn(R_SEED, rd); w.link();
    return { w, G, R, gd, rd };
  };
  const total = ({ G, R }) => G.inv.driftwood + G.inv.reeds + G.ledger.out.length + R.inv.driftwood + R.inv.reeds;
  { const s = mk(); s.G.give.offer(0); s.w.run(); ok(!!s.R.give.incoming && s.G.give.outgoing, "an offer shows up for the receiver");
    ok(s.G.inv.driftwood === 1 && s.R.inv.driftwood === 0, "before the receiver accepts, nothing has moved");
    s.w.clock = OFFER_MS + 1; s.w.tickAll(); s.w.run();
    ok(!s.G.give.outgoing && !s.R.give.incoming && s.G.inv.driftwood === 1 && total(s) === 2, "an unanswered offer times out on both sides, item stays with the giver");
    ok(!s.R.give.accept() && s.R.inv.driftwood === 0, "a late accept does nothing"); }
  { const s = mk(); s.G.give.offer(0); s.w.run(); s.R.give.decline(); s.w.run(); ok(!s.G.give.outgoing && s.G.inv.driftwood === 1 && s.R.inv.driftwood === 0, "decline ends the offer, item stays with the giver"); }
  { const s = mk(); s.G.give.offer(0); s.w.run(); s.G.give.cancel(); s.w.run(); ok(!s.R.give.incoming && s.G.inv.driftwood === 1, "taking an offer back removes it from the receiver"); }
  { const s = mk(); s.G.give.offer(0); s.w.run(); s.R.give.accept(); const accepted = s.R.ledger.exp.length === 1; s.G.give.cancel(); s.w.run(); s.w.run(); ok(accepted && s.G.inv.driftwood === 1 && s.R.inv.driftwood === 0 && s.R.ledger.exp.length === 0, "taking back just as the receiver accepts: nothing moves, the stale accept is cleared"); }
  { const s = mk(); ok(s.G.give.offer(0) && !s.G.give.offer(1), "only one offer at a time"); s.w.run();
    ok(s.R.give.incoming.i === 0, "the receiver sees kind 0"); }
  { const s = mk(); s.G.inv.driftwood = 0; ok(!s.G.give.offer(0), "no offer without the item"); ok(!s.G.give.offer(7) && !s.G.give.offer(-1) && !s.G.give.offer(1.5) && !s.G.give.offer("0"), "bad kinds are refused"); }
  { const s = mk(); for (const p of s.G.peers.values()) p.tx += GIVE_RANGE + 1; ok(!s.G.give.offer(0), `no offer to a player farther than ${GIVE_RANGE} tiles`); }
  { const s = mk(); s.R.inv.driftwood = SOFT_STACK; s.G.give.offer(0); s.w.run(); ok(!s.G.give.outgoing && !s.R.give.incoming && s.G.inv.driftwood === 1, `a receiver with ${SOFT_STACK} of that kind declines it`); }
  { const s = mk(); s.G.give.offer(0); s.w.run(); s.R.give.accept(); s.w.run(); ok(s.R.inv.driftwood === 1 && s.G.inv.driftwood === 0 && s.G.ledger.out.length === 0 && s.G.events.includes("delivered") && s.R.events.includes("received"), "both confirm: one item moves, and both sides are told"); }
  { const s = mk(); s.G.give.offer(0); s.w.run(); const gid = s.G.id; s.w.kill(s.G); ok(!s.R.give.incoming && s.R.events.includes("lost"), "the giver leaving ends the receiver's offer"); }
  { const s = mk(); s.G.give.offer(0); s.w.run(); const rid = s.R.id; s.w.kill(s.R); ok(!s.G.give.outgoing && s.G.inv.driftwood === 1 && s.G.events.includes("lost"), "the receiver leaving ends the giver's offer, item still in the pack"); }
  // hostile
  { const s = mk(); const send = (to, msg, from) => to.hs.forEach(h => h(msg, from)); const before = total(s);
    const bad = [{ k: "cf", t: 5, i: 0 }, { k: "cf", t: 5 }, { k: "cf", t: 5, i: 0, z: 1 }, { k: "cf", t: "5", i: 0 }, { k: "cf", t: 5.5, i: 0 }, { k: "cf", t: 0, i: 0 }, { k: "cf", t: 5, i: 9 }, { k: "cf", t: 4294967296, i: 0 },
      { k: "ac", t: 5 }, { k: "rc", t: 5 }, { k: "dc", t: 5 }, { k: "cx", t: 5 }, { k: "of", t: 5, i: 0, z: 1 }, { k: "of", t: 5 }, { k: "of", t: 5, i: 7 }, { k: "of", t: -5, i: 0 }, { k: "of", t: "x", i: 0 }, { k: "of", i: 0 }, "cf", 7, null, [], { k: 5 }, { k: "zap", t: 5 }];
    for (const m of bad) { send(s.R, m, s.G.id); send(s.G, m, s.R.id); send(s.R, m, "stranger"); }
    s.w.run();
    ok(total(s) === before && !s.R.give.incoming && !s.G.give.outgoing && s.R.inv.driftwood === 0, "forged or malformed messages (bad numbers, extra fields, unknown kinds, strangers) change nothing");
    send(s.R, { k: "cf", t: 5, i: 0 }, s.G.id); ok(s.R.inv.driftwood === 0, "a commit for a gift that was never accepted adds nothing");
    s.w.clock += 5000; // the forged flood above used up this peer's allowance (10 a second); real messages come later
    // an accept that is not for the current offer, a commit with the wrong kind or from the wrong seed
    s.G.give.offer(0); s.w.run(); send(s.G, { k: "ac", t: 4243 }, s.R.id); ok(s.G.inv.driftwood === 1, "an accept with the wrong gift number moves nothing");
    s.R.give.accept(); s.w.run(); // real one completes it
    const exp0 = s.R.inv.driftwood; send(s.R, { k: "cf", t: 4242, i: 0 }, s.G.id); ok(s.R.inv.driftwood === exp0, "replaying the real commit adds nothing");
    ok(s.R.inv.driftwood === 1 && total(s) === before, "and the real gift arrived once");
    // a wrong-kind commit for an accepted gift
    const t2 = mk(); t2.G.give.offer(1); t2.w.run(); t2.R.give.accept(); t2.G.ledger.out.length = 0; t2.G.inv.reeds--; send(t2.R, { k: "cf", t: 4242, i: 0 }, t2.G.id);
    ok(t2.R.inv.driftwood === 0 && t2.R.inv.reeds === 0, "a commit that names a different kind than the accepted one adds nothing");
    // an offer from out of range is ignored
    const u = mk(); for (const p of u.R.peers.values()) p.tx += 50; send(u.R, { k: "of", t: 5, i: 0 }, u.G.id); ok(!u.R.give.incoming, "an offer from a player far away is ignored");
    // flooding
    const f = mk(); for (let i = 0; i < 500; i++) send(f.R, { k: "of", t: i + 1, i: 0 }, f.G.id); ok(f.R.inv.driftwood === 0, "a flood of offers moves nothing (and only one is ever shown)"); }
}

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
// A page that closes a WebRTC connection on purpose (Leave, reload) makes the other side's Trystero log an abort; that is the test's doing.
function watch(page, label) {
  page.on("pageerror", e => errors.push(`${label}: ${e.message}`));
  page.on("console", m => { if (m.type() === "error" && !/WebSocket connection to 'wss:/.test(m.text()) && !/User-Initiated Abort, reason=Close called/.test(m.text())) errors.push(`${label}: ${m.text()}`); });
}
async function waitFor(page, fn, arg, timeout = 10000) {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 50 }); return true; } catch { return false; }
}
const gv = (page) => page.evaluate(() => window.__longWatch.give());
const total = (inv) => inv.driftwood + inv.reeds + inv.berries;
const STORE = "vigil.longwatch.v1";

async function scenario(label, mk, query, room, opts = {}) {
  console.log(`\n# ${label}`);
  const local = query.includes("net=local");
  const [pageA, pageB] = [await mk(), await mk()];
  const url = `${base}${query}#room=${room}`;
  await pageA.goto(url); await pageB.goto(url);
  const enter = async (...ps) => { for (const p of ps) await p.click("#enter"); };
  const meet = async () => await waitFor(pageA, () => window.__longWatch.peers().length === 1, null, opts.timeout) && await waitFor(pageB, () => window.__longWatch.peers().length === 1, null, opts.timeout);
  await enter(pageA, pageB);
  ok(await meet(), "each page sees exactly one other player");
  const nodes = await pageA.evaluate(() => window.__longWatch.nodes());
  const seedA = (await pageA.evaluate(() => window.__longWatch.self())).seed, seedB = (await pageB.evaluate(() => window.__longWatch.self())).seed;
  const idOf = (p) => p.evaluate(() => window.__longWatch.self().id);
  const near = async (x, y) => { // both stand beside (x, y), each sure the other is there
    await pageA.evaluate(([x, y]) => window.__longWatch.teleport(x, y), [x, y]); await pageB.evaluate(([x, y]) => window.__longWatch.teleport(x, y), [x + 0.8, y]);
    return await waitFor(pageA, ([x, y]) => window.__longWatch.peers().some(p => Math.hypot(p.x - x, p.y - y) < 0.05), [x + 0.8, y], 8000) && await waitFor(pageB, ([x, y]) => window.__longWatch.peers().some(p => Math.hypot(p.x - x, p.y - y) < 0.05), [x, y], 8000);
  };
  await waitFor(pageA, () => window.__longWatch.gather().synced, null, 6000); await waitFor(pageB, () => window.__longWatch.gather().synced, null, 6000);

  // A gathers a driftwood (node 0) and a reeds (node 14): the real way to get items.
  for (const n of [nodes[0], nodes[14]]) {
    await near(n.x - 0.2, n.y);
    await pageA.evaluate(() => window.__longWatch.pick());
    await waitFor(pageA, () => true, null, 100);
    const want = (await gv(pageA)).inv; const sum0 = total(want);
    await waitFor(pageA, (s) => { const g = window.__longWatch.give().inv; return g.driftwood + g.reeds + g.berries > s; }, sum0, 5000);
  }
  let a = await gv(pageA);
  ok(a.inv.driftwood === 1 && a.inv.reeds === 1 && total((await gv(pageB)).inv) === 0, "A gathered one driftwood and one reeds; B has nothing");
  ok((await pageA.locator("#pack").textContent()).startsWith("Pack (saved in this browser)"), "the pack line says it is saved in this browser");
  ok(await pageA.evaluate((k) => { const raw = (k.local ? sessionStorage : localStorage).getItem(k.key); const s = JSON.parse(raw); return s.inv.driftwood === 1 && s.inv.reeds === 1; }, { local, key: STORE }), "the pack was saved to the browser's storage at once, not on a timer");
  const start = total(a.inv);

  // 1. A offers driftwood by the button. Nothing moves until B accepts.
  ok(await waitFor(pageA, () => window.__longWatch.give().target !== null, null, 5000), "A is in reach of B");
  ok(!await pageA.evaluate(() => document.querySelector('#givebtns button[data-kind="0"]').disabled) && await pageA.evaluate(() => document.querySelector('#givebtns button[data-kind="2"]').disabled), "A's Give driftwood is enabled; Give oil berries is disabled (A has none)");
  await pageA.click('#givebtns button[data-kind="0"]');
  ok(await waitFor(pageB, () => window.__longWatch.give().incoming !== null && !document.getElementById("offerbox").hidden, null, 5000), "B sees the offer box");
  const offerText = await pageB.locator("#offertext").textContent();
  ok(/offers you one driftwood/.test(offerText), `the offer reads: ${offerText}`);
  await sleep(600);
  a = await gv(pageA); let b = await gv(pageB);
  ok(a.inv.driftwood === 1 && b.inv.driftwood === 0 && a.out.length === 0 && b.exp.length === 0, "before B accepts, nothing has moved and nothing is on its way");
  if (shots) await pageB.screenshot({ path: path.join(shots, `${opts.shot}-offer.png`) });
  await pageB.click("#offeryes");
  ok(await waitFor(pageB, () => window.__longWatch.give().inv.driftwood === 1, null, 6000), "B accepted: B now has the driftwood");
  ok(await waitFor(pageA, () => window.__longWatch.give().inv.driftwood === 0 && window.__longWatch.give().out.length === 0, null, 6000), "A's driftwood is gone and the gift is confirmed (nothing left on its way)");
  a = await gv(pageA); b = await gv(pageB);
  ok(total(a.inv) + total(b.inv) === start && b.got.length === 1 && b.exp.length === 0, "the item count over both players is unchanged, and B recorded the gift as received");
  ok(/confirmed/.test(a.info) && /received one driftwood/.test(b.info), `both are told: "${a.info}" / "${b.info}"`);
  ok((await pageB.locator("#pack").textContent()).includes("Driftwood 1"), "B's pack line shows the driftwood");

  // 2. The pack survives a reload (and so does the received-gift record).
  await pageB.reload();
  const bb = await gv(pageB);
  ok(bb.inv.driftwood === 1 && bb.got.length === 1, "after a reload B still has the driftwood and its record of the gift");
  await pageB.click("#enter");
  ok(await meet(), "B is back in the lantern after the reload");
  ok(await near(nodes[0].x - 0.2, nodes[0].y), "both stand together again");

  // 3. B offers it back; A says no thanks. Nothing moves.
  ok(await waitFor(pageB, () => window.__longWatch.give().target !== null, null, 5000), "B is in reach of A");
  await pageB.click('#givebtns button[data-kind="0"]');
  ok(await waitFor(pageA, () => window.__longWatch.give().incoming !== null, null, 5000), "A sees B's offer");
  await pageA.click("#offerno");
  ok(await waitFor(pageB, () => window.__longWatch.give().outgoing === null && /did not take/.test(window.__longWatch.give().info), null, 5000), "B is told A did not take it");
  a = await gv(pageA); b = await gv(pageB);
  ok(a.inv.driftwood === 0 && b.inv.driftwood === 1 && a.inv.reeds === 1, "after a decline nothing moved");

  // 4. A offers reeds and takes the offer back.
  await pageA.click('#givebtns button[data-kind="1"]');
  ok(await waitFor(pageB, () => window.__longWatch.give().incoming !== null, null, 5000), "B sees A's reeds offer");
  await pageA.click("#givecancel");
  ok(await waitFor(pageB, () => window.__longWatch.give().incoming === null && document.getElementById("offerbox").hidden, null, 5000), "the offer disappears from B when A takes it back");
  a = await gv(pageA); ok(a.inv.reeds === 1 && !a.outgoing, "A still has the reeds");

  // 5. A offers reeds and B leaves before answering: the offer ends, the reeds stay with A.
  await pageA.click('#givebtns button[data-kind="1"]');
  ok(await waitFor(pageB, () => window.__longWatch.give().incoming !== null, null, 5000), "B sees the offer again");
  await pageB.click("#leave");
  ok(await waitFor(pageA, () => window.__longWatch.give().outgoing === null, null, 8000), "A's offer ends when B leaves");
  a = await gv(pageA); ok(a.inv.reeds === 1 && a.out.length === 0 && /Nothing moved/.test(a.info), "the reeds are still in A's pack and nothing is on its way");

  // 6. A gift that was on its way when a page closed. A had taken the reeds out and saved it (as after the accept), and
  // closed before the receipt. B had accepted and saved too. Both come back: exactly one item arrives, even after resends.
  await pageA.click("#leave"); // saves
  const T = 31337;
  await pageA.evaluate(([key, local, T, seedB]) => { const st = local ? sessionStorage : localStorage; const s = JSON.parse(st.getItem(key)); s.inv.reeds = 0; s.out = [{ t: T, i: 1, s: seedB }]; st.setItem(key, JSON.stringify(s)); }, [STORE, local, T, seedB]);
  await pageB.evaluate(([key, local, T, seedA]) => { const st = local ? sessionStorage : localStorage; const s = JSON.parse(st.getItem(key)); s.exp = [{ t: T, i: 1, s: seedA }]; st.setItem(key, JSON.stringify(s)); }, [STORE, local, T, seedA]);
  await pageA.reload(); await pageB.reload();
  const a0 = await gv(pageA), b0 = await gv(pageB);
  ok(a0.inv.reeds === 0 && a0.out.length === 1 && b0.exp.length === 1 && b0.inv.reeds === 0, "after the reload the reeds are in no pack: A lists them as on their way, B lists them as expected");
  ok((await pageA.locator("#pack").textContent()).includes("On its way to another player"), "A's pack line says what is on its way");
  const bReeds0 = b0.inv.reeds, totalBefore = total(a0.inv) + total(b0.inv) + a0.out.length;
  await enter(pageA, pageB); await meet();
  const arrived = await waitFor(pageB, () => window.__longWatch.give().inv.reeds === 1, null, 12000);
  if (!arrived) { const dump = (p) => p.evaluate(() => ({ self: window.__longWatch.self(), links: window.__longWatch.linkHistory(), peers: window.__longWatch.peers().map(q => ({ id: q.id, seed: q.seed })), give: window.__longWatch.give() })); console.log("  diagnostics A", JSON.stringify(await dump(pageA)), "B", JSON.stringify(await dump(pageB))); }
  ok(arrived, "when both are back, the reeds arrive");
  ok(await waitFor(pageA, () => window.__longWatch.give().out.length === 0, null, 8000), "and A's list of gifts on their way clears");
  await sleep(RESEND_MS * 2 + 1000);
  a = await gv(pageA); b = await gv(pageB);
  ok(b.inv.reeds === bReeds0 + 1 && total(a.inv) + total(b.inv) + a.out.length === totalBefore && b.got.some(e => e.t === T), "after the resends have run again, the reeds were added exactly once and the total is unchanged");

  // 7. Local: forged messages.
  if (opts.local) await forged(pageA, pageB);

  for (const p of [pageA, pageB]) await p.context().close().catch(() => {});
}

async function forged(pageA, pageB) {
  console.log("  hostile messages");
  const idA = await pageA.evaluate(() => window.__longWatch.self().id);
  const E = await pageB.context().newPage();
  await E.goto(`${base}?net=local`);
  const post = (to, from, msgs, room) => E.evaluate(([room, from, to, msgs]) => {
    const ch = new BroadcastChannel(`vigil-long-watch:lantern-${room}`);
    for (const d of msgs) ch.postMessage({ k: "data", d, from, to });
    ch.close();
  }, [room, from, to, msgs]);
  const idB = await pageB.evaluate(() => window.__longWatch.self().id);
  const before = await gv(pageB), beforeA = await gv(pageA);
  await post(idB, idA, [{ k: "cf", t: 9, i: 0 }, { k: "cf", t: 9, i: 1 }, { k: "cf", t: 9 }, { k: "cf", t: "9", i: 0 }, { k: "of", t: 9, i: 0, z: 1 }, { k: "of", t: 9, i: 7 }, { k: "of", t: 1.5, i: 0 }, { k: "rc", t: 9 }, { k: "ac", t: 9 }, { k: "zap" }, "cf", 7], 6);
  await post(idA, idB, [{ k: "ac", t: 9 }, { k: "rc", t: 9 }, { k: "cf", t: 9, i: 0 }, { k: "dc", t: 9 }], 6);
  await post(idB, "stranger", [{ k: "of", t: 77, i: 0 }, { k: "cf", t: 77, i: 0 }], 6);
  await sleep(700);
  const after = await gv(pageB), afterA = await gv(pageA);
  ok(JSON.stringify(after.inv) === JSON.stringify(before.inv) && after.incoming === null && after.exp.length === before.exp.length, "forged or malformed messages from a known player or a stranger give B nothing and show no offer");
  ok(JSON.stringify(afterA.inv) === JSON.stringify(beforeA.inv) && afterA.out.length === beforeA.out.length, "and change nothing for A either");
  await post(idB, idA, Array.from({ length: 300 }, (_, i) => ({ k: "cf", t: i + 1, i: 0 })), 6);
  await sleep(500);
  ok(JSON.stringify((await gv(pageB)).inv) === JSON.stringify(before.inv), "a flood of 300 forged commits gives nothing");
  await E.close();
}

// ---- 1. local ----
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
  const mk = () => ctx.newPage().then(p => (watch(p, "local"), p));
  await scenario("local transport (BroadcastChannel)", mk, "?net=local&respawn=8", 6, { local: true, respawn: 8, shot: "give-local" });
  await ctx.close();
}

// ---- 2. real WebRTC through a local Nostr relay ----
if (!onlyLocal) {
  const relay = await startRelay();
  const c = [await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true }), await browser.newContext({ viewport: { width: 1000, height: 900 } })];
  let i = 0;
  const mk = () => c[i++ % 2].newPage().then(p => (watch(p, "webrtc"), p));
  await scenario("Trystero over Nostr + WebRTC (relay on 127.0.0.1)", mk, `?net=nostr&respawn=8&relay=${encodeURIComponent(relay.url)}`, 5, { timeout: 30000, respawn: 8, shot: "give-webrtc" });
  for (const x of c) await x.close().catch(() => {});
  relay.close();
}

ok(errors.length === 0, `no console errors${errors.length ? ":\n  " + errors.join("\n  ") : ""}`);
await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
