// Shades: slow creatures of the night that put out lanterns and are driven off by light, best by players together.
// Nobody is hurt: a shade only snuffs a lantern for a few seconds, and a nearby player's light brings it back.
//
// Where a shade is needs no messages at all: its whole life is a pure function of the island's seed and the UTC
// clock (a "slot" of 160 s holds a wave of 0 to 4 shades; each one drifts in from the sea to an island landmark,
// circles it slowly, then drifts off toward another). Every browser reads the same clock, so everyone sees the same
// shades in the same places.
//
// What players share is how much light has been put on each shade. Every player counts the seconds their own lit
// lantern reached a shade (grow-only counter per player per shade, like the beacons' fuel and the keeper's notes):
// merging keeps the larger number. A shade is driven off when the light-seconds add up to SHADE_NEED and at least
// MIN_PLAYERS different players added some; one player's share is capped at SHADE_NEED - 1, so no one can drive a
// shade off alone. A driven-off shade is gone for the rest of its slot.
//
// Being snuffed (decided by your own browser alone about yourself): if a shade reaches you (SNUFF_R tiles) your lantern
// shrinks to an ember for SNUFF_S seconds, unless another player whose lantern is lit has their light on that shade
// (then it is held back and nothing happens), or you stand inside the light of a lit beacon. A snuffed player is relit
// early when a player with a lit lantern stays within RELIGHT_R tiles for RELIGHT_S seconds, then cannot be snuffed again
// for GRACE_S seconds. Nothing is lost: no item, no progress.
//
// Messages (numbers only, never text):
//   { k:"sf", z }                       my lantern is snuffed (1) or lit (0); sent on change, to each newcomer, every 5 s
//   { k:"hp", s, i, n }                 my own total light-seconds on shade i (0..3) of slot s
//   { k:"hq", s }                       newcomer -> a peer: "send me the shares you know for slot s"
//   { k:"hs", s, i:[..], p:[..], n:[..], f }   up to 10 shares; f=1 on the last chunk
// A receiver checks: sender said hello, exact fields, whole numbers in range, the same slot as its own, at most 8 a
// second per sender, and "hs" only from a peer it asked and whose snapshot has not finished. A snuffed flag expires
// by itself (SNUFF_S + 6 s after the last one heard), so a silent or lying peer cannot keep anyone dark.
import { createGuard } from "./guard.js";
import { isSeed } from "./names.js";
import { hash3 } from "./world.js";

export const SLOT_S = 160;
export const SLOT_MS = SLOT_S * 1000;
export const MAX_SHADES = 4;          // at most this many in one slot
export const SHADE_NEED = 20;         // light-seconds that drive a shade off
export const MIN_PLAYERS = 2;
export const MAX_SHARE = SHADE_NEED - 1;
export const MAX_ENTRIES = 24;        // shares kept per shade; a full list refuses new players, it never drops one
export const SPEED = 0.9;             // tiles per second (a player walks at 4.2)
export const LINGER_S = 55, LEAVE_S = 35, FADE_S = 3, STAGGER_S = 12, ORBIT_R = 1.8;
export const SNUFF_R = 1.0, SNUFF_S = 14, RELIGHT_R = 2.5, RELIGHT_S = 1.5, GRACE_S = 6;
export const EMBER_TILES = 0.9;       // how far a snuffed lantern still glows
export const LIGHT_FRACTION = 0.9;    // a lantern lights a shade within this share of its reach
export const SAFE_FRACTION = 0.9;     // inside this share of a lit beacon's radius a shade cannot snuff anyone
export const HELP_S = 0.9;            // seconds beside a snuffed friend before their early relight counts as my help
export const RESEND_MS = 5000;
export const SYNC_WAIT_MS = 1500;
const CHUNK = 10;
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const TAU = Math.PI * 2;

export const slotOf = (ms) => Math.floor(ms / SLOT_MS);
export function pickClockOffset(search, onLoopback) { // ?shadeclock=N (milliseconds added to the clock), tests only, loopback pages only
  if (!onLoopback) return 0;
  const raw = new URLSearchParams(search).get("shadeclock");
  if (raw === null || !/^-?\d{1,13}$/.test(raw)) return 0;
  return Number(raw);
}

// How many shades slot s holds: a quarter of the slots are quiet, the rest hold 1 to MAX_SHADES.
export function shadeCount(seed, slot) {
  const r = hash3(((slot % 65536) + 65536) % 65536, 7, seed + 2027);
  if (r < 0.25) return 0;
  return Math.min(MAX_SHADES, 1 + Math.floor((r - 0.25) / 0.75 * MAX_SHADES));
}

// The plan of shade k in slot s: where it enters, which landmark it circles, where it leaves toward. Pure.
export function shadePlan(world, slot, k) {
  const r = (salt) => hash3(((slot % 65536) + 65536) % 65536, k * 53 + salt, world.seed + 4099);
  const marks = world.landmarks;
  const a = marks[Math.floor(r(1) * marks.length) % marks.length];
  const others = marks.filter(l => l !== a);
  const b = others[Math.floor(r(2) * others.length) % others.length];
  const phi = r(3) * TAU, ang0 = r(4) * TAU, dir = r(5) < 0.5 ? 1 : -1;
  const sx = Math.max(1, Math.min(world.w - 1, a.x + Math.cos(phi) * 26)), sy = Math.max(1, Math.min(world.h - 1, a.y + Math.sin(phi) * 26));
  const ox = a.x + Math.cos(ang0) * ORBIT_R, oy = a.y + Math.sin(ang0) * ORBIT_R;
  const t1 = Math.hypot(ox - sx, oy - sy) / SPEED;
  const ang1 = ang0 + dir * LINGER_S * 0.3;
  const ex = a.x + Math.cos(ang1) * ORBIT_R, ey = a.y + Math.sin(ang1) * ORBIT_R;
  const len = Math.hypot(b.x - ex, b.y - ey) || 1;
  return { a, b, sx, sy, ox, oy, ang0, dir, t1, ex, ey, ux: (b.x - ex) / len, uy: (b.y - ey) / len, delay: k * STAGGER_S, life: t1 + LINGER_S + LEAVE_S, bob: r(6) * TAU };
}

// Shade k at time ms (since 1970, UTC): { k, slot, x, y, alpha, phase, u } or null when it is not out.
export function shadeAt(world, ms, k) {
  const slot = slotOf(ms);
  if (!isInt(k, 0, MAX_SHADES - 1) || k >= shadeCount(world.seed, slot)) return null;
  const p = shadePlan(world, slot, k);
  const u = (ms - slot * SLOT_MS) / 1000 - p.delay;
  if (u < 0 || u > p.life) return null;
  let x, y, phase;
  if (u < p.t1) { const f = u / p.t1; x = p.sx + (p.ox - p.sx) * f; y = p.sy + (p.oy - p.sy) * f; phase = "approach"; }
  else if (u < p.t1 + LINGER_S) { const ang = p.ang0 + p.dir * (u - p.t1) * 0.3; x = p.a.x + Math.cos(ang) * ORBIT_R; y = p.a.y + Math.sin(ang) * ORBIT_R; phase = "linger"; }
  else { const v = (u - p.t1 - LINGER_S) * SPEED; x = p.ex + p.ux * v; y = p.ey + p.uy * v; phase = "leave"; }
  const alpha = Math.max(0, Math.min(1, u / FADE_S, (p.life - u) / FADE_S));
  return { k, slot, x, y, alpha, phase, u, at: p.a };
}
// Seconds from `ms` until the next slot that holds shades (0 if this one does and its first shade is not yet gone).
export function nextWaveIn(seed, ms) {
  const s0 = slotOf(ms);
  for (let s = s0; s < s0 + 40; s++) if (shadeCount(seed, s) > 0) return Math.max(0, (s * SLOT_MS - ms) / 1000);
  return -1;
}

// ---- pure state: one Map(seed -> light-seconds) per shade of the slot ----
export function createLightShares() {
  const maps = Array.from({ length: MAX_SHADES }, () => new Map());
  return {
    // Merge a share: keep the larger. Returns "new", "grew" or "" (nothing changed or refused).
    merge(i, seed, n) {
      if (!isInt(i, 0, MAX_SHADES - 1) || !isSeed(seed) || !isInt(n, 1, MAX_SHARE)) return "";
      const m = maps[i], have = m.get(seed);
      if (have === undefined) { if (m.size >= MAX_ENTRIES) return ""; m.set(seed, n); return "new"; }
      if (n > have) { m.set(seed, n); return "grew"; }
      return "";
    },
    own: (i, seed) => maps[i].get(seed) || 0,
    total: (i) => { let s = 0; for (const n of maps[i].values()) s += n; return s; },
    players: (i) => maps[i].size,
    done(i) { return this.total(i) >= SHADE_NEED && maps[i].size >= MIN_PLAYERS; },
    entries() { const out = []; maps.forEach((m, i) => { for (const [s, n] of m) out.push([i, s, n]); }); return out; },
    clear() { maps.forEach(m => m.clear()); },
  };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// Does `p`'s lit lantern (reach in tiles) light a shade at (x, y)?
export const lights = (p, reach, sh) => Math.hypot(p.x - sh.x, p.y - sh.y) <= reach * LIGHT_FRACTION;

export function createShades(net, world, me, peers, opts = {}) {
  const now = opts.now || (() => performance.now());
  const clock = opts.clock || (() => Date.now());
  const reachFor = opts.reachFor || (() => 3);
  const safeAt = opts.safeAt || (() => false);
  const holdOutAt = opts.holdOut || ((sh) => ({ x: sh.x, y: sh.y, fade: 1 })); // the lit lighthouse keeps shades out of its beam: (shade) -> { x, y }
  const onEvent = opts.onEvent || (() => {});
  let slot = slotOf(clock());
  let shares = createLightShares();
  const guard = createGuard(8, 16);
  const asked = new Set(), awaiting = new Map(), lastHq = new Map();
  const owed = new Array(MAX_SHADES).fill(0), acc = new Array(MAX_SHADES).fill(0);
  const startedAt = now();
  let lastSent = now(), synced = false, current = [], lastHeld = -1e9;
  let snuffUntil = 0, graceUntil = 0, nearFor = 0;
  let wasDone = [false, false, false, false];
  me.snuffed = false;
  const doneNow = () => Array.from({ length: MAX_SHADES }, (_, i) => shares.done(i));
  const check = () => { const d = doneNow(); d.forEach((v, i) => { if (v && !wasDone[i]) onEvent("banished", i, current.find(s => s.k === i) || null); }); wasDone = d; };
  const announceLight = (to) => { for (let i = 0; i < MAX_SHADES; i++) { const n = shares.own(i, me.seed); if (n > 0) net.send({ k: "hp", s: slot, i, n }, to); } };
  const announceSnuff = (to) => net.send({ k: "sf", z: me.snuffed ? 1 : 0 }, to);

  const helpNear = new Map(); // peer id -> seconds I have stood within relight reach of them while they were snuffed
  net.onPeerLeave((id) => { guard.forget(id); lastHq.delete(id); asked.delete(id); awaiting.delete(id); helpNear.delete(id); });
  net.onPeerJoin((id) => { announceLight(id); announceSnuff(id); });
  net.onMessage((msg, id) => {
    if (!msg || typeof msg !== "object" || (msg.k !== "sf" && msg.k !== "hp" && msg.k !== "hq" && msg.k !== "hs")) return;
    const p = peers.get(id);
    if (!p) return;
    if (!guard.allow(id, now())) return;
    const keys = Object.keys(msg).length;
    if (msg.k === "sf") {
      if (keys !== 2 || (msg.z !== 0 && msg.z !== 1)) return;
      const was = !!p.snuffed;
      p.snuffUntil = msg.z === 1 ? now() + (SNUFF_S + 6) * 1000 : 0;
      p.snuffed = msg.z === 1;
      if (msg.z === 1 && !was) p.snuffAt = now();
      if (msg.z === 0 && was) { // a friend relit early while I stood by with a lit lantern: I helped (the game counts it for the rank)
        const early = now() - (p.snuffAt ?? 0) < (SNUFF_S - 1) * 1000;
        if (early && !me.snuffed && (helpNear.get(id) || 0) >= HELP_S) onEvent("helped", p.seed);
      }
      if (msg.z === 0) helpNear.delete(id);
      return;
    }
    if (msg.s !== slot) return; // another slot (or a bad number): not ours
    if (msg.k === "hp") {
      if (keys !== 4) return;
      if (shares.merge(msg.i, p.seed, msg.n)) { onEvent("progress", msg.i); check(); }
    } else if (msg.k === "hq") {
      if (keys !== 2 || !synced) return;
      const t = now();
      if (t - (lastHq.get(id) ?? -1e9) < 1000) return;
      lastHq.set(id, t);
      const list = shares.entries();
      for (let i = 0; i === 0 || i < list.length; i += CHUNK) {
        const part = list.slice(i, i + CHUNK);
        net.send({ k: "hs", s: slot, i: part.map(e => e[0]), p: part.map(e => e[1]), n: part.map(e => e[2]), f: i + CHUNK >= list.length ? 1 : 0 }, id);
      }
    } else {
      if (keys !== 6 || !awaiting.has(id) || !Array.isArray(msg.i) || !Array.isArray(msg.p) || !Array.isArray(msg.n)) return;
      if (msg.i.length > CHUNK || msg.i.length !== msg.p.length || msg.i.length !== msg.n.length || (msg.f !== 0 && msg.f !== 1)) return;
      if (!msg.i.every(v => isInt(v, 0, MAX_SHADES - 1)) || !msg.p.every(isSeed) || !msg.n.every(v => isInt(v, 1, MAX_SHARE))) return;
      let changed = false;
      msg.i.forEach((i, j) => { if (shares.merge(i, msg.p[j], msg.n[j])) changed = true; });
      if (changed) { onEvent("progress", -1); check(); }
      if (msg.f === 1) { synced = true; awaiting.delete(id); flush(); }
    }
  });

  // Add light-seconds I put on shade i to my own share, up to the cap.
  function addOwn(i, points) {
    const have = shares.own(i, me.seed), next = Math.min(MAX_SHARE, have + points);
    if (next <= have) return 0;
    shares.merge(i, me.seed, next);
    net.send({ k: "hp", s: slot, i, n: next });
    onEvent("progress", i);
    check();
    return next - have;
  }
  function flush() { for (let i = 0; i < MAX_SHADES; i++) if (owed[i] > 0) { const p = owed[i]; owed[i] = 0; addOwn(i, p); } }
  function newSlot(s) {
    slot = s; shares = createLightShares(); owed.fill(0); acc.fill(0); wasDone = doneNow();
    asked.clear(); awaiting.clear(); synced = false; lastSent = now();
    onEvent("newslot", -1);
  }
  function setSnuffed(on, why, k = -1) {
    if (me.snuffed === on) return;
    me.snuffed = on; nearFor = 0;
    if (on) snuffUntil = now() + SNUFF_S * 1000; else graceUntil = now() + GRACE_S * 1000;
    announceSnuff();
    onEvent(on ? "snuffed" : why, k);
  }

  return {
    get shares() { return shares; }, get slot() { return slot; },
    synced: () => synced, pending: () => awaiting.size, owed: () => owed.slice(),
    list: () => current,
    snuffLeft: () => me.snuffed ? Math.max(0, (snuffUntil - now()) / 1000) : 0,
    // Called every frame (dt in seconds): move to a new slot, work out the shades that are out, count my light on them,
    // let them snuff me, relight me, ask newcomers for the shares, repeat my own totals now and then.
    tick(dt) {
      const t = now(), ms = clock(), s = slotOf(ms);
      if (s !== slot) newSlot(s);
      const count = shadeCount(world.seed, slot);
      current = [];
      for (let i = 0; i < count; i++) {
        const sh = shadeAt(world, ms, i);
        if (!sh) continue;
        { const h = holdOutAt(sh); sh.x = h.x; sh.y = h.y; sh.alpha *= h.fade; }
        sh.gone = shares.done(i); sh.total = shares.total(i); sh.players = shares.players(i); sh.own = shares.own(i, me.seed);
        sh.safe = safeAt(sh.x, sh.y);
        current.push(sh);
      }
      for (const p of peers.values()) { if (p.snuffed && !(p.snuffUntil > t)) p.snuffed = false; }
      for (const p of peers.values()) {
        if (p.snuffed && !me.snuffed && dist(me, p) <= RELIGHT_R) helpNear.set(p.id, (helpNear.get(p.id) || 0) + dt);
        else helpNear.delete(p.id);
      }
      const myReach = reachFor(me);
      // my light on the shades
      if (!me.snuffed) for (const sh of current) {
        if (sh.gone || sh.alpha < 0.3) continue;
        if (lights(me, myReach, sh)) {
          acc[sh.k] += Math.min(dt, 0.25);
          while (acc[sh.k] >= 1) { acc[sh.k] -= 1; if (!synced && peers.size > 0) owed[sh.k] = Math.min(owed[sh.k] + 1, MAX_SHARE); else addOwn(sh.k, 1); }
        }
      }
      // a shade reaching me
      if (!me.snuffed && t >= graceUntil && !safeAt(me.x, me.y)) {
        for (const sh of current) {
          if (sh.gone || sh.alpha < 0.5 || sh.safe || dist(me, sh) >= SNUFF_R) continue;
          let warded = false;
          for (const p of peers.values()) if (!p.snuffed && lights(p, reachFor(p), sh)) { warded = true; break; }
          if (warded) { if (t - lastHeld > 4000) { lastHeld = t; onEvent("held", sh.k); } }
          else { setSnuffed(true, "snuffed", sh.k); break; }
        }
      }
      if (me.snuffed) {
        let near = false;
        for (const p of peers.values()) if (!p.snuffed && dist(me, p) <= RELIGHT_R) { near = true; break; }
        nearFor = near ? nearFor + dt : 0;
        if (nearFor >= RELIGHT_S) setSnuffed(false, "relit");
        else if (t >= snuffUntil) setSnuffed(false, "expired");
      }
      for (const id of peers.keys()) if (!asked.has(id)) { asked.add(id); awaiting.set(id, { at: t, tries: 0 }); net.send({ k: "hq", s: slot }, id); }
      for (const [id, w] of awaiting) if (t - w.at >= 2500) { if (w.tries >= 2) awaiting.delete(id); else { w.tries++; w.at = t; net.send({ k: "hq", s: slot }, id); } }
      if (!synced && t - startedAt > SYNC_WAIT_MS && awaiting.size === 0) { synced = true; flush(); }
      else if (!synced && t - startedAt > SYNC_WAIT_MS * 4) { synced = true; flush(); }
      if (t - lastSent >= RESEND_MS) { lastSent = t; announceLight(); announceSnuff(); }
    },
  };
}
