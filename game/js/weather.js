// Weather and the shades' sky: pure functions (no DOM, no canvas, no network). The mist and the rain are a function of
// the island's seed and the UTC clock, like the night hour and the shades: every browser works out the same weather
// and nothing about it is ever sent or received. The weather is mostly a look; its two small effects (milestone 25) are the name fade in mist and the slower shades in rain,
// both worked out from this same weather by each browser.
// `sky()` also says how much a wave of shades darkens the small sky strip, from the same shade plans the game uses.
import { hash3 } from "./world.js";
import { shadeCount, shadeAt, slotOf, SLOT_MS, MAX_SHADES } from "./shades.js";

export const WEATHER_SLOT_MS = 4 * 60 * 1000; // the weather is decided afresh every 4 minutes
export const BLEND_MS = 40 * 1000;            // and eases from the last slot's level over its first 40 s
export const MIST_NAME_TILES = 6;  // in mist, the names of players farther than this many tiles fade (they stay on the minimap)
export const MIST_NAME_FADE = 2;   // ... over this many more tiles
export const MIST_NAME_MIN = 0.35; // the mist from which far names fade fully (they begin to fade above 0.12)
export const RAIN_SHADE_SLOW = 0.2; // in rain, shades move this share slower (a fifth)
export const MAX_MIST = 0.30, MAX_RAIN = 1;   // mist: how much of the screen it may veil (kept thin so lights stay clear)
export const RAIN_DROPS = [0, 36, 72];        // drops drawn at governor level 0, 1, 2
export const MIST_BLOBS = [0, 3, 5];          // drifting mist banks at level 0, 1, 2 (level 0 keeps the flat veil only)

const sm = (f) => f * f * (3 - 2 * f);
// The target of one slot: { mist, rain } both 0..1. About 45% of slots are clear, 30% misty, 25% rainy (rain brings mist).
export function slotWeather(seed, slot) {
  const s = ((slot % 65536) + 65536) % 65536;
  const r = hash3(s, 11, seed + 6131), q = hash3(s, 13, seed + 6133);
  if (r < 0.45) return { mist: 0, rain: 0 };
  if (r < 0.75) return { mist: 0.35 + 0.65 * q, rain: 0 };
  return { mist: 0.4 + 0.3 * q, rain: 0.25 + 0.75 * hash3(s, 17, seed + 6137) };
}
// The weather at ms (since 1970, UTC): { mist, rain, kind, slot } with mist 0..1 (of MAX_MIST) and rain 0..1. Smooth in time.
export function weatherAt(seed, ms) {
  const slot = Math.floor(ms / WEATHER_SLOT_MS), into = ms - slot * WEATHER_SLOT_MS;
  const cur = slotWeather(seed, slot);
  let mist = cur.mist, rain = cur.rain;
  if (into < BLEND_MS) {
    const f = sm(into / BLEND_MS), prev = slotWeather(seed, slot - 1);
    mist = prev.mist + (cur.mist - prev.mist) * f; rain = prev.rain + (cur.rain - prev.rain) * f;
  }
  const kind = rain > 0.12 ? "rain" : mist > 0.12 ? "mist" : "clear";
  return { mist, rain, kind, slot };
}
// `?weather=clear|mist|rain` pins the weather (tests, screenshots); anything else is ignored.
export function pickWeather(search) {
  const v = new URLSearchParams(search).get("weather");
  if (v === "clear") return { mist: 0, rain: 0, kind: "clear", slot: 0 };
  if (v === "mist") return { mist: 0.8, rain: 0, kind: "mist", slot: 0 };
  if (v === "rain") return { mist: 0.55, rain: 0.8, kind: "rain", slot: 0 };
  return null;
}

// How fast the shades of one slot travel, as a share of their usual speed: 1 - RAIN_SHADE_SLOW when it is raining at the
// start of the slot (or the weather is pinned to rain), else 1. One number per slot, so a shade never changes pace midway
// and every browser with the same seed and clock gives the same answer.
export function shadePaceAt(seed, slot, pinned) {
  const w = pinned || weatherAt(seed, slot * SLOT_MS);
  return w.kind === "rain" ? 1 - RAIN_SHADE_SLOW : 1;
}
// How opaque a name is (0..1): in mist, names of players farther than MIST_NAME_TILES fade out over MIST_NAME_FADE tiles,
// as strongly as the mist is thick (full from MIST_NAME_MIN up). Your own name and players within range stay solid.
export function nameAlpha(mist, tiles) {
  const m = Math.max(0, Math.min(1, (mist - 0.12) / (MIST_NAME_MIN - 0.12)));
  const far = Math.max(0, Math.min(1, (tiles - MIST_NAME_TILES) / MIST_NAME_FADE));
  return Number.isFinite(m + far) ? 1 - m * far : 1;
}
// How dark the shades make the sky strip: 0 with none out, up to 1 with a full wave, following their fade in and out.
// Also how many are out. Uses the same plans as the creatures on the ground, so it is the same for everyone.
export function shadeSkyAt(world, ms, pinned) {
  const slot = slotOf(ms), n = shadeCount(world.seed, slot), pace = shadePaceAt(world.seed, slot, pinned);
  let sum = 0, out = 0;
  for (let k = 0; k < n; k++) { const s = shadeAt(world, ms, k, pace); if (s) { sum += s.alpha; out++; } }
  return { dark: Math.min(1, sum / 2.5), out, expected: n };
}
// What the renderer needs for one frame.
export function skyAt(world, ms, pinned) {
  const w = pinned || weatherAt(world.seed, ms), s = shadeSkyAt(world, ms, pinned);
  return { mist: w.mist, rain: w.rain, kind: w.kind, shades: s.dark, shadesOut: s.out };
}

// Rain: n drops in a unit box that fall and slant, a pure function of time. Reduced motion: no drops are drawn at all
// (the grey tint and mist stay, which carry the same message without anything moving).
export function rainDrops(n, t, rain, reduce) {
  if (reduce || rain <= 0.02) return [];
  const count = Math.round(n * Math.min(1, rain)), out = [];
  for (let i = 0; i < count; i++) {
    const sp = 0.0011 + hash3(i, 3, 5501) * 0.0006, ph = hash3(i, 5, 5502);
    const y = ((ph + t * sp) % 1 + 1) % 1, x = (hash3(i, 7, 5503) + y * 0.12) % 1;
    out.push({ x, y, len: 0.025 + hash3(i, 9, 5504) * 0.02 });
  }
  return out;
}
// Mist banks: n soft blobs drifting slowly along the screen, in unit coordinates (x wraps). Reduced motion: still.
export function mistBanks(n, t, reduce) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const sp = 0.000006 + hash3(i, 3, 5601) * 0.000008, x0 = hash3(i, 5, 5602);
    out.push({ x: (x0 + (reduce ? 0 : t * sp)) % 1, y: 0.15 + hash3(i, 7, 5603) * 0.7, r: 0.35 + hash3(i, 9, 5604) * 0.25 });
  }
  return out;
}
