#!/usr/bin/env node
// Milestone 8 tests for The Long Watch: the keeper's notes (three quests a day from the seed and the date, finished
// by the whole lantern together).
//
//   node game/tests/quests.test.mjs            node checks, local transport, then real Trystero/WebRTC via a local Nostr relay
//   node game/tests/quests.test.mjs --local    skip the WebRTC part
//
// Part 0 (node): the notes are a pure function of seed and day (same everywhere, they change from day to day), the shares
// are a grow-only counter (merge keeps the larger, never lowers), a note needs its total AND two players, every cap
// (one player's share need-1, 24 players per note, the wire range) refuses without changing anything, messages are
// validated on a fake mesh (wrong day, extra fields, strangers, unasked snapshots, floods), work done before the room's
// counters were heard is held back and added afterwards, a peer that leaves mid-snapshot does not stall it, and midnight
// starts new notes from 0. Then pages: the same three notes on every page, a gather note, a craft note and a fuel note
// each filled by two players (one alone cannot finish), a late joiner, a reload, a page on another day, forged messages.
// SHOTS=dir saves screenshots at 375 and 1100 px wide.
import { createServer } from "node:http";
import { readFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startRelay } from "./nostr-relay.mjs";
import { generateWorld } from "../js/world.js";
import { KINDS } from "../js/resources.js";
import { notesFor, noteText, createNoteShares, countsFor, createQuests, dayNumber, pickDay, shareCap, NOTES, MIN_PLAYERS, MAX_NEED, MAX_SHARE, MAX_ENTRIES, MAX_DAY } from "../js/quests.js";
import { BEACON_RANGE } from "../js/beacon.js";
import { T, isBlocked } from "../js/world.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const onlyLocal = process.argv.includes("--local");

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failures++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const STORE = "vigil.longwatch.v1";
const HOUR = 3, DAY = 5;
const world = generateWorld();
const beaconList = world.landmarks.filter(l => l.kind === "beacon");
const seeds = (n, from = 1000) => Array.from({ length: n }, (_, i) => from + i * 7919);

// ---- 0. node: the rules ----
console.log("# the keeper's notes, in node");
{
  ok(NOTES === 3 && MIN_PLAYERS === 2 && MAX_NEED === 9 && MAX_SHARE === 8 && MAX_ENTRIES === 24, "limits: 3 notes, 2 players, need at most 9, a share at most 8, 24 players counted per note");
  const a = notesFor(world.seed, DAY, 4), b = notesFor(world.seed, DAY, 4);
  ok(JSON.stringify(a) === JSON.stringify(b), "the notes are a pure function of the seed and the day: asking twice gives the same three");
  ok(a.length === 3 && a[0].kind === "gather" && a[1].kind === "craft" && a[2].kind === "fuel", "one gather note, one craft note, one fuel note");
  let allOk = true, kinds = new Set(), crafts = new Set(), beacons = new Set(), sigs = new Set();
  for (let d = 0; d < 400; d++) {
    const n = notesFor(world.seed, d, 4);
    sigs.add(JSON.stringify(n));
    kinds.add(n[0].item); crafts.add(n[1].item); beacons.add(n[2].beacon);
    allOk = allOk && KINDS.includes(n[0].item) && n[0].need >= 5 && n[0].need <= 9 && (n[1].item === "amber" ? n[1].need === 2 : n[1].item === "wick" && n[1].need >= 3 && n[1].need <= 5) && n[2].beacon >= 0 && n[2].beacon <= 3 && n[2].need >= 6 && n[2].need <= 9;
  }
  ok(allOk, "over 400 days every note stays in range (gather 5..9 of a real item, wicks 3..5 or 2 amber lanterns, 6..9 fuel at one of the four beacons)");
  ok(kinds.size === 3 && crafts.size === 2 && beacons.size === 4 && sigs.size > 300, `the days vary: all 3 gather items, both craft items and all 4 beacons turn up, and ${sigs.size} of 400 days have different notes`);
  ok(JSON.stringify(notesFor(world.seed + 1, DAY, 4)) !== JSON.stringify(a) || JSON.stringify(notesFor(world.seed + 1, DAY + 1, 4)) !== JSON.stringify(notesFor(world.seed, DAY + 1, 4)), "another seed gives other notes");
  ok(a.every(n => shareCap(n) === n.need - 1) && noteText(a[0]).includes(String(a[0].need)) && /beacon/.test(noteText(a[2], (b) => "west")) && noteText(a[2], () => "west").includes("west"), "a note's words come from its numbers (and the place name the page gives)");
  ok(dayNumber(Date.UTC(2026, 9, 16, 23, 59, 59)) + 1 === dayNumber(Date.UTC(2026, 9, 17, 0, 0, 0)), "the day changes at 00:00 UTC");
  ok(pickDay("?day=7", true) === 7 && pickDay("?day=7", false) === null && pickDay("?day=-1", true) === null && pickDay("?day=1.5", true) === null && pickDay("?day=100000", true) === null && pickDay("", true) === null, "?day= works only on this machine and only for whole numbers 0 to 99999");

  const s = createNoteShares(a);
  const cap0 = a[0].need - 1;
  ok(s.merge(0, 111, 2) === "new" && s.merge(0, 111, 1) === "" && s.own(0, 111) === 2, "a share never goes down: a smaller number is ignored");
  ok(s.merge(0, 111, 2) === "" && s.merge(0, 111, 3) === "grew" && s.total(0) === 3, "a repeat changes nothing; a larger number grows the share");
  for (const [q, sd, n] of [[3, 1, 1], [-1, 1, 1], [0, 1, 0], [0, 1, cap0 + 1], [0, 1, a[0].need], [0, 1, 1.5], [0, 1, "3"], [0, -1, 1], [0, 2 ** 32, 1], [0, 1.5, 1], [0, 1, NaN], [0, 1, null], ["0", 1, 1], [0.5, 1, 1], [0, 1, Infinity]]) {
    const before = JSON.stringify(s.entries()); const r = s.merge(q, sd, n);
    ok(r === "" && JSON.stringify(s.entries()) === before, `a bad share (${JSON.stringify([q, sd, n])}) is refused`);
  }
  const t = createNoteShares(a);
  t.merge(0, 1, cap0);
  ok(t.total(0) === a[0].need - 1 && t.players(0) === 1 && !t.done(0), "one player alone, at the cap, is one short and the note is not done");
  t.merge(0, 2, 1);
  ok(t.total(0) === a[0].need && t.players(0) === 2 && t.done(0), "a second player adding 1 finishes it");
  ok(t.merge(0, 2, 1) === "" && t.done(0), "and it stays done");
  // the two-player rule on its own: a forged huge total cannot exist, but a total reached by two small shares of one note needs both
  const u = createNoteShares([{ kind: "gather", item: "reeds", need: 2 }]);
  u.merge(0, 5, 1);
  ok(!u.done(0), "need 2 with one share of 1 is not done");
  u.merge(0, 6, 1);
  ok(u.done(0), "need 2 with two shares of 1 is done");
  // a full list refuses a new player and never drops an old one
  const f = createNoteShares(a);
  for (const sd of seeds(MAX_ENTRIES)) f.merge(1, sd, 1);
  const before = JSON.stringify(f.entries());
  ok(f.players(1) === MAX_ENTRIES && f.merge(1, 5, 1) === "" && JSON.stringify(f.entries()) === before, "a note that already counts 24 players refuses a 25th and drops nobody");
  ok(f.merge(1, seeds(1)[0], 2) === "grew", "but a player already counted can still grow their share");
  f.clear(); ok(f.entries().length === 0 && f.total(1) === 0, "clear empties every note");
  ok(countsFor(a[0], "gather", a[0].item) && !countsFor(a[0], "gather", KINDS.find(k => k !== a[0].item)) && !countsFor(a[0], "craft", a[0].item) && countsFor(a[2], "fuel", null, a[2].beacon) && !countsFor(a[2], "fuel", null, (a[2].beacon + 1) % 4), "an action counts only for the matching note (same thing, same beacon)");
}

// ---- 0b. node: the quests module on a fake mesh ----
console.log("\n# quests on a fake mesh");
{
  const mkNet = () => { const sent = [], hs = [], joins = [], leaves = []; return { sent, hs, joins, leaves, net: { selfId: "me", send: (msg, to) => sent.push([msg, to]), onMessage: h => hs.push(h), onPeerJoin: h => joins.push(h), onPeerLeave: h => leaves.push(h) } }; };
  const mk = (opts = {}) => {
    const m = mkNet(); const peers = new Map(); const me = { seed: 4242 }; const clock = { t: Date.UTC(2026, 9, 16, 12), ms: 0 };
    const events = [];
    const q = createQuests(m.net, world, me, peers, { now: () => clock.ms, clock: () => clock.t, onEvent: (t, i) => events.push([t, i]), beacons: 4, ...opts });
    const say = (msg, id) => m.hs.forEach(h => h(msg, id));
    return { m, peers, me, clock, q, events, say, sentK: (k) => m.sent.filter(([x]) => x.k === k) };
  };
  const day = dayNumber(Date.UTC(2026, 9, 16, 12));
  const notes = notesFor(world.seed, day, 4);
  // alone: credits count at once, up to the cap
  {
    const T1 = mk();
    const item = notes[0].item;
    for (let i = 0; i < notes[0].need + 3; i++) T1.q.credit("gather", item);
    ok(T1.q.shares.own(0, 4242) === notes[0].need - 1 && T1.sentK("qp").length === notes[0].need - 1, `alone, gathering ${notes[0].need + 3} counts ${notes[0].need - 1} (the cap) and sends one message per change, none past the cap`);
    ok(!T1.q.shares.done(0), "and the note is not done: one player alone cannot finish a note");
    T1.q.credit("gather", KINDS.find(k => k !== item)); T1.q.credit("craft", "wick"); T1.q.credit("fuel", null, 9, 1);
    ok(T1.q.shares.own(1, 4242) === (notes[1].item === "wick" ? 1 : 0) && T1.q.shares.own(2, 4242) === 0, "another item, or a beacon that is not the note's, counts for nothing");
    const bad = T1.sentK("qp").length;
    T1.q.credit("gather", item, -1, 0); T1.q.credit("gather", item, -1, 1.5); T1.q.credit("gather", item, -1, 99);
    ok(T1.sentK("qp").length === bad, "credit with a bad points number does nothing");
  }
  // a peer: snapshot, held-back credits
  {
    const T2 = mk();
    T2.peers.set("p1", { seed: 777 });
    T2.m.joins.forEach(h => h("p1"));
    T2.q.credit("gather", notes[0].item); T2.q.credit("gather", notes[0].item);
    ok(T2.q.owed()[0] === 2 && T2.q.shares.own(0, 4242) === 0 && T2.sentK("qp").length === 0, "with a peer present and the room's counters not yet heard, two gathers are held back (owed 2), nothing counted or sent");
    T2.clock.ms = 100; T2.q.tick();
    ok(T2.sentK("qq").length === 1 && T2.sentK("qq")[0][0].d === day && T2.sentK("qq")[0][1] === "p1", "the newcomer asks the peer for its shares, naming the day");
    // the peer's snapshot says that I (seed 4242) already have 3 here from an earlier visit
    T2.say({ k: "qs", d: day, q: [0, 0], s: [4242, 777], n: [3, 1], f: 1 }, "p1");
    ok(T2.q.synced() && T2.q.owed()[0] === 0, "the snapshot ends the wait and the held-back credits are added");
    ok(T2.q.shares.own(0, 4242) === Math.min(3 + 2, notes[0].need - 1) && T2.q.shares.players(0) === 2, `my own share resumes from the 3 the others held for me (3 + 2 = ${Math.min(5, notes[0].need - 1)}), it does not restart at 2`);
    ok(T2.q.shares.done(0) === (T2.q.shares.total(0) >= notes[0].need), "done follows the total and the two players");
  }
  // no answer: after the timeout we carry on
  {
    const T3 = mk();
    T3.peers.set("p1", { seed: 777 });
    T3.q.credit("craft", notes[1].item);
    for (let t = 0; t <= 12000; t += 500) { T3.clock.ms = t; T3.q.tick(); }
    ok(T3.q.synced() && T3.q.owed()[1] === 0 && T3.q.shares.own(1, 4242) === 1, "a peer that never answers does not stall us: after a few tries the held-back craft is counted");
    ok(T3.sentK("qq").length === 3, "the question was asked 3 times at most");
  }
  // a peer that leaves midway
  {
    const T4 = mk();
    T4.peers.set("p1", { seed: 777 }); T4.m.joins.forEach(h => h("p1"));
    T4.clock.ms = 100; T4.q.tick();
    ok(T4.q.pending() === 1, "waiting for one snapshot");
    T4.peers.delete("p1"); T4.m.leaves.forEach(h => h("p1"));
    ok(T4.q.pending() === 0, "the peer leaving midway stops the wait");
    T4.say({ k: "qs", d: day, q: [0], s: [777], n: [2], f: 1 }, "p1");
    ok(T4.q.shares.total(0) === 0, "and a snapshot from the one that left is ignored");
    T4.clock.ms = 2000; T4.q.tick(); T4.q.credit("gather", notes[0].item);
    ok(T4.q.shares.own(0, 4242) === 1, "with nobody left, credits count at once");
  }
  // messages
  {
    const T5 = mk();
    T5.peers.set("p1", { seed: 777 }); T5.peers.set("p2", { seed: 888 });
    T5.clock.ms = 100; T5.q.tick();
    const tot = () => JSON.stringify([0, 1, 2].map(q => [T5.q.shares.total(q), T5.q.shares.players(q)]));
    const s0 = tot();
    const c0 = notes[0].need - 1;
    const bads = [
      { k: "qp", q: 0, d: day + 1, n: 1 }, { k: "qp", q: 0, d: day - 1, n: 1 }, { k: "qp", q: 0, d: "5", n: 1 }, { k: "qp", q: 0, n: 1 },
      { k: "qp", q: 3, d: day, n: 1 }, { k: "qp", q: -1, d: day, n: 1 }, { k: "qp", q: 0.5, d: day, n: 1 }, { k: "qp", q: "0", d: day, n: 1 }, { k: "qp", q: [0], d: day, n: [1] },
      { k: "qp", q: 0, d: day, n: 0 }, { k: "qp", q: 0, d: day, n: c0 + 1 }, { k: "qp", q: 0, d: day, n: 99 }, { k: "qp", q: 0, d: day, n: 1.5 }, { k: "qp", q: 0, d: day, n: "2" }, { k: "qp", q: 0, d: day, n: null }, { k: "qp", q: 0, d: day, n: NaN },
      { k: "qp", q: 0, d: day, n: 1, x: 1 }, { k: "qp", q: 0, d: day }, { k: "qp" },
      { k: "qs", d: day, q: [0], s: [777], n: [2], f: 1 }, // nobody asked p2
      { k: "qq", d: day, y: 1 }, "qp", 42, null, [], { k: "zz" },
    ];
    for (const m of bads) T5.say(m, "p2");
    ok(tot() === s0, "out-of-range, fractional, text, array, extra-field, wrong-day messages and an unasked snapshot change nothing");
    T5.say({ k: "qp", q: 0, d: day, n: 1 }, "stranger");
    ok(tot() === s0, "a message from someone who never said hello is ignored");
    T5.say({ k: "qp", q: 0, d: day, n: 1 }, "p1");
    ok(T5.q.shares.own(0, 777) === 1 && T5.q.shares.players(0) === 1, "a good message counts, as that sender's own share (a message can only change its sender's share)");
    T5.say({ k: "qp", q: 0, d: day, n: c0 }, "p1"); T5.say({ k: "qp", q: 0, d: day, n: 1 }, "p1");
    ok(T5.q.shares.own(0, 777) === c0, "a smaller number later does not lower it");
    T5.peers.set("p3", { seed: 999 });
    T5.say({ k: "qp", q: 0, d: day, n: 1 }, "p3");
    ok(T5.q.shares.done(0) && T5.events.some(e => e[0] === "done" && e[1] === 0), "a second sender finishing the note raises one 'done' event");
    const nDone = T5.events.filter(e => e[0] === "done").length;
    T5.say({ k: "qp", q: 0, d: day, n: 2 }, "p3");
    ok(T5.events.filter(e => e[0] === "done").length === nDone, "no second 'done' event");
    // a flood
    for (let i = 0; i < 500; i++) T5.say({ k: "qp", q: 1, d: day, n: 1 + (i % 2) }, "p1");
    ok(T5.q.shares.own(1, 777) <= notes[1].need - 1, "a flood of 500 messages stays inside the limits");
  }
  // midnight
  {
    const T6 = mk();
    T6.q.credit("gather", notes[0].item);
    ok(T6.q.shares.own(0, 4242) === 1, "a share before midnight");
    T6.clock.t = Date.UTC(2026, 9, 17, 0, 0, 1); T6.clock.ms = 1000; T6.q.tick();
    const n2 = notesFor(world.seed, day + 1, 4);
    ok(T6.q.day === day + 1 && JSON.stringify(T6.q.notes) === JSON.stringify(n2) && T6.q.shares.total(0) === 0 && T6.events.some(e => e[0] === "newday"), "after 00:00 UTC the notes are the new day's and every share is back to 0");
    T6.peers.set("p1", { seed: 5 });
    T6.say({ k: "qp", q: 0, d: day, n: 1 }, "p1");
    ok(T6.q.shares.total(0) === 0, "a message still carrying yesterday's day is dropped");
    const T7 = mk({ day: 12 });
    ok(T7.q.day === 12, "a pinned day (?day=) is used");
    T7.clock.t += 3 * 86400000; T7.clock.ms = 5000; T7.q.tick();
    ok(T7.q.day === 12, "and does not change when the clock passes midnight");
  }
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



// ---- pages ----
const qs = (page) => page.evaluate(() => window.__longWatch.quests());
async function seedSave(page, url, patch) {
  await page.goto(url);
  await page.evaluate(([K, patch]) => { const st = location.search.includes("net=local") ? sessionStorage : localStorage; const s = JSON.parse(st.getItem(K)); Object.assign(s, patch); st.setItem(K, JSON.stringify(s)); }, [STORE, patch]);
  await page.reload();
}
const land = (x, y) => { const t = world.tiles[Math.floor(y) * world.w + Math.floor(x)]; return (t === T.SAND || t === T.GRASS || t === T.MEADOW) && !isBlocked(world, x, y); };
const standBy = (l) => { for (let r = 1.1; r <= 2.2; r += 0.3) for (let a = 0; a < 6.28; a += 0.5) { const x = l.x + Math.cos(a) * r, y = l.y + Math.sin(a) * r; if (land(x, y) && Math.hypot(x - l.x, y - l.y) <= BEACON_RANGE - 0.2) return { x, y }; } return null; };
async function shoot(page, name) {
  if (!shots) return;
  await mkdir(shots, { recursive: true });
  const keep = page.viewportSize();
  for (const [w, h] of [[375, 760], [1100, 800]]) { await page.setViewportSize({ width: w, height: h }); await sleep(400); await page.locator("#quests").scrollIntoViewIfNeeded(); await page.locator(".stage").screenshot({ path: path.join(shots, `${name}-${w}.png`) }); await page.locator("#quests").screenshot({ path: path.join(shots, `${name}-panel-${w}.png`) }); }
  await page.setViewportSize(keep); await sleep(200);
}
// Do `count` things for note q on a page; returns how many the page's own share grew by.
const moveTo = async (page, other, x, y) => {
  if (!await page.evaluate(([x, y]) => window.__longWatch.teleport(x, y), [x, y])) return false;
  return waitFor(other, ([x, y]) => window.__longWatch.peers().some(p => Math.hypot(p.x - x, p.y - y) < 0.05), [x, y], 6000); // the arbiter checks where it last saw the picker
};
async function work(page, other, q, count, notes, fromEnd = false) {
  const n = notes[q];
  const before = (await qs(page)).own[q];
  if (n.kind === "gather") {
    const list = (await page.evaluate(() => window.__longWatch.nodes())).filter(x => x.kind === n.item);
    if (fromEnd) list.reverse();
    let got = 0;
    for (const node of list) {
      if (got >= count) break;
      if (!await moveTo(page, other, node.x, node.y)) continue;
      const have = await page.evaluate((k) => window.__longWatch.gather().inv[k], n.item);
      await sleep(400);
      if (!await page.evaluate(() => window.__longWatch.pick())) continue;
      if (await waitFor(page, ([k, h]) => window.__longWatch.gather().inv[k] > h, [n.item, have], 6000)) got++;
    }
  } else if (n.kind === "craft") {
    for (let i = 0; i < count; i++) await page.evaluate((name) => window.__longWatch.makeItem(name), n.item);
  } else {
    const spot = standBy(beaconList[n.beacon]);
    await moveTo(page, other, spot.x, spot.y);
    for (let i = 0; i < count; i++) await page.evaluate(() => window.__longWatch.addFuel("driftwood"));
  }
  return (await qs(page)).own[q] - before;
}
const agree = (pages, q, total, players, done, timeout = 8000) => Promise.all(pages.map(p => waitFor(p, ([q, total, players, done]) => { const s = window.__longWatch.quests(); return s && s.total[q] === total && s.players[q] === players && s.done[q] === done; }, [q, total, players, done], timeout))).then(r => r.every(Boolean));
const PACK = { inv: { driftwood: 60, reeds: 60, berries: 60 }, cr: { wick: 6 } };

async function scenario(label, mk, query, room, opts = {}) {
  console.log(`\n# ${label}`);
  const url = `${base}${query}&day=${DAY}#room=${room}`;
  const notes = notesFor(world.seed, DAY, 4);
  const [A, B] = [await mk(), await mk()];
  await seedSave(A, url, PACK); await seedSave(B, url, PACK);
  await A.click("#enter"); await B.click("#enter");
  const seen = await waitFor(A, () => window.__longWatch.peers().length === 1, null, opts.timeout) && await waitFor(B, () => window.__longWatch.peers().length === 1, null, opts.timeout);
  ok(seen, "each page sees exactly one other player");
  if (!seen) return;
  ok(await waitFor(A, () => window.__longWatch.quests() && window.__longWatch.quests().synced, null, 8000) && await waitFor(B, () => window.__longWatch.quests() && window.__longWatch.quests().synced, null, 8000), "both pages have heard the room's notes");

  // 1. The same three notes everywhere, from the seed and the date.
  const sa = await qs(A), sb = await qs(B);
  const words = notes.map(n => noteText(n, (b) => b === n.beacon ? sa.text[2].replace(/^.* in the (.*) beacon$/, "$1") : "x"));
  ok(sa.day === DAY && sb.day === DAY && JSON.stringify(sa.notes) === JSON.stringify(notes) && JSON.stringify(sb.notes) === JSON.stringify(notes), `both pages show day ${DAY}'s three notes, the ones the code makes from the seed and the day`);
  ok(sa.panel && sb.panel && sa.lines.length === 3 && JSON.stringify(sa.lines) === JSON.stringify(sb.lines) && sa.lines.every(l => /of \d+, from 0 players/.test(l)), "the Keeper's notes panel is open with three lines, the same words on both pages, all at 0");
  ok(sa.text[0] === words[0] && sa.text[1] === words[1] && /^Burn \d+ fuel together in the (north|south)-(west|east) beacon$/.test(sa.text[2]), `the words: "${sa.text.join('"; "')}"`);
  await shoot(B, `${opts.shot}-before`);
  const idsA = await A.evaluate(() => window.__longWatch.self().id);

  // 2. Each note: A alone fills its own share and no more; the note is not done; B's few finish it, and both agree.
  for (let q = 0; q < 3; q++) {
    const n = notes[q], cap = n.need - 1;
    console.log(`  note ${q}: ${sa.text[q]}`);
    const got = await work(A, B, q, cap + 1, notes);
    ok(got === cap && (await qs(A)).own[q] === cap, `A does ${cap + 1} things for it and ${cap} count (the cap is need - 1 = ${cap})`);
    ok(await agree([A, B], q, cap, 1, false), `B sees ${cap} of ${n.need} from 1 player, not done (one player alone cannot finish a note)`);
    await waitFor(B, ([q, c]) => new RegExp(`${c} of`).test(window.__longWatch.quests().lines[q]), [q, cap], 3000);
    const bLine = (await qs(B)).lines[q];
    ok(/from 1 player\./.test(bLine) && !/^Done/.test(bLine) && new RegExp(`${cap} of ${n.need}`).test(bLine), `B's panel line reads "${bLine}"`);
    const gotB = await work(B, A, q, 1, notes, true);
    ok(gotB === 1, "B does one");
    ok(await agree([A, B], q, n.need, 2, true), `both see ${n.need} of ${n.need} from 2 players: done`);
    ok(await waitFor(A, (q) => /^Done: /.test(window.__longWatch.quests().lines[q]) && /finished/.test(window.__longWatch.quests().info), q, 4000) && await waitFor(B, (q) => /^Done: /.test(window.__longWatch.quests().lines[q]), q, 4000), "both panels say Done and the status line says the note is finished");
  }
  await shoot(A, `${opts.shot}-after`);
  const fin = await qs(A);
  ok(fin.done.every(Boolean), "all three notes are done on A");

  // 3. A late joiner is told where the notes stand.
  const C = await mk();
  await seedSave(C, url, PACK);
  await C.click("#enter");
  ok(await waitFor(C, () => window.__longWatch.peers().length === 2, null, opts.timeout) && await waitFor(C, () => window.__longWatch.quests() && window.__longWatch.quests().synced, null, 8000), "a third player joins and hears the notes");
  ok(await waitFor(C, (t) => JSON.stringify(window.__longWatch.quests().total) === t && window.__longWatch.quests().done.every(Boolean), JSON.stringify(fin.total), 8000), "C sees every note done with the same totals");

  // 4. A reloads and comes back: the share the others hold for A is taken up again, never counted twice
  await A.click("#leave"); await A.reload();
  await A.click("#enter");
  ok(await waitFor(A, () => window.__longWatch.peers().length === 2, null, opts.timeout) && await waitFor(A, () => window.__longWatch.quests() && window.__longWatch.quests().synced, null, 8000), "A reloads and re-enters");
  ok(await waitFor(A, (o) => JSON.stringify(window.__longWatch.quests().own) === o, JSON.stringify(fin.own), 8000), `A's own shares come back from the others (${fin.own.join(", ")}), not 0`);
  const again = await work(A, B, 1, 1, notes);
  ok(again === 0 && (await qs(A)).total.join() === fin.total.join(), "and a reloaded A cannot go past the cap or change the totals");

  // 5. A page on another day does not take part in today's notes
  const D = await mk();
  const url6 = `${base}${query}&day=${DAY + 1}#room=${room}`;
  await D.goto(url6); await D.click("#enter");
  ok(await waitFor(D, () => window.__longWatch.peers().length === 3, null, opts.timeout) && await waitFor(D, () => window.__longWatch.quests() && window.__longWatch.quests().synced, null, 8000), "a fourth page set to the next day joins the same lantern");
  await sleep(1500);
  const sd = await qs(D);
  ok(sd.day === DAY + 1 && JSON.stringify(sd.notes) === JSON.stringify(notesFor(world.seed, DAY + 1, 4)) && sd.total.every(t => t === 0) && sd.players.every(p => p === 0), "D has the next day's notes and none of today's progress");
  ok((await qs(A)).total.join() === fin.total.join(), "and today's totals on A are unchanged");

  // 6. Hostile messages (local run)
  if (opts.local) await forged(A, B, C, idsA, notes);
  for (const p of [A, B, C, D]) await p.context().close().catch(() => {});
}

// Hostile messages posted on the local channel as if they came from a player the pages know.
async function forged(A, B, C, idA, notes) {
  console.log("  hostile messages");
  // a fresh room so nothing is done yet
  const ctx = B.context();
  const E = await ctx.newPage();
  await E.goto(`${base}?net=local`);
  const post = (from, to, msgs) => E.evaluate(([room, from, to, msgs]) => { const ch = new BroadcastChannel(`vigil-long-watch:lantern-${room}`); for (const d of msgs) ch.postMessage({ k: "data", d, from, to }); ch.close(); }, [6, from, to, msgs]);
  const idB = await B.evaluate(() => window.__longWatch.self().id);
  const sig = async () => { const s = await qs(B); return JSON.stringify([s.total, s.players, s.done]); };
  const before = await sig();
  await post(idA, idB, [{ k: "qp", q: 9, d: DAY, n: 1 }, { k: "qp", q: 0, d: DAY, n: 99 }, { k: "qp", q: 0, d: DAY, n: 0 }, { k: "qp", q: 0, d: DAY, n: 1.5 }, { k: "qp", q: "0", d: DAY, n: 1 }, { k: "qp", q: 0, d: DAY, n: 1, x: 1 }, { k: "qp", q: 0, d: DAY }, { k: "qp", q: 0, d: DAY + 1, n: 1 }, { k: "qp", q: 0, d: "5", n: 1 }, { k: "qp", q: [0], d: DAY, n: [1] }, { k: "qs", d: DAY, q: [0], s: [77], n: [1], f: 1 }, { k: "qq", d: DAY, y: 1 }, "qp", 42]);
  await sleep(500);
  ok(await sig() === before, "B ignored out-of-range, fractional, text, array, extra-field and other-day messages and a snapshot nobody asked for");
  await post("stranger-never-said-hello", idB, [{ k: "qp", q: 0, d: DAY, n: 1 }]);
  await sleep(300);
  ok(await sig() === before, "a note message from someone who never said hello is ignored");
  await post(idA, idB, Array.from({ length: 500 }, (_, i) => ({ k: "qp", q: i % 3, d: DAY, n: 1 + (i % 8) })));
  await sleep(700);
  const s = await qs(B);
  ok(await sig() === before && s.done.every(Boolean), "a flood of 500 well-formed messages from A cannot raise A's shares past the cap, so nothing changes and B keeps working");
  await E.close();
}

// ---- 1. local ----
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 800 } });
  const mk = () => ctx.newPage().then(p => (watch(p, "local"), p));
  await scenario("local transport (BroadcastChannel)", mk, `?net=local&hour=${HOUR}`, 6, { local: true, shot: "quests-local" });
  await ctx.close();
}

// ---- 2. real WebRTC through a local Nostr relay ----
if (!onlyLocal) {
  const relay = await startRelay();
  const c = [await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true }), await browser.newContext({ viewport: { width: 1000, height: 800 } }), await browser.newContext({ viewport: { width: 800, height: 700 } })];
  let i = 0;
  const mk = () => c[i++ % 3].newPage().then(p => (watch(p, "webrtc"), p));
  await scenario("Trystero over Nostr + WebRTC (relay on 127.0.0.1)", mk, `?net=nostr&hour=${HOUR}&relay=${encodeURIComponent(relay.url)}`, 5, { timeout: 30000, shot: "quests-webrtc" });
  for (const x of c) await x.close().catch(() => {});
  relay.close();
}

ok(errors.length === 0, `no console errors${errors.length ? ":\n  " + errors.join("\n  ") : ""}`);
await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
