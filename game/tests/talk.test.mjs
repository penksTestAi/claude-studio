#!/usr/bin/env node
// Milestone 1 tests for The Long Watch: gestures, preset phrases, cooldowns and edge arrows.
//
//   node game/tests/talk.test.mjs            local transport, then real Trystero/WebRTC via a local Nostr relay
//   node game/tests/talk.test.mjs --local    only the BroadcastChannel part
//   SHOTS=/some/dir node ...                 also save screenshots there
//
// Two pages join the same lantern. What one does, the other must see: a phrase and a gesture (as ids), the
// cooldown refusing a second one, the bubble fading, and an edge arrow pointing at a player who is off
// screen. Local mode also forges hostile messages (bad ids, extra fields, too fast) and checks they are dropped.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startRelay } from "./nostr-relay.mjs";
import { edgeArrows } from "../js/arrows.js";
import { createTalk, PHRASES, EMOTES } from "../js/talk.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const onlyLocal = process.argv.includes("--local");
const shots = process.env.SHOTS;

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failures++; };

// ---- 0. pure parts, no browser ----
console.log("# edge arrows and talk, in node");
{
  const me = { x: 50, y: 50 }, tile = 30, W = 600, H = 400;
  const arr = edgeArrows(me, [{ id: "near", x: 52, y: 51 }, { id: "east", x: 80, y: 50, colour: "#fff" }, { id: "nw", x: 20, y: 20 }], tile, W, H, 20);
  ok(arr.length === 2 && !arr.some(a => a.id === "near"), "an on-screen player gets no arrow, off-screen players do");
  const east = arr.find(a => a.id === "east"), nw = arr.find(a => a.id === "nw");
  ok(Math.abs(east.ang) < 1e-9 && Math.abs(east.x - (W - 20)) < 1e-6 && Math.abs(east.y - H / 2) < 1e-6 && Math.abs(east.dist - 30) < 1e-9, "east arrow sits on the right edge, points right, distance 30 tiles");
  ok(nw.x >= 20 - 1e-6 && nw.y >= 20 - 1e-6 && nw.x <= W - 20 && nw.y <= H - 20 && nw.ang < -1.5 && nw.ang > -3, "north-west arrow stays inside the screen margin and points up-left");

  // the receive path, with a fake transport
  const handlers = [];
  const net = { onMessage: f => handlers.push(f), onPeerLeave() {}, send() {} };
  const peers = new Map([["p1", { id: "p1", say: null, emote: null }], ["p2", { id: "p2", say: null, emote: null }], ["p3", { id: "p3", say: null, emote: null }]]);
  const me2 = { say: null, emote: null };
  createTalk(net, me2, peers);
  const recv = (m, id = "p1") => handlers.forEach(f => f(m, id));
  const bad = [{ k: "say", p: 16 }, { k: "say", p: -1 }, { k: "say", p: 1.5 }, { k: "say", p: "3" }, { k: "say", p: null }, { k: "say", p: NaN }, { k: "say", p: 2, text: "hello" }, { k: "say" }, { k: "em", e: 5 }, { k: "em", e: "0" }, { k: "em", e: 0, x: 1 }, { k: "say", p: [2] }, { k: "say", p: { valueOf: () => 2 } }, "say", 7, null];
  for (const m of bad) recv(m);
  ok(peers.get("p1").say === null && peers.get("p1").emote === null, `${bad.length} malformed or unknown ids are dropped`);
  recv({ k: "say", p: 3 }, "stranger");
  ok(!peers.has("stranger"), "a phrase from someone who never said hello is ignored");
  recv({ k: "say", p: 15 }, "p2"); recv({ k: "em", e: 4 }, "p2");
  ok(peers.get("p2").say?.id === 15 && peers.get("p2").emote?.id === 4, "the largest valid ids are accepted");
  for (let i = 0; i < 30; i++) recv({ k: "say", p: i % 2 }, "p3");
  ok(peers.get("p3").say?.id === 0, "a peer that floods phrases gets only the first one shown (cooldown and rate limit)");
  ok(PHRASES.length === 16 && PHRASES.every(s => typeof s === "string" && s.length <= 24) && EMOTES.length === 5, "16 phrases (24 characters or fewer) and 5 gestures");
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
const browser = await pw.chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ["--disable-features=WebRtcHideLocalIpsWithMdns"] });

const errors = [];
function watch(page, label) {
  page.on("pageerror", e => errors.push(`${label}: ${e.message}`));
  page.on("console", m => { if (m.type() === "error" && !/WebSocket connection to 'wss:/.test(m.text())) errors.push(`${label}: ${m.text()}`); });
}
const lw = (page, fn, arg) => page.evaluate(`(${fn.toString()})(window.__longWatch, ${JSON.stringify(arg ?? null)})`);
async function waitFor(page, fn, arg, timeout = 10000) {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 50 }); return true; } catch { return false; }
}
const otherSay = (page) => page.evaluate(() => window.__longWatch.peers()[0]?.say ?? null);
const otherEmote = (page) => page.evaluate(() => window.__longWatch.peers()[0]?.emote ?? null);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function scenario(label, pageA, pageB, query, room, opts = {}) {
  console.log(`\n# ${label}`);
  await pageA.goto(`${base}${query}#room=${room}`); await pageB.goto(`${base}${query}#room=${room}`);
  await pageA.click("#enter"); await pageB.click("#enter");
  const seen = await waitFor(pageA, () => window.__longWatch.peers().length === 1, null, opts.timeout)
    && await waitFor(pageB, () => window.__longWatch.peers().length === 1, null, opts.timeout);
  ok(seen, "each page sees exactly one other player");
  if (!seen) return;
  const ids = { a: await pageA.evaluate(() => window.__longWatch.self().id), b: await pageB.evaluate(() => window.__longWatch.self().id) };

  if (opts.forge) await hostile(pageA, pageB, ids, room);

  // The talk panel: 5 gestures and 16 phrases, built from our own lists.
  // B was opened last, so A is a background page; its frames (which repaint the cooldowns) run at a few per second.
  await pageA.bringToFront();
  await pageA.click("#talktoggle");
  ok(await pageA.locator("#gestures .tb").count() === 5 && await pageA.locator("#phrases .tb").count() === 16, "the Talk panel shows 5 gesture and 16 phrase buttons");
  ok(await pageA.getAttribute("#talktoggle", "aria-expanded") === "true", "the Talk toggle reports it is open");

  // A says "Thank you" (id 2) by clicking its button; B sees the same id and the words; A sees its own bubble.
  await pageA.locator('#phrases .tb[data-id="2"]').click();
  ok(await waitFor(pageB, () => window.__longWatch.peers()[0].say === 2, null, 5000), `B sees A say phrase 2 ("${PHRASES[2]}")`);
  ok(await pageB.locator("#heard").textContent() === `${(await lw(pageA, w => w.self().name))}: ${PHRASES[2]}`, "B's screen-reader line reads the name and the phrase from B's own list");
  ok((await pageA.evaluate(() => window.__longWatch.mine().say)) === 2, "A shows its own bubble");

  // Cooldown: a second phrase right away is refused and nothing new reaches B.
  ok(!(await lw(pageA, w => w.say(5))), "a second phrase straight away is refused (cooldown)");
  await sleep(300);
  ok(await otherSay(pageB) === 2, "B still sees phrase 2, not 5");
  ok(await pageA.locator('#phrases .tb[data-id="5"]').getAttribute("aria-disabled") === "true", "A's phrase buttons show the cooldown");

  // A waves (gesture id 0) with the button; B sees the id. Gesture has its own, shorter cooldown.
  await pageA.locator('#gestures .tb[data-id="0"]').click();
  ok(await waitFor(pageB, () => window.__longWatch.peers()[0].emote === 0, null, 5000), `B sees A ${EMOTES[0]}`);
  ok(!(await lw(pageA, w => w.emote(3))), "a second gesture straight away is refused (cooldown)");
  if (shots) { await sleep(250); await pageB.screenshot({ path: path.join(shots, `${opts.shot}-bubble-b.png`) }); }

  // After the cooldown the other direction and a new phrase work; B talks, A sees.
  await sleep(3100);
  ok(await lw(pageA, w => w.say(9)), "after the cooldown A can speak again");
  ok(await waitFor(pageB, () => window.__longWatch.peers()[0].say === 9, null, 5000), "B sees the new phrase (9)");
  ok(await lw(pageB, w => w.say(0)) && await waitFor(pageA, () => window.__longWatch.peers()[0].say === 0, null, 5000), "B speaks and A sees it (phrase 0)");
  await lw(pageB, w => w.emote(3));
  ok(await waitFor(pageA, () => window.__longWatch.peers()[0].emote === 3, null, 5000), `A sees B ${EMOTES[3]}`);

  // Bubbles and gestures fade by themselves.
  ok(await waitFor(pageB, () => window.__longWatch.peers()[0].say === null && window.__longWatch.peers()[0].emote === null, null, 8000), "the bubble and gesture fade away on B");

  // Sitting ends when the sitter walks.
  await pageB.locator("#view").focus();
  await sleep(1500);
  await lw(pageA, w => w.emote(4));
  ok(await waitFor(pageB, () => window.__longWatch.peers()[0].emote === 4, null, 5000), "B sees A sit");
  await pageA.locator("#view").focus();
  await pageA.keyboard.down("ArrowRight"); await sleep(250); await pageA.keyboard.up("ArrowRight");
  ok(await waitFor(pageB, () => window.__longWatch.peers()[0].emote === null, null, 3000), "sitting ends on B once A walks");
  await pageA.keyboard.press("t");
  ok(await pageA.getAttribute("#talktoggle", "aria-expanded") === "false", "the T key closes the Talk panel");

  // Edge arrows: A walks away from B until B leaves A's screen, the arrow points at B, then comes back.
  await arrows(pageA, pageB, opts);

  await pageA.click("#leave");
  ok(await waitFor(pageB, () => window.__longWatch.peers().length === 0, null, 5000), "when A leaves, B no longer shows A");
}

async function arrows(pageA, pageB, opts) {
  const aSees = () => pageA.evaluate(() => window.__longWatch.arrows());
  let found = (await aSees()).length > 0;
  await pageA.locator("#view").focus();
  if (!found) { // walking can be blocked by water or trees depending on the random spawns, so first stand at the landmark farthest from B
    await pageA.evaluate(() => {
      const w = window.__longWatch, b = w.peers()[0], list = w.world().landmarkList.slice().sort((p, q) => Math.hypot(q.x - b.x, q.y - b.y) - Math.hypot(p.x - b.x, p.y - b.y));
      for (const l of list) for (const [dx, dy] of [[0, 2], [2, 0], [0, -2], [-2, 0], [2, 2], [-2, -2]]) if (w.teleport(l.x + dx, l.y + dy)) return;
    });
    for (let i = 0; i < 60 && !found; i++) { await sleep(100); found = (await aSees()).length > 0; }
  }
  for (const key of found ? [] : ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
    await pageA.keyboard.down(key);
    for (let i = 0; i < 60 && !found; i++) { await sleep(100); found = (await aSees()).length > 0; }
    await pageA.keyboard.up(key);
    if (found) break;
  }
  ok(found, "when B is off A's screen, A gets an edge arrow");
  if (!found) return;
  await sleep(200);
  if (shots) await pageA.screenshot({ path: path.join(shots, `${opts.shot}-arrow-a.png`) });
  const arr = (await aSees())[0], a = await pageA.evaluate(() => window.__longWatch.self()), b = (await pageA.evaluate(() => window.__longWatch.peers()))[0];
  const want = Math.atan2(b.y - a.y, b.x - a.x);
  const diff = Math.abs(Math.atan2(Math.sin(arr.ang - want), Math.cos(arr.ang - want)));
  ok(diff < 0.2 && Math.abs(arr.dist - Math.hypot(b.x - a.x, b.y - a.y)) < 1, `the arrow points at B (off by ${diff.toFixed(2)} rad, ${arr.dist.toFixed(1)} tiles away)`);
  // return to B (a teleport: walking back can be blocked by water or trees) until the arrow goes
  await pageA.evaluate(() => {
    const w = window.__longWatch, p = w.peers()[0];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) if (w.teleport(p.x + dx, p.y + dy)) return;
  });
  for (let i = 0; i < 60 && (await aSees()).length; i++) await sleep(100);
  ok((await aSees()).length === 0, "the arrow disappears when B is back on screen");
}

// Hostile messages, forged on the local channel as if they came from A. B must drop them all.
async function hostile(pageA, pageB, ids, room) {
  console.log("  hostile messages");
  const pageE = await pageA.context().newPage();
  await pageE.goto(`${base}?net=local`);
  const send = (msgs) => pageE.evaluate(([room, from, to, msgs]) => {
    const ch = new BroadcastChannel(`vigil-long-watch:lantern-${room}`);
    for (const d of msgs) ch.postMessage({ k: "data", d, from, to });
    ch.close();
  }, [room, ids.a, ids.b, msgs]);
  await send([{ k: "say", p: 99 }, { k: "say", p: -1 }, { k: "say", p: 1.5 }, { k: "say", p: "3" }, { k: "say", p: 2, text: "<b>hi</b>" }, { k: "em", e: 9 }, { k: "em", e: "1" }, { k: "say" }, { k: "zap", p: 1 }, "say", 12]);
  await sleep(400);
  ok(await otherSay(pageB) === null && await otherEmote(pageB) === null, "B dropped every forged bad id, extra field and unknown kind");
  await send([{ k: "say", p: 1 }, { k: "say", p: 2 }, { k: "say", p: 3 }, { k: "em", e: 0 }, { k: "em", e: 1 }]);
  await sleep(400);
  ok(await otherSay(pageB) === 1 && await otherEmote(pageB) === 0, "a burst of valid forged messages: only the first of each kind is shown, the rest hit the cooldown");
  await send(Array.from({ length: 400 }, (_, i) => ({ k: "st", x: 10 + (i % 5), y: 10, d: 0, m: 1 })));
  await sleep(300);
  ok(await pageB.evaluate(() => window.__longWatch.peers().length) === 1, "a flood of 400 movement messages does not break B");
  await pageE.close();
  // let the forged bubble and the cooldown pass so the real checks start clean
  await sleep(3300);
  await waitFor(pageB, () => window.__longWatch.peers()[0].say === null, null, 6000);
  // the forged st messages moved A's drawn position on B; A's own next update puts it back
  await pageA.evaluate(() => window.__longWatch.self());
}

// ---- 1. local ----
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 800 } });
  const [a, b] = [await ctx.newPage(), await ctx.newPage()];
  watch(a, "local A"); watch(b, "local B");
  await scenario("local transport (BroadcastChannel)", a, b, "?net=local", 5, { forge: true, shot: "talk-local" });
  await ctx.close();
}

// ---- 2. real WebRTC through a local Nostr relay (the real code path; the public relays are still untested) ----
if (!onlyLocal) {
  const relay = await startRelay();
  const c1 = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
  const c2 = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const a = await c1.newPage(), b = await c2.newPage();
  watch(a, "webrtc A"); watch(b, "webrtc B");
  await scenario("Trystero over Nostr + WebRTC (relay on 127.0.0.1)", a, b, `?net=nostr&relay=${encodeURIComponent(relay.url)}`, 6, { timeout: 30000, shot: "talk-webrtc" });
  await c1.close(); await c2.close(); relay.close();
}

ok(errors.length === 0, `no console errors${errors.length ? ":\n  " + errors.join("\n  ") : ""}`);
await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
