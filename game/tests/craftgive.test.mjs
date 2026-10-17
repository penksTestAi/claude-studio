#!/usr/bin/env node
// Milestone 12 tests for The Long Watch: giving crafted things (wicks and lanterns) through the same
// offer, accept, commit and receipt as gathered items.
//
//   node game/tests/craftgive.test.mjs            node checks, local transport, then real Trystero/WebRTC via a local Nostr relay
//   node game/tests/craftgive.test.mjs --local    skip the WebRTC part
//
// Part 0 (node, fake mesh): every cap and timeout the giving code uses, tested when full and when expired, for a wick and
// for lanterns: the receiver's full stack, the receiver's full expected list, the giver's full "on its way" list, an offer
// nobody answers, a late accept, a pack that emptied between offer and accept, a peer leaving at every step, and every
// single message dropped or either side restarted from its saved state at every step (the item must exist exactly once
// and arrive once). The lantern in hand is put back to plain when its last copy is given away.
// Then pages: a wick and an amber lantern are offered with the Give buttons, accepted, saved, and the receiver can hold
// the lantern and the giver's friends see the light change; a full stack refuses; forged messages change nothing.
// "Online play" here means a local relay on this machine, not the public relays.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startRelay } from "./nostr-relay.mjs";
import { createGive, OFFER_MS, RESEND_MS } from "../js/give.js";
import { cleanSave, ITEMS, CRAFTED, SOFT_STACK, MAX_OUT, MAX_EXP } from "../js/inventory.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const onlyLocal = process.argv.includes("--local");

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failures++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const IDX = Object.fromEntries(ITEMS.map((k, i) => [k, i]));
ok(IDX.driftwood === 0 && IDX.reeds === 1 && IDX.berries === 2 && IDX.wick === 3 && IDX.amber === 4 && IDX.jade === 5 && IDX.azure === 6, "gathered kinds keep their old numbers 0..2; wick 3, amber 4, jade 5, azure 6");
{
  const c = cleanSave({ cr: { amber: 1 }, lamp: 1, out: [{ t: 1, i: 6, s: 5 }, { t: 2, i: 8, s: 5 }, { t: 3, i: 3.5, s: 5 }], exp: [{ t: 4, i: 4, s: 6 }, { t: 5, i: -1, s: 6 }] });
  ok(c.out.length === 1 && c.out[0].i === 6 && c.exp.length === 1 && c.exp[0].i === 4, "saved gifts of crafted kinds are read back; kind numbers past 7 (lamp oil) are dropped");
}

// ---- 0. node: giving on a fake mesh ----
console.log("# giving crafted things, in node");
const G_SEED = 111, R_SEED = 222;
function makeWorld() {
  const w = { clock: 0, queue: [], players: new Map(), nextId: 1, hook: null };
  w.spawn = (seed, disk) => {
    const id = `${seed === G_SEED ? "g" : "r"}${w.nextId++}`;
    const st = cleanSave(disk.json ? JSON.parse(disk.json) : disk.init);
    const p = { id, seed, hs: [], leaves: [], me: { x: 5, y: 5 }, peers: new Map(), inv: st.inv, cr: st.cr, held: { lamp: st.lamp }, ledger: { out: st.out, exp: st.exp, got: st.got }, alive: true, events: [], dropped: 0 };
    p.save = () => { disk.json = JSON.stringify({ inv: p.inv, cr: p.cr, lamp: p.held.lamp, out: p.ledger.out, exp: p.ledger.exp, got: p.ledger.got }); };
    p.net = {
      selfId: id, onMessage: h => p.hs.push(h), onPeerLeave: h => p.leaves.push(h), onPeerJoin() {},
      send(msg, to) { const m = JSON.parse(JSON.stringify(msg)); for (const [oid, o] of w.players) if (oid !== id && o.alive && (!to || to === oid)) w.queue.push({ from: id, to: oid, msg: m }); },
    };
    p.give = createGive(p.net, p.me, p.peers, p.inv, p.ledger, { now: () => w.clock, persist: p.save, onEvent: (t) => p.events.push(t), rand: () => 4242, cr: p.cr, held: p.held, onLampDropped: () => { p.dropped++; p.save(); } });
    p.disk = disk; w.players.set(id, p);
    return p;
  };
  w.link = () => { for (const a of w.players.values()) if (a.alive) for (const b of w.players.values()) if (b.alive && a !== b && !a.peers.has(b.id)) a.peers.set(b.id, { id: b.id, seed: b.seed, tx: b.me.x + 1, ty: b.me.y }); };
  w.kill = (p) => { p.alive = false; w.players.delete(p.id); w.queue = w.queue.filter(e => e.to !== p.id && e.from !== p.id); for (const o of w.players.values()) if (o.peers.delete(p.id)) o.leaves.forEach(h => h(p.id)); };
  w.step = () => { const e = w.queue.shift(); if (!e) return false; const to = w.players.get(e.to); if (!to || !to.alive) return true; if (w.hook && w.hook(e) === "drop") return true; to.hs.forEach(h => h(e.msg, e.from)); return true; };
  w.run = (check) => { let n = 0; while (w.step() && n++ < 200) check && check(); };
  w.tickAll = () => { for (const p of w.players.values()) p.give.tick(); };
  return w;
}
// Saved-state view of a player (live state is the saved state once persisted).
const read = (p) => p.alive ? { cr: p.cr, out: p.ledger.out, got: p.ledger.got, lamp: p.held.lamp } : cleanSave(JSON.parse(p.disk.json));
// How many of `item` exist: giver + way list (unless the receiver already recorded it) + receiver.
function census(G, R, item) {
  const g = read(G), r = read(R);
  const way = g.out.filter(e => ITEMS[e.i] === item && !r.got.some(x => x.s === G_SEED && x.t === e.t)).length;
  const own = (s) => (CRAFTED.includes(item) ? s.cr : s.inv)[item];
  const gs = G.alive ? { cr: G.cr, inv: G.inv } : cleanSave(JSON.parse(G.disk.json)), rs = R.alive ? { cr: R.cr, inv: R.inv } : cleanSave(JSON.parse(R.disk.json));
  return { g: own(gs), way, r: own(rs), total: own(gs) + way + own(rs) };
}
function mk(item = "wick", { gHas = 1, rHas = 0, held = 0, extraR = {}, extraG = {} } = {}) {
  const w = makeWorld();
  const gd = { init: { cr: { [item]: gHas }, lamp: held, ...extraG } }, rd = { init: { cr: { [item]: rHas }, ...extraR } };
  const G = w.spawn(G_SEED, gd), R = w.spawn(R_SEED, rd);
  w.link(); G.save(); R.save();
  return { w, G, R, gd, rd, i: IDX[item], item };
}

// Basic hand-over of each crafted kind.
for (const item of CRAFTED) {
  const s = mk(item); s.G.give.offer(s.i); s.w.run();
  ok(s.R.give.incoming && s.R.give.incoming.i === s.i && s.G.cr[item] === 1, `${item}: an offer shows for the receiver and nothing has left the giver`);
  s.R.give.accept(); s.w.run();
  ok(s.G.cr[item] === 0 && s.R.cr[item] === 1 && s.G.ledger.out.length === 0 && s.R.ledger.exp.length === 0 && s.R.ledger.got.length === 1 && s.G.events.includes("delivered") && s.R.events.includes("received"), `${item}: both confirm, one moves, giver 0 and receiver 1, lists clear, both told`);
}
// The lantern in hand.
{
  const s = mk("amber", { held: 1 }); s.G.give.offer(4); s.w.run(); s.R.give.accept(); s.w.run();
  ok(s.G.held.lamp === 0 && s.G.dropped === 1 && JSON.parse(s.gd.json).lamp === 0 && s.R.held.lamp === 0 && s.R.cr.amber === 1, "giving away the last lantern in hand puts the plain lantern back (saved), and the receiver does not start holding it");
  const t = mk("amber", { gHas: 2, held: 1 }); t.G.give.offer(4); t.w.run(); t.R.give.accept(); t.w.run();
  ok(t.G.cr.amber === 1 && t.G.held.lamp === 1 && t.G.dropped === 0, "giving one of two keeps the lantern in hand");
  const u = mk("amber", { gHas: 1, held: 0, extraG: { cr: { amber: 1, jade: 1 } } }); u.G.cr.jade = 1; u.G.held.lamp = 2; u.G.give.offer(4); u.w.run(); u.R.give.accept(); u.w.run();
  ok(u.G.held.lamp === 2 && u.G.dropped === 0, "giving a lantern that is not the one in hand leaves the one in hand alone");
  const v = mk("amber", { held: 1 }); v.G.give.offer(4); v.w.run(); v.G.give.cancel(); v.w.run();
  ok(v.G.held.lamp === 1 && v.G.cr.amber === 1, "an offer taken back keeps the lantern in hand");
}
// Caps when full.
{
  const s = mk("wick", { rHas: SOFT_STACK }); s.G.give.offer(3); s.w.run();
  ok(!s.G.give.outgoing && !s.R.give.incoming && s.G.cr.wick === 1 && s.R.cr.wick === SOFT_STACK && s.G.events.includes("declined"), `a receiver with ${SOFT_STACK} wicks declines; the giver keeps it`);
  const t = mk("jade", { rHas: SOFT_STACK }); t.G.give.offer(5); t.w.run();
  ok(!t.G.give.outgoing && !t.R.give.incoming && t.G.cr.jade === 1 && t.R.cr.jade === SOFT_STACK, `a receiver with ${SOFT_STACK} jade lanterns declines; the giver keeps it`);
  const u = mk("wick", { rHas: SOFT_STACK - 1 }); u.G.give.offer(3); u.w.run(); u.R.give.accept(); u.w.run();
  ok(u.R.cr.wick === SOFT_STACK && u.G.cr.wick === 0, "one below the cap still receives");
  const v = mk("azure"); for (let n = 0; n < MAX_EXP; n++) v.R.ledger.exp.push({ t: 9000 + n, i: 0, s: 77 });
  v.G.give.offer(6); v.w.run();
  ok(!v.G.give.outgoing && !v.R.give.incoming && v.R.ledger.exp.length === MAX_EXP && v.G.cr.azure === 1, "a receiver with a full expected list declines a lantern and drops no entry");
  v.R.ledger.exp.length = MAX_EXP - 1; v.w.clock += 1000; v.G.give.offer(6); v.w.run(); v.R.ledger.exp.push({ t: 9999, i: 0, s: 77 });
  const first = v.R.ledger.exp[0];
  ok(!v.R.give.accept() && v.R.ledger.exp.length === MAX_EXP && v.R.ledger.exp[0] === first, "accept() refuses when the list filled in the meantime, and drops nothing");
  const w = mk("wick"); w.G.give.offer(3); w.w.run(); w.R.cr.wick = SOFT_STACK; w.R.give.accept(); w.w.run();
  ok(w.G.cr.wick === 1 && w.R.cr.wick === SOFT_STACK && w.R.ledger.exp.length === 0 && !w.G.give.outgoing && w.G.events.includes("declined"), "a stack that filled between offer and accept refuses at accept: the giver keeps it, nothing is expected");
  const x = mk("wick"); for (let n = 0; n < MAX_OUT; n++) x.G.ledger.out.push({ t: 8000 + n, i: 3, s: 77 });
  ok(!x.G.give.offer(3) && x.G.cr.wick === 1, "a giver with a full on-its-way list cannot offer, and keeps everything");
  const y = mk("wick"); y.G.give.offer(3); y.w.run(); for (let n = 0; n < MAX_OUT; n++) y.G.ledger.out.push({ t: 8000 + n, i: 3, s: 77 });
  y.R.give.accept(); y.w.run();
  ok(y.G.cr.wick === 1 && y.G.ledger.out.length === MAX_OUT && y.R.cr.wick === 0 && y.R.ledger.exp.length === 0 && !y.G.give.outgoing, "the on-its-way list filled between offer and accept: nothing moves, the receiver's accept is cleared, no entry is dropped");
  const z = mk("wick", { gHas: 0 });
  ok(!z.G.give.offer(3), "no offer of an item the giver does not have");
  const z2 = mk("wick"); z2.G.give.offer(3); z2.w.run(); z2.G.cr.wick = 0; z2.R.give.accept(); z2.w.run();
  ok(z2.G.cr.wick === 0 && z2.R.cr.wick === 0 && z2.G.ledger.out.length === 0 && z2.R.ledger.exp.length === 0 && z2.G.events.includes("cancelled"), "the wick was used up between offer and accept: nothing moves, nothing is owed");
}
// Expiry.
{
  const s = mk("wick"); s.G.give.offer(3); s.w.run(); s.w.clock += OFFER_MS + 1; s.G.give.tick(); s.R.give.tick(); s.w.run();
  ok(!s.G.give.outgoing && !s.R.give.incoming && s.G.cr.wick === 1 && s.G.events.includes("expired") && s.R.events.includes("expired"), "an unanswered offer of a wick expires on both sides; nothing moved");
  ok(!s.R.give.accept() && s.R.cr.wick === 0 && s.R.ledger.exp.length === 0, "a late accept after expiry does nothing");
  const t = mk("amber"); t.G.give.offer(4); t.w.run(); t.w.clock += OFFER_MS + 1; ok(!t.R.give.accept() && t.R.ledger.exp.length === 0 && t.G.cr.amber === 1, "accept() checks the clock itself, even before any tick");
  const u = mk("wick"); u.G.give.offer(3); u.w.run(); u.R.give.accept(); u.w.run(); u.w.clock += OFFER_MS * 10; u.G.give.tick(); u.R.give.tick();
  ok(u.G.cr.wick === 0 && u.R.cr.wick === 1, "a delivered gift is not undone by time passing");
}
// A peer leaving midway.
{
  const s = mk("jade"); s.G.give.offer(5); s.w.run(); s.w.kill(s.G);
  ok(!s.R.give.incoming && s.R.events.includes("lost") && s.R.cr.jade === 0 && s.R.ledger.exp.length === 0, "the giver leaves after offering: the receiver's offer ends, nothing owed");
  const t = mk("jade"); t.G.give.offer(5); t.w.run(); t.w.kill(t.R);
  ok(!t.G.give.outgoing && t.G.cr.jade === 1 && t.G.events.includes("lost") && t.G.ledger.out.length === 0, "the receiver leaves after being offered: the giver's offer ends, the lantern is still in the pack");
  // receiver leaves after accepting but before the commit arrives: the giver commits to nobody? (accept is lost with the receiver)
  const u = mk("amber"); u.G.give.offer(4); u.w.run(); u.R.give.accept(); u.w.kill(u.R);
  ok(u.G.cr.amber === 1 && !u.G.give.outgoing && u.G.ledger.out.length === 0, "the receiver leaves right after accepting: the accept never arrives, so the lantern never left the giver");
  // giver leaves after the commit: the receiver, with the gift expected, gets it when the giver returns.
  const v = mk("amber"); v.G.give.offer(4); v.w.run(); v.R.give.accept();
  v.w.hook = (e) => (e.msg.k === "cf" ? "drop" : null); v.w.run(); v.w.hook = null;
  ok(v.G.cr.amber === 0 && v.G.ledger.out.length === 1 && v.R.ledger.exp.length === 1, "the commit was lost: the lantern is on its way (saved), the receiver is still waiting");
  v.w.kill(v.G);
  const G2 = v.w.spawn(G_SEED, v.gd); v.w.link(); v.w.clock += RESEND_MS + 1; v.w.tickAll(); v.w.run();
  ok(G2.ledger.out.length === 0 && v.R.cr.amber === 1 && census(G2, v.R, "amber").total === 1, "the giver comes back from its saved state and the lantern arrives exactly once");
  v.w.clock += RESEND_MS * 3; v.w.tickAll(); v.w.run();
  ok(v.R.cr.amber === 1, "later resends add nothing");
  // receiver leaves after the commit and comes back later
  const x = mk("wick"); x.G.give.offer(3); x.w.run(); x.R.give.accept(); x.w.hook = (e) => (e.msg.k === "cf" ? "drop" : null); x.w.run(); x.w.hook = null;
  x.w.kill(x.R); x.w.clock += RESEND_MS + 1; x.w.tickAll(); x.w.run();
  ok(x.G.ledger.out.length === 1 && x.G.cr.wick === 0, "with the receiver away the wick stays on its way and is not given back");
  const R2 = x.w.spawn(R_SEED, x.rd); x.w.link(); x.w.clock += RESEND_MS + 1; x.w.tickAll(); x.w.run();
  ok(R2.cr.wick === 1 && x.G.ledger.out.length === 0 && census(x.G, R2, "wick").total === 1, "the receiver returns from its saved state: the wick arrives once and the giver's list clears");
}
// Every message dropped, or either side restarted, at every step: the item exists exactly once and arrives once.
function scenario(item, fault) {
  const s = mk(item, { held: item === "amber" ? 1 : 0 });
  let n = 0, bad = null, accepted = false;
  s.w.hook = (e) => {
    n++;
    if (fault.kind === "drop" && n === fault.at) return "drop";
    if (fault.kind === "killG" && n === fault.at) { s.w.kill(s.G); s.G = null; return "drop"; }
    if (fault.kind === "killR" && n === fault.at) { s.w.kill(s.R); s.R = null; return "drop"; }
    return null;
  };
  const G0 = s.G, R0 = s.R;
  G0.give.offer(s.i);
  let guard = 0;
  while (guard++ < 40) {
    s.w.run(() => {});
    const R = [...s.w.players.values()].find(p => p.seed === R_SEED);
    if (R && R.give.incoming && !accepted) { accepted = true; R.give.accept(); continue; }
    break;
  }
  s.w.hook = null;
  const Gnow = () => [...s.w.players.values()].find(p => p.seed === G_SEED), Rnow = () => [...s.w.players.values()].find(p => p.seed === R_SEED);
  if (!Gnow()) s.w.spawn(G_SEED, s.gd);
  if (!Rnow()) s.w.spawn(R_SEED, s.rd);
  s.w.link();
  for (let k = 0; k < 4; k++) { s.w.clock += RESEND_MS + 1; s.w.tickAll(); s.w.run(); }
  const G = Gnow(), R = Rnow(), c = census(G, R, item);
  if (c.total !== 1) bad = `total ${c.total} at the end`;
  return { bad, c, rGot: R.ledger.got.length, rCount: R.cr[item], gCount: G.cr[item], lamp: G.held.lamp, steps: n };
}
for (const item of ["wick", "amber"]) {
  const base = scenario(item, { kind: "none", at: 0 });
  ok(base.bad === null && base.rCount === 1 && base.gCount === 0, `${item}: no fault, one moves (${base.steps} messages)`);
  let bads = [], cnt = 0;
  for (const kind of ["drop", "killG", "killR"]) for (let at = 1; at <= base.steps; at++) {
    cnt++;
    const r = scenario(item, { kind, at });
    // Either the offer ended before anything left the giver (giver 1, receiver 0) or it all arrived: exactly one exists, and at most one on the receiver.
    if (r.bad || r.c.total !== 1 || r.rCount > 1 || (r.rCount === 1 && r.gCount !== 0) || r.rGot > 1) bads.push(`${kind}@${at}: ${r.bad || JSON.stringify(r.c)}`);
  }
  ok(bads.length === 0, `${item}: ${cnt} runs with one message dropped or one side restarted at each step: it always exists exactly once${bads.length ? " (" + bads.slice(0, 4).join("; ") + ")" : ""}`);
}
// Hostile messages.
{
  const s = mk("wick"); const send = (msg, from = s.G.id) => s.R.hs.forEach(h => h(msg, from));
  const before = JSON.stringify([s.R.cr, s.R.inv, s.R.ledger]);
  for (const m of [{ k: "of", t: 5, i: 8 }, { k: "of", t: 5, i: -1 }, { k: "of", t: 5, i: 3.5 }, { k: "of", t: 5, i: "3" }, { k: "cf", t: 5, i: 3 }, { k: "cf", t: 5, i: 6 }, { k: "of", t: 5, i: 3, z: 1 }]) send(m);
  ok(JSON.stringify([s.R.cr, s.R.inv, s.R.ledger]) === before && (!s.R.give.incoming || s.R.give.incoming.i === 3), "bad kind numbers and an unasked-for commit of a crafted kind change nothing");
  const t = mk("wick"); t.R.hs.forEach(h => h({ k: "of", t: 5, i: 3 }, "nobody"));
  ok(!t.R.give.incoming, "an offer from someone who never said hello is ignored");
  const u = mk("jade"); u.G.give.offer(5); u.w.run(); u.R.hs.forEach(h => h({ k: "cf", t: 4242, i: 4 }, u.G.id));
  ok(u.R.cr.amber === 0 && u.R.cr.jade === 0, "a commit that names another kind than the accepted one gives nothing");
}

// ---- browser harness ----
const require = createRequire(import.meta.url);
let pw;
for (const id of ["playwright", "/opt/node-tools/node_modules/playwright", "playwright-core"]) { try { pw = require(id); break; } catch { /* next */ } }
if (!pw) { console.error("playwright not found"); process.exit(2); }
async function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const b = "/opt/pw-browsers";
  if (!existsSync(b)) return undefined;
  for (const d of (await readdir(b)).filter(d => d.startsWith("chromium")).sort().reverse())
    for (const rel of ["chrome-linux/chrome", "chrome-linux64/chrome"]) { const p = path.join(b, d, rel); if (existsSync(p)) return p; }
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
const browser = await pw.chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ["--disable-features=WebRtcHideLocalIpsWithMdns"] });

const errors = [];
function watch(page, label) {
  page.on("pageerror", e => errors.push(`${label}: ${e.message}`));
  page.on("console", m => { if (m.type() === "error" && !/WebSocket connection to 'wss:/.test(m.text()) && !/User-Initiated Abort, reason=Close called/.test(m.text())) errors.push(`${label}: ${m.text()}`); });
}
async function waitFor(page, fn, arg, timeout = 10000) {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 50 }); return true; } catch { return false; }
}
const STORE = "vigil.longwatch.v1";
const gv = (page) => page.evaluate(() => window.__longWatch.give());
async function seedPack(page, url, patch) {
  await page.goto(url);
  await page.evaluate(([K, patch]) => { const st = location.search.includes("net=local") ? sessionStorage : localStorage; const s = JSON.parse(st.getItem(K)); Object.assign(s, patch); st.setItem(K, JSON.stringify(s)); }, [STORE, patch]);
  await page.reload();
}

async function pages(label, mkPage, query, room, opts = {}) {
  console.log(`\n# ${label}`);
  const url = `${base}${query}#room=${room}`;
  const A = await mkPage(), B = await mkPage();
  await seedPack(A, url, { cr: { wick: 2, amber: 1, jade: 1, azure: 0 }, lamp: 1 });
  await seedPack(B, url, { cr: { wick: SOFT_STACK, amber: 0, jade: 0, azure: 0 } });
  await A.click("#enter"); await B.click("#enter");
  ok(await waitFor(A, () => window.__longWatch.peers().length === 1, null, opts.timeout) && await waitFor(B, () => window.__longWatch.peers().length === 1, null, opts.timeout), "each page sees exactly one other player");
  const idA = await A.evaluate(() => window.__longWatch.self().id), idB = await B.evaluate(() => window.__longWatch.self().id);
  const a0 = await gv(A);
  ok(a0.cr.wick === 2 && a0.cr.amber === 1 && a0.lamp === 1, "A starts with 2 wicks, an amber and a jade lantern, holding the amber one");
  const nodes = await A.evaluate(() => window.__longWatch.nodes()), n0 = nodes[0];
  const near = async () => { // both stand beside a gathering spot (open ground), each sure the other is there
    await A.evaluate(([x, y]) => window.__longWatch.teleport(x, y), [n0.x - 0.2, n0.y]); await B.evaluate(([x, y]) => window.__longWatch.teleport(x, y), [n0.x + 0.6, n0.y]);
    return await waitFor(A, ([x, y]) => window.__longWatch.peers().some(p => Math.hypot(p.x - x, p.y - y) < 0.05), [n0.x + 0.6, n0.y], 8000) && await waitFor(B, ([x, y]) => window.__longWatch.peers().some(p => Math.hypot(p.x - x, p.y - y) < 0.05), [n0.x - 0.2, n0.y], 8000);
  };
  ok(await near() && await waitFor(A, () => window.__longWatch.give().target !== null, null, 6000), "A is in reach of B");
  const btn = (i) => `#givebtns button[data-kind="${i}"]`;
  const labels = await A.evaluate(() => [...document.querySelectorAll("#givebtns button")].map(b => b.textContent));
  ok(labels.length === 8 && labels.includes("Give lamp oil") && labels.includes("Give wick") && labels.includes("Give amber lantern") && labels.includes("Give jade lantern") && labels.includes("Give azure lantern"), "the Give buttons list the three gathered kinds, the wick, three lanterns and lamp oil");
  await waitFor(A, () => !document.querySelector('#givebtns button[data-kind="3"]').disabled, null, 4000);
  const dis = await A.evaluate(() => [...document.querySelectorAll("#givebtns button")].map(b => b.disabled));
  ok(dis[3] === false && dis[4] === false && dis[5] === false && dis[6] === true, "Give wick, amber and jade are on for A; Give azure is off (none)");

  // 1. A full stack refuses.
  await A.click(btn(3));
  ok(await waitFor(A, () => /did not take/.test(window.__longWatch.give().info) && window.__longWatch.give().outgoing === null, null, 6000), "B has a full wick stack: the offer is declined and A is told");
  const a1 = await gv(A), b1 = await gv(B);
  ok(a1.cr.wick === 2 && b1.cr.wick === SOFT_STACK && b1.incoming === null && b1.exp.length === 0, "nothing moved and B shows no offer");

  // 2. A gives the amber lantern it holds; B accepts; both save.
  await A.click(btn(4));
  ok(await waitFor(B, () => window.__longWatch.give().incoming !== null && !document.getElementById("offerbox").hidden && /amber lantern/.test(document.getElementById("offertext").textContent), null, 6000), "B sees an offer of one amber lantern");
  ok((await gv(A)).cr.amber === 1, "before B accepts the lantern is still in A's pack");
  await B.click("#offeryes");
  ok(await waitFor(B, () => window.__longWatch.give().cr.amber === 1, null, 8000), "B accepted: B has the amber lantern");
  ok(await waitFor(A, () => { const g = window.__longWatch.give(); return g.cr.amber === 0 && g.out.length === 0; }, null, 8000), "A's lantern is gone and the gift is confirmed");
  const a2 = await gv(A);
  ok(a2.lamp === 0 && await A.evaluate(() => window.__longWatch.craft().lamp === 0), "A held it, so A is back to the plain lantern");
  ok(await waitFor(B, (id) => (window.__longWatch.craft().peerLamps.find(p => p.id === id) || {}).lamp === 0, idA, 5000), "B sees A with the plain lantern");
  ok(await B.evaluate(() => !document.querySelector('#holdbtns button[data-lamp="1"]').hidden), "B now has a Hold amber lantern button");
  await B.click('#holdbtns button[data-lamp="1"]');
  ok(await waitFor(A, (id) => (window.__longWatch.craft().peerLamps.find(p => p.id === id) || {}).lamp === 1, idB, 5000), "B holds it and A sees B's amber light");
  const saved = async (p) => p.evaluate(([K]) => { const st = location.search.includes("net=local") ? sessionStorage : localStorage; return JSON.parse(st.getItem(K)); }, [STORE]);
  const sA = await saved(A), sB = await saved(B);
  ok(sA.cr.amber === 0 && sA.lamp === 0 && sB.cr.amber === 1 && sB.lamp === 1 && sA.out.length === 0 && sB.exp.length === 0, "both saves agree: A has none and holds plain, B has one and holds it");
  await B.reload(); await B.click("#enter");
  ok(await waitFor(B, () => window.__longWatch.craft().lamp === 1 && window.__longWatch.craft().cr.amber === 1, null, 6000), "after a reload B still has the lantern and holds it");
  ok(await waitFor(B, () => window.__longWatch.peers().length === 1, null, opts.timeout) && await waitFor(A, () => window.__longWatch.peers().length === 1, null, opts.timeout), "they find each other again");

  // 3. A takes an offer back; a player leaving ends an offer.
  ok(await near() && await waitFor(A, () => window.__longWatch.give().target !== null, null, 6000), "A is in reach of B again");
  await A.click(btn(5));
  ok(await waitFor(B, () => window.__longWatch.give().incoming !== null, null, 6000), "B sees an offer of the jade lantern");
  await A.click("#givecancel");
  ok(await waitFor(B, () => window.__longWatch.give().incoming === null && document.getElementById("offerbox").hidden, null, 6000) && (await gv(A)).cr.jade === 1, "A takes it back: B's offer disappears and A keeps the lantern");
  await A.click(btn(5));
  ok(await waitFor(B, () => window.__longWatch.give().incoming !== null, null, 6000), "an offer is up again");
  await A.close();
  ok(await waitFor(B, () => window.__longWatch.give().incoming === null, null, opts.leaveTimeout || 20000) && (await gv(B)).cr.jade === 0 && (await gv(B)).exp.length === 0, "A leaves: B's offer ends and nothing is owed");

  await B.close();
}

// ---- 1. local ----
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
  const mkPage = () => ctx.newPage().then(p => (watch(p, "local"), p));
  await pages("local transport (BroadcastChannel)", mkPage, "?net=local", 6, { local: true, leaveTimeout: 20000 });
  await ctx.close();
}

// ---- 2. real WebRTC through a local Nostr relay ----
if (!onlyLocal) {
  const relay = await startRelay();
  const c = [await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true }), await browser.newContext({ viewport: { width: 1000, height: 900 } })];
  let i = 0;
  const mkPage = () => c[i++ % 2].newPage().then(p => (watch(p, "webrtc"), p));
  await pages("Trystero over Nostr + WebRTC (relay on 127.0.0.1)", mkPage, `?net=nostr&relay=${encodeURIComponent(relay.url)}`, 5, { timeout: 30000, leaveTimeout: 40000 });
  for (const x of c) await x.close().catch(() => {});
  relay.close();
}

ok(errors.length === 0, `no console errors${errors.length ? ":\n  " + errors.join("\n  ") : ""}`);
await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
