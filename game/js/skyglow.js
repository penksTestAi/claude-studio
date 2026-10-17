// Dawn and dusk: the pure parts (no DOM, no canvas, no network) of the look step of milestone 24. At the two ends of the
// night the whole map takes the colour of the sky: a cool blue at dusk, a grey at dawn with longer shadows, and the thin
// line of the horizon in the small sky strip glows. It is a function of the night hour only (the same clock every browser
// reads), so nothing is ever sent or received, and it changes no rule of the game. render.js draws what this describes.
// Reduced motion draws the same colours but holds the horizon steady; the colours themselves follow the hour, which moves
// only over minutes (the night's hours last HOUR_MS each).
import { HOURS } from "./nightclock.js";

export const DUSK_PEAK = 0, DAWN_PEAK = 7;           // the hours at which each is strongest (nightclock.js: hour 0 Dusk, hour 7 Dawn)
export const DUSK_SPAN = [0.35, 1.3];                // dusk builds over the last 0.35 hours before hour 0 and fades over 1.3 hours after it
export const DAWN_SPAN = [1.1, 0.65];                // dawn builds over 1.1 hours up to hour 7 and fades over the last 0.65 hours
export const WASH = { dusk: [20, 52, 128], dawn: [92, 98, 118] };   // the sky colour the night layer's tint is pulled toward
export const WASH_MIX = 0.8;                          // how far toward that colour at full strength (0..1)
export const VEIL_ADD = { dusk: 0.14, dawn: 0.16 };      // the night layer is this much darker at full strength, so lanterns and paths keep their contrast against the lighter sky
export const GLOW_POOL = 0.40;                       // the warm pool each lantern lays on the ground at full strength (peak opacity)
export const SHADOW_STRETCH = { dusk: 0.35, dawn: 0.7 }; // extra shadow length at full strength (dawn's are the long ones)
export const HORIZON = { night: [120, 140, 190, 0.34], dusk: [130, 180, 245, 0.9], dawn: [214, 216, 226, 0.9] }; // r, g, b, alpha of the sky strip's horizon line

const sm = (f) => { const x = Math.min(1, Math.max(0, f)); return x * x * (3 - 2 * x); };
const mix = (a, b, f) => a + (b - a) * f;

// How strong dusk and dawn are at an hour (a number, wraps): { dusk, dawn } each 0..1.
export function endsAt(hour) {
  const h = Number.isFinite(hour) ? ((hour % HOURS) + HOURS) % HOURS : 3;
  const d = h < HOURS / 2 ? h : h - HOURS;              // hours after dusk (negative just before it)
  const dusk = d < DUSK_PEAK ? sm(1 + (d - DUSK_PEAK) / DUSK_SPAN[0]) : sm(1 - (d - DUSK_PEAK) / DUSK_SPAN[1]);
  const e = h - DAWN_PEAK;                              // hours after dawn's peak (negative before it)
  const dawn = e < 0 ? sm(1 + e / DAWN_SPAN[0]) : sm(1 - e / DAWN_SPAN[1]);
  return { dusk: h >= HOURS / 2 && h < HOURS - DUSK_SPAN[0] ? 0 : dusk, dawn: h < HOURS / 2 ? 0 : dawn };
}

// Everything the renderer needs for one hour and the night layer's own tint [r, g, b]:
// { kind: "night"|"dusk"|"dawn", amount 0..1, tint [r,g,b] (the tint pulled toward the sky), shadowLen (>= 1, multiply
// shadow lengths by it), horizon [r,g,b,a] }.
export function glowAt(hour, tint) {
  const { dusk, dawn } = endsAt(hour), kind = dusk === 0 && dawn === 0 ? "night" : dusk >= dawn ? "dusk" : "dawn";
  const amount = Math.max(dusk, dawn), base = Array.isArray(tint) && tint.length === 3 ? tint : [3, 6, 18];
  if (kind === "night") return { kind, amount: 0, tint: base.slice(), darkAdd: 0, shadowLen: 1, horizon: HORIZON.night.slice() };
  const w = WASH[kind], f = amount * WASH_MIX, hz = HORIZON[kind];
  return {
    kind, amount,
    tint: [0, 1, 2].map(k => Math.round(mix(base[k], w[k], f))),
    darkAdd: VEIL_ADD[kind] * amount,
    shadowLen: 1 + SHADOW_STRETCH[kind] * amount,
    horizon: [0, 1, 2, 3].map(k => mix(HORIZON.night[k], hz[k], amount)),
  };
}

// Relative luminance (0..1) of an sRGB colour, and the contrast ratio of two (1..21), as the web's accessibility guide defines
// them. The tests use these to check players, lanterns and paths against the ground at both ends of the night.
export function luminance(r, g, b) {
  const c = [r, g, b].map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a, b) {
  const la = luminance(a[0], a[1], a[2]), lb = luminance(b[0], b[1], b[2]);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
