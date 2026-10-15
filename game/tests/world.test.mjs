#!/usr/bin/env node
// Milestone 2 tests for The Long Watch: landmarks from the seed, the minimap, footsteps (off by default),
// light by night hour, reduced motion, and the byte-size cap on incoming messages.
//
//   node game/tests/world.test.mjs            node checks, then two pages on the local transport
//   SHOTS=/some/dir node ...                  also save screenshots there
//   CHROME=/path/to/headless_shell            use this browser binary
//
// Online play over the public relays is not tested here (the build sandbox cannot reach them); the real
// WebRTC path is covered by presence.test.mjs and talk.test.mjs through a local relay.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateWorld, landmarkFingerprint, worldFingerprint, isBlocked, tileAt, surfaceAt, T, LANDMARK_KINDS } from "../js/world.js";
import { hourAt, lightFor, pickHour, HOURS, HOUR_MS } from "../js/nightclock.js";
import { createStrideTracker, stepGain, STRIDE } from "../js/sound.js";
import { walkBob } from "../js/render.js";
import { describeNearest, compass } from "../js/minimap.js";
import { withinSizeCap, capped, MAX_MESSAGE_BYTES } from "../js/net/transport.js";
import { colourFor } from "../js/names.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const shots = process.env.SHOTS;
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failures++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---- 0. pure parts, no browser ----
console.log("# landmarks, light, steps, size cap: in node");
{
  const w = generateWorld(), w2 = generateWorld();
  ok(worldFingerprint(w) === "d44b09c6", `the island tiles are unchanged by landmarks (${worldFingerprint(w)})`);
  ok(landmarkFingerprint(w) === landmarkFingerprint(w2), `landmarks are the same on every build (${landmarkFingerprint(w)})`);
  const count = (k) => w.landmarks.filter(l => l.kind === k).length;
  ok(count("beacon") === 4 && count("lighthouse") === 1 && count("jetty") === 1 && count("well") === 1, "4 old beacons, 1 lighthouse, 1 jetty, 1 well");
  ok(new Set(w.landmarks.filter(l => l.kind === "beacon").map(l => l.side)).size === 4, "the 4 beacons stand in 4 different quarters of the island");
  ok(w.landmarks.every(l => LANDMARK_KINDS.includes(l.kind)), "every landmark kind is in the fixed list");
  // every landmark is reachable on foot from the spawn (4-neighbour flood fill)
  const seen = new Set([`${Math.floor(w.spawn.x)},${Math.floor(w.spawn.y)}`]), q = [[Math.floor(w.spawn.x), Math.floor(w.spawn.y)]];
  while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${x + dx},${y + dy}`; if (!seen.has(k) && !isBlocked(w, x + dx, y + dy)) { seen.add(k); q.push([x + dx, y + dy]); } } }
  const reach = (l) => [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]].some(([dx, dy]) => seen.has(`${Math.floor(l.x) + dx},${Math.floor(l.y) + dy}`));
  ok(w.landmarks.every(reach), "every landmark can be reached on foot from where players arrive");
  ok(w.landmarks.filter(l => l.solid).every(l => isBlocked(w, l.x, l.y)), "beacons, lighthouse and well block walking; the jetty does not");
  const jetty = w.landmarks.find(l => l.kind === "jetty");
  ok(jetty.planks.length >= 2 && jetty.planks.every(([x, y]) => tileAt(w, x, y) === T.SHALLOW && !isBlocked(w, x + 0.5, y + 0.5) && surfaceAt(w, x + 0.5, y + 0.5) === "wood"), `the jetty runs ${jetty.planks.length} planks over shallow water, can be walked and sounds like wood`);
  const near = describeNearest(w, w.landmarks[0].x + 2, w.landmarks[0].y);
  ok(near && near.name.startsWith("Old beacon") && near.tiles === 2 && near.dir === "west", `nearest landmark text: "${near.name}, ${near.tiles} tiles ${near.dir}"`);
  ok(compass(0, -5) === "north" && compass(5, 5) === "south-east" && compass(-3, 0) === "west", "compass words");
}
{
  const ms0 = 0;
  ok(hourAt(ms0 + 3 * HOUR_MS) === 3 && hourAt(HOURS * HOUR_MS + 90000) === 0.25 && hourAt(-HOUR_MS) === 7, "night hour from the clock wraps every 8 hours (48 real minutes)");
  const darks = Array.from({ length: HOURS }, (_, i) => lightFor(i).dark);
  ok(darks.indexOf(Math.max(...darks)) === 3 && darks[0] < darks[3] && darks[7] < darks[3], `darkest at midnight (${darks.map(d => d.toFixed(2)).join(" ")})`);
  const l35 = lightFor(3.5), l3 = lightFor(3), l4 = lightFor(4);
  ok(l35.dark < l3.dark && l35.dark > l4.dark && l35.reach > 0 && lightFor(7.99).dark > 0.2 && Math.abs(lightFor(8).dark - lightFor(0).dark) < 1e-9, "light slides smoothly between hours and wraps from dawn to dusk");
  ok(pickHour("?hour=3") === 3 && pickHour("?hour=2.5") === 2.5 && pickHour("?hour=8") === null && pickHour("?hour=-1") === null && pickHour("?hour=abc") === null && pickHour("") === null, "?hour= accepts only numbers from 0 up to 8");
}
{
  const tr = createStrideTracker();
  ok(tr.advance("a", 0, 0, true) === 0, "the first position counts no steps");
  let n = 0; for (let i = 1; i <= 100; i++) n += tr.advance("a", i * 0.09, 0, true);
  ok(n >= 9 && n <= 10, `9 tiles of walking at ${STRIDE} tiles a step is ${n} steps`);
  ok(tr.advance("a", 50, 0, true) === 0, "a jump (arrival) makes no steps");
  ok(tr.advance("a", 50.5, 0, false) === 0, "standing makes no steps");
  ok(stepGain(0) === 1 && stepGain(4) === 0.5 && stepGain(30) === 0, "a step is loud at your feet and silent beyond earshot");
}
{
  ok(walkBob(true, 1000, 36, false) !== 0 && walkBob(false, 1000, 36, false) === 0, "the walking bob moves while walking");
  ok(walkBob(true, 1000, 36, true) === 0 && walkBob(true, 1234, 36, true) === 0, "with prefers-reduced-motion the bob is zero");
  const big = { k: "st", x: 1, y: 1, d: 0, m: 1, pad: "x".repeat(5000) };
  ok(withinSizeCap({ k: "st", x: 10.25, y: 99.5, d: -3.14, m: 1 }) && withinSizeCap({ k: "hi", v: 1, s: 4294967295, x: 127.99, y: 127.99, d: 3.99 }), "every real message is far under the cap");
  ok(!withinSizeCap(big) && !withinSizeCap("x".repeat(MAX_MESSAGE_BYTES + 1)) && !withinSizeCap(undefined) && !withinSizeCap({ s: "é".repeat(300) }), `messages over ${MAX_MESSAGE_BYTES} bytes (or with no JSON form) are refused`);
  const circ = {}; circ.me = circ;
  ok(!withinSizeCap(circ), "a message that cannot be turned into JSON is refused, not thrown");
  const got = []; const inner = { add: () => {}, emit: (m) => got.push(m) }; const c = capped(inner);
  c.emit({ k: "by" }, "p"); c.emit(big, "p"); c.emit(big, "p");
  ok(got.length === 1 && c.dropped() === 2, "the capped emitter passes small messages and counts the dropped ones");
}

// ---- browser ----
const require = createRequire(import.meta.url);
let pw;
for (const id of ["playwright", "/opt/node-tools/node_modules/playwright", "playwright-core"]) { try { pw = require(id); break; } catch { /* next */ } }
if (!pw) { console.error("playwright not found"); process.exit(2); }
async function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = "/opt/pw-browsers";
  if (!existsSync(base)) return undefined;
  for (const d of (await readdir(base)).filter(d => d.startsWith("chromium")).sort().reverse())
    for (const rel of ["chrome-linux/chrome", "chrome-linux64/chrome", "chrome-linux/headless_shell"]) { const p = path.join(base, d, rel); if (existsSync(p)) return p; }
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
const browser = await pw.chromium.launch({ ...(executablePath ? { executablePath } : {}) });

const errors = [];
function watch(page, label) {
  page.on("pageerror", e => errors.push(`${label}: ${e.message}`));
  page.on("console", m => { if (m.type() === "error") errors.push(`${label}: ${m.text()}`); });
}
const get = (page) => page.evaluate(() => ({ self: window.__longWatch.self(), peers: window.__longWatch.peers(), world: window.__longWatch.world(), hud: window.__longWatch.hud(), light: window.__longWatch.light() }));
async function waitFor(page, fn, arg, timeout = 8000) { try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; } catch { return false; } }
async function walk(page, key, ms) { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); }
const px = (page, sel, x, y) => page.evaluate(([sel, x, y]) => Array.from(document.querySelector(sel).getContext("2d").getImageData(x, y, 1, 1).data), [sel, x, y]);

console.log("\n# two pages, local transport, Lantern 5");
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 800 } });
  const a = await ctx.newPage(), b = await ctx.newPage();
  watch(a, "A"); watch(b, "B");
  for (const p of [a, b]) await p.goto(`${base}?net=local&hour=3#room=5`);
  ok((await get(a)).hud.stepsOn === false && await a.textContent("#stepstoggle") === "Footsteps: off", "footsteps are off before anyone joins");
  await a.click("#enter"); await b.click("#enter");
  ok(await waitFor(a, () => window.__longWatch.peers().length === 1) && await waitFor(b, () => window.__longWatch.peers().length === 1), "each page sees the other");
  const A = await get(a), B = await get(b);
  ok(A.world.landmarks === B.world.landmarks && A.world.landmarkList.length === 7, `both pages built the same 7 landmarks (${A.world.landmarks})`);
  ok(A.hud.stepsOn === false && B.hud.stepsOn === false, "footsteps are off by default after entering");
  ok(A.light.index === 3 && Math.abs(A.light.dark - 0.60) < 1e-9, `?hour=3 pins the light to "${A.light.name}" (dark ${A.light.dark})`);

  // Minimap: shown by default, 7 landmark marks, and the other player appears in their lantern colour.
  ok(A.hud.mapOn && await a.isVisible("#minimap") && A.hud.minimapMarks === 7, "the minimap is shown with 7 landmark marks");
  await a.locator("#view").focus();
  await walk(a, "ArrowRight", 300);
  const aSelf = (await get(a)).self, bPeer = (await get(b)).peers[0];
  await sleep(300);
  const want = colourFor(bPeer.seed ?? (await get(a)).peers[0].seed);
  const hex = (c) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  // The dot is drawn at B's eased position, which can lag the reported one by a tile or two, so look for the colour in a 9 x 9 window.
  const pe = (await get(a)).peers[0];
  const rgb = await a.evaluate(([x, y, want]) => {
    const d = document.querySelector("#minimap").getContext("2d").getImageData(Math.round(x) - 4, Math.round(y) - 4, 9, 9).data;
    let best = null, bd = 1e9;
    for (let i = 0; i < d.length; i += 4) { const e = Math.abs(d[i] - want[0]) + Math.abs(d[i + 1] - want[1]) + Math.abs(d[i + 2] - want[2]); if (e < bd) { bd = e; best = [d[i], d[i + 1], d[i + 2]]; } }
    return best;
  }, [pe.x, pe.y, hex(want)]);
  ok(rgb && hex(want).every((v, i) => Math.abs(v - rgb[i]) < 40), `B's dot on A's minimap is B's lantern colour ${want} (read ${rgb && rgb.slice(0, 3)})`);
  await a.keyboard.press("m");
  ok(!(await get(a)).hud.mapOn && !(await a.isVisible("#minimap")) && await a.getAttribute("#maptoggle", "aria-pressed") === "false", "M hides the minimap");
  await a.click("#maptoggle");
  ok((await get(a)).hud.mapOn && await a.isVisible("#minimap"), "the Map button shows it again");

  // Landmarks: walk to the well, the text names it, and walking into it is blocked.
  const well = A.world.landmarkList.find(l => l.kind === "well");
  ok(await a.evaluate(([x, y]) => window.__longWatch.teleport(x - 3, y), [well.x, well.y]), "moved A three tiles west of the well");
  await a.locator("#view").focus();
  await a.waitForTimeout(1200);
  const hudA = (await get(a)).hud.where;
  ok(/Well, 3 tiles east/.test(hudA) && /Midnight/.test(hudA), `the status text names the landmark and the hour: "${hudA}"`);
  await walk(a, "ArrowRight", 900);
  const afterWell = (await get(a)).self;
  ok(afterWell.x < well.x - 0.5 + 0.0 && Math.abs(afterWell.y - well.y) < 1, `walking east stops at the well (x ${afterWell.x.toFixed(2)}, well tile starts at ${(well.x - 0.5).toFixed(2)})`);
  ok(await waitFor(b, ([x]) => { const p = window.__longWatch.peers()[0]; return p && Math.abs(p.x - x) < 0.1; }, [afterWell.x]), "B sees A standing beside the well");
  if (shots) { await a.waitForTimeout(300); await a.screenshot({ path: path.join(shots, "world-well.png") }); }

  // Footsteps: off = silent. On = steps while walking, and steps of a nearby walker.
  const p0 = (await get(a)).hud.stepsPlayed;
  await walk(a, "ArrowLeft", 900);
  ok((await get(a)).hud.stepsPlayed === p0, "walking with footsteps off plays no steps");
  await a.click("#stepstoggle");
  const hudOn = (await get(a)).hud;
  ok(hudOn.stepsOn && await a.textContent("#stepstoggle") === "Footsteps: on" && await a.getAttribute("#stepstoggle", "aria-pressed") === "true", "the Footsteps button turns them on");
  const p1 = hudOn.stepsPlayed;
  await a.locator("#view").focus();
  await walk(a, "ArrowLeft", 1000);
  const p2 = (await get(a)).hud.stepsPlayed;
  ok(p2 - p1 >= 3, `walking about 4 tiles plays steps (${p2 - p1})`);
  // B walks next to A; A hears B's steps (B is within earshot).
  await b.evaluate(([x, y]) => window.__longWatch.teleport(x + 2, y), [(await get(a)).self.x, (await get(a)).self.y]);
  await sleep(700);
  const p3 = (await get(a)).hud.stepsPlayed;
  await b.locator("#view").focus(); await walk(b, "ArrowRight", 900);
  await sleep(500);
  const heard = (await get(a)).hud.stepsPlayed - p3;
  ok(heard >= 2, `A hears B's steps while B walks nearby (${heard})`);
  await a.click("#stepstoggle");
  const p4 = (await get(a)).hud.stepsPlayed;
  await b.locator("#view").focus(); await walk(b, "ArrowLeft", 700);
  ok((await get(a)).hud.stepsPlayed === p4 && !(await get(a)).hud.stepsOn, "turning footsteps off silences them again");

  // Light: different hours draw different darkness on the same spot.
  const c = await ctx.newPage(); watch(c, "C");
  const lum = async (hour) => { await c.goto(`${base}?net=local&hour=${hour}#room=6`); await c.click("#enter"); await c.waitForTimeout(500); const d = await px(c, "#view", 4, 4); await c.click("#leave"); return d[0] + d[1] + d[2]; };
  const [l3, l7] = [await lum(3), await lum(7)];
  ok(l7 > l3, `the same corner is brighter at Dawn (${l7}) than at Midnight (${l3})`);
  const un = await (async () => { await c.goto(`${base}?net=local#room=6`); await c.click("#enter"); const l = await c.evaluate(() => window.__longWatch.light()); await c.click("#leave"); return l; })();
  ok(un.hour >= 0 && un.hour < 8 && Math.abs(un.hour - hourAt(Date.now())) < 0.05, `without ?hour= the light follows the shared UTC clock (hour ${un.hour.toFixed(2)})`);
  await c.close();

  // Size cap: an oversize message from A's id, valid in every other way, must be dropped.
  const e = await ctx.newPage(); await e.goto(`${base}?net=local`);
  const ids = { a: (await get(a)).self.id, b: (await get(b)).self.id };
  const before = (await get(b)).peers[0], dropped0 = (await get(b)).hud.dropped;
  const far = { x: Math.min(120, before.x + 6), y: before.y };
  await e.evaluate(([from, to, x, y]) => {
    const ch = new BroadcastChannel("vigil-long-watch:lantern-5");
    ch.postMessage({ k: "data", from, to, d: { k: "st", x, y, d: 0, m: 0, pad: "x".repeat(6000) } });
    ch.postMessage({ k: "data", from, to, d: { k: "st", x: x + 1, y, d: 0, m: 0, pad: "é".repeat(300) } });
    ch.close();
  }, [ids.a, ids.b, far.x, far.y]);
  await sleep(500);
  const afterBig = (await get(b)).peers[0];
  ok(Math.abs(afterBig.x - far.x) > 3 && (await get(b)).hud.dropped === dropped0 + 2, `B dropped 2 oversize but otherwise valid moves (dropped count ${dropped0} -> ${(await get(b)).hud.dropped}), A stayed at x ${afterBig.x.toFixed(1)}`);
  await e.evaluate(([from, to, x, y]) => {
    const ch = new BroadcastChannel("vigil-long-watch:lantern-5");
    ch.postMessage({ k: "data", from, to, d: { k: "st", x, y, d: 0, m: 0 } }); ch.close();
  }, [ids.a, ids.b, far.x, far.y]);
  ok(await waitFor(b, ([x]) => Math.abs(window.__longWatch.peers()[0].x - x) < 0.3, [far.x], 3000), "the same move without the padding is accepted");
  await e.close();
  await ctx.close();
}

console.log("\n# reduced motion");
{
  const ctx = await browser.newContext({ viewport: { width: 700, height: 700 }, reducedMotion: "reduce" });
  const p = await ctx.newPage(); watch(p, "R");
  await p.goto(`${base}?net=local&hour=1#room=2`); await p.click("#enter"); await p.waitForTimeout(300);
  ok((await get(p)).hud.reducedMotion === true, "the page reports prefers-reduced-motion: reduce");
  await p.locator("#view").focus(); await walk(p, "ArrowRight", 200);
  if (shots) await p.screenshot({ path: path.join(shots, "world-reduced.png") });
  await ctx.close();
  const ctx2 = await browser.newContext({ viewport: { width: 375, height: 700 }, hasTouch: true, isMobile: true });
  const q = await ctx2.newPage(); watch(q, "phone");
  await q.goto(`${base}?net=local&hour=6#room=2`); await q.click("#enter"); await q.waitForTimeout(500);
  ok((await get(q)).hud.reducedMotion === false, "without the setting, reduced motion is false");
  const over = await q.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  ok(!over, "no sideways scroll at 375 px with the minimap and buttons");
  if (shots) await q.screenshot({ path: path.join(shots, "world-phone.png") });
  await ctx2.close();
}

ok(errors.length === 0, `no console errors${errors.length ? ":\n  " + errors.join("\n  ") : ""}`);
await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
