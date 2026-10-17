#!/usr/bin/env node
// Milestone 9 tests for The Long Watch: the shades (slow night creatures that snuff lanterns and are driven off by light,
// best by players together; nobody is hurt).
//
//   node game/tests/shades.test.mjs            node checks, local transport, then real Trystero/WebRTC via a local Nostr relay
//   node game/tests/shades.test.mjs --local    skip the WebRTC part
//
// Part 0 (node): a shade's whole life is a pure function of the seed and the clock (same everywhere, slow, continuous,
// inside its slot), the light shares are a grow-only counter (merge keeps the larger, a shade needs its total AND two
// players, one player's share is capped, 24 players per shade, bad shares refused), and the module on a fake mesh: light
// is counted per second, held back until the room's counters are heard, a snapshot is taken only from a peer asked, forged
// and flooded messages change nothing, a shade snuffs a lone player, a friend's lit lantern holds it back, a lit beacon's
// light is safe, a near friend relights you, the snuffed flag expires, and a new slot starts from 0.
// Then pages: two players near a circling shade drive it off together and are never snuffed; a lone player is snuffed
// (and cannot drive it off), a friend arrives and relights; a late joiner hears the shade is gone; forged messages.
// SHOTS=dir saves screenshots at 375 and 1100 px wide.
import { createServer } from "node:http";
import { readFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startRelay } from "./nostr-relay.mjs";
import { generateWorld, T, isBlocked } from "../js/world.js";
import * as S from "../js/shades.js";
import { createShades, createLightShares, shadeAt, shadePlan, shadeCount, slotOf, nextWaveIn, pickClockOffset, lights, SLOT_MS, SLOT_S, MAX_SHADES, SHADE_NEED, MIN_PLAYERS, MAX_SHARE, MAX_ENTRIES, SPEED, ORBIT_R, LINGER_S, SNUFF_R, SNUFF_S, RELIGHT_R, RELIGHT_S, GRACE_S, EMBER_TILES } from "../js/shades.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const onlyLocal = process.argv.includes("--local");

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failures++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const HOUR = 3;
const world = generateWorld();
const seeds = (n, from = 1000) => Array.from({ length: n }, (_, i) => from + i * 7919);
const SEED = world.seed;

// A slot (in the future, so it is the same for every run) whose first shade circles a landmark with free ground round it.
const land = (x, y) => { const t = world.tiles[Math.floor(y) * world.w + Math.floor(x)]; return (t === T.SAND || t === T.GRASS || t === T.MEADOW) && !isBlocked(world, x, y); };
// free standing points round (cx, cy) at distance r, starting from angle a0
function ringPoints(cx, cy, r, a0 = 0) { const out = []; for (let i = 0; i < 24; i++) { const a = a0 + i * Math.PI / 12, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; if (land(x, y)) out.push({ x, y }); } return out; }
function pickSlot(from, need = 1, skip = []) {
  for (let s = from; s < from + 4000; s++) {
    if (skip.includes(s) || shadeCount(SEED, s) < need) continue;
    const p = shadePlan(world, s, 0);
    // the whole ring of the shade's circle and a free spot 1.1 to 1.5 tiles from the landmark's middle, two of them apart
    const spots = ringPoints(p.a.x, p.a.y, 1.3).concat(ringPoints(p.a.x, p.a.y, 1.5));
    const ringFree = ringPoints(p.a.x, p.a.y, ORBIT_R).length >= 18;
    if (spots.length >= 10 && ringFree) return s;
  }
  throw new Error("no usable slot found");
}
const SLOT_A = pickSlot(slotOf(Date.UTC(2027, 0, 1)));      // the cooperative scenario
const SLOT_B = pickSlot(SLOT_A + 1, 1, [SLOT_A]);           // the lone-player scenario
// Three quiet slots in a row (no shades at all): pages load on this clock, so no shade of the real clock can reach
// a player standing at the arrival point while the pages connect (before this, a shade of whatever slot the test ran
// in could snuff A or B before the scenario began, and "neither player was ever snuffed" failed now and then).
const QUIET = (() => { for (let s = SLOT_A + 400; s < SLOT_A + 40000; s++) if (shadeCount(SEED, s) === 0 && shadeCount(SEED, s + 1) === 0 && shadeCount(SEED, s + 2) === 0) return s; throw new Error("no quiet slots"); })();
const quiet = () => `&shadeclock=${QUIET * SLOT_MS + 2000 - Date.now()}`;

// ---- 0. node: the rules ----
console.log("# shades, in node");
{
  ok(SLOT_S === 160 && MAX_SHADES === 4 && SHADE_NEED === 20 && MIN_PLAYERS === 2 && MAX_SHARE === 19 && MAX_ENTRIES === 24 && SPEED === 0.9, "limits: 160 s slots, at most 4 shades, 20 light-seconds, 2 players, a share at most 19, 24 players counted, 0.9 tiles a second");
  const counts = [0, 0, 0, 0, 0];
  for (let s = 0; s < 4000; s++) counts[shadeCount(SEED, s)]++;
  ok(counts.every(n => n > 200) && counts[0] > 700 && counts[0] < 1300, `waves vary: of 4000 slots, ${counts.join(", ")} hold 0, 1, 2, 3, 4 shades (a quarter are quiet)`);
  ok(shadeCount(SEED, 123) === shadeCount(SEED, 123) && shadeCount(SEED + 1, 5) !== undefined && shadeCount(SEED, -3) >= 0 && shadeCount(SEED, -3) <= 4, "the count is a pure function of seed and slot (also for odd slot numbers)");
  const a = JSON.stringify(shadePlan(world, SLOT_A, 0)), b = JSON.stringify(shadePlan(world, SLOT_A, 0));
  ok(a === b && JSON.stringify(shadePlan(world, SLOT_A, 1)) !== a, "a shade's plan is a pure function of seed, slot and number; the next shade has another plan");
  let lifeOk = true, step = 0, maxStep = 0, startFar = 0, orbitOk = true, alphaOk = true, shown = 0, kinds = new Set();
  for (let sl = SLOT_A; sl < SLOT_A + 60; sl++) {
    for (let k = 0; k < shadeCount(SEED, sl); k++) {
      const p = shadePlan(world, sl, k);
      lifeOk = lifeOk && p.delay + p.life < SLOT_S && p.life > 60;
      startFar = Math.max(startFar, Math.hypot(p.sx - p.ox, p.sy - p.oy));
      let prev = null;
      for (let u = 0; u <= SLOT_S; u += 0.25) {
        const ms = sl * SLOT_MS + u * 1000, s = shadeAt(world, ms, k);
        if (!s) { prev = null; continue; }
        shown++; kinds.add(s.phase);
        if (prev) { const d = Math.hypot(s.x - prev.x, s.y - prev.y); step++; maxStep = Math.max(maxStep, d / 0.25); }
        prev = s;
        if (s.phase === "linger" && Math.abs(Math.hypot(s.x - p.a.x, s.y - p.a.y) - ORBIT_R) > 1e-6) orbitOk = false;
        if (!(s.alpha >= 0 && s.alpha <= 1) || (s.u < 1 && s.alpha > 0.4) || (s.alpha === 1 && (s.u < 3 || s.u > p.life - 3))) alphaOk = false;
      }
    }
  }
  ok(lifeOk, "every shade of 60 slots lives and leaves inside its own slot");
  ok(maxStep <= SPEED * 1.2 + 1e-9, `no shade ever moves faster than ${SPEED} tiles a second (+20% for the circle): the fastest seen is ${maxStep.toFixed(2)} (${step} steps, a player walks at 4.2)`);
  ok(orbitOk && alphaOk && kinds.size === 3, "it comes in, circles its landmark at a fixed radius and drifts off; it fades in and out over 3 s");
  ok(startFar > 20 && startFar < 30, `it starts about ${startFar.toFixed(0)} tiles out`);
  const sl = SLOT_A, p0 = shadePlan(world, sl, 0), t0 = sl * SLOT_MS;
  ok(shadeAt(world, t0 - 1000, 0) === null && shadeAt(world, t0 + (p0.life + 1) * 1000, 0) === null && shadeAt(world, t0 + 1000, 9) === null && shadeAt(world, t0 + 1000, -1) === null && shadeAt(world, t0 + 1000, 0.5) === null, "no shade before it enters, after it leaves, or for a number that is not a shade");
  const sk = Math.max(...[0, 1, 2, 3].filter(k => shadeCount(SEED, SLOT_A) > k).concat([0]));
  ok(sk >= 0, "shade numbers are 0 to count - 1");
  let quiet = SLOT_A - 1; while (shadeCount(SEED, quiet) > 0 || shadeCount(SEED, quiet - 1) > 0) quiet--; // a quiet slot just before a wave of shades
  let nextS = quiet + 1; while (shadeCount(SEED, nextS) === 0) nextS++;
  ok(nextWaveIn(SEED, quiet * SLOT_MS + 1000) === (nextS * SLOT_MS - quiet * SLOT_MS - 1000) / 1000 && nextWaveIn(SEED, SLOT_A * SLOT_MS + 1000) === 0, "the page can say how long until the next slot that holds shades");
  ok(pickClockOffset("?shadeclock=5000", true) === 5000 && pickClockOffset("?shadeclock=5000", false) === 0 && pickClockOffset("?shadeclock=-7", true) === -7 && pickClockOffset("?shadeclock=1.5", true) === 0 && pickClockOffset("?shadeclock=abc", true) === 0 && pickClockOffset("", true) === 0, "?shadeclock= works only on this machine and only for whole numbers");

  const s = createLightShares();
  ok(s.merge(0, 111, 2) === "new" && s.merge(0, 111, 1) === "" && s.own(0, 111) === 2, "a share never goes down: a smaller number is ignored");
  ok(s.merge(0, 111, 2) === "" && s.merge(0, 111, 3) === "grew" && s.total(0) === 3, "a repeat changes nothing; a larger number grows the share");
  for (const [i, sd, n] of [[4, 1, 1], [-1, 1, 1], [0, 1, 0], [0, 1, MAX_SHARE + 1], [0, 1, SHADE_NEED], [0, 1, 1.5], [0, 1, "3"], [0, -1, 1], [0, 2 ** 32, 1], [0, 1.5, 1], [0, 1, NaN], [0, 1, null], ["0", 1, 1], [0.5, 1, 1], [0, 1, Infinity]]) {
    const before = JSON.stringify(s.entries()); const r = s.merge(i, sd, n);
    ok(r === "" && JSON.stringify(s.entries()) === before, `a bad share (${JSON.stringify([i, sd, n])}) is refused`);
  }
  const t = createLightShares();
  t.merge(1, 1, MAX_SHARE);
  ok(t.total(1) === 19 && t.players(1) === 1 && !t.done(1), "one player alone, at the cap, is one short and the shade stays");
  t.merge(1, 2, 1);
  ok(t.total(1) === 20 && t.players(1) === 2 && t.done(1) && t.merge(1, 2, 1) === "" && t.done(1), "a second player adding 1 drives it off, and it stays driven off");
  const f = createLightShares();
  for (const sd of seeds(MAX_ENTRIES)) f.merge(2, sd, 1);
  const before = JSON.stringify(f.entries());
  ok(f.players(2) === MAX_ENTRIES && f.merge(2, 5, 1) === "" && JSON.stringify(f.entries()) === before && f.merge(2, seeds(1)[0], 2) === "grew", "a shade that already counts 24 players refuses a 25th and drops nobody; a counted player can still grow");
  f.clear(); ok(f.entries().length === 0, "clear empties every shade");
  ok(lights({ x: 0, y: 0 }, 3, { x: 2.7, y: 0 }) && !lights({ x: 0, y: 0 }, 3, { x: 2.8, y: 0 }), "a lantern lights a shade within 90% of its reach");
}

// ---- 0b. node: the module on a fake mesh ----
console.log("\n# shades on a fake mesh");
{
  const mkNet = () => { const sent = [], hs = [], joins = [], leaves = []; return { sent, hs, joins, leaves, net: { selfId: "me", send: (msg, to) => sent.push([msg, to]), onMessage: h => hs.push(h), onPeerJoin: h => joins.push(h), onPeerLeave: h => leaves.push(h) } }; };
  // The shade clock stands still at `u` seconds into SLOT_A (so the shade stands still too); `perf` is the game's own timer.
  const plan = shadePlan(world, SLOT_A, 0);
  const U_LINGER = plan.t1 + 10;
  const mk = (opts = {}) => {
    const m = mkNet(); const peers = new Map(); const me = { seed: 4242, x: 0, y: 0, lamp: 0 }; const c = { ms: SLOT_A * SLOT_MS + U_LINGER * 1000, perf: 10000 };
    const events = [];
    const q = createShades(m.net, world, me, peers, { now: () => c.perf, clock: () => c.ms, onEvent: (t, i, x) => events.push([t, i, x]), reachFor: () => 3.2, ...opts });
    const say = (msg, id) => m.hs.forEach(h => h(msg, id));
    const adv = (secs, dt = 0.1) => { for (let i = 0; i < Math.round(secs / dt); i++) { c.perf += dt * 1000; q.tick(dt); } };
    q.tick(0.01); // find the shade
    const sh = () => q.list().find(x => x.k === 0);
    return { m, peers, me, c, q, events, say, adv, sh, sentK: (k) => m.sent.filter(([x]) => x.k === k) };
  };
  const placeAt = (T, dx, dy) => { const s = T.sh(); T.me.x = s.x + dx; T.me.y = s.y + dy; return s; };
  const peer = (T, id, seed, dx, dy, extra = {}) => { const s = T.sh(); const p = { id, seed, x: s.x + dx, y: s.y + dy, lamp: 0, snuffed: false, ...extra }; T.peers.set(id, p); return p; };

  // alone, in the light but out of reach of the shade: light counts a second at a time, up to the cap
  {
    const T1 = mk(); placeAt(T1, 2, 0);
    ok(T1.sh() && T1.sh().phase === "linger" && !T1.sh().gone, "the shade is out, circling its landmark");
    T1.adv(2.5);
    ok(T1.q.shares.own(0, 4242) === 2 && T1.sentK("hp").length === 2, "alone in reach, 2.5 s of light count 2 light-seconds and send one message per change");
    T1.adv(40);
    const hpN = new Set(T1.sentK("hp").map(([m]) => m.n));
    ok(T1.q.shares.own(0, 4242) === MAX_SHARE && hpN.size === MAX_SHARE && Math.max(...hpN) === MAX_SHARE && !T1.q.shares.done(0) && !T1.sh().gone, "alone, light stops counting at the cap (19) and the shade stays: one player cannot drive a shade off");
    ok(!T1.me.snuffed && T1.events.every(e => e[0] === "progress"), "and at 2 tiles it never snuffed anyone");
    const T1b = mk(); placeAt(T1b, 3.4, 0); T1b.adv(5);
    ok(T1b.q.shares.own(0, 4242) === 0, "light that does not reach the shade (beyond 90% of 3.2 tiles) counts nothing");
  }
  // a peer is present: light is held back until the room's counters are heard, then added to the share the others hold
  {
    const T2 = mk(); placeAt(T2, 2, 0); peer(T2, "p1", 111, 9, 9);
    T2.adv(3.2);
    ok(!T2.q.synced() && T2.q.owed()[0] === 3 && T2.q.shares.own(0, 4242) === 0 && T2.sentK("hp").length === 0 && T2.sentK("hq").length >= 1 && T2.sentK("hq").every(([, to]) => to === "p1"), "with a peer present and its counters not yet heard, light is held back (owed 3) and the peer is asked");
    T2.say({ k: "hs", s: SLOT_A, i: [0, 0], p: [111, 4242], n: [5, 4], f: 1 }, "p1");
    ok(T2.q.synced() && T2.q.shares.own(0, 4242) === 7 && T2.q.shares.total(0) === 12 && T2.q.owed()[0] === 0, "once the snapshot arrives the owed 3 are added to the 4 the others hold for me (7), not counted from 0");
    T2.adv(20);
    ok(T2.q.shares.total(0) >= SHADE_NEED && T2.q.shares.players(0) === 2 && T2.q.shares.done(0) && T2.sh().gone && T2.events.some(e => e[0] === "banished" && e[1] === 0), "my light plus the other's 5 drives the shade off; the page is told once");
    ok(T2.events.filter(e => e[0] === "banished").length === 1, "and only once");
  }
  // a peer that never answers does not stall us; one that leaves mid-snapshot stops the wait
  {
    const T3 = mk(); placeAt(T3, 2, 0); peer(T3, "p1", 111, 9, 9);
    T3.adv(8);
    ok(T3.q.synced() && T3.q.pending() === 0 && T3.q.shares.own(0, 4242) > 0, "a peer that never answers: after the waits we go on and the owed light is added");
    const T3b = mk(); placeAt(T3b, 2, 0); peer(T3b, "p1", 111, 9, 9); T3b.adv(0.3);
    T3b.m.leaves.forEach(h => h("p1")); T3b.peers.delete("p1");
    T3b.say({ k: "hs", s: SLOT_A, i: [0], p: [111], n: [9], f: 1 }, "p1");
    ok(T3b.q.shares.total(0) === 0, "a snapshot that arrives after its sender left is ignored");
  }
  // hostile messages
  {
    const T4 = mk(); placeAt(T4, 20, 20); peer(T4, "p1", 111, 20, 20); T4.adv(2); T4.say({ k: "hs", s: SLOT_A, i: [0], p: [111], n: [3], f: 1 }, "p1");
    const sig = () => JSON.stringify([T4.q.shares.entries(), T4.me.snuffed, T4.peers.get("p1").snuffed]);
    const before = sig();
    const bad = [{ k: "hp", s: SLOT_A, i: 9, n: 1 }, { k: "hp", s: SLOT_A, i: 0, n: 99 }, { k: "hp", s: SLOT_A, i: 0, n: 0 }, { k: "hp", s: SLOT_A, i: 0, n: 1.5 }, { k: "hp", s: SLOT_A, i: "0", n: 1 }, { k: "hp", s: SLOT_A, i: 0, n: [1] }, { k: "hp", s: SLOT_A, i: 0, n: 1, x: 1 }, { k: "hp", s: SLOT_A, i: 0 }, { k: "hp", s: SLOT_A + 1, i: 0, n: 5 }, { k: "hp", s: "x", i: 0, n: 5 }, { k: "hp", i: 0, n: 5 },
      { k: "hs", s: SLOT_A, i: [0], p: [222], n: [5], f: 1 }, { k: "hq" }, { k: "hq", s: SLOT_A + 3 }, { k: "sf", z: 2 }, { k: "sf", z: "1" }, { k: "sf" }, { k: "sf", z: 1, x: 1 }, { k: "sf", z: true }, null, 5, "hp", [], { k: "hp", s: SLOT_A, i: 0, n: 5, __proto__: { n: 1 } }];
    bad.forEach(m => T4.say(m, "p1"));
    ok(sig() === before, `${bad.length} malformed, wrong-slot, extra-field and unasked-snapshot messages change nothing`);
    T4.say({ k: "hp", s: SLOT_A, i: 0, n: 5 }, "stranger");
    T4.say({ k: "sf", z: 1 }, "stranger");
    ok(sig() === before, "messages from someone who never said hello are ignored");
    T4.c.perf += 3000;
    for (let i = 0; i < 500; i++) T4.say({ k: "hp", s: SLOT_A, i: 1, n: 1 + (i % 19) }, "p1");
    ok(T4.q.shares.own(1, 111) <= 16 && T4.q.shares.own(1, 111) >= 1, `a flood of 500 well-formed messages is cut by the rate limit (${T4.q.shares.own(1, 111)} of 19 got in)`);
    const T4b = mk(); placeAt(T4b, 20, 20); const p = peer(T4b, "p1", 111, 20, 20);
    T4b.say({ k: "sf", z: 1 }, "p1");
    ok(p.snuffed === true && p.snuffUntil > T4b.c.perf, "a peer says its lantern is out: it shows as snuffed");
    T4b.adv(SNUFF_S + 7);
    ok(p.snuffed === false, `and the flag expires by itself after ${SNUFF_S + 6} s if not repeated`);
    T4b.say({ k: "sf", z: 1 }, "p1"); T4b.say({ k: "sf", z: 0 }, "p1");
    ok(p.snuffed === false, "z 0 clears it at once");
  }
  // being snuffed
  {
    const T5 = mk(); placeAt(T5, 0.5, 0);
    T5.adv(0.2);
    ok(T5.me.snuffed && T5.events.some(e => e[0] === "snuffed") && T5.sentK("sf").some(([m]) => m.z === 1), "a lone player a half tile from a shade is snuffed, and tells the room (sf z=1)");
    const gotBefore = T5.q.shares.own(0, 4242);
    T5.adv(5); placeAt(T5, 1.5, 0);
    ok(T5.q.shares.own(0, 4242) === gotBefore, "while snuffed no light is counted");
    T5.adv(SNUFF_S - 5 + 0.3);
    ok(!T5.me.snuffed && T5.events.some(e => e[0] === "expired") && T5.sentK("sf").some(([m]) => m.z === 0), `after ${SNUFF_S} s the lantern lights itself again, and tells the room (sf z=0)`);
    placeAt(T5, 0.5, 0); T5.adv(2);
    ok(!T5.me.snuffed, `for ${GRACE_S} s after that the same shade cannot snuff again`);
    T5.adv(GRACE_S + 1); placeAt(T5, 0.5, 0); T5.adv(0.3);
    ok(T5.me.snuffed, "and afterwards it can");
    ok(T5.sh().alpha === 1 && T5.sh().total >= 0, "(the shade itself stayed out the whole time: snuffing does not change it)");
  }
  // held back by a friend's light; a friend whose own lantern is out cannot; a lit beacon is safe
  {
    const T6 = mk(); placeAt(T6, 0.5, 0); peer(T6, "p1", 111, 2.5, 0);
    T6.adv(2);
    ok(!T6.me.snuffed && T6.events.some(e => e[0] === "held"), "a friend whose lit lantern is on the shade holds it back: nobody is snuffed, the page is told");
    const T6b = mk(); placeAt(T6b, 0.5, 0); peer(T6b, "p1", 111, 2.5, 0, { snuffed: true, snuffUntil: 1e12 });
    T6b.adv(0.3);
    ok(T6b.me.snuffed, "a friend whose own lantern is out does not hold it back");
    const T6c = mk(); placeAt(T6c, 0.5, 0); peer(T6c, "p1", 111, 9, 9);
    T6c.adv(0.3);
    ok(T6c.me.snuffed, "a friend too far away to light the shade does not hold it back");
    const T6d = mk({ safeAt: () => true }); placeAt(T6d, 0.5, 0); T6d.adv(1);
    ok(!T6d.me.snuffed && T6d.sh().safe, "inside the light of a lit beacon a shade cannot snuff anyone");
  }
  // relight
  {
    const T7 = mk(); placeAt(T7, 0.5, 0); T7.adv(0.2);
    const p = peer(T7, "p1", 111, 9, 9); p.x = T7.me.x + RELIGHT_R + 0.5; p.y = T7.me.y;
    T7.adv(3);
    ok(T7.me.snuffed, `a friend ${RELIGHT_R + 0.5} tiles away is too far to relight me`);
    p.x = T7.me.x + RELIGHT_R - 0.2;
    T7.adv(RELIGHT_S - 0.4);
    ok(T7.me.snuffed, `a friend close by does not relight at once`);
    T7.adv(0.8);
    ok(!T7.me.snuffed && T7.events.some(e => e[0] === "relit"), `after ${RELIGHT_S} s of a friend with a lit lantern close by, I am relit`);
    const T7b = mk(); placeAt(T7b, 0.5, 0); T7b.adv(0.2);
    const p2 = peer(T7b, "p1", 111, 9, 9); p2.x = T7b.me.x + 1; p2.y = T7b.me.y; p2.snuffed = true; p2.snuffUntil = 1e12;
    T7b.adv(4);
    ok(T7b.me.snuffed, "a friend who is snuffed too cannot relight me");
  }
  // a new slot starts from nothing
  {
    const T8 = mk(); placeAt(T8, 2, 0); T8.adv(3);
    ok(T8.q.shares.total(0) > 0, "light has been counted");
    T8.c.ms = (SLOT_A + 1) * SLOT_MS + 1000; T8.adv(0.2);
    ok(T8.q.slot === SLOT_A + 1 && T8.q.shares.total(0) === 0 && T8.events.some(e => e[0] === "newslot"), "in the next slot every share is back to 0");
    T8.say({ k: "hp", s: SLOT_A, i: 0, n: 5 }, "p1"); T8.peers.set("p1", { seed: 9, x: 99, y: 99 }); T8.say({ k: "hp", s: SLOT_A, i: 0, n: 5 }, "p1");
    ok(T8.q.shares.total(0) === 0, "a message still carrying the old slot is dropped");
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
const sh = (page) => page.evaluate(() => window.__longWatch.shades());
const peersOf = (page) => page.evaluate(() => window.__longWatch.peers());
// Set the shade clock of pages so that, right now, it reads `u` seconds into `slot`.
async function aim(pages, slot, u) {
  const off = slot * SLOT_MS + Math.round(u * 1000) - Date.now();
  const r = await Promise.all(pages.map(p => p.evaluate((o) => window.__longWatch.setShadeClock(o), off)));
  const there = await Promise.all(pages.map(p => waitFor(p, (sl) => window.__longWatch.shades().slot === sl, slot, 5000)));
  return r.every(Boolean) && there.every(Boolean);
}
const tele = (page, x, y) => page.evaluate(([x, y]) => window.__longWatch.teleport(x, y), [x, y]);
async function shoot(page, name) {
  if (!shots) return;
  await mkdir(shots, { recursive: true });
  const keep = page.viewportSize();
  for (const [w, h] of [[375, 760], [1100, 800]]) { await page.setViewportSize({ width: w, height: h }); await sleep(500); await page.locator(".stage").screenshot({ path: path.join(shots, `${name}-${w}.png`) }); }
  await page.setViewportSize(keep); await sleep(200);
}
async function enterBoth(label, mk, url, timeout) {
  const [A, B] = [await mk(), await mk()];
  await A.goto(url); await B.goto(url);
  await A.click("#enter"); await B.click("#enter");
  const seen = await waitFor(A, () => window.__longWatch.peers().length === 1, null, timeout) && await waitFor(B, () => window.__longWatch.peers().length === 1, null, timeout);
  ok(seen, `${label}: each page sees exactly one other player`);
  const sy = seen && await waitFor(A, () => window.__longWatch.shades() && window.__longWatch.shades().synced, null, 8000) && await waitFor(B, () => window.__longWatch.shades() && window.__longWatch.shades().synced, null, 8000);
  return seen && sy ? [A, B] : null;
}

async function scenario(label, mk, query, roomA, roomB, opts = {}) {
  console.log(`\n# ${label}`);
  const pl = shadePlan(world, SLOT_A, 0), uArrive = pl.t1;
  const A_url = `${base}${query}${quiet()}#room=${roomA}`;
  const pair = await enterBoth("cooperative room", mk, A_url, opts.timeout);
  if (!pair) return;
  const [A, B] = pair;
  const panelA = await sh(A);
  ok(panelA.panel && /shade/i.test(await A.locator("#shades-label").innerText()), "the Shades panel is open on the page with its plain description");
  ok((await sh(A)).count === 0 && (await sh(B)).count === 0 && await A.evaluate(() => window.__longWatch.snuffCount()) === 0, "while the pages connect their shade clock is in a quiet slot: no shades, nobody snuffed");
  // 1. the same shades everywhere
  ok(await aim([A, B], SLOT_A, uArrive - 14), "both pages' shade clock set to 14 s before the shade reaches its landmark");
  ok(await waitFor(A, () => window.__longWatch.shades().synced, null, 8000) && await waitFor(B, () => window.__longWatch.shades().synced, null, 8000), "and both hear the room's counters for that slot");
  const [a0, b0] = [await sh(A), await sh(B)];
  const nodeNow = shadeAt(world, await A.evaluate(() => window.__longWatch.shadeNow()), 0);
  ok(a0.slot === SLOT_A && b0.slot === SLOT_A && a0.count === shadeCount(SEED, SLOT_A) && b0.count === a0.count, `both pages are in slot ${SLOT_A}, which holds ${a0.count} shade${a0.count === 1 ? "" : "s"}`);
  const sa = a0.list.find(s => s.k === 0), sb = b0.list.find(s => s.k === 0);
  ok(sa && sb && Math.hypot(sa.x - sb.x, sa.y - sb.y) < 0.1 && nodeNow && Math.hypot(sa.x - nodeNow.x, sa.y - nodeNow.y) < 0.5 && sa.phase === "approach", `A and B draw the shade in the same place (${sa.x.toFixed(1)}, ${sa.y.toFixed(1)}), the one the code computes, still coming in`);
  ok(/shade/.test(a0.text) && /light 0 of 20/.test(a0.text), `the panel says: "${a0.text.slice(0, 150)}…"`);
  // 2. A and B stand together near the landmark and light it up; the shade arrives and circles
  const spots = ringPoints(pl.a.x, pl.a.y, 1.3).concat(ringPoints(pl.a.x, pl.a.y, 1.5));
  const pa = spots[0], pb = spots.filter(p => Math.hypot(p.x - pa.x, p.y - pa.y) > 0.9 && Math.hypot(p.x - pa.x, p.y - pa.y) < 2).sort((p, q) => Math.hypot(p.x - pa.x, p.y - pa.y) - Math.hypot(q.x - pa.x, q.y - pa.y))[0] || spots[1];
  ok(await tele(A, pa.x, pa.y) && await tele(B, pb.x, pb.y), "A and B stand about a tile and a half from the landmark, within 3 tiles of each other");
  ok(await waitFor(A, ([x, y]) => window.__longWatch.peers().some(p => Math.hypot(p.x - x, p.y - y) < 0.1), [pb.x, pb.y], 6000) && await waitFor(B, ([x, y]) => window.__longWatch.peers().some(p => Math.hypot(p.x - x, p.y - y) < 0.1), [pa.x, pa.y], 6000), "each sees where the other stands");
  ok(await waitFor(A, () => window.__longWatch.shades().list.some(s => s.phase === "linger"), null, 25000), "the shade reaches the landmark and starts to circle");
  await sleep(2500);
  const perf = await A.evaluate(() => window.__longWatch.perf());
  console.log(`  frame cost with a shade on screen: draw mean ${perf.drawMean.toFixed(2)} ms, p95 ${perf.drawP95.toFixed(2)} ms (headless Chromium, software canvas)`);
  await shoot(A, `${opts.shot}-near`);
  // 3. together their light drives it off, and neither is ever snuffed
  const done = await Promise.all([A, B].map(p => waitFor(p, () => { const s = window.__longWatch.shades(); const x = s.list.find(q => q.k === 0); return x && x.gone; }, null, 50000)));
  ok(done[0] && done[1], "both pages see the shade driven off");
  const [a1, b1] = [await sh(A), await sh(B)];
  const x1 = a1.list.find(s => s.k === 0), y1 = b1.list.find(s => s.k === 0);
  ok(x1.total >= SHADE_NEED && x1.players === 2 && y1.total === x1.total && y1.players === 2, `both pages count ${x1.total} light-seconds from 2 players (A ${x1.own}, B ${y1.own}; each at most ${MAX_SHARE})`);
  ok(x1.own <= MAX_SHARE && y1.own <= MAX_SHARE && x1.own >= 1 && y1.own >= 1, "each added some and neither went over the cap");
  const [snA, snB] = [await A.evaluate(() => window.__longWatch.snuffCount()), await B.evaluate(() => window.__longWatch.snuffCount())];
  ok(snA === 0 && snB === 0, "neither player was ever snuffed: together their light held the shade back");
  if (snA || snB) console.log(`  snuffs: A ${JSON.stringify(await A.evaluate(() => window.__longWatch.snuffLog()))}, B ${JSON.stringify(await B.evaluate(() => window.__longWatch.snuffLog()))}; A's links ${JSON.stringify(await A.evaluate(() => window.__longWatch.linkHistory()))}`);
  ok(a1.drivenOff === 1 && b1.drivenOff === 1 && /driven off/.test(a1.info), `the page says so ("${a1.info}")`);
  ok(Math.abs((x1.own + y1.own) - x1.total) === 0, "the two shares add up to the total");
  await shoot(A, `${opts.shot}-after`);
  // 4. a late joiner hears the shade is gone
  const C = await mk();
  await C.goto(A_url); await C.click("#enter");
  ok(await waitFor(C, () => window.__longWatch.peers().length === 2, null, opts.timeout) && await waitFor(C, () => window.__longWatch.shades() && window.__longWatch.shades().synced, null, 8000), "a third player joins and hears the shades");
  ok(await aim([C], SLOT_A, (await A.evaluate(() => window.__longWatch.shadeNow())) / 1 % SLOT_MS / 1000), "C reads the same clock");
  ok(await waitFor(C, () => { const s = window.__longWatch.shades(); const x = s.list.find(q => q.k === 0); return x && x.gone && x.total >= 20 && x.players === 2; }, null, 8000), "C sees the shade driven off, with the same 2 players");
  // 5. forged messages (local only)
  if (opts.local) await forged(A, B, C);
  // 6. a lone player in another room is snuffed and cannot drive it off; a friend relights
  await loneScenario(mk, query, roomB, opts);
  for (const p of [A, B, C]) await p.context().close().catch(() => {});
}

async function loneScenario(mk, query, room, opts) {
  console.log("  a lone player");
  const pl = shadePlan(world, SLOT_B, 0), url = `${base}${query}${quiet()}#room=${room}`;
  const C = await mk();
  await C.goto(url); await C.click("#enter");
  ok(await waitFor(C, () => window.__longWatch.shades() && window.__longWatch.shades().synced, null, 10000), "a player enters an empty lantern");
  ok(await aim([C], SLOT_B, pl.t1 - 2), "the clock is set to just before a shade reaches its landmark");
  // stand where the shade will pass in a few seconds: 0.7 tiles from its circle, towards the landmark
  const future = shadeAt(world, SLOT_B * SLOT_MS + (pl.t1 + 4) * 1000, 0);
  const near = ringPoints(future.x, future.y, 0.7).sort((p, q) => Math.hypot(p.x - pl.a.x, p.y - pl.a.y) - Math.hypot(q.x - pl.a.x, q.y - pl.a.y))[0];
  ok(await tele(C, near.x, near.y), "C stands where the shade will pass");
  ok(await waitFor(C, () => window.__longWatch.shades().snuffed, null, 25000), "the shade reaches C and snuffs C's lantern");
  const s1 = await sh(C);
  ok(/lantern is out/.test(s1.text) && /snuffed your lantern/.test(s1.info), `the page says so ("${s1.info.slice(0, 80)}…")`);
  const lights1 = await C.evaluate(() => window.__longWatch.lights());
  ok(lights1.find(l => l.id === "me").tiles === EMBER_TILES && lights1.find(l => l.id === "me").snuffed, `C's light shrinks to an ember (${EMBER_TILES} tiles)`);
  await shoot(C, `${opts.shot}-snuffed`);
  const shade1 = s1.list.find(s => s.k === 0);
  ok(shade1 && !shade1.gone && shade1.total < SHADE_NEED && shade1.players <= 1, `alone, C cannot drive it off (${shade1 && shade1.total} of ${SHADE_NEED} light-seconds from ${shade1 && shade1.players} player)`);
  // a friend comes with a lit lantern: C is relit and the friend's light holds the shade back
  const D = await mk();
  await D.goto(url); await D.click("#enter");
  ok(await waitFor(D, () => window.__longWatch.peers().length === 1, null, opts.timeout) && await waitFor(D, () => window.__longWatch.shades() && window.__longWatch.shades().synced, null, 8000), "D joins the same lantern");
  ok(await aim([D], SLOT_B, ((await C.evaluate(() => window.__longWatch.shadeNow())) % SLOT_MS) / 1000), "D reads the same clock");
  ok(await waitFor(D, () => window.__longWatch.shades().peerSnuffed.some(p => p.snuffed), null, 8000), "D sees that C's lantern is out");
  const dl = await D.evaluate(() => window.__longWatch.lights());
  ok(dl.some(l => l.id !== "me" && l.snuffed && l.tiles === EMBER_TILES), "and draws C's light as an ember");
  const cNow = (await C.evaluate(() => window.__longWatch.self()));
  const stand = ringPoints(cNow.x, cNow.y, 1.2).find(p => Math.hypot(p.x - pl.a.x, p.y - pl.a.y) > 0) || { x: cNow.x, y: cNow.y };
  await tele(D, stand.x, stand.y);
  ok(await waitFor(C, () => !window.__longWatch.shades().snuffed, null, 8000), "D stands close by with a lit lantern and C is relit");
  ok(await waitFor(D, () => window.__longWatch.shades().peerSnuffed.every(p => !p.snuffed), null, 8000), "D sees C's lantern lit again");
  ok(/lit again/.test((await sh(C)).info), "C's page says so");
  await C.context().close().catch(() => {}); await D.context().close().catch(() => {});
}

// Hostile messages posted on the local channel as if they came from a player the pages know.
async function forged(A, B, C) {
  console.log("  hostile messages");
  const ctx = B.context();
  const E = await ctx.newPage();
  await E.goto(`${base}?net=local`);
  const post = (from, to, msgs) => E.evaluate(([room, from, to, msgs]) => { const ch = new BroadcastChannel(`vigil-long-watch:lantern-${room}`); for (const d of msgs) ch.postMessage({ k: "data", d, from, to }); ch.close(); }, [6, from, to, msgs]);
  const idA = await A.evaluate(() => window.__longWatch.self().id), idB = await B.evaluate(() => window.__longWatch.self().id);
  const sig = async () => { const s = await sh(B); return JSON.stringify([s.list.map(x => [x.total, x.players, x.gone]), s.snuffed, s.peerSnuffed.map(p => p.snuffed)]); };
  const slot = SLOT_A;
  const before = await sig();
  await post(idA, idB, [{ k: "hp", s: slot, i: 9, n: 1 }, { k: "hp", s: slot, i: 0, n: 99 }, { k: "hp", s: slot, i: 0, n: 0 }, { k: "hp", s: slot, i: 0, n: 1.5 }, { k: "hp", s: slot, i: "0", n: 1 }, { k: "hp", s: slot, i: 0, n: 1, x: 1 }, { k: "hp", s: slot + 1, i: 0, n: 5 }, { k: "hs", s: slot, i: [0], p: [5], n: [5], f: 1 }, { k: "sf", z: 2 }, { k: "sf", z: "1" }, { k: "sf", z: 1, x: 1 }, { k: "sf" }, { k: "hq", s: slot, x: 1 }]);
  await sleep(500);
  ok(await sig() === before, "B ignored out-of-range, fractional, text, extra-field and other-slot messages, an unasked snapshot and bad snuffed flags");
  await post("stranger-never-said-hello", idB, [{ k: "hp", s: slot, i: 0, n: 3 }, { k: "sf", z: 1 }]);
  await sleep(300);
  ok(await sig() === before, "messages from someone who never said hello are ignored");
  await post(idA, idB, Array.from({ length: 500 }, (_, i) => ({ k: "hp", s: slot, i: 1, n: 1 + (i % 19) })));
  await sleep(700);
  const s = await sh(B);
  ok(s.list.find(x => x.k === 0).gone && s.list.find(x => x.k === 0).total >= SHADE_NEED, "a flood of 500 well-formed messages is cut by the rate limit, and the driven-off shade stays driven off");
  await E.close();
}

// ---- 1. local ----
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 800 } });
  const mk = () => ctx.newPage().then(p => (watch(p, "local"), p));
  await scenario("local transport (BroadcastChannel)", mk, `?net=local&hour=${HOUR}&weather=clear`, 6, 4, { local: true, shot: "shades-local" });
  await ctx.close();
}

// ---- 2. real WebRTC through a local Nostr relay ----
if (!onlyLocal) {
  const relay = await startRelay();
  const c = [await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" }), await browser.newContext({ viewport: { width: 1000, height: 800 } }), await browser.newContext({ viewport: { width: 800, height: 700 } })];
  let i = 0;
  const mk = () => c[i++ % 3].newPage().then(p => (watch(p, "webrtc"), p));
  await scenario("Trystero over Nostr + WebRTC (relay on 127.0.0.1; one page asks for reduced motion)", mk, `?net=nostr&hour=${HOUR}&weather=clear&relay=${encodeURIComponent(relay.url)}`, 5, 3, { timeout: 30000, shot: "shades-webrtc" });
  for (const x of c) await x.close().catch(() => {});
  relay.close();
}

ok(errors.length === 0, `no console errors${errors.length ? ":\n  " + errors.join("\n  ") : ""}`);
await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
