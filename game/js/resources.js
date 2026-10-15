// Things to gather: driftwood, reeds and oil berries at seeded spots. Generated from the world seed, so
// every browser has the same list in the same order; a node is identified on the network only by its index.
// Pure code (no DOM), so the tests run it in node.
import { T, tileAt, isBlocked, hash3, reachable } from "./world.js";

export const KINDS = ["driftwood", "reeds", "berries"];
export const KIND_NAMES = { driftwood: "Driftwood", reeds: "Reeds", berries: "Oil berries" };
export const PER_KIND = 14;          // nodes of each kind on the island
export const MIN_GAP = 4;            // tiles (taxicab) between any two nodes
export const RESPAWN_MIN_S = 90, RESPAWN_SPAN_S = 61; // seeded respawn: 90 to 150 seconds
export const MAX_RESPAWN_S = 600;    // the largest respawn any message may carry (tests may pin a shorter one)

const near = (world, x, y, r, pred) => {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (pred(tileAt(world, x + dx, y + dy))) return true;
  return false;
};
const isWater = (t) => t === T.SHALLOW || t === T.DEEP;
const RULES = {
  driftwood: (w, x, y) => tileAt(w, x, y) === T.SAND && near(w, x, y, 2, isWater),
  reeds: (w, x, y) => (tileAt(w, x, y) === T.SAND || tileAt(w, x, y) === T.GRASS || tileAt(w, x, y) === T.MEADOW) && near(w, x, y, 1, t => t === T.SHALLOW),
  berries: (w, x, y) => (tileAt(w, x, y) === T.GRASS || tileAt(w, x, y) === T.MEADOW) && near(w, x, y, 2, t => t === T.TREE),
};

export function generateNodes(world) {
  const seen = reachable(world), out = [];
  const taken = (x, y) => out.some(n => Math.abs(n.x - x - 0.5) + Math.abs(n.y - y - 0.5) < MIN_GAP)
    || world.landmarks.some(l => Math.abs(l.x - x - 0.5) + Math.abs(l.y - y - 0.5) < 2.5);
  KINDS.forEach((kind, ki) => {
    const cands = [];
    for (let y = 2; y < world.h - 2; y++) for (let x = 2; x < world.w - 2; x++) {
      if (!seen[y * world.w + x] || isBlocked(world, x, y) || !RULES[kind](world, x, y)) continue;
      cands.push({ x, y, s: hash3(x, y, world.seed + 200 + ki) });
    }
    cands.sort((a, b) => b.s - a.s || a.y - b.y || a.x - b.x);
    let n = 0;
    for (const c of cands) {
      if (n >= PER_KIND) break;
      if (taken(c.x, c.y)) continue;
      out.push({ kind, x: c.x + 0.5, y: c.y + 0.5 }); n++;
    }
  });
  out.forEach((n, i) => { n.id = i; n.respawn = RESPAWN_MIN_S + Math.floor(hash3(Math.floor(n.x), Math.floor(n.y), world.seed + 77) * RESPAWN_SPAN_S); });
  return out;
}

export function nodeFingerprint(nodes) {
  let h = 2166136261;
  for (const n of nodes) for (const v of [KINDS.indexOf(n.kind), Math.round(n.x * 2), Math.round(n.y * 2), n.respawn]) { h ^= v; h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

// The nearest node in `list` within `range` tiles of (x, y), or null.
export function nearestNode(list, x, y, range) {
  let best = null, bd = range * range;
  for (const n of list) { const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y); if (d <= bd) { bd = d; best = n; } }
  return best;
}
