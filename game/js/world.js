// The world: one island generated from a fixed seed, identical in every browser.
// Only exactly-rounded arithmetic (+ - * / floor, integer ops) is used here, never Math.sin/exp/pow,
// so every JavaScript engine produces the same tiles bit for bit.

export const WORLD_SEED = 20261015;
export const W = 128;
export const H = 128;

export const T = { DEEP: 0, SHALLOW: 1, SAND: 2, GRASS: 3, TREE: 4, ROCK: 5, MEADOW: 6 };
const BLOCKING = new Set([T.DEEP, T.TREE, T.ROCK]);

// Integer hash of (x, y, seed) -> [0, 1). Uses Math.imul, which is exact.
export function hash3(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t) { return t * t * (3 - 2 * t); }

// Value noise on an integer lattice, bilinear with smoothstep.
function valueNoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash3(xi, yi, s), b = hash3(xi + 1, yi, s);
  const c = hash3(xi, yi + 1, s), d = hash3(xi + 1, yi + 1, s);
  const top = a + (b - a) * xf, bot = c + (d - c) * xf;
  return top + (bot - top) * yf;
}

function fbm(x, y, s) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < 4; o++) {
    sum += valueNoise(x * freq, y * freq, s + o * 101) * amp;
    norm += amp; amp *= 0.5; freq *= 2;
  }
  return sum / norm;
}

export function generateWorld(seed = WORLD_SEED) {
  const tiles = new Uint8Array(W * H);
  const shade = new Uint8Array(W * H); // small per-tile variation for drawing
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x - W / 2) / (W / 2), ny = (y - H / 2) / (H / 2);
      const r2 = nx * nx + ny * ny; // 0 at centre, 1 at the edge circle
      const height = fbm(x / 22, y / 22, seed) - r2 * 0.62 + 0.05;
      const moist = fbm(x / 14 + 40, y / 14 + 40, seed + 7);
      const rocky = fbm(x / 9 + 90, y / 9 + 90, seed + 13);
      let t;
      if (height < 0.18) t = T.DEEP;
      else if (height < 0.24) t = T.SHALLOW;
      else if (height < 0.29) t = T.SAND;
      else if (rocky > 0.68 && height > 0.36) t = T.ROCK;
      else if (moist > 0.58 && hash3(x, y, seed + 3) < 0.55) t = T.TREE;
      else if (moist < 0.36) t = T.MEADOW;
      else t = T.GRASS;
      tiles[y * W + x] = t;
      shade[y * W + x] = Math.floor(hash3(x, y, seed + 5) * 4);
    }
  }
  const world = { seed, w: W, h: H, tiles, shade };
  world.spawn = findSpawn(world);
  world.landmarks = placeLandmarks(world);
  world.solid = new Set(); // landmark tiles that block walking (key = y * w + x)
  for (const l of world.landmarks) if (l.solid) world.solid.add(Math.floor(l.y) * world.w + Math.floor(l.x));
  return world;
}

// ---- landmarks: placed from the seed, the same in every browser ----
// Kinds and the fixed words shown for them (a peer never supplies any text).
export const LANDMARK_KINDS = ["beacon", "lighthouse", "jetty", "well"];
export const LANDMARK_NAMES = { beacon: "Old beacon", lighthouse: "Ruined lighthouse", jetty: "Jetty", well: "Well" };
export const BEACON_SIDES = ["north-west", "north-east", "south-west", "south-east"];

// Open ground a player can walk to from the spawn (flood fill over tiles that do not block).
export function reachable(world) {
  const { w, h } = world, seen = new Uint8Array(w * h), q = [];
  const sx = Math.floor(world.spawn.x), sy = Math.floor(world.spawn.y);
  seen[sy * w + sx] = 1; q.push(sx, sy);
  for (let i = 0; i < q.length; i += 2) {
    const x = q[i], y = q[i + 1];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny * w + nx] || isBlocked(world, nx, ny)) continue;
      seen[ny * w + nx] = 1; q.push(nx, ny);
    }
  }
  return seen;
}

const isLand = (t) => t === T.SAND || t === T.GRASS || t === T.MEADOW;
// Is there water (shallow or deep) within `r` tiles?
function waterNear(world, x, y, r) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const t = tileAt(world, x + dx, y + dy);
    if (t === T.DEEP || t === T.SHALLOW) return true;
  }
  return false;
}

function placeLandmarks(world) {
  const { w, h, seed } = world;
  const seen = reachable(world);
  const cx = w / 2, cy = h / 2;
  const out = [];
  const far = (x, y, min) => out.every(l => Math.abs(l.x - x - 0.5) + Math.abs(l.y - y - 0.5) >= min);
  // Best candidate = highest seeded score among tiles passing `ok`; ties impossible in practice, scan order breaks them.
  const pick = (salt, ok) => {
    let best = null, bs = -1;
    for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
      if (!seen[y * w + x] || !ok(x, y)) continue;
      const sc = hash3(x, y, seed + salt);
      if (sc > bs) { bs = sc; best = { x, y }; }
    }
    return best;
  };
  const d2 = (x, y) => (x - cx) * (x - cx) + (y - cy) * (y - cy);

  // Four old beacons on headlands: one per quarter of the island, on land near water, well away from the middle.
  for (let q = 0; q < 4; q++) {
    const right = q % 2 === 1, down = q >= 2;
    for (const [minD2, gap] of [[26 * 26, 18], [20 * 20, 12], [12 * 12, 6]]) {
      const c = pick(31 + q, (x, y) => (x + 0.5 >= cx) === right && (y + 0.5 >= cy) === down
        && isLand(tileAt(world, x, y)) && d2(x, y) >= minD2 && waterNear(world, x, y, 3) && far(x, y, gap));
      if (c) { out.push({ kind: "beacon", side: q, x: c.x + 0.5, y: c.y + 0.5, solid: true }); break; }
    }
  }
  // The ruined lighthouse: on rock or open ground far out, away from the beacons.
  for (const gap of [24, 14, 8]) {
    const c = pick(41, (x, y) => (isLand(tileAt(world, x, y)) || tileAt(world, x, y) === T.GRASS) && d2(x, y) >= 18 * 18 && waterNear(world, x, y, 4) && far(x, y, gap));
    if (c) { out.push({ kind: "lighthouse", x: c.x + 0.5, y: c.y + 0.5, solid: true }); break; }
  }
  // The jetty: from a sand tile at the shore, planks run out over shallow water in the direction with the most of it (2 to 4 tiles).
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const run = (x, y, [dx, dy]) => { let n = 0; while (n < 4 && tileAt(world, x + dx * (n + 1), y + dy * (n + 1)) === T.SHALLOW) n++; return n; };
  for (const gap of [14, 8, 3]) {
    const c = pick(51, (x, y) => tileAt(world, x, y) === T.SAND && far(x, y, gap) && DIRS.some(d => run(x, y, d) >= 2));
    if (!c) continue;
    let bd = DIRS[0], bn = -1;
    for (const d of DIRS) { const n = run(c.x, c.y, d); if (n > bn) { bn = n; bd = d; } }
    const planks = [];
    for (let i = 1; i <= bn; i++) planks.push([c.x + bd[0] * i, c.y + bd[1] * i]);
    out.push({ kind: "jetty", x: c.x + 0.5 + bd[0] * (bn / 2 + 0.5), y: c.y + 0.5 + bd[1] * (bn / 2 + 0.5), planks, dir: bd, solid: false });
    break;
  }
  // The well: open ground a short walk from where everyone arrives.
  for (const [lo, hi] of [[6, 14], [4, 22], [3, 40]]) {
    const c = pick(61, (x, y) => (tileAt(world, x, y) === T.GRASS || tileAt(world, x, y) === T.MEADOW) && openAround(world, x, y)
      && Math.abs(x + 0.5 - world.spawn.x) + Math.abs(y + 0.5 - world.spawn.y) >= lo && Math.abs(x + 0.5 - world.spawn.x) + Math.abs(y + 0.5 - world.spawn.y) <= hi && far(x, y, 4));
    if (c) { out.push({ kind: "well", x: c.x + 0.5, y: c.y + 0.5, solid: true }); break; }
  }
  return out;
}

// What the ground under a point is made of, for footstep sounds: wood on the jetty, otherwise by tile.
export function surfaceAt(world, x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  for (const l of world.landmarks) if (l.planks && l.planks.some(([px, py]) => px === tx && py === ty)) return "wood";
  const t = tileAt(world, x, y);
  return t === T.SHALLOW || t === T.DEEP ? "water" : t === T.SAND ? "sand" : t === T.ROCK ? "stone" : "grass";
}

// A short fingerprint of the landmark list; the tests compare it between browsers.
export function landmarkFingerprint(world) {
  let h = 2166136261;
  for (const l of world.landmarks) for (const v of [LANDMARK_KINDS.indexOf(l.kind), Math.round(l.x * 2), Math.round(l.y * 2)]) { h ^= v; h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

export function tileAt(world, x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) return T.DEEP;
  return world.tiles[ty * world.w + tx];
}

export function isBlocked(world, x, y) {
  if (BLOCKING.has(tileAt(world, x, y))) return true;
  return !!world.solid && world.solid.has(Math.floor(y) * world.w + Math.floor(x));
}

// The nearest open grass or meadow tile to the middle of the map, found by a square spiral.
function findSpawn(world) {
  const cx = world.w >> 1, cy = world.h >> 1;
  for (let r = 0; r < world.w / 2; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const t = tileAt(world, cx + dx, cy + dy);
        if ((t === T.GRASS || t === T.MEADOW) && openAround(world, cx + dx, cy + dy)) return { x: cx + dx + 0.5, y: cy + dy + 0.5 };
      }
    }
  }
  return { x: cx + 0.5, y: cy + 0.5 };
}

function openAround(world, x, y) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isBlocked(world, x + dx, y + dy)) return false;
  return true;
}

// The player's collision half-width (main.js RADIUS). A spawn must let the body move in at least one of the
// four directions; about 1 in 100 spawns inside a pocket of rock or tree could not move at all.
const BODY = 0.28;
function canMoveFrom(world, x, y) {
  const hits = (px, py) => [[-BODY, -BODY], [BODY, -BODY], [-BODY, BODY], [BODY, BODY]].some(([ox, oy]) => isBlocked(world, px + ox, py + oy));
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let px = x, py = y;
    for (let s = 0; s < 10; s++) { // walk 0.01 tile at a time, as the player does, and stop at the first wall
      if (hits(px + dx * 0.01, py + dy * 0.01)) break;
      px += dx * 0.01; py += dy * 0.01;
    }
    if (Math.hypot(px - x, py - y) >= 0.1) return true;
  }
  return false;
}

// A walkable point near the spawn, chosen from a player's own seed so arrivals do not stack exactly.
export function spawnFor(world, playerSeed) {
  for (let i = 0; i < 40; i++) {
    const ox = (hash3(playerSeed, i, 17) - 0.5) * 6, oy = (hash3(playerSeed, i, 29) - 0.5) * 6;
    const x = world.spawn.x + ox, y = world.spawn.y + oy;
    if (!isBlocked(world, x, y) && tileAt(world, x, y) !== T.SHALLOW && canMoveFrom(world, x, y)) return { x, y };
  }
  return { ...world.spawn };
}

// Count tiles by kind; used by the tests to check every browser built the same island.
export function worldFingerprint(world) {
  let h = 2166136261;
  for (let i = 0; i < world.tiles.length; i++) { h ^= world.tiles[i]; h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
