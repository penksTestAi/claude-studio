#!/usr/bin/env node
// Milestone 15 tests for The Long Watch: character figures (walk cycle, lantern swing, gesture poses). The poses are
// worked out by each browser alone from what it already holds (moving flag, facing, gesture); nothing new is sent.
//
//   node game/tests/figure.test.mjs             node checks, then two pages on the local transport
//   SHOTS=/some/dir node ...                    also save screenshots (walking, a bow, a wave; 375 and 1100 px)
//   CHROME=/path/to/headless_shell              use this browser binary
// Online play over the public relays is not tested here.
import { createServer } from "node:http";
import { readFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { figurePose, walkPose, STRIDE_MS } from "../js/figure.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const shots = process.env.SHOTS;
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failures++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

console.log("# figure poses, in node");
{
  const still = JSON.stringify(figurePose(false, 1234, 0, "", 0, false));
  ok(JSON.stringify(figurePose(true, 1234, 0, "", 0, true)) === still && JSON.stringify(figurePose(true, 9999, 2, "", 0, true)) === still, "with reduced motion a walking figure is the still pose, whatever the time");
  ok(JSON.stringify(figurePose(false, 777, 1, "", 0, false)) === still, "a standing figure is the still pose at any time");
  let minS = 9, maxS = -9, minL = 9, maxL = -9, bad = 0;
  for (let t = 0; t < 2 * STRIDE_MS; t += 7) {
    const p = figurePose(true, t, 0.5, "", 0, false);
    minS = Math.min(minS, p.footL.fwd); maxS = Math.max(maxS, p.footL.fwd); minL = Math.min(minL, p.lanternSwing); maxL = Math.max(maxL, p.lanternSwing);
    if (!Number.isFinite(p.footL.fwd + p.footR.fwd + p.footLift + p.lanternSwing + p.armReach + p.headLean) || Math.abs(p.footL.fwd + p.footR.fwd) > 1e-9) bad++;
  }
  ok(minS < -0.4 && maxS > 0.4 && bad === 0, "the feet swap places over a walk cycle, always in opposite step, and every number is finite");
  ok(minL < -0.3 && maxL > 0.3 && maxL < 0.8, `the lantern swings both ways, by at most ${maxL.toFixed(2)} rad`);
  const r6 = (o) => JSON.stringify(o, (k, v) => typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v);
  const a = r6(figurePose(true, 100, 0, "", 0, false)), b = r6(figurePose(true, 100 + STRIDE_MS, 0, "", 0, false));
  ok(a === b && a !== JSON.stringify(figurePose(true, 100, 3, "", 0, false)), "one cycle takes STRIDE_MS and a different phase steps out of time");
  ok(figurePose(false, 0, 0, "bow", 0.35, false).headLean > 0.3 && figurePose(false, 0, 0, "bow", 0, false).headLean === 0, "a bow leans the head forward and back");
  ok(figurePose(false, 0, 0, "wave", 0.5, false).raiseHand === 1 && figurePose(false, 0, 0, "cheer", 0.5, false).headUp > 0 && figurePose(false, 0, 0, "sit", 0.5, false).sit === true, "wave, cheer and sit each have their own pose");
  const odd = [figurePose(true, NaN, NaN, "", NaN, false), figurePose(true, Infinity, "x", "nonsense", Infinity, false), walkPose(true, -5e12, 1e300, false)];
  ok(JSON.stringify(odd[0]) === still && Object.values(odd[2]).every(Number.isFinite), "odd times, phases and gesture names give a finite pose, never an error");
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
const browser = await pw.chromium.launch({ ...(executablePath ? { executablePath } : {}) });
const errors = [];
function watch(page, label) {
  page.on("pageerror", e => errors.push(`${label}: ${e.message}`));
  page.on("console", m => { if (m.type() === "error" && !/WebSocket connection to 'wss:/.test(m.text()) && !/User-Initiated Abort, reason=Close called/.test(m.text())) errors.push(`${label}: ${m.text()}`); });
}
async function waitFor(page, fn, arg, timeout = 10000) {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 50 }); return true; } catch { return false; }
}
const perf = (p) => p.evaluate(() => window.__longWatch.perf());
const mk = async (opts = {}, ctx = null) => { const c = ctx || await browser.newContext({ viewport: { width: 700, height: 700 }, ...opts }); const p = await c.newPage(); watch(p, "page"); return p; };
async function enter(page, query, room) { await page.goto(`${base}${query}#room=${room}`); await page.click("#enter"); await waitFor(page, () => window.__longWatch.self().playing, null, 5000); await sleep(500); }
const poseOf = (p, id) => p.evaluate((i) => window.__longWatch.pose(i), id);
async function sample(p, id, n = 12, gap = 45) { const out = []; for (let i = 0; i < n; i++) { out.push(await poseOf(p, id)); await sleep(gap); } return out; }
const spread = (arr, f) => Math.max(...arr.map(f)) - Math.min(...arr.map(f));
async function shoot(page, name) {
  if (!shots) return;
  await mkdir(shots, { recursive: true });
  const keep = page.viewportSize();
  for (const [w, h] of [[375, 760], [1100, 800]]) { await page.setViewportSize({ width: w, height: h }); await sleep(500); await page.locator(".stage").screenshot({ path: path.join(shots, `${name}-${w}.png`) }); }
  await page.setViewportSize(keep); await sleep(200);
}
// the pixels round the middle of the canvas, where the player's own figure stands
async function centreHash(p) { return p.evaluate(() => { const c = document.getElementById("view"), g = c.getContext("2d"), s = Math.round(c.width / 12); const d = g.getImageData(c.width / 2 - s, c.height / 2 - s, 2 * s, 2 * s).data; let h = 0; for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0; return h; }); }

try {
  console.log("\n# two players: a walker's figure moves for the one who watches");
  const A = await mk(), B = await mk({}, A.context());
  await enter(A, "?net=local&hour=3&weather=clear", "fg1"); await enter(B, "?net=local&hour=3&weather=clear", "fg1");
  ok(await waitFor(A, () => window.__longWatch.peers().length === 1, null, 8000) && await waitFor(B, () => window.__longWatch.peers().length === 1, null, 8000), "two players share a room");
  const bid = (await A.evaluate(() => window.__longWatch.peers()))[0].id;
  const still = await sample(A, bid, 4);
  ok(still.every(p => p.footL.fwd === 0 && p.lanternSwing === 0), "B standing: A sees B's figure still");
  await B.keyboard.down("ArrowRight");
  ok(await waitFor(A, (i) => { const p = window.__longWatch.pose(i); return p && p.footL.fwd !== 0; }, bid, 4000), "B starts walking");
  const walking = await sample(A, bid, 16, 40);
  ok(spread(walking, p => p.footL.fwd) > 0.5 && spread(walking, p => p.lanternSwing) > 0.3, `B walking: A sees B's feet step (spread ${spread(walking, p => p.footL.fwd).toFixed(2)}) and the lantern swing (${spread(walking, p => p.lanternSwing).toFixed(2)} rad)`);
  await shoot(A, "figure-walk");
  await B.keyboard.up("ArrowRight");
  ok(await waitFor(A, (i) => { const p = window.__longWatch.pose(i); return p && p.footL.fwd === 0 && p.lanternSwing === 0; }, bid, 4000), "B stops: A sees the figure come to rest");
  // the pixels round the player change while walking (the ground and glints move too, so this only shows the canvas is live)
    await A.keyboard.down("ArrowLeft"); const hs = new Set(); for (let i = 0; i < 10; i++) { hs.add(await centreHash(A)); await sleep(45); } await A.keyboard.up("ArrowLeft");
  ok(hs.size > 2, `A's own figure is redrawn while walking (${hs.size} different pictures round the player in 10 looks)`);
  // gestures: B waves, then bows; A sees each id and the page keeps drawing (the poses themselves are checked in node)
  await B.evaluate(() => window.__longWatch.emote(0));
  ok(await waitFor(A, () => window.__longWatch.peers()[0].emote === 0, null, 4000), "A sees B wave");
  await shoot(A, "figure-wave"); await sleep(1700);
  await B.evaluate(() => window.__longWatch.emote(1));
  ok(await waitFor(A, () => window.__longWatch.peers()[0].emote === 1, null, 4000), "A sees B bow");
  await sleep(450); await shoot(A, "figure-bow");

  console.log("\n# reduced motion: figures stand still, even while walking");
  const rc = await browser.newContext({ viewport: { width: 700, height: 700 }, reducedMotion: "reduce" });
  const R1 = await mk({}, rc), R2 = await mk({}, rc);
  await enter(R1, "?net=local&hour=3&weather=clear", "fg2"); await enter(R2, "?net=local&hour=3&weather=clear", "fg2");
  ok(await waitFor(R1, () => window.__longWatch.peers().length === 1, null, 8000), "two players share a room");
  const rid = (await R1.evaluate(() => window.__longWatch.peers()))[0].id;
  await R2.keyboard.down("ArrowRight"); await R1.keyboard.down("ArrowLeft"); await sleep(400);
  const calm = [...await sample(R1, rid, 10, 40), ...await sample(R1, "me", 10, 40)];
  ok(calm.every(p => p.footL.fwd === 0 && p.lanternSwing === 0 && p.footLift === 0), "walking players (own and the other's) keep the still pose under reduced motion");
  await R1.keyboard.up("ArrowLeft"); await R2.keyboard.up("ArrowRight");
  await shoot(R1, "figure-reduced");
  const h = await A.evaluate(() => window.__longWatch.hud());
  ok(h.dropped === 0, "nothing was dropped or sent for the figures");
  ok(errors.length === 0, errors.length ? `console errors: ${errors.join(" | ")}` : "no console errors");
} catch (e) {
  ok(false, `test crashed: ${e && e.stack || e}`);
} finally {
  await browser.close(); server.close();
}
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
