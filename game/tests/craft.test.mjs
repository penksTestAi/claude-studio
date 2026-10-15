#!/usr/bin/env node
// Milestone 5 tests for The Long Watch: crafting.
//
//   node game/tests/craft.test.mjs            node checks, local transport, then real Trystero/WebRTC via a local Nostr relay
//   node game/tests/craft.test.mjs --local    skip the WebRTC part
//
// Part 0 (node): the recipes only ever convert (ingredients out, result in, nothing created), a missing ingredient or
// a full stack refuses and changes nothing, saved crafted items are checked on load, and the lantern message is
// validated. Then pages: a second player sees the lantern's reach (the radius the game draws around the crafter
// and the brightness of the ground between them), a late joiner sees it too, the lantern survives a reload, a
// player with a full stack is refused without losing anything, and (local run) forged messages change nothing.
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
import { cleanSave, CRAFTED, LAMP_KEYS, emptyPack, emptyCraft } from "../js/inventory.js";
import { RECIPES, tryCraft, createCraft, LAMPS, CRAFT_STACK } from "../js/craft.js";
import { lightFor } from "../js/nightclock.js";
import { withinSizeCap } from "../js/net/transport.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const onlyLocal = process.argv.includes("--local");

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failures++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const STORE = "vigil.longwatch.v1";
const HOUR = 3; // pinned night hour for the pages
const BASE_REACH = lightFor(HOUR).reach;

// ---- 0. node: the rules ----
console.log("# crafting rules, in node");
const total = (inv, cr) => ({ ...inv, ...cr });
const snap = (inv, cr) => JSON.stringify([inv, cr]);
{
  ok(Object.keys(RECIPES).join() === CRAFTED.join(), "there is one recipe for each crafted item");
  ok(LAMPS.length === LAMP_KEYS.length + 1 && LAMPS.every((l, i) => i === 0 || l.mult > LAMPS[i - 1].mult), "each lantern reaches further than the one before");
  // Ingredients in the lantern recipes, converted down to raw items, to check nothing is created.
  const raw = (name) => { const t = Object.fromEntries(KINDS.map(k => [k, 0])); const add = (n, m) => { for (const [k, c] of Object.entries(RECIPES[n])) { if (CRAFTED.includes(k)) add(k, m * c); else t[k] += m * c; } }; add(name, 1); return t; };
  for (const name of CRAFTED) {
    const inv = Object.fromEntries(KINDS.map(k => [k, 20])), cr = Object.fromEntries(CRAFTED.map(k => [k, 5]));
    const before = JSON.parse(JSON.stringify([inv, cr]));
    const r = tryCraft(inv, cr, name);
    ok(r.ok && cr[name] === before[1][name] + 1, `${name}: one is made`);
    for (const [k, n] of Object.entries(RECIPES[name])) { const was = CRAFTED.includes(k) ? before[1][k] : before[0][k]; const now = CRAFTED.includes(k) ? cr[k] : inv[k]; ok(was - now === n, `${name}: exactly ${n} ${k} used`); }
    const others = [...KINDS, ...CRAFTED].filter(k => !(k in RECIPES[name]) && k !== name);
    ok(others.every(k => (CRAFTED.includes(k) ? cr[k] : inv[k]) === (CRAFTED.includes(k) ? before[1][k] : before[0][k])), `${name}: nothing else changed`);
  }
  // Each ingredient one short: refused, nothing changes. Result stack full: refused, nothing changes.
  for (const name of CRAFTED) for (const [k, n] of Object.entries(RECIPES[name])) {
    const inv = Object.fromEntries(KINDS.map(x => [x, 50])), cr = Object.fromEntries(CRAFTED.map(x => [x, 50]));
    (CRAFTED.includes(k) ? cr : inv)[k] = n - 1;
    const s = snap(inv, cr), r = tryCraft(inv, cr, name);
    ok(!r.ok && r.why === "missing" && r.item === k && snap(inv, cr) === s, `${name} with one ${k} short is refused and nothing is used`);
  }
  for (const name of CRAFTED) {
    const inv = Object.fromEntries(KINDS.map(x => [x, 500])), cr = Object.fromEntries(CRAFTED.map(x => [x, 500]));
    cr[name] = CRAFT_STACK;
    const s = snap(inv, cr), r = tryCraft(inv, cr, name);
    ok(!r.ok && r.why === "full" && snap(inv, cr) === s, `${name} with a full stack (${CRAFT_STACK}) is refused, nothing is used and nothing is dropped`);
    cr[name] = CRAFT_STACK - 1; const r2 = tryCraft(inv, cr, name);
    ok(r2.ok && cr[name] === CRAFT_STACK, `${name}: one below full still works`);
  }
  for (const bad of ["__proto__", "constructor", "toString", "hasOwnProperty", "", "Wick", 5, null, undefined]) {
    const inv = emptyPack(), cr = emptyCraft(); inv.reeds = 9; const s = snap(inv, cr);
    ok(!tryCraft(inv, cr, bad).ok && snap(inv, cr) === s, `an unknown recipe (${String(bad) || "empty"}) is refused`);
  }
  // A long random walk: raw items used equal what the made things cost. Nothing is created.
  let seed = 12345; const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  const inv = Object.fromEntries(KINDS.map(k => [k, 200])), cr = emptyCraft(), start = { ...inv };
  for (let i = 0; i < 400; i++) tryCraft(inv, cr, CRAFTED[Math.floor(rnd() * 4)]);
  const used = Object.fromEntries(KINDS.map(k => [k, 0]));
  for (const name of CRAFTED) { const r = raw(name); for (const k of KINDS) used[k] += r[k] * cr[name]; }
  // wicks inside lanterns are counted in raw(), so add the loose wicks as they are
  ok(KINDS.every(k => start[k] - inv[k] === used[k]), `400 random crafts: raw items used equal the cost of what was made (${JSON.stringify(cr)})`);
  ok(Object.values(inv).every(v => v >= 0) && Object.values(cr).every(v => v >= 0), "no count ever goes below zero");
  // Saved data is checked on load.
  const c1 = cleanSave({ seed: 1, inv: { reeds: 3 }, cr: { wick: 2, amber: 1, jade: -1, azure: 1.5, evil: 9 }, lamp: 1 });
  ok(c1.cr.wick === 2 && c1.cr.amber === 1 && c1.cr.jade === 0 && c1.cr.azure === 0 && !("evil" in c1.cr) && c1.lamp === 1, "a saved crafted pack is cleaned (negative, fractional and unknown entries dropped)");
  ok(cleanSave({ cr: { amber: 0 }, lamp: 1 }).lamp === 0 && cleanSave({ cr: { azure: 1 }, lamp: 9 }).lamp === 0 && cleanSave({ cr: { azure: 1 }, lamp: "3" }).lamp === 0 && cleanSave({ cr: { azure: 1 }, lamp: 3 }).lamp === 3, "you can only hold a lantern you own");
  ok(cleanSave(null).lamp === 0 && cleanSave({ cr: "x" }).cr.wick === 0 && cleanSave({ cr: { wick: 1e9 } }).cr.wick === 0, "garbage and huge saved counts become empty");
}
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
  console.log("# the lantern message, on a fake mesh");
  const m = mesh(["a", "b"]); const t = { v: 0 };
  const mk = (id, other) => { const f = m.fakes.get(id); f.peers.set(other, { id: other }); const inv = Object.fromEntries(KINDS.map(k => [k, 30])), cr = emptyCraft(), held = { lamp: 0 }; return { f, inv, cr, held, c: createCraft(f.net, f.me, f.peers, inv, cr, held, { now: () => t.v, persist() {} }) }; };
  const A = mk("a", "b"), B = mk("b", "a");
  A.c.craft("wick"); A.c.craft("amber"); m.pump();
  ok(A.held.lamp === 1 && A.f.me.lamp === 1 && B.f.peers.get("a").lamp === 1, "crafting a lantern holds it, and the other player is told");
  const msgs = A.f.sent.map(([x]) => x).filter(x => x.k === "lt");
  ok(msgs.length > 0 && msgs.every(x => Object.keys(x).length === 2 && Number.isInteger(x.l) && withinSizeCap(x)), "the lantern message is two numbers and small");
  A.f.joins.forEach(h => h("b")); m.pump(); ok(A.f.sent.at(-1)[1] === "b" && A.f.sent.at(-1)[0].l === 1, "a newcomer is told the lantern straight away");
  t.v += 5001; A.c.tick(); ok(A.f.sent.at(-1)[0].k === "lt" && A.f.sent.at(-1)[1] === undefined, "it is repeated to everyone every 5 seconds");
  ok(!A.c.hold(2) && !A.c.hold(-1) && !A.c.hold(1.5) && !A.c.hold("1") && A.held.lamp === 1, "holding a lantern you do not own (or a bad number) is refused");
  ok(A.c.hold(0) && A.held.lamp === 0 && A.cr.amber === 1, "putting the lantern back to plain keeps it in the pack");
  const hostile = [{ k: "lt", l: 4 }, { k: "lt", l: -1 }, { k: "lt", l: 1.5 }, { k: "lt", l: "2" }, { k: "lt", l: null }, { k: "lt" }, { k: "lt", l: 2, x: 1 }, { k: "lt", l: [2] }, { k: "lt", l: NaN }, "lt", 7, null];
  for (const h of hostile) B.f.hs.forEach(fn => fn(h, "a"));
  ok(B.f.peers.get("a").lamp === 1 || B.f.peers.get("a").lamp === 0, "bad lantern messages (out of range, fractions, strings, extra fields) change nothing");
  const before = B.f.peers.get("a").lamp;
  B.f.hs.forEach(fn => fn({ k: "lt", l: 3 }, "stranger"));
  ok(B.f.peers.get("a").lamp === before && !B.f.peers.has("stranger"), "a message from someone who never said hello is ignored");
  t.v += 100000; for (let i = 0; i < 50; i++) B.f.hs.forEach(fn => fn({ k: "lt", l: i % 2 ? 2 : 3 }, "a"));
  ok(B.f.peers.get("a").lamp !== undefined && [2, 3].includes(B.f.peers.get("a").lamp), "a flood of 50 is cut off after the burst");
  ok(KINDS.every(k => A.inv[k] <= 30), "no raw item was ever created by crafting");
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
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const lw = (page) => page.evaluate(() => window.__longWatch.craft());
async function teleportSynced(page, others, x, y) {
  if (!await page.evaluate(([x, y]) => window.__longWatch.teleport(x, y), [x, y])) return false;
  for (const o of others) if (!await waitFor(o, ([x, y]) => window.__longWatch.peers().some(p => Math.hypot(p.x - x, p.y - y) < 0.05), [x, y], 6000)) return false;
  return true;
}
// Put a pack into a page's own saved character, then reload so the game starts from it.
async function seedPack(page, url, patch) {
  await page.goto(url);
  await page.evaluate(([K, patch]) => { const st = location.search.includes("net=local") ? sessionStorage : localStorage; const s = JSON.parse(st.getItem(K)); Object.assign(s, patch); st.setItem(K, JSON.stringify(s)); }, [STORE, patch]);
  await page.reload();
}
// Open ground for the crafter (px, py), the watcher 5 tiles to the left and a patch of ground 5 tiles below the crafter.
const world = generateWorld();
const land = (x, y) => { const t = world.tiles[Math.floor(y) * world.w + Math.floor(x)]; return (t === T.SAND || t === T.GRASS || t === T.MEADOW) && !isBlocked(world, x, y); };
const spot = (() => {
  for (let y = 30; y < 100; y++) for (let x = 30; x < 100; x++) {
    const px = x + 0.5, py = y + 0.5;
    if (land(px, py) && land(px - 5, py) && land(px, py + 5) && land(px - 5, py + 5) && land(px - 2.5, py) && land(px, py + 2.5)) return { px, py };
  }
  throw new Error("no open ground for the light test");
})();
// Mean brightness (r+g+b) of a 7x7 patch of the watcher's screen at a world position.
const brightness = (page, wx, wy) => page.evaluate(([wx, wy]) => {
  const c = document.getElementById("view"), me = window.__longWatch.self(), dpr = c.width / c.clientWidth, tile = (c.clientWidth < 520 ? 30 : 36) * dpr;
  const sx = Math.round(c.width / 2 + (wx - me.x) * tile), sy = Math.round(c.height / 2 + (wy - me.y) * tile);
  const d = c.getContext("2d").getImageData(sx - 3, sy - 3, 7, 7).data; let s = 0;
  for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
  return s / (d.length / 4);
}, [wx, wy]);
const settledBrightness = async (page, wx, wy) => { let last = -1; for (let i = 0; i < 30; i++) { const v = await brightness(page, wx, wy); if (Math.abs(v - last) < 0.5 && i > 2) return v; last = v; await sleep(80); } return last; };
const seenLamp = (page, id) => page.evaluate((id) => (window.__longWatch.craft().peerLamps.find(p => p.id === id) || {}).lamp ?? -1, id);
const seenTiles = (page, id) => page.evaluate((id) => (window.__longWatch.lights().find(l => l.id === id) || {}).tiles ?? -1, id);
async function shoot(page, name) {
  if (!shots) return;
  await mkdir(shots, { recursive: true });
  const keep = page.viewportSize();
  for (const [w, h] of [[375, 760], [1100, 800]]) { await page.setViewportSize({ width: w, height: h }); await sleep(400); await page.locator(".stage").screenshot({ path: path.join(shots, `${name}-${w}.png`) }); }
  await page.setViewportSize(keep); await sleep(200);
}

async function scenario(label, mk, query, room, opts = {}) {
  console.log(`\n# ${label}`);
  const url = `${base}${query}#room=${room}`;
  const [A, B] = [await mk(), await mk()]; // A crafts, B watches
  // A has 20 reeds, 14 oil berries, 10 driftwood: exactly enough for a wick for every lantern and one of each lantern, with 1 of each left.
  await seedPack(A, url, { inv: { driftwood: 10, reeds: 20, berries: 14 } });
  await B.goto(url);
  await A.click("#enter"); await B.click("#enter");
  const seen = await waitFor(A, () => window.__longWatch.peers().length === 1, null, opts.timeout) && await waitFor(B, () => window.__longWatch.peers().length === 1, null, opts.timeout);
  ok(seen, "each page sees exactly one other player");
  if (!seen) return;
  const idA = await A.evaluate(() => window.__longWatch.self().id);
  const idB = await B.evaluate(() => window.__longWatch.self().id);
  ok(await A.evaluate(() => !document.getElementById("craft").hidden) && (await A.locator("#craftbtns button").count()) === 4, "the Craft panel shows four Make buttons in the game");
  ok((await A.locator("#recipes").textContent()).includes("2 reeds, 1 oil berry"), "the recipes are shown as words from the game's own list");

  // Place them: A (the crafter) at the spot, B (the watcher) 5 tiles to the left; B looks at the ground 5 tiles below A.
  const pre = await Promise.all([A, B].map(p => p.evaluate(() => window.__longWatch.self())));
  ok(await teleportSynced(A, [B], spot.px, spot.py) && await teleportSynced(B, [A], spot.px - 5, spot.py), "A and B stand on open ground 5 tiles apart");
  const sample = [spot.px, spot.py + 5];
  const L0 = await settledBrightness(B, ...sample);
  ok(await seenLamp(B, idA) === 0 && Math.abs(await seenTiles(B, idA) - BASE_REACH) < 0.02, `B sees A with the plain lantern at the night's reach (${BASE_REACH} tiles)`);
  await shoot(B, `${opts.shot}-before`);

  // 1. A cannot make what it lacks: nothing changes.
  const start = await lw(A);
  ok(start.inv.driftwood === 10 && start.inv.reeds === 20 && start.inv.berries === 14 && sum(start.cr) === 0, "A starts with the seeded pack");
  await A.click('#craftbtns [data-recipe="amber"]');
  let st = await lw(A);
  ok(JSON.stringify(st.inv) === JSON.stringify(start.inv) && sum(st.cr) === 0 && /Not enough wick/.test(st.info), "an amber lantern without a wick is refused: nothing used, and the page says why");
  const stB = await lw(B);
  await B.click('#craftbtns [data-recipe="wick"]');
  ok(JSON.stringify((await lw(B)).inv) === JSON.stringify(stB.inv) && !await B.evaluate(() => window.__longWatch.holdLamp(3)), "B has nothing: crafting is refused and it cannot hold a lantern it does not own");

  // 2. Craft up the ladder with the real buttons; check the pack after every step.
  const steps = [["amber", 1, 1], ["jade", 2, 2], ["azure", 3, 3]];
  let inv = { ...start.inv }, wicks = 0; const lit = [L0], tilesSeen = [];
  for (const [lamp, needWicks, n] of steps) {
    for (let i = 0; i < needWicks; i++) { await A.click('#craftbtns [data-recipe="wick"]'); inv.reeds -= 2; inv.berries -= 1; wicks++; }
    st = await lw(A);
    ok(st.cr.wick === wicks && st.inv.reeds === inv.reeds && st.inv.berries === inv.berries, `${needWicks} wick(s) made: ${needWicks * 2} reeds and ${needWicks} oil berries used up`);
    await A.click(`#craftbtns [data-recipe="${lamp}"]`);
    const need = RECIPES[lamp]; for (const [k, c] of Object.entries(need)) { if (k === "wick") wicks -= c; else inv[k] -= c; }
    st = await lw(A);
    ok(st.cr[lamp] === 1 && st.cr.wick === wicks && st.inv.driftwood === inv.driftwood && st.inv.reeds === inv.reeds && st.inv.berries === inv.berries, `the ${lamp} lantern is made and exactly its ingredients are gone`);
    ok(st.lamp === n, `A holds the ${lamp} lantern`);
    ok(await waitFor(B, ([id, n]) => (window.__longWatch.craft().peerLamps.find(p => p.id === id) || {}).lamp === n, [idA, n], 5000), `B sees A hold the ${lamp} lantern`);
    const want = Math.round(BASE_REACH * LAMPS[n].mult * 100) / 100;
    ok(await waitFor(B, ([id, w]) => { const l = window.__longWatch.lights().find(l => l.id === id); return l && Math.abs(l.tiles - w) < 0.15; }, [idA, want], 4000), `B's screen draws A's light about ${want} tiles wide (it was ${BASE_REACH} with the plain lantern)`);
    tilesSeen.push(want);
    lit.push(await settledBrightness(B, ...sample));
  }
  ok(st.inv.driftwood === 1 && st.inv.reeds === 1 && st.inv.berries === 1 && st.cr.wick === 0 && st.cr.amber + st.cr.jade + st.cr.azure === 3, "at the end: 1 driftwood, 1 reeds, 1 oil berries left, no wicks, one lantern of each colour (nothing created)");
  console.log(`  brightness of the ground 5 tiles from A, as B sees it: plain ${lit[0].toFixed(1)}, amber ${lit[1].toFixed(1)}, jade ${lit[2].toFixed(1)}, azure ${lit[3].toFixed(1)}`);
  ok(lit[3] > lit[0] + 25 && lit[2] > lit[0] + 10 && lit[3] > lit[2], "the ground 5 tiles from A is clearly brighter for B with a brighter lantern (plain < jade < azure)");
  await shoot(B, `${opts.shot}-after`);
  // B's own view of itself is unchanged, and A's reach is not B's.
  ok(Math.abs(await seenTiles(B, "me") - BASE_REACH) < 0.02, "B's own light is still the plain lantern's");

  // 3. Putting the lantern back to plain dims it for the watcher again; holding it again brings it back.
  ok(await A.evaluate(() => window.__longWatch.holdLamp(0)), "A puts the plain lantern back (the others stay in the pack)");
  ok(await waitFor(B, (id) => (window.__longWatch.craft().peerLamps.find(p => p.id === id) || {}).lamp === 0, idA, 5000), "B sees the plain lantern");
  const dim = await settledBrightness(B, ...sample);
  ok(Math.abs(dim - lit[0]) < 8 && (await lw(A)).cr.azure === 1, `the ground is back to its dim level for B (${dim.toFixed(1)} vs ${lit[0].toFixed(1)})`);
  await A.locator("#holdbtns button[data-lamp='3']").click();
  ok(await waitFor(B, (id) => (window.__longWatch.craft().peerLamps.find(p => p.id === id) || {}).lamp === 3, idA, 5000), "the Hold azure button lights it again for B");

  // 4. A reload keeps the pack and the lantern, and B sees the lantern again when A returns.
  await A.reload(); await A.click("#enter");
  ok(await waitFor(A, () => window.__longWatch.craft().lamp === 3, null, 5000) && (await lw(A)).cr.azure === 1 && (await lw(A)).inv.reeds === 1, "after a reload A still has the pack, the lanterns and holds the azure one");
  ok(await waitFor(A, () => window.__longWatch.self().playing && !!window.__longWatch.self().id, null, 8000), "A is back in the lantern");
  const idA2 = await A.evaluate(() => window.__longWatch.self().id); // a reload gives a new connection id
  ok(idA2 && idA2 !== idA, "A came back with a new connection id");
  const metAgain = await waitFor(B, (id) => window.__longWatch.peers().some(p => p.id === id), idA2, opts.timeout || 8000);
  ok(metAgain, "B meets the returning A (new connection)");
  if (!metAgain) console.log("  diagnostics: B peers", JSON.stringify(await B.evaluate(() => window.__longWatch.peers().map(p => p.id))), "A peers", JSON.stringify(await A.evaluate(() => window.__longWatch.peers().map(p => p.id))), "A is", idA2);
  ok(metAgain && await waitFor(B, (id) => (window.__longWatch.craft().peerLamps.find(p => p.id === id) || {}).lamp === 3, idA2, 8000), "B sees the azure lantern on the returning A");

  // 5. A late joiner sees the lantern at once; a full stack is refused, and nothing is dropped.
  const C = await mk();
  await seedPack(C, url, { inv: { driftwood: 3, reeds: 7, berries: 5 }, cr: { wick: CRAFT_STACK } });
  await C.click("#enter");
  const threeSeen = await waitFor(C, () => window.__longWatch.peers().length === 2, null, opts.timeout);
  if (!threeSeen) { const dump = (p) => p.evaluate(() => ({ id: window.__longWatch.self().id, links: window.__longWatch.linkHistory(), peers: window.__longWatch.peers().map(q => q.id) })); console.log("  diagnostics A", JSON.stringify(await dump(A)), "B", JSON.stringify(await dump(B)), "C", JSON.stringify(await dump(C))); }
  ok(threeSeen, "a third player joins and sees both others");
  ok(await waitFor(C, () => window.__longWatch.craft().peerLamps.some(p => p.lamp === 3), null, 6000), "the late joiner sees A's azure lantern without A doing anything");
  const c0 = await lw(C);
  ok(c0.cr.wick === CRAFT_STACK, `C starts with a full stack of ${CRAFT_STACK} wicks`);
  await C.click('#craftbtns [data-recipe="wick"]');
  const c1 = await lw(C);
  ok(JSON.stringify(c1.inv) === JSON.stringify(c0.inv) && c1.cr.wick === CRAFT_STACK && /full/.test(c1.info), "C's full wick stack refuses crafting: nothing is used, nothing is dropped, and the page says it is full");
  await C.click('#craftbtns [data-recipe="amber"]'); // the amber lantern takes wicks (has room); still allowed, uses wicks
  const c2 = await lw(C);
  ok(c2.cr.amber === 1 && c2.cr.wick === CRAFT_STACK - 1 && c2.inv.driftwood === 1 && c2.inv.berries === 4, "but a recipe whose result has room still works, and it frees a place in the full stack");
  await C.click('#craftbtns [data-recipe="wick"]');
  const c3 = await lw(C);
  ok(c3.cr.wick === CRAFT_STACK && c3.inv.reeds === 5 && c3.inv.berries === 3, "and then the wick can be made again, up to the stack and not past it");
  await C.reload(); await C.click("#enter");
  ok(await waitFor(C, () => window.__longWatch.craft().cr.amber === 1, null, 5000) && (await lw(C)).cr.wick === CRAFT_STACK && (await lw(C)).lamp === 1, "C's crafted items and held lantern survive a reload");
  ok(await waitFor(C, () => window.__longWatch.self().playing && !!window.__longWatch.self().id, null, 8000), "C is back in the lantern");
  const idC2 = await C.evaluate(() => window.__longWatch.self().id); // the old connection may linger for a few seconds on the others' side, so name the new one
  const metC = await waitFor(B, (id) => window.__longWatch.peers().some(p => p.id === id), idC2, opts.timeout || 8000);
  ok(metC, "B meets the returning C (new connection)");
  if (!metC) console.log("  diagnostics: B peers", JSON.stringify(await B.evaluate(() => window.__longWatch.peers().map(p => p.id))), "C is", idC2);
  ok(metC && await waitFor(B, (id) => (window.__longWatch.craft().peerLamps.find(p => p.id === id) || {}).lamp === 1, idC2, 8000), "B sees C's amber lantern too");
  if (opts.local) await forged(A, B, C, idA2);

  // 6. A leaves: the others stop drawing its light.
  await A.click("#leave");
  ok(await waitFor(B, (id) => !window.__longWatch.peers().some(p => p.id === id), idA2, 20000), "B sees A leave");
  ok(await waitFor(B, (id) => !window.__longWatch.lights().some(l => l.id === id), idA2, 3000) && await B.evaluate((id) => !window.__longWatch.craft().peerLamps.some(p => p.id === id), idA2), "A's lantern light is gone from B's screen");
  for (const p of [A, B, C]) await p.context().close().catch(() => {});
}

// Hostile lantern messages, posted on the local channel as if they came from A.
async function forged(A, B, C, idA) {
  console.log("  hostile messages");
  const E = await B.context().newPage();
  await E.goto(`${base}?net=local`);
  const idB = await B.evaluate(() => window.__longWatch.self().id);
  const post = (from, to, msgs) => E.evaluate(([room, from, to, msgs]) => { const ch = new BroadcastChannel(`vigil-long-watch:lantern-${room}`); for (const d of msgs) ch.postMessage({ k: "data", d, from, to }); ch.close(); }, [6, from, to, msgs]);
  const before = await seenLamp(B, idA);
  await post(idA, idB, [{ k: "lt", l: 9 }, { k: "lt", l: -2 }, { k: "lt", l: 1.5 }, { k: "lt", l: "3" }, { k: "lt", l: 2, extra: 1 }, { k: "lt" }, { k: "lt", l: null }, { k: "lt", l: [3] }, "lt", 42]);
  await sleep(500);
  ok(await seenLamp(B, idA) === before && before === 3, "B ignored out-of-range, fractional, text, array and extra-field lantern messages");
  await post(idA, idB, Array.from({ length: 500 }, (_, i) => ({ k: "lt", l: i % 4 })));
  await sleep(600);
  ok(await B.evaluate(() => window.__longWatch.lights().length) >= 3 && [0, 1, 2, 3].includes(await seenLamp(B, idA)), "a flood of 500 lantern messages does not break B");
  await post("stranger-never-said-hello", idB, [{ k: "lt", l: 3 }]);
  await sleep(300);
  ok(await B.evaluate(() => !window.__longWatch.craft().peerLamps.some(p => p.id === "stranger-never-said-hello")), "a lantern message from someone who never said hello is ignored");
  await E.close();
}

// ---- 1. local ----
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 800 } });
  const mk = () => ctx.newPage().then(p => (watch(p, "local"), p));
  await scenario("local transport (BroadcastChannel)", mk, `?net=local&hour=${HOUR}`, 6, { local: true, shot: "craft-local" });
  await ctx.close();
}

// ---- 2. real WebRTC through a local Nostr relay ----
if (!onlyLocal) {
  const relay = await startRelay();
  const c = [await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true }), await browser.newContext({ viewport: { width: 1000, height: 800 } }), await browser.newContext({ viewport: { width: 800, height: 700 } })];
  let i = 0;
  const mk = () => c[i++ % 3].newPage().then(p => (watch(p, "webrtc"), p));
  await scenario("Trystero over Nostr + WebRTC (relay on 127.0.0.1)", mk, `?net=nostr&hour=${HOUR}&relay=${encodeURIComponent(relay.url)}`, 5, { timeout: 30000, shot: "craft-webrtc" });
  for (const x of c) await x.close().catch(() => {});
  relay.close();
}

ok(errors.length === 0, `no console errors${errors.length ? ":\n  " + errors.join("\n  ") : ""}`);
await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
