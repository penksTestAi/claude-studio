// Drawing: the island is painted once into an offscreen canvas (8 px per tile), then each frame the
// visible part is scaled up with a camera on the local player, avatars are drawn, and a night layer
// with a pool of lantern light around every player goes on top.
import { T } from "./world.js";

const TILE_SRC = 8;
const PAL = {
  [T.DEEP]: ["#0b1830", "#0c1a33", "#0a172d", "#0d1b35"],
  [T.SHALLOW]: ["#17345a", "#183660", "#163257", "#19385f"],
  [T.SAND]: ["#8a7b58", "#8f805c", "#857654", "#928360"],
  [T.GRASS]: ["#2f5a3a", "#31603d", "#2c5537", "#335f3f"],
  [T.MEADOW]: ["#4b6b3a", "#4f703c", "#476636", "#52733f"],
  [T.TREE]: ["#2f5a3a", "#31603d", "#2c5537", "#335f3f"],
  [T.ROCK]: ["#3a3f47", "#3e434b", "#373c44", "#41464e"],
};

export function paintWorld(world) {
  const c = document.createElement("canvas");
  c.width = world.w * TILE_SRC; c.height = world.h * TILE_SRC;
  const g = c.getContext("2d");
  for (let y = 0; y < world.h; y++) {
    for (let x = 0; x < world.w; x++) {
      const i = y * world.w + x, t = world.tiles[i], s = world.shade[i];
      g.fillStyle = PAL[t][s];
      g.fillRect(x * TILE_SRC, y * TILE_SRC, TILE_SRC, TILE_SRC);
      const px = x * TILE_SRC, py = y * TILE_SRC;
      if (t === T.TREE) {
        g.fillStyle = "#173b26"; g.beginPath(); g.arc(px + 4, py + 4, 3.6, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#215034"; g.beginPath(); g.arc(px + 3.3, py + 3.3, 2, 0, Math.PI * 2); g.fill();
      } else if (t === T.ROCK) {
        g.fillStyle = "#565c66"; g.fillRect(px + 1, py + 2, 6, 4); g.fillStyle = "#6b727d"; g.fillRect(px + 2, py + 2, 3, 2);
      } else if (t === T.MEADOW && s === 0) {
        g.fillStyle = "#c9b26b"; g.fillRect(px + 2, py + 5, 1, 1); g.fillStyle = "#b79ad6"; g.fillRect(px + 5, py + 2, 1, 1);
      } else if (t === T.SHALLOW && s === 1) {
        g.fillStyle = "#24477a"; g.fillRect(px + 1, py + 3, 3, 1);
      }
    }
  }
  return c;
}

export function createRenderer(canvas, world) {
  const g = canvas.getContext("2d");
  const map = paintWorld(world);
  const dark = document.createElement("canvas");
  const dg = dark.getContext("2d");
  let dpr = 1, cw = 0, ch = 0;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = canvas.clientWidth; ch = canvas.clientHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    dark.width = canvas.width; dark.height = canvas.height;
  }

  function draw(me, peers, stick, t) {
    if (canvas.clientWidth !== cw || canvas.clientHeight !== ch) resize();
    const tile = (cw < 520 ? 30 : 36) * dpr; // screen px per tile
    const W = canvas.width, H = canvas.height;
    const camX = me.x * tile - W / 2, camY = me.y * tile - H / 2;
    g.imageSmoothingEnabled = false;
    g.fillStyle = PAL[T.DEEP][0]; g.fillRect(0, 0, W, H);
    const k = tile / TILE_SRC;
    g.drawImage(map, -camX, -camY, map.width * k, map.height * k);

    const all = [...peers.values(), me];
    all.sort((a, b) => a.y - b.y);
    const fontPx = Math.round(12 * dpr);
    g.font = `${fontPx}px Georgia, serif`;
    g.textAlign = "center";
    for (const p of all) drawAvatar(g, p, p.x * tile - camX, p.y * tile - camY, tile, p === me, t);

    // Night layer with light pools.
    dg.globalCompositeOperation = "source-over";
    dg.clearRect(0, 0, W, H);
    dg.fillStyle = "rgba(3,6,18,0.5)"; dg.fillRect(0, 0, W, H);
    dg.globalCompositeOperation = "destination-out";
    for (const p of all) {
      const sx = p.x * tile - camX, sy = p.y * tile - camY, r = tile * 3.2;
      const grad = dg.createRadialGradient(sx, sy, 0, sx, sy, r);
      grad.addColorStop(0, "rgba(0,0,0,0.95)"); grad.addColorStop(0.55, "rgba(0,0,0,0.6)"); grad.addColorStop(1, "rgba(0,0,0,0)");
      dg.fillStyle = grad; dg.beginPath(); dg.arc(sx, sy, r, 0, Math.PI * 2); dg.fill();
    }
    g.drawImage(dark, 0, 0);

    // Names above the dark layer so they stay readable.
    for (const p of all) {
      const sx = p.x * tile - camX, sy = p.y * tile - camY - tile * 0.62;
      g.lineWidth = 3 * dpr; g.strokeStyle = "rgba(5,8,18,0.85)"; g.fillStyle = p === me ? "#fff3d6" : "#e6e9f2";
      g.strokeText(p.name, sx, sy); g.fillText(p.name, sx, sy);
    }

    if (stick.on) {
      g.strokeStyle = "rgba(255,243,214,0.5)"; g.lineWidth = 2 * dpr;
      g.beginPath(); g.arc(stick.ox * dpr, stick.oy * dpr, 48 * dpr, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "rgba(255,243,214,0.35)";
      g.beginPath(); g.arc(stick.x * dpr, stick.y * dpr, 16 * dpr, 0, Math.PI * 2); g.fill();
    }
  }

  return { draw, resize };
}

function drawAvatar(g, p, sx, sy, tile, isMe, t) {
  const r = tile * 0.33;
  const bob = p.moving ? Math.sin(t / 90) * tile * 0.03 : 0;
  g.fillStyle = "rgba(0,0,0,0.35)";
  g.beginPath(); g.ellipse(sx, sy + r * 0.9, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#1c2233";
  g.beginPath(); g.arc(sx, sy + bob, r, 0, Math.PI * 2); g.fill();
  g.lineWidth = Math.max(2, tile * 0.07); g.strokeStyle = p.colour;
  g.stroke();
  // The lantern, held toward the facing direction.
  const lx = sx + Math.cos(p.d) * r * 1.15, ly = sy + bob + Math.sin(p.d) * r * 1.15;
  g.fillStyle = p.colour;
  g.beginPath(); g.arc(lx, ly, r * 0.38, 0, Math.PI * 2); g.fill();
  if (isMe) {
    g.strokeStyle = "rgba(255,243,214,0.55)"; g.lineWidth = 1.5;
    g.beginPath(); g.arc(sx, sy + bob, r * 1.45, 0, Math.PI * 2); g.stroke();
  }
}
