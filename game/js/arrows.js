// Edge arrows: for every other player who is off screen, where on the screen edge to draw an arrow that
// points toward them, and how far away they are in tiles. Pure maths, tested in node.
//   me {x,y} and peers (iterable of {id,x,y,colour}) are in tiles; tile = screen px per tile;
//   W, H = screen size in px; inset = how far inside the edge the arrow sits.
export function edgeArrows(me, peers, tile, W, H, inset) {
  const out = [];
  const hw = W / 2, hh = H / 2;
  for (const p of peers) {
    const dx = (p.x - me.x) * tile, dy = (p.y - me.y) * tile;
    if (Math.abs(dx) <= hw && Math.abs(dy) <= hh) continue; // on screen: no arrow needed
    const s = Math.min((hw - inset) / Math.max(Math.abs(dx), 1e-9), (hh - inset) / Math.max(Math.abs(dy), 1e-9));
    out.push({ id: p.id, colour: p.colour, name: p.name, x: hw + dx * s, y: hh + dy * s, ang: Math.atan2(dy, dx), dist: Math.hypot(dx, dy) / tile });
  }
  return out;
}
