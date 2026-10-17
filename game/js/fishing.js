// Fishing at the jetty. Where the fish are needs no messages at all: each fish's life is a pure function of the
// island's seed and the clock (a "slot" of FISH_SLOT_S seconds holds up to MAX_FISH fish, each present for part of the
// slot, over water within GROUND_RADIUS tiles of the jetty), so every browser whose clock agrees draws the same fish in
// the same places, and nothing about a fish is ever sent. Because nothing is sent, a fish cannot be taken away from
// anyone else: two players can both catch "the same" fish (fish are an endless supply, not a shared pile).
//
// A cast puts a float on a water tile in front of you. When a fish is near the float it bites; you have BITE_WINDOW_S
// seconds to press Reel in (the timing press). Too early, or too late, and nothing is caught. A catch is one lamp oil
// (inventory.js, "oil"), which burns as 3 fuel in a beacon and can be given.
//
// The shoal: when two players have a line out and their floats are at most SHOAL_RANGE tiles apart, a shoal of
// SHOAL_FISH fish circles the midpoint of the two floats for both of them, and fish of the shoal bite from farther
// (SHOAL_BITE_R). The shoal is worked out by each browser from the two floats alone, so both see the same one. Where
// there are no natural fish (away from the jetty) only a shoal brings bites.
//
// The one message, numbers only: { k:"fl", x, y }   the tile my float is on, or x = y = -1 for "no line".
// Sent on change, to each newcomer, and every RESEND_MS. A receiver checks: sender said hello, exactly three fields, whole
// numbers, the float on a water tile, not farther than FLOAT_SLACK tiles from where the sender last stood, at most 4 a
// second per sender. A heard line is forgotten LINE_TTL_S after the last time it was repeated, so a silent or lying
// peer cannot keep a shoal alive. A modified client can claim a line it does not have; that only gives itself a shoal.
import { T, tileAt, hash3 } from "./world.js";
import { createGuard } from "./guard.js";
import { SOFT_STACK } from "./inventory.js";

export const FISH_SLOT_S = 24;
export const MAX_FISH = 8;             // fish that may be present at once (before the slot's dice)
export const FISH_PRESENT = 0.75;      // chance that a given fish of a slot exists
export const GROUND_RADIUS = 12;       // tiles from the jetty within which natural fish live
export const ORBIT_R = 0.6;            // how far a fish drifts round its place
export const CAST_MAX = 4;             // farthest cast, in tiles
export const CAST_MIN = 1.5;
export const CAST_COOLDOWN_S = 1.5;
export const LINE_MAX_S = 45;          // a line left out this long is reeled in by itself
export const BITE_R = 1.1;             // a natural fish this close to the float bites
export const SHOAL_BITE_R = 2.6;       // a shoal fish bites from this close
export const BITE_WINDOW_S = 2;        // time to press Reel in after a bite starts
export const BITE_WINDOW_STILL_S = 3.5; // longer when the page is asked for reduced motion (nothing flashes, more time)
export const SETTLE_S = 0.8;           // a float must lie this long before anything bites
export const SHOAL_RANGE = 4;          // floats at most this far apart draw a shoal
export const SHOAL_SETTLE_S = 1.5;     // both lines must have been out this long (as each browser sees it)
export const SHOAL_FISH = 3;
export const SHOAL_RING = 0.5;
export const OIL_PER_FISH = 1;
export const RESEND_MS = 5000;
export const LINE_TTL_S = 12;
export const SLACK_WALK = 2.5;         // walk farther than CAST_MAX plus this from the float and the line comes in
export const FLOAT_SLACK = 9;          // the sender's float may be this far from where I last saw them (casting 4, plus lag)

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const isWater = (world, x, y) => { const t = tileAt(world, x, y); return t === T.SHALLOW || t === T.DEEP; };
const TAU = Math.PI * 2;

export const jettyOf = (world) => world.landmarks.find(l => l.kind === "jetty") || null;
// The place the fishing ground is round: the outer end of the planks.
export function groundCentre(world) {
  const j = jettyOf(world);
  if (!j) return null;
  const n = j.planks ? j.planks.length : 0;
  return { x: j.x + (j.dir ? j.dir[0] : 0) * (n / 2 + 0.5), y: j.y + (j.dir ? j.dir[1] : 0) * (n / 2 + 0.5) };
}
export const slotOfMs = (ms) => Math.floor(ms / (FISH_SLOT_S * 1000));

// The natural fish at a time (milliseconds since 1970): [{ id, x, y, alpha, shoal:false }]. `still` = reduced motion: no drifting.
export function fishAt(world, ms, still = false) {
  const c = groundCentre(world);
  if (!c || !Number.isFinite(ms)) return [];
  const slot = slotOfMs(ms), u = (ms - slot * FISH_SLOT_S * 1000) / 1000, s = slot % 65536, out = [];
  for (let i = 0; i < MAX_FISH; i++) {
    if (hash3(s, i, world.seed + 4401) >= FISH_PRESENT) continue;
    const start = hash3(s, i, world.seed + 4402) * 8, end = 16 + hash3(s, i, world.seed + 4403) * 8;
    if (u < start || u > end) continue;
    let bx = 0, by = 0, found = false;
    for (let k = 0; k < 8 && !found; k++) {
      const a = hash3(s, i * 8 + k, world.seed + 4404) * TAU, r = 1.5 + hash3(s, i * 8 + k, world.seed + 4405) * (GROUND_RADIUS - 1.5);
      bx = Math.floor(c.x + Math.cos(a) * r) + 0.5; by = Math.floor(c.y + Math.sin(a) * r) + 0.5; // a fish's place is the middle of a water tile whose four neighbours are water too, so its drifting stays over water
      found = isWater(world, bx, by) && isWater(world, bx + 1, by) && isWater(world, bx - 1, by) && isWater(world, bx, by + 1) && isWater(world, bx, by - 1);
    }
    if (!found) continue;
    const ph = hash3(s, i, world.seed + 4406) * TAU, per = 7 + hash3(s, i, world.seed + 4407) * 5;
    const x = still ? bx : bx + Math.cos(ph + u * TAU / per) * ORBIT_R * 0.9, y = still ? by : by + Math.sin(ph + u * TAU / per) * ORBIT_R * 0.9;
    out.push({ id: i, x, y, bx, by, alpha: Math.max(0, Math.min(1, (u - start) / 1.5, (end - u) / 1.5)), shoal: false });
  }
  return out;
}

// Two players' shared key (the same whichever way round), for the shoal's fish phases.
export const pairKey = (a, b) => ((Math.min(a, b) ^ Math.imul(Math.max(a, b), 2654435761)) >>> 0);
// The fish of a shoal round a point at a time: SHOAL_FISH fish on a small ring, turning slowly.
export function shoalFish(world, ms, cx, cy, key, still = false) {
  const out = [], u = (ms % 3600000) / 1000;
  for (let i = 0; i < SHOAL_FISH; i++) {
    const ph = hash3(key % 65536, i, world.seed + 4420) * TAU, a = still ? ph : ph + u * 0.9;
    out.push({ id: 100 + i, x: cx + Math.cos(a) * SHOAL_RING, y: cy + Math.sin(a) * SHOAL_RING, alpha: 1, shoal: true });
  }
  return out;
}

// The nearest fish a float at (fx, fy) would bite, or null: natural fish within BITE_R, shoal fish within SHOAL_BITE_R.
export function biteFish(fish, fx, fy) {
  let best = null, bd = Infinity;
  for (const f of fish) {
    const d = Math.hypot(f.x - fx, f.y - fy);
    if (d <= (f.shoal ? SHOAL_BITE_R : BITE_R) && d < bd && f.alpha > 0.5) { bd = d; best = f; }
  }
  return best;
}

// Where a cast goes: the farthest water tile along `dir` from (px, py), CAST_MAX down to CAST_MIN tiles away. Returns the tile's
// middle { x, y } or null.
export function castTarget(world, px, py, dir) {
  if (!Number.isFinite(px + py + dir)) return null;
  for (let d = CAST_MAX; d >= CAST_MIN; d -= 0.25) {
    const x = Math.floor(px + Math.cos(dir) * d), y = Math.floor(py + Math.sin(dir) * d);
    if (x >= 2 && y >= 2 && x < world.w - 2 && y < world.h - 2 && isWater(world, x, y)) return { x: x + 0.5, y: y + 0.5 };
  }
  return null;
}

export function createFishing(net, world, me, peers, opts = {}) {
  const now = opts.now || (() => performance.now());
  const clock = opts.clock || (() => Date.now());
  const still = opts.still || (() => false);
  const onEvent = opts.onEvent || (() => {});
  const persist = opts.persist || (() => {});
  const inv = opts.inv;                       // the saved pack: inv.oil is the catch
  const stack = opts.stack || SOFT_STACK;
  const bites = opts.bites !== false;        // tests only: false = nothing ever bites (to hold a shoal steady while its rules are checked)
  const guard = createGuard(4, 8);
  let line = null;                            // { x, y, at, phase:"wait"|"bite", until, fish }
  let lastEnd = -1e9, lastSent = now();

  const announce = (to) => net.send(line ? { k: "fl", x: Math.floor(line.x), y: Math.floor(line.y) } : { k: "fl", x: -1, y: -1 }, to);
  net.onPeerJoin((id) => announce(id));
  net.onPeerLeave((id) => { guard.forget(id); const p = peers.get(id); if (p) p.line = null; });
  net.onMessage((msg, id) => {
    if (!msg || typeof msg !== "object" || msg.k !== "fl") return;
    const p = peers.get(id);
    if (!p || Object.keys(msg).length !== 3 || !Number.isInteger(msg.x) || !Number.isInteger(msg.y)) return;
    if (!guard.allow(id, now())) return;
    if (msg.x === -1 && msg.y === -1) { p.line = null; return; }
    if (!isInt(msg.x, 2, world.w - 3) || !isInt(msg.y, 2, world.h - 3) || !isWater(world, msg.x, msg.y)) return;
    if (Math.hypot(msg.x + 0.5 - p.tx, msg.y + 0.5 - p.ty) > FLOAT_SLACK) return;
    const t = now();
    if (p.line && p.line.x === msg.x + 0.5 && p.line.y === msg.y + 0.5) p.line.seen = t; // a repeat: the float has been lying since `at`
    else p.line = { x: msg.x + 0.5, y: msg.y + 0.5, at: t, seen: t };
  });

  const secs = (ms) => ms / 1000;
  function end(type, extra) {
    const l = line;
    line = null; lastEnd = now();
    announce();
    onEvent(type, extra || null, l);
  }
  // The shoal this player is part of, or null: { id, x, y, key } with the other fisher's id and the middle of the two floats.
  function shoal() {
    if (!line || secs(now() - line.at) < SHOAL_SETTLE_S) return null;
    let best = null, bd = Infinity;
    for (const p of peers.values()) {
      const l = p.line;
      if (!l || secs(now() - l.seen) > LINE_TTL_S || secs(now() - l.at) < SHOAL_SETTLE_S) continue;
      const d = Math.hypot(l.x - line.x, l.y - line.y);
      if (d <= SHOAL_RANGE && (d < bd || (d === bd && best && p.seed < best.seed))) { bd = d; best = p; }
    }
    if (!best) return null;
    const cx = (line.x + best.line.x) / 2, cy = (line.y + best.line.y) / 2;
    if (!isWater(world, Math.floor(cx), Math.floor(cy))) return null;
    return { id: best.id, seed: best.seed, x: cx, y: cy, key: pairKey(me.seed, best.seed) };
  }
  const fishNow = () => {
    const ms = clock(), s = still(), sh = shoal();
    const out = fishAt(world, ms, s);
    if (sh) out.push(...shoalFish(world, ms, sh.x, sh.y, sh.key, s));
    return { fish: out, shoal: sh };
  };

  return {
    get line() { return line ? { ...line } : null; },
    shoal,
    // Everything the renderer and the panel need.
    view() {
      const { fish, shoal: sh } = fishNow();
      const lines = [];
      if (line) lines.push({ px: me.x, py: me.y, fx: line.x, fy: line.y, mine: true, bite: line.phase === "bite", age: secs(now() - line.at) });
      const t = now();
      for (const p of peers.values()) if (p.line && secs(t - p.line.seen) <= LINE_TTL_S) lines.push({ px: p.x, py: p.y, fx: p.line.x, fy: p.line.y, mine: false, bite: false, age: secs(t - p.line.at) });
      return { fish, lines, shoal: sh ? { x: sh.x, y: sh.y } : null };
    },
    // Cast at the tile (x, y) (middle coordinates). Refused when a line is out, within the cooldown, too far or not water.
    cast(x, y) {
      const t = now();
      if (line) return { ok: false, why: "out" };
      if (secs(t - lastEnd) < CAST_COOLDOWN_S) return { ok: false, why: "cooldown" };
      if (!Number.isFinite(x + y) || !isWater(world, Math.floor(x), Math.floor(y))) return { ok: false, why: "land" };
      const d = Math.hypot(x - me.x, y - me.y);
      if (d > CAST_MAX + 0.6 || d < CAST_MIN - 0.6) return { ok: false, why: "far" };
      line = { x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5, at: t, phase: "wait", until: 0, fish: -1 };
      announce(); lastSent = t;
      onEvent("cast", null, line);
      return { ok: true };
    },
    // Cast in the direction the player faces.
    castAhead() {
      const tg = castTarget(world, me.x, me.y, me.d);
      if (!tg) { onEvent("nowater", null, null); return { ok: false, why: "nowater" }; }
      return this.cast(tg.x, tg.y);
    },
    // The timing press. During a bite it catches the fish (if the stack has room); before a bite it only brings the line in.
    reel() {
      if (!line) return { ok: false, why: "noline" };
      if (line.phase !== "bite") { end("early"); return { ok: true, caught: false, why: "early" }; }
      if (inv.oil >= stack) { end("full"); return { ok: true, caught: false, why: "full" }; }
      inv.oil += OIL_PER_FISH;
      persist();                                // the catch is saved before anything else happens
      const shoalBite = line.fish >= 100;
      end("caught", { shoal: shoalBite });
      return { ok: true, caught: true, shoal: shoalBite };
    },
    // Every frame: let a lying float wait for a bite, end a missed bite or a too-long line, forget stale lines of others.
    tick() {
      const t = now();
      for (const p of peers.values()) if (p.line && secs(t - p.line.seen) > LINE_TTL_S) p.line = null;
      if (t - lastSent >= RESEND_MS) { lastSent = t; announce(); }
      if (!line) return;
      if (secs(t - line.at) > LINE_MAX_S) { end("timeout"); return; }
      if (Math.hypot(line.x - me.x, line.y - me.y) > CAST_MAX + SLACK_WALK) { end("slack"); return; } // walked away from the float
      if (line.phase === "bite") { if (t >= line.until) end("escaped"); return; }
      if (!bites || secs(t - line.at) < SETTLE_S) return;
      const f = biteFish(fishNow().fish, line.x, line.y);
      if (f) { line.phase = "bite"; line.until = t + (still() ? BITE_WINDOW_STILL_S : BITE_WINDOW_S) * 1000; line.fish = f.id; onEvent("bite", null, line); }
    },
    // Leaving the lantern: the line comes in and the others are told.
    leave() { if (line) { line = null; announce(); } },
  };
}
