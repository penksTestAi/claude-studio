#!/usr/bin/env node
// Multiplayer tests for The Long Watch, in headless Chromium (Playwright).
//
//   node game/tests/presence.test.mjs            run everything
//   node game/tests/presence.test.mjs --local    only the BroadcastChannel test
//   SHOTS=/some/dir node game/tests/...          also save screenshots there
//
// 1. local:  two pages in one browser context with ?net=local join Lantern 2, see each other, one walks and
//            the other sees it move; a third page in Lantern 3 sees nobody; leaving removes the player.
// 2. webrtc: two separate browser contexts use the real Trystero/Nostr code and real WebRTC data channels,
//            with signalling through a tiny Nostr relay on 127.0.0.1 (tests/nostr-relay.mjs). This checks
//            everything except the public relays themselves.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startRelay } from "./nostr-relay.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const onlyLocal = process.argv.includes("--local");
const shots = process.env.SHOTS;

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
  if (p === "/favicon.ico") { res.writeHead(204).end(); return; } // the site has none; not the game's concern
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try { const body = await readFile(file); res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" }).end(body); }
  catch { res.writeHead(404).end("not found"); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/game/`;

const executablePath = await findChrome();
// Same-machine WebRTC: let Chromium use plain host addresses instead of mDNS names it cannot resolve here.
const browser = await pw.chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ["--disable-features=WebRtcHideLocalIpsWithMdns"] });

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failures++; };
const errors = [];
function watch(page, label) {
  page.on("pageerror", e => errors.push(`${label}: ${e.message}`));
  page.on("console", m => { if (m.type() === "error" && !/WebSocket connection to 'wss:/.test(m.text())) errors.push(`${label}: ${m.text()}`); });
}
const state = (page) => page.evaluate(() => ({ self: window.__longWatch.self(), peers: window.__longWatch.peers(), world: window.__longWatch.world() }));
async function waitFor(page, fn, arg, timeout = 10000) {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; } catch { return false; }
}
async function walk(page, key, ms) { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); }

async function scenario(label, pageA, pageB, query, room, opts = {}) {
  console.log(`\n# ${label}`);
  await pageA.goto(`${base}${query}#room=${room}`); await pageB.goto(`${base}${query}#room=${room}`);
  await pageA.click("#enter"); await pageB.click("#enter");
  const t0 = Date.now();
  const seen = await waitFor(pageA, () => window.__longWatch.peers().length === 1, null, opts.timeout)
    && await waitFor(pageB, () => window.__longWatch.peers().length === 1, null, opts.timeout);
  ok(seen, `each page sees exactly one other player (${seen ? "after " + ((Date.now() - t0) / 1000).toFixed(1) + " s" : "gave up"})`);
  if (!seen) return;
  const a = await state(pageA), b = await state(pageB);
  ok(a.world.fingerprint === b.world.fingerprint, `both built the same island (${a.world.fingerprint})`);
  ok(b.peers[0].name === a.self.name && a.peers[0].name === b.self.name, `names match across pages: "${a.self.name}" and "${b.self.name}"`);
  ok(a.self.name !== b.self.name, "the two players have different generated names");

  // A walks; B must see A arrive where A says it is.
  const before = (await state(pageB)).peers[0];
  await pageA.locator("#view").focus();
  await walk(pageA, "ArrowRight", 450); await walk(pageA, "ArrowDown", 450); await walk(pageA, "ArrowLeft", 250);
  const aNow = (await state(pageA)).self;
  const moved = Math.hypot(aNow.x - before.x, aNow.y - before.y);
  ok(moved > 0.2, `A moved ${moved.toFixed(2)} tiles`);
  const synced = await waitFor(pageB, ([x, y]) => { const p = window.__longWatch.peers()[0]; return p && Math.hypot(p.x - x, p.y - y) < 0.05; }, [aNow.x, aNow.y], 5000);
  const bSees = (await state(pageB)).peers[0];
  ok(synced, `B sees A at (${bSees.x.toFixed(2)}, ${bSees.y.toFixed(2)}); A is at (${aNow.x.toFixed(2)}, ${aNow.y.toFixed(2)})`);

  // And the other way round.
  await pageB.locator("#view").focus();
  await walk(pageB, "ArrowUp", 400);
  const bNow = (await state(pageB)).self;
  ok(await waitFor(pageA, ([x, y]) => { const p = window.__longWatch.peers()[0]; return p && Math.hypot(p.x - x, p.y - y) < 0.05; }, [bNow.x, bNow.y], 5000), "A sees B's move too");

  if (shots) { await pageA.waitForTimeout(300); await pageA.screenshot({ path: path.join(shots, `${opts.shot || "game"}-a.png`) }); await pageB.screenshot({ path: path.join(shots, `${opts.shot || "game"}-b.png`) }); }

  await pageA.click("#leave");
  ok(await waitFor(pageB, () => window.__longWatch.peers().length === 0, null, 5000), "when A leaves, B no longer shows A");
}

// ---- 1. local ----
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 800 } });
  const [a, b, c] = [await ctx.newPage(), await ctx.newPage(), await ctx.newPage()];
  watch(a, "local A"); watch(b, "local B"); watch(c, "local C");
  await c.goto(`${base}?net=local#room=3`); await c.click("#enter");
  await scenario("local transport (BroadcastChannel)", a, b, "?net=local", 2, { shot: "local" });
  ok((await state(c)).peers.length === 0, "a player in Lantern 3 never saw the players in Lantern 2");
  await ctx.close();
}

// ---- 2. real WebRTC through a local Nostr relay ----
if (!onlyLocal) {
  const relay = await startRelay();
  const c1 = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
  const c2 = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const a = await c1.newPage(), b = await c2.newPage();
  watch(a, "webrtc A"); watch(b, "webrtc B");
  await scenario("Trystero over Nostr + WebRTC (relay on 127.0.0.1)", a, b, `?net=nostr&relay=${encodeURIComponent(relay.url)}`, 4, { timeout: 30000, shot: "webrtc" });
  await c1.close(); await c2.close(); relay.close();
}

ok(errors.length === 0, `no console errors${errors.length ? ":\n  " + errors.join("\n  ") : ""}`);
await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
