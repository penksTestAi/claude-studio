// The living island: the pure parts (no DOM, no canvas) of the animated look. Which tiles shimmer, foam, sway;
// where the moon and stars are for an hour of the night; where the fireflies drift; and a small governor that
// turns the extras down on a device that cannot keep up. render.js draws what these functions describe.
// None of this touches the network: every browser draws its own water, so nothing here is ever sent or received.
import { T, hash3 } from "./world.js";

// Tile kinds for the animated layer (one byte per tile) and the foam edges (a bit mask per tile).
export const D = { NONE: 0, SPARKLE: 1, GRASS: 2, TREE: 3, REED: 4 };
export const EDGE = { N: 1, E: 2, S: 4, W: 8 };
const isWater = (t) => t === T.DEEP || t === T.SHALLOW;

// deco[i]: D.* for tile i; foam[i]: which sides of a shallow tile touch dry land (the shore where waves wash).
export function classify(world) {
  const { w, h, tiles, seed } = world;
  const deco = new Uint8Array(w * h), foam = new Uint8Array(w * h);
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? T.DEEP : tiles[y * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, t = tiles[i], r = hash3(x, y, seed + 77);
      if (t === T.DEEP) { if (r < 0.10) deco[i] = D.SPARKLE; }
      else if (t === T.SHALLOW) {
        if (r < 0.12) deco[i] = D.SPARKLE;
        let m = 0;
        if (!isWater(at(x, y - 1))) m |= EDGE.N;
        if (!isWater(at(x + 1, y))) m |= EDGE.E;
        if (!isWater(at(x, y + 1))) m |= EDGE.S;
        if (!isWater(at(x - 1, y))) m |= EDGE.W;
        foam[i] = m;
      } else if (t === T.TREE) deco[i] = D.TREE;
      else if ((t === T.GRASS || t === T.MEADOW) && r < 0.30) deco[i] = D.GRASS;
    }
  }
  return { deco, foam };
}

// A phase in [0, 2pi) for a tile, so neighbours do not move in step.
export const phaseOf = (x, y, seed) => hash3(x, y, seed + 191) * 6.2831853;

// How far something sways (in source pixels of the 8 px tile) at time t. Reduced motion: no sway at all.
export function sway(t, phase, reduce) {
  if (reduce) return { x: 0, y: 0 };
  return { x: Math.sin(t / 1300 + phase) * 0.55 + Math.sin(t / 460 + phase * 2) * 0.18, y: Math.cos(t / 1700 + phase) * 0.28 };
}

// Shore foam: 0..1 for how far a wave has washed up the beach (the foam line sits at `wash` of its tile
// width away from the land) and its opacity. Reduced motion holds one steady mid position.
export function foamState(t, phase, reduce) {
  if (reduce) return { wash: 0.5, alpha: 0.4 };
  const s = Math.sin(t / 1250 + phase) * 0.5 + 0.5;
  return { wash: s, alpha: 0.18 + 0.4 * (1 - s) }; // strongest where it meets the sand, fading as it draws back
}

// Glints on the water: 0..1. Slow twinkle; steady half-bright for reduced motion. The moon makes glints brighter.
export function sparkle(t, phase, reduce) {
  if (reduce) return 0.5;
  const s = Math.sin(t / 650 + phase * 3);
  return s > 0.35 ? (s - 0.35) / 0.65 : 0;
}

// ---- moon and stars, following the night hour ----
// The moon crosses the sky from the east at dusk to the west at dawn: x runs 0..1 over the 8 hours, height rises to
// its highest at midnight. `lit` is how bright its light on the water is (0 when it is low on the horizon).
export function moonAt(hour) {
  const p = (((hour % 8) + 8) % 8) / 8;
  const h = Math.sin(Math.PI * p);
  return { x: p, h, lit: Math.min(1, Math.max(0, (h - 0.08) / 0.5)) };
}
// How many stars show: all of them in the deepest dark, a few at dusk and none left by dawn. `dark` is lightFor().dark.
export function starAlpha(dark) {
  return Math.min(1, Math.max(0, (dark - 0.27) / 0.30));
}
// 30 stars, fixed positions in a unit box (the same every frame and for everyone).
export const STARS = Array.from({ length: 30 }, (_, i) => ({ x: hash3(i, 3, 901), y: hash3(i, 7, 902), s: 0.5 + hash3(i, 11, 903), ph: hash3(i, 13, 904) * 6.28 }));

// ---- fireflies ----
// n fireflies drifting round (cx, cy) within `spread` tiles. Each wanders on two slow loops of its own and blinks.
// Returns {x, y, a} with a in 0..1. Reduced motion: they hold still, glowing steadily.
export function fireflies(n, key, cx, cy, spread, t, reduce) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a0 = hash3(i, key, 311) * 6.2831853, r0 = 0.35 + hash3(i, key, 312) * 0.65;
    const sp = 0.00018 + hash3(i, key, 313) * 0.00022, ph = hash3(i, key, 314) * 6.2831853;
    if (reduce) { out.push({ x: cx + Math.cos(a0) * r0 * spread, y: cy + Math.sin(a0) * r0 * spread * 0.8, a: 0.75 }); continue; }
    const x = cx + (Math.cos(a0 + t * sp) * 0.7 + Math.cos(t * sp * 2.3 + ph) * 0.3) * r0 * spread;
    const y = cy + (Math.sin(a0 + t * sp * 1.2) * 0.7 + Math.sin(t * sp * 1.7 + ph) * 0.3) * r0 * spread * 0.8;
    const b = Math.sin(t / (380 + hash3(i, key, 315) * 300) + ph);
    out.push({ x, y, a: b > -0.2 ? Math.min(1, 0.45 + 0.55 * (b + 0.2) / 1.2) : 0.12 });
  }
  return out;
}

// Soft edge for a pool of light: alpha stops from `peak` at the middle to 0 at the rim, falling along a smoothstep
// (zero slope at the rim), so a coloured lantern's glow melts into the dark instead of ending in a visible ring.
export function softStops(peak, steps = 4) {
  const out = [];
  for (let i = 0; i <= steps; i++) { const s = i / steps; out.push([s, peak * (1 - s * s * (3 - 2 * s))]); }
  return out;
}

// ---- a governor for slow devices ----
// Level 2: everything. Level 1: no glints on the water, no grass blades, fewer fireflies. Level 0: only the
// light itself (trees and foam still move). It looks at the time between frames: if 90 frames in a row averaged
// slower than 34 ms (under 30 fps) it steps down one level; it never steps back up in the same visit (so the look cannot flicker).
export function createGovernor(start = 2) {
  let level = start, n = 0, sum = 0;
  return {
    get level() { return level; },
    note(frameMs) {
      if (!(frameMs > 0) || frameMs > 500) return level; // a hidden tab or a pause is not slowness
      sum += frameMs; n++;
      if (n >= 90) { if (sum / n > 34 && level > 0) level--; n = 0; sum = 0; }
      return level;
    },
    set(l) { level = l; n = 0; sum = 0; },
  };
}
