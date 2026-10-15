// The minimap: the whole island at one pixel per tile, with the landmarks and every player in their lantern
// colour. Drawn from the same seeded world as the big view; the only thing that changes is where the dots are.
import { T, LANDMARK_NAMES, BEACON_SIDES } from "./world.js";

const COL = { [T.DEEP]: "#0b1830", [T.SHALLOW]: "#1d4068", [T.SAND]: "#8f805c", [T.GRASS]: "#2f5a3a", [T.MEADOW]: "#4f703c", [T.TREE]: "#1d4a2c", [T.ROCK]: "#5a6068" };

// Eight compass words, from an angle in tiles (x east, y south).
const COMPASS = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];
export function compass(dx, dy) {
  const a = Math.atan2(dy, dx), i = Math.round(a / (Math.PI / 4));
  return COMPASS[((i % 8) + 8) % 8];
}
// "Old beacon (north-west of the island), 6 tiles south-east" for the landmark nearest to a point; null if none.
export function describeNearest(world, x, y) {
  let best = null, bd = Infinity;
  for (const l of world.landmarks) { const d = Math.hypot(l.x - x, l.y - y); if (d < bd) { bd = d; best = l; } }
  if (!best) return null;
  const name = LANDMARK_NAMES[best.kind] + (best.kind === "beacon" ? ` (${BEACON_SIDES[best.side]})` : "");
  return { name, tiles: Math.round(bd), dir: compass(best.x - x, best.y - y), kind: best.kind };
}

export function createMinimap(canvas, world) {
  const g = canvas.getContext("2d");
  canvas.width = world.w; canvas.height = world.h;
  const base = document.createElement("canvas");
  base.width = world.w; base.height = world.h;
  const bg = base.getContext("2d");
  for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) { bg.fillStyle = COL[world.tiles[y * world.w + x]]; bg.fillRect(x, y, 1, 1); }
  for (const l of world.landmarks) if (l.planks) { bg.fillStyle = "#c28a4a"; for (const [px, py] of l.planks) bg.fillRect(px, py, 1, 1); }
  let marks = 0;

  function mark(l) {
    const x = l.x, y = l.y;
    if (l.kind === "beacon") { g.fillStyle = "#ffcf5a"; g.beginPath(); g.moveTo(x, y - 3.5); g.lineTo(x + 3, y); g.lineTo(x, y + 3.5); g.lineTo(x - 3, y); g.closePath(); g.fill(); }
    else if (l.kind === "lighthouse") { g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + 3.5, y + 3); g.lineTo(x - 3.5, y + 3); g.closePath(); g.fill(); }
    else if (l.kind === "well") { g.strokeStyle = "#7fd0ff"; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.stroke(); }
    else { g.fillStyle = "#c28a4a"; g.fillRect(x - 2.5, y - 2.5, 5, 5); }
    marks++;
  }

  return {
    // me and peers carry x, y, colour, d. Peers' x, y are the eased drawn positions.
    draw(me, peers) {
      marks = 0;
      g.drawImage(base, 0, 0);
      for (const l of world.landmarks) mark(l);
      for (const p of peers) { g.fillStyle = p.colour; g.strokeStyle = "#05081a"; g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, 3, 0, Math.PI * 2); g.fill(); g.stroke(); }
      g.strokeStyle = "#fff3d6"; g.fillStyle = me.colour; g.lineWidth = 1.6;
      g.beginPath(); g.arc(me.x, me.y, 3.6, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(me.x, me.y); g.lineTo(me.x + Math.cos(me.d) * 7, me.y + Math.sin(me.d) * 7); g.stroke();
    },
    markCount: () => marks,
  };
}
