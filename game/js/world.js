// The world: one island generated from a fixed seed, identical in every browser.
// Only exactly-rounded arithmetic (+ - * / floor, integer ops) is used here, never Math.sin/exp/pow,
// so every JavaScript engine produces the same tiles bit for bit.

export const WORLD_SEED = 20261015;
export const W = 128;
export const H = 128;

export const T = { DEEP: 0, SHALLOW: 1, SAND: 2, GRASS: 3, TREE: 4, ROCK: 5, MEADOW: 6 };
const BLOCKING = new Set([T.DEEP, T.TREE, T.ROCK]);

// Integer hash of (x, y, seed) -> [0, 1). Uses Math.imul, which is exact.
function hash3(x, y, s) {
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
  return world;
}

export function tileAt(world, x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) return T.DEEP;
  return world.tiles[ty * world.w + tx];
}

export function isBlocked(world, x, y) { return BLOCKING.has(tileAt(world, x, y)); }

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

// A walkable point near the spawn, chosen from a player's own seed so arrivals do not stack exactly.
export function spawnFor(world, playerSeed) {
  for (let i = 0; i < 40; i++) {
    const ox = (hash3(playerSeed, i, 17) - 0.5) * 6, oy = (hash3(playerSeed, i, 29) - 0.5) * 6;
    const x = world.spawn.x + ox, y = world.spawn.y + oy;
    if (!isBlocked(world, x, y) && tileAt(world, x, y) !== T.SHALLOW) return { x, y };
  }
  return { ...world.spawn };
}

// Count tiles by kind; used by the tests to check every browser built the same island.
export function worldFingerprint(world) {
  let h = 2166136261;
  for (let i = 0; i < world.tiles.length; i++) { h ^= world.tiles[i]; h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
