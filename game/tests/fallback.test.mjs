#!/usr/bin/env node
// Milestone 13: the second signalling path. Everything runs on 127.0.0.1 (a tiny Nostr relay and a tiny BitTorrent
// tracker), so this proves the fallback logic and the BitTorrent path through real WebRTC, not the public servers.
//
//   node game/tests/fallback.test.mjs
//
// A. Nostr unreachable (dead port), tracker alive: two players fall back, say so on the page, and meet.
// B. Nostr alive, tracker dead: they connect on Nostr at once and never touch the tracker path.
// C. Both unreachable: the page says so and keeps alternating, then says neither could be reached.
// D. ?net=torrent chosen by hand works; unit checks of the URL flags (a tracker flag is honoured only for this machine).
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startRelay } from "./nostr-relay.mjs";
import { startTracker } from "./tracker-server.mjs";
import { pickKind, pickTestRelay, pickTestTracker } from "../js/net/transport.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
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
const browser = await pw.chromium.launch({ ...(await findChrome() ? { executablePath: await findChrome() } : {}), args: ["--disable-features=WebRtcHideLocalIpsWithMdns"] });

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failures++; };
const errors = [];
function watch(page, label) {
  page.on("pageerror", e => errors.push(`${label}: ${e.message}`));
  // Refused connections to the dead local ports are the point of this test, not errors in the game.
  page.on("console", m => { if (m.type() === "error" && !/WebSocket connection to 'wss?:|ERR_CONNECTION_REFUSED/.test(m.text())) errors.push(`${label}: ${m.text()}`); });
}
async function waitFor(page, fn, arg, timeout = 10000) {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; } catch { return false; }
}
const ns = (page) => page.evaluate(() => window.__longWatch.netStatus());
const netText = (page) => page.locator("#netkind").textContent();
const statusText = (page) => page.locator("#status").textContent();
const dead = "ws://127.0.0.1:1"; // nothing listens on port 1

async function pair(label, query, room) {
  console.log(`\n# ${label}`);
  const c1 = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const c2 = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const a = await c1.newPage(), b = await c2.newPage();
  watch(a, label + " A"); watch(b, label + " B");
  await a.goto(`${base}${query}#room=${room}`); await b.goto(`${base}${query}#room=${room}`);
  await a.click("#enter"); await b.click("#enter");
  return { a, b, close: async () => { await c1.close(); await c2.close(); } };
}

// ---- unit checks of the flags ----
ok(pickKind("") === "auto", "the default path is auto (Nostr first, BitTorrent if it cannot be reached)");
ok(pickKind("?net=torrent") === "torrent" && pickKind("?net=nostr") === "nostr" && pickKind("?net=local") === "local" && pickKind("?net=zzz") === "auto", "?net= picks a path by hand; anything else is auto");
ok(pickTestTracker("?tracker=ws://127.0.0.1:9000") === "ws://127.0.0.1:9000/" && pickTestTracker("?tracker=wss://evil.example/") === null && pickTestTracker("?tracker=ws://10.0.0.5:1") === null && pickTestTracker("") === null, "?tracker= accepts only a tracker on this machine");
ok(pickTestRelay("?tracker=ws://127.0.0.1:9000") === null, "?relay= does not read ?tracker=");

// ---- A. Nostr dead, tracker alive ----
{
  const tracker = await startTracker();
  const q = `?relay=${encodeURIComponent(dead)}&tracker=${encodeURIComponent(tracker.url)}`;
  const { a, b, close } = await pair("A. Nostr unreachable, BitTorrent tracker reachable", q, 2);
  // The transport starts asynchronously after Enter, so the lobby wording can still be there for a moment: wait (at most
  // 5 s, well inside the 7 s before a switch) for the first status paint instead of reading the text once.
  const tryingSaid = await waitFor(a, () => { const t = document.getElementById("netkind").textContent; return /trying/i.test(t) && /Nostr/.test(t); }, null, 5000);
  ok(tryingSaid, `at first the page says it is trying Nostr ("${await netText(a)}")`);
  const t0 = Date.now();
  const seen = await waitFor(a, () => window.__longWatch.peers().length === 1, null, 45000) && await waitFor(b, () => window.__longWatch.peers().length === 1, null, 45000);
  ok(seen, `the two pages find each other through the tracker (${seen ? ((Date.now() - t0) / 1000).toFixed(1) + " s" : "gave up"})`);
  const sa = await ns(a), sb = await ns(b);
  ok(sa.path === "torrent" && sb.path === "torrent", `both report the connected path as torrent (${sa.path}, ${sb.path})`);
  ok(sa.tried.map(t => t.kind).join() === "nostr,torrent" && sa.tried[0].reached === false && sa.tried[1].reached === true, `A tried nostr (not reached) then torrent (reached): ${JSON.stringify(sa.tried)}`);
  await a.waitForTimeout(600);
  const ta = await netText(a), tb = await netText(b);
  ok(/BitTorrent trackers \(connected; the Nostr relays could not be reached\)/.test(ta) && ta === tb, `the page says which path connected: "${ta}"`);
  ok((await a.evaluate(() => window.__longWatch.self().net)) === "torrent", "the game's transport reports kind torrent");
  ok(tracker.swarmSizes().some(n => n === 2), `the tracker saw both players in one swarm (${tracker.swarmSizes()})`);
  // Game traffic crosses the fallback path: A walks and B sees it.
  await a.locator("#view").focus();
  await a.keyboard.down("ArrowRight"); await a.waitForTimeout(500); await a.keyboard.up("ArrowRight");
  const aNow = await a.evaluate(() => window.__longWatch.self());
  ok(await waitFor(b, ([x, y]) => { const p = window.__longWatch.peers()[0]; return p && Math.hypot(p.x - x, p.y - y) < 0.05; }, [aNow.x, aNow.y], 8000), "B sees A walk over the BitTorrent path");
  const idA = (await a.evaluate(() => window.__longWatch.self())).id, seenByB = (await b.evaluate(() => window.__longWatch.peers()[0].id));
  ok(typeof idA === "string" && idA === seenByB, "the id A had after the switch is the id B sees (the id survives the switch)");
  await a.click("#leave");
  ok(await waitFor(b, () => window.__longWatch.peers().length === 0, null, 8000), "when A leaves, B no longer shows A");
  await close(); tracker.close();
}

// ---- B. Nostr alive, tracker dead ----
{
  const relay = await startRelay();
  const q = `?relay=${encodeURIComponent(relay.url)}&tracker=${encodeURIComponent(dead)}`;
  const { a, b, close } = await pair("B. Nostr reachable (the tracker is dead and must not be needed)", q, 3);
  const t0 = Date.now();
  const seen = await waitFor(a, () => window.__longWatch.peers().length === 1, null, 30000) && await waitFor(b, () => window.__longWatch.peers().length === 1, null, 30000);
  ok(seen, `the two pages find each other through the relay (${seen ? ((Date.now() - t0) / 1000).toFixed(1) + " s" : "gave up"})`);
  await waitFor(a, () => { const s = window.__longWatch.netStatus(); return !!s && s.path !== null; }, null, 5000);
  const sa = await ns(a);
  ok(sa.path === "nostr" && sa.switches === 0 && sa.tried.length === 1, `connected on nostr with no switch: ${JSON.stringify({ path: sa.path, switches: sa.switches, tried: sa.tried })}`);
  await a.waitForTimeout(8500); // longer than the try window: nothing may move to the tracker once connected
  const sa2 = await ns(a);
  ok(sa2.path === "nostr" && sa2.switches === 0 && (await a.evaluate(() => window.__longWatch.peers().length)) === 1, "after 8.5 more seconds still on nostr, still together");
  ok(/^Nostr relays \(connected\)$/.test(await netText(a)), `the page says Nostr connected: "${await netText(a)}"`);
  await close(); relay.close();
}

// ---- C. Both dead ----
{
  const q = `?relay=${encodeURIComponent(dead)}&tracker=${encodeURIComponent(dead)}`;
  const { a, b, close } = await pair("C. Neither path reachable", q, 4);
  const sw = await waitFor(a, () => { const s = window.__longWatch.netStatus(); return !!s && s.tried.length >= 2; }, null, 20000);
  ok(sw, "after the try window the page moves on to the second path");
  const s = await ns(a);
  ok(s.path === null && s.relaysOpen === 0, "no path is reported as connected");
  const said = await waitFor(a, () => /trying BitTorrent|Could not reach/.test(document.getElementById("status").textContent) && /BitTorrent trackers \(trying|neither/.test(document.getElementById("netkind").textContent), null, 10000);
  ok(said, `the page says what is happening: "${await statusText(a)}" / "${await netText(a)}"`);
  ok((await a.evaluate(() => window.__longWatch.peers().length)) === 0 && (await b.evaluate(() => window.__longWatch.peers().length)) === 0, "nobody sees anyone, and nothing crashes");
  await a.click("#leave");
  ok((await a.evaluate(() => window.__longWatch.netStatus())) === null, "leaving while still trying closes the transport");
  await close();
}

// ---- D. chosen by hand ----
{
  const tracker = await startTracker();
  const { a, b, close } = await pair("D. ?net=torrent chosen by hand", `?net=torrent&tracker=${encodeURIComponent(tracker.url)}`, 5);
  const seen = await waitFor(a, () => window.__longWatch.peers().length === 1, null, 30000) && await waitFor(b, () => window.__longWatch.peers().length === 1, null, 30000);
  ok(seen, "two pages meet through the tracker with no fallback logic involved");
  await a.waitForTimeout(700);
  ok(/^BitTorrent trackers \(connected\)$/.test(await netText(a)), `the page says: "${await netText(a)}"`);
  await close(); tracker.close();
}

ok(errors.length === 0, `no console errors${errors.length ? ":\n  " + errors.join("\n  ") : ""}`);
await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
