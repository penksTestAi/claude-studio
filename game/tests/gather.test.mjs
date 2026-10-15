#!/usr/bin/env node
// Milestone 3 tests for The Long Watch: gathering, shared.
//
//   node game/tests/gather.test.mjs            node checks, local transport, then real Trystero/WebRTC via a local Nostr relay
//   node game/tests/gather.test.mjs --local    skip the WebRTC part
//
// Part 0 (node): the seeded nodes, and the real gather code on a fake mesh of players: contested picks settled by
// the arbiter, hostile messages dropped, snapshots in chunks under the size cap.
// Then pages: what one player picks is gone for the other, a contested pick gives exactly one winner, the node
// grows back for everyone, a late joiner gets a snapshot, a new arbiter takes over when the old one leaves.
// The local run also forges hostile messages.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startRelay } from "./nostr-relay.mjs";
import { generateWorld } from "../js/world.js";
import { generateNodes, nodeFingerprint, KINDS, PER_KIND, MIN_GAP, MAX_RESPAWN_S } from "../js/resources.js";
import { createGather, PICK_RANGE, ARBITER_RANGE } from "../js/gather.js";
import { MAX_MESSAGE_BYTES, withinSizeCap } from "../js/net/transport.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const onlyLocal = process.argv.includes("--local");

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failures++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---- 0. node: nodes and the arbiter logic on a fake mesh ----
console.log("# seeded nodes and arbiter, in node");
const world = generateWorld();
const nodes = generateNodes(world);
{
  const again = generateNodes(generateWorld());
  ok(nodeFingerprint(nodes) === nodeFingerprint(again), `the node list is the same on every build (${nodeFingerprint(nodes)})`);
  for (const k of KINDS) ok(nodes.filter(n => n.kind === k).length === PER_KIND, `${PER_KIND} ${k} spots`);
  ok(nodes.every((n, i) => n.id === i), "ids are 0..n-1 in order");
  ok(nodes.every(n => n.respawn >= 90 && n.respawn <= 150), "seeded respawn is 90 to 150 seconds");
  let minGap = 1e9; for (const a of nodes) for (const b of nodes) if (a !== b) minGap = Math.min(minGap, Math.abs(a.x - b.x) + Math.abs(a.y - b.y));
  ok(minGap >= MIN_GAP, `no two nodes closer than ${MIN_GAP} tiles (closest ${minGap})`);
  const walk = (x, y) => world.tiles[Math.floor(y) * world.w + Math.floor(x)];
  ok(nodes.every(n => ![0, 4, 5].includes(walk(n.x, n.y)) && !world.solid.has(Math.floor(n.y) * world.w + Math.floor(n.x))), "every node is on open ground");
  ok(nodes.filter(n => n.kind === "driftwood").every(n => walk(n.x, n.y) === 2), "driftwood lies on sand");
}
function mesh(ids) {
  const fakes = new Map();
  const make = (id) => {
    const f = { selfId: id, hs: [], leaves: [], sent: [], me: { x: 0, y: 0 }, peers: new Map(), clock: 0 };
    f.net = {
      selfId: id, onMessage: h => f.hs.push(h), onPeerLeave: h => f.leaves.push(h), onPeerJoin() {},
      send(msg, to) { f.sent.push([msg, to]); for (const [oid, o] of fakes) if (oid !== id && (!to || to === oid)) o.queue.push([JSON.parse(JSON.stringify(msg)), id]); },
    };
    f.queue = [];
    fakes.set(id, f);
    return f;
  };
  ids.forEach(make);
  const link = () => { for (const [id, f] of fakes) for (const [oid, o] of fakes) if (oid !== id && !f.peers.has(oid)) f.peers.set(oid, { id: oid, tx: o.me.x, ty: o.me.y }); };
  const pump = () => { let moved = true; while (moved) { moved = false; for (const [id, f] of fakes) while (f.queue.length) { moved = true; const [m, from] = f.queue.shift(); f.hs.forEach(h => h(m, from)); } } };
  return { fakes, link, pump };
}
{
  const m = mesh(["a1", "b2", "c3"]); m.link();
  const events = {};
  const g = {};
  const clock = { t: 0 };
  for (const [id, f] of m.fakes) {
    events[id] = [];
    g[id] = createGather(f.net, world, f.me, f.peers, nodes, { now: () => clock.t, onEvent: (t, k) => events[id].push(t + ":" + k) });
  }
  const n0 = nodes[0];
  for (const f of m.fakes.values()) { f.me.x = n0.x; f.me.y = n0.y; }
  m.link(); for (const [id, f] of m.fakes) for (const [oid, o] of m.fakes) if (oid !== id) f.peers.get(oid).tx = o.me.x, f.peers.get(oid).ty = o.me.y;
  clock.t = 2000; for (const x of Object.values(g)) x.tick(); m.pump();
  ok(Object.values(g).every(x => x.synced), "all three are synced after the wait");
  ok(g.a1.isArbiter() && !g.b2.isArbiter() && !g.c3.isArbiter() && g.c3.arbiterId() === "a1", "the lowest id is the arbiter, and everyone agrees");
  // contested: b2 and c3 both ask before anything is delivered
  clock.t = 3000;
  ok(g.b2.pick() && g.c3.pick(), "both b2 and c3 ask for the same node");
  m.pump();
  const total = () => Object.values(g).reduce((s, x) => s + KINDS.reduce((a, k) => a + x.inv[k], 0), 0);
  ok(total() === 1 && g.b2.inv[n0.kind] === 1 && g.c3.inv[n0.kind] === 0, "exactly one winner: the first request the arbiter saw (b2)");
  ok(events.c3.includes("denied:" + n0.kind), "the loser is told");
  ok(Object.values(g).every(x => x.isHidden(0) && x.hiddenCount() === 1), "the node is hidden for all three");
  clock.t = 3000 + n0.respawn * 1000 - 10; ok(Object.values(g).every(x => x.isHidden(0)), "still hidden just before its respawn");
  clock.t += 20; ok(Object.values(g).every(x => !x.isHidden(0)), "back for everyone at its seeded respawn time");
  // the arbiter picking itself
  clock.t += 1000; const apick = g.a1.pick(); m.pump(); ok(apick && g.a1.inv[n0.kind] === 1 && g.b2.isHidden(0), "the arbiter can pick too, and the others see it");
  // out of range for the arbiter's own check
  const far = nodes[5]; m.fakes.get("c3").me.x = far.x; m.fakes.get("c3").me.y = far.y; // c3 really moved, but the arbiter still thinks it is at n0
  clock.t += 1000; g.c3.pick(); m.pump();
  ok(!g.a1.isHidden(5) && g.c3.inv[far.kind] === 0, "a pick from a position the arbiter does not believe is refused");
  // hostile
  const send = (to, msg, from) => { const f = m.fakes.get(to); f.hs.forEach(h => h(msg, from)); };
  const before = KINDS.map(k => g.b2.inv[k]).join();
  const bad = [{ k: "gt", n: 9, r: 50 }, { k: "gt", n: 9 }, { k: "ok", n: 3 }, { k: "no", n: 3 }, { k: "sn", n: [9], t: [50], f: 1, z: 1 }, { k: "pk", n: 9999 }, { k: "pk", n: -1 }, { k: "pk", n: 1.5 }, { k: "pk", n: "3" }, { k: "pk", n: 3, x: 1 }, "gt", 7, null, { k: "pk", n: [3] }];
  for (const msg of bad) { send("b2", msg, "c3"); send("a1", msg, "c3"); send("a1", msg, "stranger"); }
  m.pump();
  ok(Object.values(g).every(x => !x.isHidden(9) && !x.isHidden(3)), "forged gt/ok/no from a non-arbiter, bad ids, extra fields and strangers change nothing");
  ok(before === KINDS.map(k => g.b2.inv[k]).join(), "a forged ok grants nothing without a request");
  for (const msg of [{ k: "gt", n: 9, r: 0 }, { k: "gt", n: 9, r: MAX_RESPAWN_S + 1 }, { k: "gt", n: 9, r: 1.5 }, { k: "gt", n: 9, r: NaN }, { k: "gt", n: 9, r: "9" }]) send("b2", msg, "a1");
  ok(!g.b2.isHidden(9), "even from the arbiter, a respawn time that is not a whole number of seconds in range is refused");
  // snapshot in chunks
  const m2 = mesh(["a1", "z9"]); m2.link();
  const t2 = { t: 0 };
  const A = createGather(m2.fakes.get("a1").net, world, m2.fakes.get("a1").me, m2.fakes.get("a1").peers, nodes, { now: () => t2.t });
  t2.t = 2000; A.tick(); t2.t += 6000;
  const fa = m2.fakes.get("a1"); fa.me.x = 0; fa.me.y = 0;
  // hide 40 nodes on A as if the arbiter had granted them: via gt messages from itself is impossible, so deliver from the peer that is arbiter
  const zf = m2.fakes.get("z9");
  const Z = createGather(zf.net, world, zf.me, zf.peers, nodes, { now: () => t2.t });
  // a1 is the arbiter for z9; deliver 40 gt messages from a1 to z9, then ask z9's snapshot into a fresh peer
  for (let i = 0; i < 40; i++) { t2.t += 100; zf.hs.forEach(h => h({ k: "gt", n: i, r: 100 + i }, "a1")); }
  t2.t += 2000; Z.tick(); t2.t += 1000;
  zf.hs.forEach(h => h({ k: "rq" }, "a1")); // a1 asks z9 (a peer that is synced)
  const sn = zf.sent.filter(([msg]) => msg.k === "sn");
  ok(sn.length === 3 && sn.every(([msg]) => withinSizeCap(msg)) && sn.map(([msg]) => msg.f).join() === "0,0,1", `40 hidden nodes go out as 3 snapshot chunks, each under ${MAX_MESSAGE_BYTES} bytes (largest ${Math.max(...sn.map(([msg]) => JSON.stringify(msg).length))})`);
  for (const [msg] of sn) fa.queue.push([msg, "z9"]);
  m2.pump();
  ok(A.hiddenCount() === 40 && A.synced, "the receiver now hides all 40 and counts itself synced");
  zf.hs.forEach(h => h({ k: "rq" }, "a1")); ok(zf.sent.filter(([msg]) => msg.k === "sn").length === 3, "a second snapshot request within a second is ignored");
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
  page.on("console", m => { if (m.type() === "error" && !/WebSocket connection to 'wss:/.test(m.text())) errors.push(`${label}: ${m.text()}`); });
}
async function waitFor(page, fn, arg, timeout = 10000) {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 50 }); return true; } catch { return false; }
}

// ---- pages ----
const lw = (page) => page.evaluate(() => window.__longWatch.gather());
const sum = (g) => g.inv.driftwood + g.inv.reeds + g.inv.berries;
const nodePos = (n) => ({ x: n.x, y: n.y });
async function teleportSynced(page, others, x, y) {
  if (!await page.evaluate(([x, y]) => window.__longWatch.teleport(x, y), [x, y])) return false;
  for (const o of others) if (!await waitFor(o, ([x, y]) => window.__longWatch.peers().some(p => Math.hypot(p.x - x, p.y - y) < 0.05), [x, y], 6000)) return false;
  return true;
}

async function scenario(label, mk, query, room, opts = {}) {
  console.log(`\n# ${label}`);
  const [pageA, pageB] = [await mk(), await mk()];
  await pageA.goto(`${base}${query}#room=${room}`); await pageB.goto(`${base}${query}#room=${room}`);
  await pageA.click("#enter"); await pageB.click("#enter");
  const seen = await waitFor(pageA, () => window.__longWatch.peers().length === 1, null, opts.timeout) && await waitFor(pageB, () => window.__longWatch.peers().length === 1, null, opts.timeout);
  if (!seen) { const dump = (p) => p.evaluate(() => ({ id: window.__longWatch.self().id, links: window.__longWatch.linkHistory(), peers: window.__longWatch.peers().map(q => q.id), hud: window.__longWatch.hud() })); console.log("  diagnostics A", JSON.stringify(await dump(pageA)), "B", JSON.stringify(await dump(pageB))); }
  ok(seen, "each page sees exactly one other player");
  if (!seen) return;
  const list = await pageA.evaluate(() => window.__longWatch.nodes());
  ok(JSON.stringify(list) === JSON.stringify(await pageB.evaluate(() => window.__longWatch.nodes())) && list.length === 42, "both pages have the same 42 nodes");
  ok(await pageA.evaluate(() => window.__longWatch.nodeFingerprint()) === nodeFingerprint(nodes), "the browser's node list matches the one built in node");
  ok(await waitFor(pageA, () => window.__longWatch.gather().synced, null, 5000) && await waitFor(pageB, () => window.__longWatch.gather().synced, null, 5000), "both are synced");
  const ga = await lw(pageA);
  const [Y, X] = ga.isArbiter ? [pageA, pageB] : [pageB, pageA]; // Y is the arbiter, X is not
  ok((await lw(Y)).isArbiter && !(await lw(X)).isArbiter && (await lw(X)).arbiter === (await Y.evaluate(() => window.__longWatch.self().id)), "the players agree who the arbiter is (lowest id)");
  const spawn = await Y.evaluate(() => window.__longWatch.self());

  // 1. X picks with the real E key; Y sees the node vanish; the node comes back for both.
  const n0 = list[0];
  await Y.evaluate(([x, y]) => window.__longWatch.teleport(x, y), [spawn.x, spawn.y]);
  ok(await teleportSynced(X, [Y], n0.x, n0.y), "X stands on the node and the arbiter knows it");
  ok(await waitFor(X, (id) => window.__longWatch.gather().reach === id, n0.id, 3000), "X's game says the node is in reach");
  ok(!await X.evaluate(() => document.getElementById("gather").disabled), "the Gather button is enabled in reach");
  await X.locator("#view").focus(); await X.keyboard.press("e");
  ok(await waitFor(X, () => { const g = window.__longWatch.gather(); return g.inv.driftwood + g.inv.reeds + g.inv.berries === 1; }, null, 5000), "X gets one item (E key)");
  ok(await waitFor(Y, (id) => window.__longWatch.gather().hidden.includes(id), n0.id, 5000), "Y sees the node vanish");
  ok(sum(await lw(Y)) === 0, "the other player got nothing");
  ok((await X.locator("#pack").textContent()).includes("1"), "X's pack line shows it");
  ok(await waitFor(X, (id) => !window.__longWatch.gather().hidden.includes(id), n0.id, (opts.respawn + 4) * 1000) && await waitFor(Y, (id) => !window.__longWatch.gather().hidden.includes(id), n0.id, 3000), `the node grows back for both (respawn pinned to ${opts.respawn} s)`);

  // 2. contested picks: both stand on the same node and press at once, three times.
  for (const i of [1, 2, 3]) {
    const n = list[i * 7 % list.length];
    await Y.evaluate(([x, y]) => window.__longWatch.teleport(x, y), [n.x + 0.1, n.y]);
    const synced = await teleportSynced(X, [Y], n.x - 0.1, n.y) && await waitFor(X, ([x, y]) => window.__longWatch.peers().some(p => Math.hypot(p.x - x, p.y - y) < 0.05), [n.x + 0.1, n.y], 6000);
    const x0 = sum(await lw(X)) + sum(await lw(Y));
    await Promise.all([X.evaluate(() => window.__longWatch.pick()), Y.evaluate(() => window.__longWatch.pick())]);
    await waitFor(X, (id) => window.__longWatch.gather().hidden.includes(id), n.id, 5000); await waitFor(Y, (id) => window.__longWatch.gather().hidden.includes(id), n.id, 5000);
    await sleep(500);
    const gx = await lw(X), gy = await lw(Y);
    ok(synced && sum(gx) + sum(gy) - x0 === 1 && gx.hidden.includes(n.id) && gy.hidden.includes(n.id), `contested node ${n.id}: exactly one of the two got it, and it is hidden for both`);
    // (no wait for the contested node to grow back: nothing later uses it, and the real-WebRTC run pins a long respawn)
  }

  // 3. a late joiner gets a snapshot of what is hidden
  const nS = list[20];
  await Y.evaluate(([x, y]) => window.__longWatch.teleport(x, y), [spawn.x, spawn.y]);
  await waitFor(X, ([x, y]) => window.__longWatch.peers().some(p => Math.hypot(p.x - x, p.y - y) < 0.05), [spawn.x, spawn.y], 6000);
  await teleportSynced(X, [Y], nS.x, nS.y);
  await X.evaluate(() => window.__longWatch.pick());
  const pickedAt = Date.now();
  ok(await waitFor(Y, (id) => window.__longWatch.gather().hidden.includes(id), nS.id, 5000), "X picks another node; Y sees it hidden");
  const pageC = await mk(); await pageC.goto(`${base}${query}#room=${room}`); await pageC.click("#enter");
  ok(await waitFor(pageC, () => window.__longWatch.peers().length === 2, null, opts.timeout), "a third player joins and sees both others");
  const metAfter = Date.now() - pickedAt;
  const snap = await waitFor(pageC, (id) => window.__longWatch.gather().hidden.includes(id), nS.id, 5000);
  // The node is only hidden for the pinned respawn time (opts.respawn s: 20 over WebRTC, where a third player can take
  // several seconds to connect, 8 on the instant local channel). A slower join found it grown back in 7 of 36 runs under
  // heavy load with the old 8 s pin: that was the test's clock, not the game. Say so instead of a bare failure.
  if (!snap) console.log(`  diagnostics: the third player took ${metAfter} ms after the pick to see both others; the node respawns after ${opts.respawn * 1000} ms; X still hides it: ${await X.evaluate((id) => window.__longWatch.gather().hidden.includes(id), nS.id)}`);
  ok(snap, "the late joiner's map already hides that node (snapshot)");
  ok(await waitFor(pageC, () => window.__longWatch.gather().synced, null, 4000), "and the late joiner counts itself synced");
  ok(await waitFor(pageC, (id) => !window.__longWatch.gather().hidden.includes(id), nS.id, (opts.respawn + 3) * 1000) && await waitFor(Y, (id) => !window.__longWatch.gather().hidden.includes(id), nS.id, 3000), "it grows back for the late joiner and the others at about the same time");
  if (opts.local) await forged(X, Y, pageC, list);

  // 4. the arbiter leaves; the next lowest id takes over and picks still work
  const pages = [pageA, pageB, pageC];
  const ids = await Promise.all(pages.map(p => p.evaluate(() => window.__longWatch.self().id)));
  const low = ids.indexOf([...ids].sort()[0]);
  await pages[low].click("#leave");
  const rest = pages.filter((_, i) => i !== low);
  ok(await waitFor(rest[0], () => window.__longWatch.peers().length === 1, null, 6000) && await waitFor(rest[1], () => window.__longWatch.peers().length === 1, null, 6000), "the two others see the arbiter leave");
  const newLow = [...ids.filter((_, i) => i !== low)].sort()[0];
  const restIds = await Promise.all(rest.map(p => p.evaluate(() => window.__longWatch.self().id)));
  const [newArb, other] = restIds[0] === newLow ? [rest[0], rest[1]] : [rest[1], rest[0]];
  ok((await lw(newArb)).isArbiter && !(await lw(other)).isArbiter, "the next lowest id is now the arbiter on both sides");
  const nL = list[30];
  await teleportSynced(other, [newArb], nL.x, nL.y);
  await other.evaluate(() => window.__longWatch.pick());
  ok(await waitFor(other, () => { const g = window.__longWatch.gather(); return g.inv.driftwood + g.inv.reeds + g.inv.berries >= 1; }, null, 5000) || sum(await lw(other)) >= 1, "a pick through the new arbiter works");
  ok(await waitFor(newArb, (id) => window.__longWatch.gather().hidden.includes(id), nL.id, 5000), "and the new arbiter sees the node hidden");
  if (shots) { await other.screenshot({ path: path.join(shots, `${opts.shot}-picker.png`) }); }
  for (const p of pages) await p.context().close().catch(() => {});
}

// Hostile messages, posted on the local channel as if they came from the players.
async function forged(P1, P2, P3, list) {
  console.log("  hostile messages");
  // After the late joiner arrived the arbiter may be any of the three: pick the real one, and forge as one of the others.
  const all = [P1, P2, P3], allIds = await Promise.all(all.map(p => p.evaluate(() => window.__longWatch.self().id)));
  const ai = allIds.indexOf([...allIds].sort()[0]);
  const Y = all[ai], X = all[(ai + 1) % 3], idY = allIds[ai], idX = allIds[(ai + 1) % 3];
  const E = await X.context().newPage();
  await E.goto(`${base}?net=local`);
  const post = (to, from, msgs) => E.evaluate(([room, from, to, msgs]) => {
    const ch = new BroadcastChannel(`vigil-long-watch:lantern-${room}`);
    for (const d of msgs) ch.postMessage({ k: "data", d, from, to });
    ch.close();
  }, [6, from, to, msgs]);
  const hiddenOf = async (p) => (await lw(p)).hidden;
  // X is not the arbiter. Claims of gt from X (a non-arbiter) to Y, bad pk to Y, bad sn to Y.
  await post(idY, idX, [{ k: "gt", n: 11, r: 50 }, { k: "pk", n: 9999 }, { k: "pk", n: -1 }, { k: "pk", n: 1.5 }, { k: "pk", n: "3" }, { k: "pk", n: 12, x: 1 }, { k: "ok", n: 12 },
    { k: "sn", n: Array.from({ length: 17 }, (_, i) => i), t: Array(17).fill(30), f: 1 }, { k: "sn", n: [13], t: [0], f: 1 }, { k: "sn", n: [13], t: [99999], f: 1 }, { k: "sn", n: [13], t: [5, 6], f: 1 }, { k: "sn", n: [13.5], t: [5], f: 1 },
    { k: "sn", n: "13", t: "5", f: 1 }, { k: "sn", n: [13], t: [5], f: 2 }, { k: "zap" }, "gt", 5]);
  await sleep(500);
  ok((await hiddenOf(Y)).length === 0, "Y dropped a forged gt from a non-arbiter, bad node ids, extra fields and bad or oversize snapshots");
  // a pk for a node far away from where X stands: refused, nothing hidden
  const far = list.find(n => Math.hypot(n.x - 60, n.y - 60) > 30);
  const posX = (await X.evaluate(() => window.__longWatch.self()));
  const farNode = list.find(n => Math.hypot(n.x - posX.x, n.y - posX.y) > ARBITER_RANGE + 5);
  await post(idY, idX, [{ k: "pk", n: farNode.id }]);
  await sleep(400);
  ok(!(await hiddenOf(Y)).includes(farNode.id), `a pick for a node ${Math.round(Math.hypot(farNode.x - posX.x, farNode.y - posX.y))} tiles from the asker is refused`);
  await post(idY, idX, Array.from({ length: 400 }, () => ({ k: "pk", n: farNode.id })));
  await sleep(300);
  ok((await lw(Y)) !== null && !(await hiddenOf(Y)).includes(farNode.id), "a flood of 400 picks does not break the arbiter");
  // a valid snapshot from a known peer is accepted (that is the design): it hides node 13
  await sleep(800);
  await post(idY, idX, [{ k: "sn", n: [13], t: [30], f: 1 }]);
  ok(await waitFor(Y, () => window.__longWatch.gather().hidden.includes(13), null, 3000), "a well-formed snapshot from a known player is accepted");
  await E.close();
}

// ---- 1. local ----
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 800 } });
  const mk = () => ctx.newPage().then(p => (watch(p, "local"), p));
  await scenario("local transport (BroadcastChannel)", mk, "?net=local&respawn=8", 6, { local: true, respawn: 8, shot: "gather-local" });
  await ctx.close();
}

// ---- 2. real WebRTC through a local Nostr relay ----
if (!onlyLocal) {
  const relay = await startRelay();
  const c = [await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true }), await browser.newContext({ viewport: { width: 1000, height: 800 } }), await browser.newContext({ viewport: { width: 800, height: 700 } })];
  let i = 0;
  const mk = () => c[i++ % 3].newPage().then(p => (watch(p, "webrtc"), p));
  await scenario("Trystero over Nostr + WebRTC (relay on 127.0.0.1)", mk, `?net=nostr&respawn=20&relay=${encodeURIComponent(relay.url)}`, 5, { timeout: 30000, respawn: 20, shot: "gather-webrtc" });
  for (const x of c) await x.close().catch(() => {});
  relay.close();
}

ok(errors.length === 0, `no console errors${errors.length ? ":\n  " + errors.join("\n  ") : ""}`);
await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
