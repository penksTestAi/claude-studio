#!/usr/bin/env node
// Milestone 6 tests for The Long Watch: beacons fuelled together, and the presence watchdog.
//
//   node game/tests/beacon.test.mjs            node checks, local transport, then real Trystero/WebRTC via a local Nostr relay
//   node game/tests/beacon.test.mjs --local    skip the WebRTC part
//
// Part 0 (node): the shares are a grow-only counter (merge keeps the larger, never lowers, order and repeats do not
// matter), a beacon needs both enough fuel and two players, every cap (one player's share 16, 24 players counted per
// beacon, the item in the pack) refuses without changing anything, messages are validated on a fake mesh, and the
// presence watchdog resends a lost "hi". Then pages: fuel added on one page shows on the others; one player alone
// cannot light a beacon however much they add; two players adding at the same moment lose nothing; a lit beacon
// lights the ground for the others; a late joiner gets the shares; a reload cannot add more than the cap; forged
// messages (local run) change nothing.
// SHOTS=dir saves before and after screenshots at 375 and 1100 px wide.
import { createServer } from "node:http";
import { readFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startRelay } from "./nostr-relay.mjs";
import { generateWorld, T, isBlocked } from "../js/world.js";
import { KINDS } from "../js/resources.js";
import { createShares, canAdd, createBeacons, BEACON_NEED, MIN_PLAYERS, MAX_OWN, MAX_ENTRIES, BEACON_RANGE, WORTH, LIT_RADIUS } from "../js/beacon.js";
import { createPresence, MAX_PEERS } from "../js/presence.js";
import { lightFor } from "../js/nightclock.js";
import { withinSizeCap } from "../js/net/transport.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const onlyLocal = process.argv.includes("--local");

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failures++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const STORE = "vigil.longwatch.v1";
const HOUR = 3;
const world = generateWorld();
const beaconList = world.landmarks.filter(l => l.kind === "beacon");
const seeds = (n, from = 1000) => Array.from({ length: n }, (_, i) => from + i * 7919);

// ---- 0. node: the rules ----
console.log("# beacon rules, in node");
{
  ok(beaconList.length === 4, "the island has four beacons");
  ok(BEACON_NEED === 12 && MIN_PLAYERS === 2 && MAX_OWN === 16 && MAX_ENTRIES === 24 && MAX_OWN >= BEACON_NEED, "limits: 12 fuel, 2 players, 16 per player, 24 players counted, and one player could reach the fuel alone");
  const s = createShares(4);
  ok(s.merge(0, 111, 5) === "new" && s.merge(0, 111, 3) === "" && s.own(0, 111) === 5, "a share never goes down: a smaller number is ignored");
  ok(s.merge(0, 111, 5) === "" && s.merge(0, 111, 8) === "grew" && s.fuel(0) === 8, "a repeat changes nothing; a larger number grows the share");
  for (const [b, sd, n] of [[4, 1, 1], [-1, 1, 1], [0, 1, 0], [0, 1, 17], [0, 1, 1.5], [0, 1, "3"], [0, -1, 1], [0, 2 ** 32, 1], [0, 1.5, 1], [0, 1, NaN], [0, 1, null], ["0", 1, 1], [0.5, 1, 1]]) {
    const before = JSON.stringify(s.entries()); const r = s.merge(b, sd, n);
    ok(r === "" && JSON.stringify(s.entries()) === before, `a bad share (${JSON.stringify([b, sd, n])}) is refused`);
  }
  // Lighting: fuel AND two players.
  const a = createShares(4);
  a.merge(0, 1, 16);
  ok(a.fuel(0) === 16 && a.players(0) === 1 && !a.lit(0), "one player alone with 16 fuel (more than enough) does not light a beacon");
  a.merge(1, 1, 6); a.merge(1, 2, 5);
  ok(a.fuel(1) === 11 && a.players(1) === 2 && !a.lit(1), "two players with 11 fuel: not lit");
  a.merge(1, 2, 6);
  ok(a.fuel(1) === 12 && a.lit(1), "two players with exactly 12 fuel: lit");
  a.merge(0, 2, 1);
  ok(a.lit(0), "the alone-player's beacon lights the moment a second player adds 1");
  let wasLit = true; for (const [b, sd, n] of [[0, 1, 1], [1, 1, 1], [1, 2, 2], [0, 9, 3]]) { a.merge(b, sd, n); wasLit = wasLit && a.lit(0) && a.lit(1); }
  ok(wasLit, "a lit beacon stays lit whatever else arrives (the counters only grow)");
  ok(!a.lit(2) && !a.lit(3), "the other beacons are not affected");
  // Concurrency: any order and any repeats give the same state.
  let seed = 4242; const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  const ops = []; for (const sd of seeds(6)) for (let b = 0; b < 4; b++) for (let n = 1; n <= 1 + Math.floor(rnd() * 16); n++) ops.push([b, sd, n]);
  const ref = createShares(4); for (const o of ops) ref.merge(...o);
  let same = true;
  for (let t = 0; t < 30; t++) {
    const r2 = createShares(4), order = ops.map(o => [rnd(), o]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
    for (const o of order) { r2.merge(...o); if (rnd() < 0.3) r2.merge(...o); }
    if (JSON.stringify(r2.entries().sort()) !== JSON.stringify(ref.entries().sort())) same = false;
  }
  ok(same, "30 shuffled copies with repeats of the same updates all end in the same shares (a G-counter)");
  // Caps.
  const big = createShares(4); const ids = seeds(MAX_ENTRIES + 3);
  for (const sd of ids) big.merge(0, sd, 1);
  ok(big.players(0) === MAX_ENTRIES && ids.slice(0, MAX_ENTRIES).every(sd => big.own(0, sd) === 1) && big.own(0, ids[MAX_ENTRIES]) === 0, `with ${MAX_ENTRIES} players counted, new ones are refused and no earlier one is dropped`);
  ok(big.merge(0, ids[0], 9) === "grew" && big.own(0, ids[0]) === 9, "but a counted player can still add more");
  const pack = (o = {}) => ({ driftwood: 5, reeds: 5, berries: 5, ...o });
  const c0 = createShares(4);
  ok(canAdd(c0, 0, 1, pack(), "driftwood").ok && canAdd(c0, 0, 1, pack(), "berries").ok, "driftwood and oil berries can be added");
  for (const bad of ["reeds", "wick", "__proto__", "constructor", "", null, 3]) ok(!canAdd(c0, 0, 1, pack(), bad).ok, `${String(bad) || "empty"} cannot be burned`);
  ok(canAdd(c0, 0, 1, pack({ driftwood: 0 }), "driftwood").why === "missing", "no item in the pack: refused");
  c0.merge(0, 1, 15);
  ok(canAdd(c0, 0, 1, pack(), "berries").why === "full" && canAdd(c0, 0, 1, pack(), "driftwood").ok, "at 15 of 16 a 2-fuel item is refused and a 1-fuel item still fits");
  c0.merge(0, 1, 16);
  ok(canAdd(c0, 0, 1, pack(), "driftwood").why === "full", "at 16 of 16 nothing more can be added");
  const crowd = createShares(4); for (const sd of ids.slice(0, MAX_ENTRIES)) crowd.merge(0, sd, 1);
  ok(crowd.players(0) === MAX_ENTRIES && crowd.lit(0) && canAdd(crowd, 0, 999999, pack(), "driftwood").why === "lit" && canAdd(crowd, 0, ids[0], pack(), "driftwood").why === "lit", "a beacon with 24 players counted already holds 24 fuel, so it is lit and takes no more: a 25th player's item is never taken and then lost");
}

// ---- fake mesh ----
function mesh(ids) {
  const fakes = new Map();
  for (const id of ids) {
    const f = { id, hs: [], joins: [], leaves: [], sent: [], queue: [], peers: new Map(), me: {}, clock: 0 };
    f.net = {
      selfId: id, onMessage: h => f.hs.push(h), onPeerLeave: h => f.leaves.push(h), onPeerJoin: h => f.joins.push(h),
      send(msg, to) { f.sent.push([msg, to]); for (const [oid, o] of fakes) if (oid !== id && (!to || to === oid)) o.queue.push([JSON.parse(JSON.stringify(msg)), id]); },
    };
    fakes.set(id, f);
  }
  const pump = () => { let moved = true; while (moved) { moved = false; for (const f of fakes.values()) while (f.queue.length) { moved = true; const [m, from] = f.queue.shift(); f.hs.forEach(h => h(m, from)); } } };
  return { fakes, pump };
}
{
  console.log("# the fuel messages, on a fake mesh");
  const m = mesh(["a", "b", "c"]); const t = { v: 0 };
  const nodes = {};
  for (const id of ["a", "b", "c"]) {
    const f = m.fakes.get(id); f.me = { id: "me", seed: { a: 111, b: 222, c: 333 }[id], x: beaconList[0].x + 1, y: beaconList[0].y };
    for (const o of ["a", "b", "c"]) if (o !== id) f.peers.set(o, { id: o, seed: { a: 111, b: 222, c: 333 }[o] });
    const inv = Object.fromEntries(KINDS.map(k => [k, 40])), events = [];
    nodes[id] = { f, inv, events, b: createBeacons(f.net, f.me, f.peers, inv, beaconList, { now: () => t.v, persist() { nodes[id].saves = (nodes[id].saves || 0) + 1; }, onEvent: (...a) => events.push(a) }) };
  }
  const { a, b, c } = nodes;
  t.v = 2000; for (const n of [a, b, c]) n.b.tick(); m.pump(); // everyone synced
  const r = a.b.add("driftwood"); m.pump();
  ok(r.ok && a.inv.driftwood === 39 && a.b.shares.own(0, 111) === 1 && b.b.shares.own(0, 111) === 1 && c.b.shares.fuel(0) === 1, "adding one driftwood uses exactly one item, is saved, and the others count it");
  ok(a.saves === 1, "the pack was saved in the same step as the change");
  const fu = a.f.sent.map(([x]) => x).filter(x => x.k === "fu");
  ok(fu.length === 1 && Object.keys(fu[0]).length === 3 && Number.isInteger(fu[0].b) && Number.isInteger(fu[0].n) && withinSizeCap(fu[0]), "the fuel message is three numbers and small");
  a.b.add("berries"); m.pump();
  ok(a.inv.berries === 39 && b.b.shares.own(0, 111) === 3, "oil berries are worth 2 fuel");
  // A far player cannot add; an item that is not there cannot be added.
  c.f.me.x = beaconList[0].x + BEACON_RANGE + 0.5;
  const before = JSON.stringify(c.inv); const rf = c.b.add("driftwood");
  ok(!rf.ok && rf.why === "far" && JSON.stringify(c.inv) === before && c.b.shares.own(0, 333) === 0, "farther than the beacon range: refused, the pack is unchanged");
  c.f.me.x = beaconList[0].x + BEACON_RANGE - 0.05;
  ok(c.b.near() === 0, "just inside the range counts as near");
  c.f.me.x = beaconList[0].x + 1;
  // Newcomer message and the resend.
  a.f.joins.forEach(h => h("b")); const last = a.f.sent.at(-1);
  ok(last[1] === "b" && last[0].k === "fu" && last[0].n === 3, "a newcomer is told my share straight away");
  t.v += 5001; a.b.tick(); ok(a.f.sent.at(-1)[0].k === "fu" && a.f.sent.at(-1)[1] === undefined, "my share is repeated to everyone every 5 seconds");
  // Lighting on a fake mesh, with the event.
  c.events.length = 0; b.events.length = 0;
  for (let i = 0; i < 9; i++) a.b.add("driftwood"); m.pump(); // a: 3 + 9 = 12 alone
  ok(a.b.shares.own(0, 111) === 12 && !a.b.lit(0) && !c.b.lit(0), "12 fuel from one player alone: not lit on any page");
  b.f.me.x = beaconList[0].x; b.f.me.y = beaconList[0].y + 1; b.b.add("driftwood"); m.pump();
  ok(a.b.lit(0) && b.b.lit(0) && c.b.lit(0) && c.events.some(e => e[0] === "lit" && e[1] === 0) && b.events.some(e => e[0] === "lit"), "the second player's 1 fuel lights it for all three pages, each told once");
  ok(c.events.filter(e => e[0] === "lit").length === 1, "the lit event comes once, not on every repeat");
  const inv0 = JSON.stringify(c.inv); const rl = c.b.add("driftwood");
  ok(!rl.ok && rl.why === "lit" && JSON.stringify(c.inv) === inv0, "adding to a lit beacon is refused and nothing is used");
  // The cap on one player's share, through the real add path.
  const d = nodes.b; for (let i = 0; i < 30; i++) { d.f.me.x = beaconList[1].x + 1; d.f.me.y = beaconList[1].y; d.b.add("driftwood"); }
  ok(d.b.shares.own(1, 222) === MAX_OWN && d.inv.driftwood === 40 - 1 - MAX_OWN, `30 tries to add give exactly ${MAX_OWN} fuel and use exactly ${MAX_OWN} items (the rest are refused)`);
  // Random adds: items used times worth equals shares; nothing created.
  const rnd2 = (() => { let s = 99; return () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296; })();
  const start = { ...c.inv }; let spent = 0;
  for (let i = 0; i < 200; i++) { const bi = Math.floor(rnd2() * 4); c.f.me.x = beaconList[bi].x + 1; c.f.me.y = beaconList[bi].y; const item = rnd2() < 0.5 ? "driftwood" : "berries"; const r2 = c.b.add(item); if (r2.ok) spent += WORTH[item]; }
  const fuelNow = [0, 1, 2, 3].reduce((s, bi) => s + c.b.shares.own(bi, 333), 0);
  ok(fuelNow === spent && (start.driftwood - c.inv.driftwood) + 2 * (start.berries - c.inv.berries) === spent && c.inv.reeds === 40, "200 random adds: the fuel counted is exactly the fuel the items were worth");
  // Hostile messages.
  m.pump();
  const stateOf = (n) => JSON.stringify(n.b.shares.entries().sort());
  const snapB = stateOf(b);
  const hostile = [{ k: "fu", b: 4, n: 1 }, { k: "fu", b: -1, n: 1 }, { k: "fu", b: 0, n: 17 }, { k: "fu", b: 0, n: 0 }, { k: "fu", b: 0, n: 1.5 }, { k: "fu", b: "0", n: 1 }, { k: "fu", b: 0, n: "5" }, { k: "fu", b: 2, n: 5, s: 9 }, { k: "fu", b: 2 }, { k: "fu" }, { k: "fu", b: [2], n: [5] }, { k: "fu", b: 2, n: null }, { k: "fu", b: 2, n: NaN }, { k: "fu", b: 2, n: Infinity }, "fu", 7, null, { k: "fq", x: 1 }, { k: "fs" }, { k: "fs", b: [2], s: [5], n: [5], f: 1 }, { k: "fs", b: [2], s: [5], n: [5], f: 1, x: 1 }];
  for (const h of hostile) b.f.hs.forEach(fn => fn(h, "a"));
  ok(stateOf(b) === snapB, "bad fuel messages (range, fractions, strings, arrays, extra fields, a snapshot nobody asked for) change nothing");
  b.f.hs.forEach(fn => fn({ k: "fu", b: 3, n: 9 }, "stranger"));
  ok(stateOf(b) === snapB, "a fuel message from someone who never said hello is ignored");
  // Snapshot rules.
  const e = nodes.a; e.f.sent.length = 0;
  t.v += 2000; e.f.hs.forEach(fn => fn({ k: "fq" }, "b")); const sn = e.f.sent.filter(([x]) => x.k === "fs");
  ok(sn.length >= 1 && sn.every(([x, to]) => to === "b" && x.b.length <= 10 && withinSizeCap(x)) && sn.at(-1)[0].f === 1, "a snapshot request is answered to the asker in small chunks, the last marked");
  e.f.sent.length = 0; e.f.hs.forEach(fn => fn({ k: "fq" }, "b")); ok(e.f.sent.length === 0, "a repeated request within a second is not answered again");
  const worst = { k: "fs", b: Array(10).fill(3), s: Array(10).fill(4294967295), n: Array(10).fill(16), f: 1 };
  ok(withinSizeCap(worst), "the biggest possible snapshot chunk is under the message size cap");
  // A tidy snapshot from a peer we asked is merged; the same from a stranger is not.
  const late = createBeacons(m.fakes.get("c").net, { seed: 333, x: 0, y: 0 }, m.fakes.get("c").peers, { driftwood: 0, reeds: 0, berries: 0 }, beaconList, { now: () => t.v });
  late.tick(); m.pump(); // asks a and b
  ok(late.shares.fuel(0) > 0, "a newcomer asks the others and gets the shares of everyone, including players who have left (the shares are kept by the room)");
  // Peer cap on entries via fs: 30 forged seeds over three chunks fill at most 24.
  const f2 = createBeacons(m.fakes.get("c").net, { seed: 333, x: 0, y: 0 }, m.fakes.get("c").peers, { driftwood: 0, reeds: 0, berries: 0 }, beaconList, { now: () => t.v });
  f2.tick(); m.pump();
  m.fakes.get("c").hs.forEach(fn => { for (let i = 0; i < 3; i++) fn({ k: "fs", b: Array(10).fill(3), s: seeds(10, 5000 + i * 100000), n: Array(10).fill(1), f: 0 }, "a"); });
  ok(f2.shares.size(3) <= MAX_ENTRIES && f2.shares.size(3) >= 1, "forged snapshots can never make more than 24 shares on a beacon");
}

// ---- the presence watchdog (node) ----
{
  console.log("# presence watchdog, on a fake mesh");
  const mk = (id) => { const sent = [], hs = [], joins = [], leaves = []; return { sent, hs, joins, net: { selfId: id, send: (msg, to) => sent.push([msg, to]), onMessage: h => hs.push(h), onPeerJoin: h => joins.push(h), onPeerLeave: h => leaves.push(h) }, me: { seed: id === "a" ? 111 : 222, x: 50, y: 50, d: 0, moving: false } }; };
  const hiOf = (sent) => sent.filter(([x]) => x.k === "hi");
  const w = { w: 200, h: 200 };
  const A = mk("a"); const pa = createPresence(A.net, w, A.me);
  A.sent.length = 0; A.joins.forEach(h => h("b"));
  ok(hiOf(A.sent).length === 1 && A.sent[0][1] === "b", "a join is greeted with a hi");
  const t0 = performance.now();
  pa.tick(t0 + 1000, 0.016); ok(hiOf(A.sent).length === 1, "not repeated before 3 seconds");
  pa.tick(t0 + 3200, 0.016); ok(hiOf(A.sent).length === 2, "after 3 seconds with no hi from them, the hi is sent again (the first may have been lost)");
  pa.tick(t0 + 6300, 0.016); pa.tick(t0 + 9400, 0.016); pa.tick(t0 + 12500, 0.016); pa.tick(t0 + 15600, 0.016);
  ok(hiOf(A.sent).length === 4, "it tries three more times and then gives up (no endless repeats)");
  // They answer: the entry appears and the repeats stop.
  const B = mk("b"); const pb = createPresence(B.net, w, B.me);
  const A2 = mk("a2"); const pa2 = createPresence(A2.net, w, A2.me); A2.sent.length = 0; A2.joins.forEach(h => h("b"));
  A2.hs.forEach(h => h({ k: "hi", v: 1, s: 222, x: 10, y: 10, d: 0 }, "b"));
  pa2.tick(t0 + 3500, 0.016); ok(pa2.peers.has("b") && hiOf(A2.sent).length === 1, "once their hi arrives the repeats stop");
  // Greeting back: a hi from someone we never greeted (our join event came late or never).
  const A3 = mk("a3"); const pa3 = createPresence(A3.net, w, A3.me); A3.sent.length = 0;
  A3.hs.forEach(h => h({ k: "hi", v: 1, s: 222, x: 10, y: 10, d: 0 }, "b"));
  ok(pa3.peers.has("b") && hiOf(A3.sent).length === 1 && A3.sent[0][1] === "b", "a hi from someone we have not greeted is answered with ours");
  A3.hs.forEach(h => h({ k: "hi", v: 1, s: 222, x: 11, y: 10, d: 0 }, "b"));
  ok(hiOf(A3.sent).length === 1, "and only once (no hi ping-pong)");
  A3.joins.forEach(h => h("b")); ok(hiOf(A3.sent).length === 1, "a late join event for someone already greeted sends nothing more");
  // Movement from a stranger: send our hi, at most once per 2 s.
  const A4 = mk("a4"); const pa4 = createPresence(A4.net, w, A4.me); A4.sent.length = 0;
  for (let i = 0; i < 5; i++) A4.hs.forEach(h => h({ k: "st", x: 10, y: 10, d: 0, m: 1 }, "s"));
  ok(hiOf(A4.sent).length === 1 && !pa4.peers.has("s"), "movement from a stranger is not accepted, but it makes us send our hi once (5 messages, 1 hi)");
  // A flood of strangers cannot grow the bookkeeping without limit.
  for (let i = 0; i < 300; i++) A4.hs.forEach(h => h({ k: "st", x: 1, y: 1, d: 0, m: 0 }, "x" + i));
  ok(hiOf(A4.sent).length <= 1 + 64, "at most 64 strangers are ever answered");
  ok(MAX_PEERS === 11, "the peer cap is unchanged");
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
function watch(page, label) {
  page.on("pageerror", e => errors.push(`${label}: ${e.message}`));
  page.on("console", m => { if (m.type() === "error" && !/WebSocket connection to 'wss:/.test(m.text()) && !/User-Initiated Abort, reason=Close called/.test(m.text())) errors.push(`${label}: ${m.text()}`); });
}
async function waitFor(page, fn, arg, timeout = 10000) {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 50 }); return true; } catch { return false; }
}


// A page that closes a WebRTC connection on purpose (Leave, reload) makes the other side's Trystero log an abort; that is the test's doing.
// ---- pages ----
const bc = (page) => page.evaluate(() => window.__longWatch.beacon());
async function seedPack(page, url, patch) {
  await page.goto(url);
  await page.evaluate(([K, patch]) => { const st = location.search.includes("net=local") ? sessionStorage : localStorage; const s = JSON.parse(st.getItem(K)); Object.assign(s, patch); st.setItem(K, JSON.stringify(s)); }, [STORE, patch]);
  await page.reload();
}
const land = (x, y) => { const t = world.tiles[Math.floor(y) * world.w + Math.floor(x)]; return (t === T.SAND || t === T.GRASS || t === T.MEADOW) && !isBlocked(world, x, y); };
// Open ground near each beacon (inside the range) for each player.
const stand = beaconList.map(l => {
  const out = [];
  for (let r = 1.1; r <= 2.2 && out.length < 3; r += 0.3) for (let a = 0; a < 6.28 && out.length < 3; a += 0.5) { const x = l.x + Math.cos(a) * r, y = l.y + Math.sin(a) * r; if (land(x, y) && Math.hypot(x - l.x, y - l.y) <= BEACON_RANGE - 0.2) out.push({ x, y }); }
  return out;
});
async function teleportSynced(page, others, x, y) {
  if (!await page.evaluate(([x, y]) => window.__longWatch.teleport(x, y), [x, y])) return false;
  for (const o of others) if (!await waitFor(o, ([x, y]) => window.__longWatch.peers().some(p => Math.hypot(p.x - x, p.y - y) < 0.05), [x, y], 6000)) return false;
  return true;
}
const brightness = (page, wx, wy) => page.evaluate(([wx, wy]) => {
  const c = document.getElementById("view"), me = window.__longWatch.self(), dpr = c.width / c.clientWidth, tile = (c.clientWidth < 520 ? 30 : 36) * dpr;
  const sx = Math.round(c.width / 2 + (wx - me.x) * tile), sy = Math.round(c.height / 2 + (wy - me.y) * tile);
  const d = c.getContext("2d").getImageData(sx - 3, sy - 3, 7, 7).data; let s = 0;
  for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
  return s / (d.length / 4);
}, [wx, wy]);
const settledBrightness = async (page, wx, wy) => { let last = -1; for (let i = 0; i < 40; i++) { const v = await brightness(page, wx, wy); if (Math.abs(v - last) < 0.5 && i > 2) return v; last = v; await sleep(80); } return last; };
async function shoot(page, name) {
  if (!shots) return;
  await mkdir(shots, { recursive: true });
  const keep = page.viewportSize();
  for (const [w, h] of [[375, 760], [1100, 800]]) { await page.setViewportSize({ width: w, height: h }); await sleep(400); await page.locator(".stage").screenshot({ path: path.join(shots, `${name}-${w}.png`) }); }
  await page.setViewportSize(keep); await sleep(200);
}
const converged = (pages, b, fuel, players, lit, timeout = 6000) => Promise.all(pages.map(p => waitFor(p, ([b, fuel, players, lit]) => { const s = window.__longWatch.beacon(); return s && s.fuel[b] === fuel && s.players[b] === players && s.lit[b] === lit; }, [b, fuel, players, lit], timeout))).then(r => r.every(Boolean));

async function scenario(label, mk, query, room, opts = {}) {
  console.log(`\n# ${label}`);
  const url = `${base}${query}#room=${room}`;
  const [A, B] = [await mk(), await mk()];
  await seedPack(A, url, { inv: { driftwood: 45, reeds: 3, berries: 4 } });
  await seedPack(B, url, { inv: { driftwood: 20, reeds: 0, berries: 2 } });
  await A.click("#enter"); await B.click("#enter");
  const seen = await waitFor(A, () => window.__longWatch.peers().length === 1, null, opts.timeout) && await waitFor(B, () => window.__longWatch.peers().length === 1, null, opts.timeout);
  ok(seen, "each page sees exactly one other player");
  if (!seen) return;
  ok(await waitFor(A, () => window.__longWatch.beacon() && window.__longWatch.beacon().synced, null, 5000) && await waitFor(B, () => window.__longWatch.beacon() && window.__longWatch.beacon().synced, null, 5000), "both pages have heard the room's beacon state (or waited for it)");
  const idA = await A.evaluate(() => window.__longWatch.self().id);
  ok(stand.every(s => s.length >= 2), "there is open ground within reach of every beacon");

  // 1. Far from a beacon: no panel, nothing added, nothing used.
  const awayOk = await A.evaluate(() => { for (let x = 3; x < 20; x++) for (let y = 3; y < 20; y++) if (window.__longWatch.teleport(x + 0.5, y + 0.5)) return true; return false; });
  ok(awayOk && Math.min(...beaconList.map(l => Math.hypot(l.x - 12, l.y - 12))) > BEACON_RANGE, "A starts away from the beacons");
  const far = await bc(A);
  ok(far.near === -1 && !far.panel, "away from every beacon the Beacon panel is hidden");
  const rf = await A.evaluate(() => window.__longWatch.addFuel("driftwood"));
  ok(rf && !rf.ok && rf.why === "far" && (await bc(A)).inv.driftwood === 45, "adding fuel while far is refused and nothing is used");

  // 2. Beacon 0: A alone adds a lot; it does not light. Real buttons first.
  ok(await teleportSynced(A, [B], stand[0][0].x, stand[0][0].y) && await teleportSynced(B, [A], stand[0][1].x, stand[0][1].y), "A and B stand within reach of the first beacon");
  const sample = [beaconList[0].x, beaconList[0].y + 6];
  const dimBefore = await settledBrightness(B, ...sample);
  await shoot(B, `${opts.shot}-before`);
  ok(await waitFor(A, () => window.__longWatch.beacon().panel, null, 3000) && await A.locator("#beaconbtns button").count() === 2, "the Beacon panel appears with two Add buttons");
  await A.click('#beaconbtns [data-item="driftwood"]');
  let s = await bc(A);
  ok(s.inv.driftwood === 44 && s.own[0] === 1 && s.fuel[0] === 1 && /added driftwood/.test(s.info), "a button press uses one driftwood and adds 1 to A's share");
  ok(await converged([B], 0, 1, 1, false), "B sees the same: 1 fuel from 1 player");
  for (let i = 0; i < 9; i++) await A.evaluate(() => window.__longWatch.addFuel("driftwood"));
  await A.evaluate(() => window.__longWatch.addFuel("berries"));
  s = await bc(A);
  ok(s.own[0] === 12 && s.inv.driftwood === 35 && s.inv.berries === 3 && s.fuel[0] === 12, "A has added 12 fuel (10 driftwood and 1 oil berry) and used exactly those");
  ok(await converged([A, B], 0, 12, 1, false), `12 fuel from one player alone does not light the beacon (needs ${MIN_PLAYERS} players), on both pages`);
  await sleep(300);
  ok(Math.abs(await settledBrightness(B, ...sample) - dimBefore) < 6, "and the ground 6 tiles from it is still dark");
  await shoot(B, `${opts.shot}-embers`);
  // B adds: lit on both.
  await B.click('#beaconbtns [data-item="berries"]');
  ok(await converged([A, B], 0, 14, 2, true), "B adds 2 fuel from oil berries: the beacon is lit on both pages (14 fuel, 2 players)");
  ok(await waitFor(A, () => /lit/.test(document.getElementById("beaconinfo").textContent) || /lit/.test(document.getElementById("beaconstate").textContent), null, 2000), "the page says it is lit");
  const lit0 = await settledBrightness(B, ...sample);
  console.log(`  brightness of the ground 6 tiles below the beacon, as B sees it: dark ${dimBefore.toFixed(1)}, lit ${lit0.toFixed(1)}`);
  ok(lit0 > dimBefore + 25, "the lit beacon lights the ground 6 tiles away, on B's screen");
  await shoot(B, `${opts.shot}-lit`);
  ok(await B.evaluate(() => window.__longWatch.beacon().fires[0].lit), "the renderer draws that beacon as lit");
  const bInv = (await bc(B)).inv, rl = await B.evaluate(() => window.__longWatch.addFuel("driftwood"));
  ok(!rl.ok && rl.why === "lit" && JSON.stringify((await bc(B)).inv) === JSON.stringify(bInv), "a lit beacon refuses more fuel and nothing is used");
  ok(await B.evaluate(() => window.__longWatch.beacon().fires.filter(f => f.lit).length) === 1, "only that one beacon is lit");

  // 3. Beacon 1: both add at the same moment; nothing is lost.
  ok(await teleportSynced(A, [B], stand[1][0].x, stand[1][0].y) && await teleportSynced(B, [A], stand[1][1].x, stand[1][1].y), "A and B walk to the second beacon");
  for (let round = 0; round < 3; round++) await Promise.all([A, B].map(p => p.evaluate(() => { for (let i = 0; i < 2; i++) window.__longWatch.addFuel("driftwood"); })));
  ok(await converged([A, B], 1, 12, 2, true), "A and B each added 6 at the same moment: both pages show exactly 12 fuel from 2 players, lit");
  const sa = await bc(A), sb = await bc(B);
  ok(sa.own[1] === 6 && sb.own[1] === 6 && sa.inv.driftwood === 29 && sb.inv.driftwood === 14 && sb.inv.berries === 1, "each used exactly the 6 items they added");

  // 4. Beacon 2: A fills their share to the cap alone; a 17th is refused.
  ok(await teleportSynced(A, [B], stand[2][0].x, stand[2][0].y), "A walks to the third beacon");
  const aBefore = (await bc(A)).inv.driftwood;
  const res = []; for (let i = 0; i < 20; i++) res.push(await A.evaluate(() => window.__longWatch.addFuel("driftwood")));
  s = await bc(A);
  ok(res.filter(r => r.ok).length === MAX_OWN && res.slice(MAX_OWN).every(r => !r.ok && r.why === "full") && s.own[2] === MAX_OWN && s.inv.driftwood === aBefore - MAX_OWN, `20 tries: exactly ${MAX_OWN} are added and used, the other 4 are refused as full and use nothing`);
  ok(await converged([A, B], 2, MAX_OWN, 1, false), "16 fuel from one player: still not lit (needs a second player), on both pages");
  const ra = await A.evaluate(() => window.__longWatch.addFuel("berries"));
  ok(!ra.ok && ra.why === "full" && (await bc(A)).inv.berries === 3, "even oil berries are refused at the cap, and stay in the pack");

  // 5. A late joiner gets all shares, and one driftwood lights beacon 2.
  const C = await mk();
  await seedPack(C, url, { inv: { driftwood: 3, reeds: 0, berries: 0 } });
  await C.click("#enter");
  ok(await waitFor(C, () => window.__longWatch.peers().length === 2, null, opts.timeout), "a third player joins and sees both others");
  ok(await waitFor(C, () => { const s = window.__longWatch.beacon(); return s && s.fuel[0] === 14 && s.fuel[1] === 12 && s.fuel[2] === 16 && s.lit[0] && s.lit[1] && !s.lit[2] && s.players[2] === 1; }, null, 8000), "the late joiner is told the room's beacons: two lit, one with 16 fuel from one player");
  const beforeC = await bc(C);
  if (beforeC) ok(await teleportSynced(C, [A, B], stand[2][1].x, stand[2][1].y), "C walks to the third beacon");
  await C.click('#beaconbtns [data-item="driftwood"]');
  ok(await converged([A, B, C], 2, 17, 2, true), "C's single driftwood lights the third beacon for all three pages (17 fuel, 2 players)");
  ok((await bc(C)).inv.driftwood === 2, "C used exactly one driftwood");

  // 6. A reload cannot get around the cap: the share comes back from the others.
  await A.reload(); await A.click("#enter");
  ok(await waitFor(A, () => window.__longWatch.self().playing && !!window.__longWatch.self().id, null, 8000), "A is back in the lantern");
  ok(await waitFor(A, () => { const s = window.__longWatch.beacon(); return s && s.own[2] === 16 && s.own[0] === 12 && s.lit[0] && s.lit[1] && s.lit[2]; }, null, 12000), "A's old shares are told back to A by the others (12, 6 and 16), and all three beacons are still lit");
  ok(JSON.stringify((await bc(A)).inv) === JSON.stringify({ driftwood: 13, reeds: 3, berries: 3 }), "A's pack was saved with the spent items gone (13 driftwood, 3 reeds, 3 oil berries)");
  await teleportSynced(A, [B], stand[2][0].x, stand[2][0].y);
  const rr = await A.evaluate(() => window.__longWatch.addFuel("driftwood"));
  ok(!rr.ok, "back at a beacon, A cannot add again to a lit beacon, and a reload did not reset the 16-item cap");
  const idA2 = await A.evaluate(() => window.__longWatch.self().id);
  ok(idA2 !== idA, "A came back with a new connection id");
  if (opts.local) await forged(A, B, C, idA2);

  // 7. The first player leaves: the beacons stay lit for the others.
  await A.click("#leave");
  ok(await waitFor(B, (id) => !window.__longWatch.peers().some(p => p.id === id), idA2, 20000), "B sees A leave");
  ok(await converged([B, C], 0, 14, 2, true) && await converged([B, C], 2, 17, 2, true), "the lit beacons stay lit after A has left (A's fuel is still counted)");
  // 8. Everyone leaves: a new player finds the room empty (nothing is kept on a server).
  for (const p of [B, C]) await p.click("#leave");
  await sleep(500);
  const D = await mk();
  await D.goto(url); await D.click("#enter");
  ok(await waitFor(D, () => window.__longWatch.beacon() && window.__longWatch.beacon().synced, null, 6000), "a new player enters the empty lantern");
  s = await bc(D);
  ok(s && s.fuel.every(f => f === 0) && !s.lit.some(Boolean), "the empty room has forgotten the fuel: the room's state lives only while someone is in it");
  for (const p of [A, B, C, D]) await p.context().close().catch(() => {});
}

// Hostile messages posted on the local channel as if they came from A (a player B knows).
async function forged(A, B, C, idA) {
  console.log("  hostile messages");
  const E = await B.context().newPage();
  await E.goto(`${base}?net=local`);
  const idB = await B.evaluate(() => window.__longWatch.self().id);
  const post = (from, to, msgs) => E.evaluate(([room, from, to, msgs]) => { const ch = new BroadcastChannel(`vigil-long-watch:lantern-${room}`); for (const d of msgs) ch.postMessage({ k: "data", d, from, to }); ch.close(); }, [6, from, to, msgs]);
  ok(await waitFor(B, () => window.__longWatch.beacon().pending === 0, null, 10000) && await waitFor(C, () => window.__longWatch.beacon().pending === 0, null, 10000), "B and C have finished asking for shares (a snapshot is accepted only while one is being waited for)");
  const sig = async () =>  JSON.stringify((await bc(B)).fuel) + JSON.stringify((await bc(B)).players);
  const before = await sig();
  await post(idA, idB, [{ k: "fu", b: 9, n: 1 }, { k: "fu", b: 3, n: 17 }, { k: "fu", b: 3, n: 0 }, { k: "fu", b: 3, n: 1.5 }, { k: "fu", b: "3", n: 2 }, { k: "fu", b: 3, n: 2, x: 1 }, { k: "fu", b: 3 }, { k: "fu", b: [3], n: [2] }, { k: "fu", b: 3, n: null }, { k: "fs", b: [3], s: [77], n: [9], f: 1 }, { k: "fq", y: 1 }, "fu", 42]);
  await sleep(500);
  ok(await sig() === before, "B ignored out-of-range, fractional, text, array, extra-field messages and a snapshot nobody asked for");
  await post("stranger-never-said-hello", idB, [{ k: "fu", b: 3, n: 9 }]);
  await sleep(300);
  ok(await sig() === before, "a fuel message from someone who never said hello is ignored");
  await post(idA, idB, [{ k: "fu", b: 3, n: 16 }]);
  await sleep(500);
  const s3 = await bc(B);
  ok(s3.fuel[3] === 16 && s3.players[3] === 1 && !s3.lit[3], "16 fuel claimed for A on a fourth beacon counts as one player's share (a message can only change its own sender's share) and does not light it");
  await post(idA, idB, [{ k: "fu", b: 3, n: 5 }]);
  await sleep(300);
  ok((await bc(B)).fuel[3] === 16, "a smaller share claimed later does not lower it");
  await post(idA, idB, Array.from({ length: 500 }, (_, i) => ({ k: "fu", b: 3, n: 1 + (i % 16) })));
  await sleep(600);
  const s4 = await bc(B);
  ok(s4.fuel[3] === 16 && s4.players[3] === 1 && !s4.lit[3], "a flood of 500 fuel messages does not break B or light the beacon");
  await E.close();
}

// ---- 1. local ----
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 800 } });
  const mk = () => ctx.newPage().then(p => (watch(p, "local"), p));
  await scenario("local transport (BroadcastChannel)", mk, `?net=local&hour=${HOUR}`, 6, { local: true, shot: "beacon-local" });
  await ctx.close();
}

// ---- 2. real WebRTC through a local Nostr relay ----
if (!onlyLocal) {
  const relay = await startRelay();
  const c = [await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true }), await browser.newContext({ viewport: { width: 1000, height: 800 } }), await browser.newContext({ viewport: { width: 800, height: 700 } })];
  let i = 0;
  const mk = () => c[i++ % 3].newPage().then(p => (watch(p, "webrtc"), p));
  await scenario("Trystero over Nostr + WebRTC (relay on 127.0.0.1)", mk, `?net=nostr&hour=${HOUR}&relay=${encodeURIComponent(relay.url)}`, 5, { timeout: 30000, shot: "beacon-webrtc" });
  for (const x of c) await x.close().catch(() => {});
  relay.close();
}

// ---- 3. the link watchdog: a half-open link is rebuilt (real WebRTC only) ----
if (!onlyLocal) {
  console.log("\n# link watchdog: one side hears and says nothing for 12 s after joining, like a half-open WebRTC link");
  const relay = await startRelay();
  const c = [await browser.newContext({ viewport: { width: 800, height: 700 } }), await browser.newContext({ viewport: { width: 800, height: 700 } })];
  const [A, B] = await Promise.all(c.map(x => x.newPage()));
  watch(A, "watchdog"); watch(B, "watchdog");
  const q = `?net=nostr&hour=${HOUR}&relay=${encodeURIComponent(relay.url)}`;
  await A.goto(`${base}${q}#room=4`); await B.goto(`${base}${q}&mute=12#room=4`);
  await Promise.all([A.click("#enter"), B.click("#enter")]);
  const t0 = Date.now();
  const met = await waitFor(A, () => window.__longWatch.peers().length === 1, null, 40000) && await waitFor(B, () => window.__longWatch.peers().length === 1, null, 40000);
  ok(met, `the two pages find each other although one was deaf for 12 s (after ${Math.round((Date.now() - t0) / 100) / 10} s)`);
  const rb = (await Promise.all([A, B].map(p => p.evaluate(() => window.__longWatch.hud().rebuilds))));
  ok(rb[0] + rb[1] >= 1 && rb[0] + rb[1] <= 3, `the stalled side rebuilt its link (rebuilds A ${rb[0]}, B ${rb[1]}; never more than 3)`);
  if (met) {
    const [ida, idb] = await Promise.all([A, B].map(p => p.evaluate(() => window.__longWatch.self().id)));
    ok(await waitFor(A, (id) => window.__longWatch.peers().some(p => p.id === id), idb, 5000) && await waitFor(B, (id) => window.__longWatch.peers().some(p => p.id === id), ida, 5000), "and each sees the other's current connection id");
    ok(await waitFor(B, () => window.__longWatch.beacon() && window.__longWatch.beacon().synced, null, 5000), "the game modules work on the rebuilt link (the beacon state synced)");
  }
  for (const x of c) await x.close().catch(() => {});
  relay.close();
}

ok(errors.length === 0, `no console errors${errors.length ? ":\n  " + errors.join("\n  ") : ""}`);
await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
