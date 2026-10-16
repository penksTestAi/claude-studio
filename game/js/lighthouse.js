// The long watch kept: when every beacon of a lantern burns at once, the ruined lighthouse lights for everyone there,
// for as long as the beacons' shared fuel counters exist (they are forgotten when the room empties, so the lighthouse
// goes dark with the last player). Nothing is sent for this: whether it is lit is worked out from the beacon state each
// browser already holds, and the shades' places are worked out from the shared clock plus that state.
//
// The light of the lighthouse: players inside SAFE_FRACTION of its reach cannot be snuffed (the same rule as a lit
// beacon), and shades keep out of the beam: a shade whose plan would take it inside the reach is held at its edge.
// The beam grows and fades over EASE_S seconds (instantly with reduced motion), so shades slide outward rather than jump.
export const LIGHTHOUSE_RADIUS = 14;   // tiles of light the lit lighthouse gives
export const SAFE_FRACTION = 0.9;      // inside this share of it a shade cannot snuff anyone
export const EASE_S = 2.5;
export const TOP_RISE = 1.9;           // tiles above the tower's foot where the lamp sits

export const lighthouseOf = (world) => world.landmarks.find(l => l.kind === "lighthouse") || null;

// Is the watch kept? Every beacon the island has must be lit (lit: array of booleans, one per beacon).
export const watchKept = (lit) => Array.isArray(lit) && lit.length > 0 && lit.every(v => v === true);

// A shade and the beam. f is how far the beam has grown (0 to 1). Pure: returns a new { x, y, fade }.
// A shade that was making for the lighthouse itself (sh.at) loses its way and fades out as the beam grows (fade 1 to 0).
// Any other shade whose path would take it inside the beam is held at the beam's edge, on the line from the lighthouse.
export function holdOut(sh, lh, f, radius = LIGHTHOUSE_RADIUS) {
  if (!lh || !(f > 0)) return { x: sh.x, y: sh.y, fade: 1 };
  const k = Math.min(1, f);
  const fade = sh.at && sh.at.x === lh.x && sh.at.y === lh.y ? 1 - k : 1;
  const dx = sh.x - lh.x, dy = sh.y - lh.y, d = Math.hypot(dx, dy), r = radius * k;
  if (d >= r) return { x: sh.x, y: sh.y, fade };
  const nx = d > 1e-6 ? dx / d : 1, ny = d > 1e-6 ? dy / d : 0;
  return { x: lh.x + nx * r, y: lh.y + ny * r, fade };
}

export const insideBeam = (x, y, lh, f, radius = LIGHTHOUSE_RADIUS) => !!lh && f >= 1 && Math.hypot(x - lh.x, y - lh.y) <= radius * SAFE_FRACTION;

// The eased size of the beam, 0 (dark) to 1 (full). update(kept, dt, reduce) moves it toward its target.
export function createBeam() {
  let f = 0;
  return {
    get f() { return f; },
    update(kept, dt, reduce) {
      if (reduce) f = kept ? 1 : 0;
      else f = kept ? Math.min(1, f + dt / EASE_S) : Math.max(0, f - dt / EASE_S);
      return f;
    },
    reset() { f = 0; },
  };
}
