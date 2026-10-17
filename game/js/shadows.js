// Shadows and flame: the pure parts (no DOM, no canvas) of the look step of milestone 20. Things that stand up (trees,
// rocks, the four kinds of landmark) throw a short soft shadow away from the lights near them (every lantern, lit
// beacons, the lit lighthouse); flames and the lighthouse lamp flicker. render.js draws what these functions describe.
// Nothing here is sent or received: each browser works its shadows out alone from the lights it can see, so two players
// may see a tree's shadow differently only if they see different lights.
import { hash3 } from "./world.js";

export const CASTERS_MAX = [0, 14, 40];   // how many shadows a frame may draw at governor level 0, 1 and 2
export const LIGHT_SPAN = 1.15;           // a thing is in a light's reach out to this many times the light's radius
// Height of each kind of thing in tiles, and how wide its shadow is (in tiles).
export const CASTER = {
  tree: { h: 1.15, w: 0.95 }, rock: { h: 0.5, w: 0.8 }, beacon: { h: 1.45, w: 0.55 },
  lighthouse: { h: 2.9, w: 0.85 }, well: { h: 0.5, w: 0.95 },
};
export const SHADOW_ALPHA_MAX = 0.5;      // the darkest a shadow gets (before the night layer goes over it)

// The shadow of a thing at (x, y) given the lights [{x, y, r, f}] (r: the light's radius in tiles, f: how bright it is
// right now, about 1; flames flicker). Returns null when no light reaches it, else {dx, dy, len, wid, alpha}: a unit
// direction away from the lights (the brighter and nearer ones count more), the length and width in tiles, and an
// opacity from 0 to SHADOW_ALPHA_MAX. A light standing on the thing itself (within 0.3 tile) does not shadow it.
export function shadowOf(x, y, kind, lights) {
  const c = CASTER[kind];
  if (!c) return null;
  let vx = 0, vy = 0, wsum = 0, wmax = 0, near = Infinity, nearR = 1;
  for (const l of lights) {
    const dx = x - l.x, dy = y - l.y, d = Math.hypot(dx, dy), span = l.r * LIGHT_SPAN;
    if (!(d > 0.3) || d >= span || !(span > 0)) continue;
    const w = (1 - d / span) * Math.min(1.4, Math.max(0, l.f));
    if (!(w > 0.01)) continue; // also skips a light with an odd number
    vx += (dx / d) * w; vy += (dy / d) * w; wsum += w;
    if (w > wmax) wmax = w;
    if (d < near) { near = d; nearR = l.r; }
  }
  if (wsum <= 0.01) return null;
  const m = Math.hypot(vx, vy);
  if (m < 1e-6) return null; // lights on opposite sides cancel: no clear direction, no shadow
  // A light close by sits low against the thing and throws a long shadow; a far one is higher up and the shadow shortens.
  const len = c.h * (0.45 + 0.75 * Math.min(1, near / nearR)) * (0.8 + 0.2 * Math.min(1.4, wmax + 0.4));
  const clear = m / wsum; // 1 when every light is on one side, less when they pull in different directions
  return { dx: vx / m, dy: vy / m, len, wid: c.w, alpha: Math.min(SHADOW_ALPHA_MAX, (0.12 + 0.5 * wmax) * (0.5 + 0.5 * clear)) };
}

// Keep the `max` darkest shadows (a stable choice, so shadows do not pop in and out as the camera moves one tile).
export function keepDarkest(list, max) {
  if (list.length <= max) return list;
  return list.slice().sort((a, b) => b.alpha - a.alpha || a.x - b.x || a.y - b.y).slice(0, Math.max(0, max));
}

// The flicker of a flame (a beacon's fire, the lighthouse lamp) at time t (ms): {wob, h, glow}, wob a sideways lean in
// source pixels (before the old +-0.35), h a height factor and glow a factor for the light it gives, all about 1 and
// bounded. `seed` keeps neighbours out of step. Level 0 flickers with one slow wave; levels 1 and 2 add faster
// waves. Reduced motion: a steady flame (wob 0, factors 1), which still burns, it just does not move.
export function flameFlicker(t, seed, level, reduce) {
  if (reduce) return { wob: 0, h: 1, glow: 1 };
  const s = hash3(seed | 0, 5, 611) * 6.2831853;
  if (!(level > 0)) { const a = Math.sin(t / 170 + s); return { wob: a * 0.35, h: 1 + 0.05 * a, glow: 1 + 0.02 * a }; }
  const a = Math.sin(t / 97 + s) * 0.5 + Math.sin(t / 151 + s * 1.7) * 0.3 + Math.sin(t / 53 + s * 2.3) * 0.2; // within -1..1
  return { wob: a * 0.5, h: 1 + a * 0.14, glow: 1 + a * 0.05 };
}
