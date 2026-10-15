// The night hour. One night is 8 game hours; each hour lasts 6 real minutes of the UTC clock, so a night is
// 48 real minutes and then it starts again. Everyone reads the same clock, so everyone in a lantern sees the same
// light without sending a single message. Pure functions, no DOM.
export const HOURS = 8;
export const HOUR_MS = 6 * 60 * 1000;
export const HOUR_NAMES = ["Dusk", "First watch", "Deep night", "Midnight", "Small hours", "Late watch", "Grey before dawn", "Dawn"];
// Per hour: how dark the night layer is (0..1), its tint (r, g, b) and how far a lantern reaches (tiles).
const DARK = [0.30, 0.42, 0.52, 0.60, 0.56, 0.48, 0.38, 0.26];
const TINT = [[40, 22, 38], [8, 14, 36], [3, 6, 18], [2, 4, 14], [3, 6, 18], [6, 10, 28], [22, 22, 44], [52, 30, 36]];
const REACH = [2.9, 3.1, 3.4, 3.6, 3.5, 3.3, 3.1, 2.9];

// Hour as a number in [0, 8) for a time in milliseconds since 1970 (UTC).
export function hourAt(ms) {
  const x = (ms % (HOURS * HOUR_MS)) / HOUR_MS;
  return x < 0 ? x + HOURS : x;
}
const mix = (a, b, f) => a + (b - a) * f;
// The light for an hour (a number, so it can sit between two hours): smooth, and wraps from dawn back to dusk.
export function lightFor(hour) {
  const h = ((hour % HOURS) + HOURS) % HOURS, i = Math.floor(h), j = (i + 1) % HOURS, f = h - i;
  return {
    hour: h, index: i, name: HOUR_NAMES[i],
    dark: mix(DARK[i], DARK[j], f),
    tint: [0, 1, 2].map(k => Math.round(mix(TINT[i][k], TINT[j][k], f))),
    reach: mix(REACH[i], REACH[j], f),
  };
}
// `?hour=3` pins the hour (tests, screenshots); anything that is not a number from 0 up to 8 is ignored.
export function pickHour(search) {
  const v = new URLSearchParams(search).get("hour");
  if (v === null || v === "" || !/^\d(\.\d{1,2})?$/.test(v)) return null;
  const n = Number(v);
  return n >= 0 && n < HOURS ? n : null;
}
