#!/usr/bin/env node
// Milestone 17 tests for The Long Watch: the clock check. Each browser tells the room its device clock (one number) and
// shows a plain note when another player's clock differs from its own by CLOCK_WARN_S or more.
//
//   node game/tests/clock.test.mjs            node checks, local transport, then real Trystero/WebRTC via a local Nostr relay
//   node game/tests/clock.test.mjs --local    skip the WebRTC part
//   CHROME=/path/to/headless_shell            use this browser binary
// Online play over the public relays is not tested here.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClockCheck, validClockMsg, clockWords, clockNote, pickClockSkew, CLOCK_WARN_S, CLOCK_SEND_MS } from "../js/clock.js";
import { startRelay } from "./nostr-relay.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const onlyLocal = process.argv.includes("--local");
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failures++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

console.log("# the clock check, in node");
{
  const T = 1760000000;
  ok(validClockMsg({ k: "ck", t: T }), "a whole number of seconds is a clock reading");
  const bad = [{ k: "ck", t: T + 0.5 }, { k: "ck", t: String(T) }, { k: "ck", t: NaN }, { k: "ck", t: Infinity }, { k: "ck", t: 5 }, { k: "ck", t: 1e11 }, { k: "ck", t: -T }, { k: "ck" }, { k: "ck", t: T, x: 1 }, { k: "ck", t: T, name: "Bob" }, { k: "CK", t: T }, { k: "ck", t: [T] }, { k: "ck", t: null }, null, "ck", 7, []];
  ok(bad.every(m => !validClockMsg(m)), `${bad.length} malformed, out-of-range and extra-field messages are refused`);
  ok(clockWords(12) === "about 12 seconds" && clockWords(-150) === "about 3 minutes" && clockWords(60) === "about 60 seconds" && clockWords(3 * 3600) === "about 3 hours" && clockWords(5 * 86400) === "about 5 days" && clockWords(NaN) === "about 0 seconds", "differences are put in plain words");
  ok(clockNote("Grey Heron 41", CLOCK_WARN_S - 0.1) === "" && clockNote("Grey Heron 41", -(CLOCK_WARN_S - 0.1)) === "" && clockNote("x", NaN) === "", `under ${CLOCK_WARN_S} s nothing is said`);
  const n1 = clockNote("Grey Heron 41", 150), n2 = clockNote("Grey Heron 41", -150);
  ok(/Grey Heron 41's differ by about 3 minutes \(yours is behind\)/.test(n1) && /yours is ahead/.test(n2) && /network time/.test(n1), "the note names the player, the size and which clock is behind");
  ok(pickClockSkew("?clockskew=120", true) === 120 && pickClockSkew("?a=1&clockskew=-30", true) === -30 && pickClockSkew("?clockskew=120", false) === 0 && pickClockSkew("?clockskew=999999", true) === 0 && pickClockSkew("?clockskew=1.5", true) === 0 && pickClockSkew("", true) === 0, "?clockskew= only on this machine, whole seconds, at most two days");

  const mkNet = () => { const sent = [], hs = [], leaves = []; return { sent, hs, leaves, net: { selfId: "me", send: (msg, to) => sent.push([msg, to]), onMessage: h => hs.push(h), onPeerJoin: () => {}, onPeerLeave: h => leaves.push(h) } }; };
  const m = mkNet(), peers = new Map(), c = { perf: 100000, ms: T * 1000 + 400 };
  const ck = createClockCheck(m.net, peers, { now: () => c.perf, clock: () => c.ms });
  const say = (msg, id) => m.hs.forEach(h => h(msg, id));
  ck.tick();
  ok(m.sent.length === 0, "alone, nothing is sent");
  peers.set("p1", { id: "p1" });
  ck.tick();
  ok(m.sent.some(([msg, to]) => to === "p1" && msg.k === "ck" && msg.t === T && Object.keys(msg).length === 2), "a newcomer is told my clock (whole seconds, two fields)");
  const n0 = m.sent.length;
  c.perf += 1000; ck.tick(); ok(m.sent.length === n0, "not again a second later");
  c.perf += 2100; ck.tick(); ok(m.sent.length === n0 + 1 && m.sent[n0][1] === "p1", "a second time 3 s later (in case the first came before my hello)");
  c.perf += 5000; ck.tick(); ok(m.sent.length === n0 + 1, "then not to them alone again");
  c.perf += CLOCK_SEND_MS; ck.tick(); ok(m.sent.length === n0 + 2 && m.sent[n0 + 1][1] === undefined, `everyone is told every ${CLOCK_SEND_MS / 1000} s`);
  say({ k: "ck", t: T + 150 }, "p1");
  ok(ck.worst() && ck.worst().id === "p1" && Math.abs(ck.worst().off - 149.6) < 1e-6, "a known player's clock gives an offset (theirs minus mine)");
  say({ k: "ck", t: T + 9999 }, "stranger");
  ok(ck.offsets().length === 1, "a clock from someone who never said hello is ignored");
  c.perf += 5000;
  for (const msg of bad) say(msg, "p1");
  ok(Math.abs(ck.worst().off - 149.6) < 1e-6, "malformed messages from a known player change nothing");
  peers.set("p2", { id: "p2" }); c.perf += 5000; say({ k: "ck", t: T - 3 }, "p2");
  ok(ck.worst().id === "p1" && ck.offsets().length === 2, "the note is about the clock that differs most");
  c.perf += 5000;
  for (let i = 0; i < 200; i++) say({ k: "ck", t: T + i }, "p2");
  ok(ck.offsets().find(o => o.id === "p2").off < 3, "a flood is cut by the rate limit (1 a second, burst 3)");
  m.leaves.forEach(h => h("p1")); peers.delete("p1");
  ok(ck.offsets().length === 1 && ck.worst().id === "p2", "a player who leaves is forgotten");
  peers.delete("p2"); ck.tick();
  ok(ck.worst() === null, "a player gone from the room without a leave event is forgotten at the next tick");
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
  try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; } catch { return false; }
}
const clockOf = (p) => p.evaluate(() => window.__longWatch.clock());
const nameOf = (p) => p.evaluate(() => window.__longWatch.self().name);
async function enter(page, query, room) { await page.goto(`${base}${query}#room=${room}`); await page.click("#enter"); await waitFor(page, () => window.__longWatch.self().playing, null, 5000); }

async function scenario(label, mk, query, rooms, timeout) {
  console.log(`\n# ${label}`);
  const A = await mk(), B = await mk(), C = await mk(), D = await mk();
  await enter(A, `${query}&clockskew=180`, rooms[0]); await enter(B, query, rooms[0]);
  await enter(C, `${query}&clockskew=4`, rooms[1]); await enter(D, query, rooms[1]);
  const met = await waitFor(A, () => window.__longWatch.peers().length === 1, null, timeout) && await waitFor(B, () => window.__longWatch.peers().length === 1, null, timeout)
    && await waitFor(C, () => window.__longWatch.peers().length === 1, null, timeout) && await waitFor(D, () => window.__longWatch.peers().length === 1, null, timeout);
  ok(met, "two pairs of players, each pair in its own lantern, see each other");
  const nA = await nameOf(A), nB = await nameOf(B);
  ok(await waitFor(B, () => window.__longWatch.clock().note !== "", null, 10000), "B, whose clock is right, gets a note about A's clock (180 s ahead)");
  const cb = await clockOf(B);
  ok(cb.note.includes(`${nA}'s differ by about 3 minutes (yours is behind)`), `B's note names A and says B's clock is behind: "${cb.note.slice(0, 90)}…"`);
  ok(await waitFor(A, () => window.__longWatch.clock().note !== "", null, 10000) && (await clockOf(A)).note.includes(`${nB}'s differ by about 3 minutes (yours is ahead)`), "A gets the mirror note about B (A's clock is ahead)");
  ok(await B.locator("#clocknote").isVisible() && !(await B.evaluate(() => document.querySelector("#clocknote").children.length)), "the note is shown on B's page as plain text");
  ok(await waitFor(D, () => window.__longWatch.clock().offsets.length === 1, null, 10000), "D hears C's clock (4 s off)");
  const cd = await clockOf(D);
  ok(Math.abs(cd.offsets[0].off - 4) < 1.5 && cd.note === "" && !(await D.locator("#clocknote").isVisible()), `a difference under ${CLOCK_WARN_S} s is not mentioned (D measured ${cd.offsets[0].off.toFixed(1)} s)`);
  await A.click("#leave");
  ok(await waitFor(B, () => window.__longWatch.clock().note === "" && window.__longWatch.clock().offsets.length === 0, null, 10000), "when A leaves, B's note goes");
  ok(!(await A.locator("#clocknote").isVisible()), "and A, back in the lobby, shows none");
  for (const p of [A, B, C, D]) await p.close();
}

try {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 800 } });
  const mk = () => ctx.newPage().then(p => (watch(p, "local"), p));
  await scenario("local transport (BroadcastChannel)", mk, "?net=local&hour=3&weather=clear", [3, 4], 10000);
  await ctx.close();
  if (!onlyLocal) {
    const relay = await startRelay();
    const cs = [];
    for (let i = 0; i < 4; i++) cs.push(await browser.newContext({ viewport: i === 0 ? { width: 390, height: 800 } : { width: 900, height: 800 }, ...(i === 0 ? { isMobile: true, hasTouch: true } : {}) }));
    let i = 0;
    const mk2 = () => cs[i++ % 4].newPage().then(p => (watch(p, "webrtc"), p));
    await scenario("Trystero over Nostr + WebRTC (relay on 127.0.0.1)", mk2, `?net=nostr&hour=3&weather=clear&relay=${encodeURIComponent(relay.url)}`, [5, 6], 30000);
    for (const c of cs) await c.close().catch(() => {});
    relay.close();
  }
  ok(errors.length === 0, errors.length ? `console errors: ${errors.join(" | ")}` : "no console errors");
} catch (e) {
  ok(false, `test crashed: ${e && e.stack || e}`);
} finally {
  await browser.close(); server.close();
}
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
