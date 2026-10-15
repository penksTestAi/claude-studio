// Drawing: the island is painted once into an offscreen canvas (8 px per tile), then each frame the
// visible part is scaled up with a camera on the local player, avatars are drawn, and a night layer
// with a pool of lantern light around every player goes on top.
import { T, LANDMARK_NAMES } from "./world.js";
import { PHRASES, EMOTES } from "./talk.js";
import { edgeArrows } from "./arrows.js";

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

// The small up-and-down bob while walking. Reduced-motion players get a steady avatar.
export function walkBob(moving, t, tile, reduce) { return moving && !reduce ? Math.sin(t / 90) * tile * 0.03 : 0; }

function paintLandmarks(g, world) {
  const P = TILE_SRC;
  for (const l of world.landmarks) {
    const px = Math.floor(l.x) * P, py = Math.floor(l.y) * P;
    if (l.kind === "beacon") { // a stone base, a dark post and an unlit iron basket
      g.fillStyle = "#4a4f58"; g.fillRect(px + 1, py + 4, 6, 4);
      g.fillStyle = "#2a2118"; g.fillRect(px + 3, py - 6, 2, 11);
      g.fillStyle = "#1a1612"; g.fillRect(px + 1, py - 10, 6, 4);
      g.fillStyle = "#6b4a2a"; g.fillRect(px + 2, py - 9, 4, 1);
    } else if (l.kind === "lighthouse") { // a round tower with a broken top and a dark doorway
      g.fillStyle = "#8d8f94"; g.fillRect(px + 1, py - 14, 6, 21);
      g.fillStyle = "#6e7077"; g.fillRect(px + 1, py - 14, 2, 21);
      g.fillStyle = "#b9bbbf"; g.fillRect(px + 1, py - 4, 6, 2); g.fillRect(px + 1, py - 10, 6, 2);
      g.fillStyle = "#0b1830"; g.fillRect(px + 1, py - 15, 2, 2); g.fillRect(px + 4, py - 16, 2, 3); // broken crown
      g.fillStyle = "#1a1612"; g.fillRect(px + 3, py + 3, 2, 4);
    } else if (l.kind === "jetty") {
      for (const [bx, by] of l.planks) {
        g.fillStyle = "#6b4a2a"; g.fillRect(bx * P, by * P, P, P);
        g.fillStyle = "#8a6238";
        if (l.dir[0]) for (let i = 1; i < P; i += 3) g.fillRect(bx * P + i, by * P, 1, P);
        else for (let i = 1; i < P; i += 3) g.fillRect(bx * P, by * P + i, P, 1);
        g.fillStyle = "#2a2118";
        if (l.dir[0]) { g.fillRect(bx * P, by * P, P, 1); g.fillRect(bx * P, by * P + P - 1, P, 1); } else { g.fillRect(bx * P, by * P, 1, P); g.fillRect(bx * P + P - 1, by * P, 1, P); }
      }
    } else if (l.kind === "well") { // a ring of stones around dark water
      g.fillStyle = "#6b727d"; g.beginPath(); g.arc(px + 4, py + 4, 3.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#0b1830"; g.beginPath(); g.arc(px + 4, py + 4, 2, 0, Math.PI * 2); g.fill();
    }
  }
}

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
  paintLandmarks(g, world);
  return c;
}

export function createRenderer(canvas, world, opts = {}) {
  const g = canvas.getContext("2d");
  const map = paintWorld(world);
  const dark = document.createElement("canvas");
  const dg = dark.getContext("2d");
  let dpr = 1, cw = 0, ch = 0, lastArrows = [];

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = canvas.clientWidth; ch = canvas.clientHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    dark.width = canvas.width; dark.height = canvas.height;
  }

  function draw(me, peers, stick, t, light) {
    const reduce = !!(opts.reducedMotion && opts.reducedMotion());
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
    for (const p of all) drawAvatar(g, p, p.x * tile - camX, p.y * tile - camY, tile, p === me, t, reduce);

    // Night layer with light pools.
    dg.globalCompositeOperation = "source-over";
    dg.clearRect(0, 0, W, H);
    const lt = light || { dark: 0.5, tint: [3, 6, 18], reach: 3.2 };
    dg.fillStyle = `rgba(${lt.tint[0]},${lt.tint[1]},${lt.tint[2]},${lt.dark.toFixed(3)})`; dg.fillRect(0, 0, W, H);
    dg.globalCompositeOperation = "destination-out";
    for (const p of all) {
      const sx = p.x * tile - camX, sy = p.y * tile - camY, r = tile * lt.reach;
      const grad = dg.createRadialGradient(sx, sy, 0, sx, sy, r);
      grad.addColorStop(0, "rgba(0,0,0,0.95)"); grad.addColorStop(0.55, "rgba(0,0,0,0.6)"); grad.addColorStop(1, "rgba(0,0,0,0)");
      dg.fillStyle = grad; dg.beginPath(); dg.arc(sx, sy, r, 0, Math.PI * 2); dg.fill();
    }
    g.drawImage(dark, 0, 0);

    // Landmark names when one is close (words from our own list).
    g.font = `${fontPx}px Georgia, serif`; g.textAlign = "center";
    for (const l of world.landmarks) {
      const d = Math.hypot(l.x - me.x, l.y - me.y);
      if (d > 7) continue;
      const lx = l.x * tile - camX, ly = (l.y - (l.kind === "jetty" ? 0.2 : 1.3)) * tile - camY;
      g.globalAlpha = Math.min(1, (7 - d) / 2);
      g.lineWidth = 3 * dpr; g.strokeStyle = "rgba(5,8,18,0.85)"; g.fillStyle = "#f2d9a0";
      g.strokeText(LANDMARK_NAMES[l.kind], lx, ly); g.fillText(LANDMARK_NAMES[l.kind], lx, ly);
      g.globalAlpha = 1;
    }

    // Names above the dark layer so they stay readable.
    for (const p of all) {
      const sx = p.x * tile - camX, sy = p.y * tile - camY - tile * 0.62;
      g.lineWidth = 3 * dpr; g.strokeStyle = "rgba(5,8,18,0.85)"; g.fillStyle = p === me ? "#fff3d6" : "#e6e9f2";
      g.strokeText(p.name, sx, sy); g.fillText(p.name, sx, sy);
    }

    // Speech bubbles (preset phrases, words from our own list), over the names.
    for (const p of all) {
      if (!p.say || t >= p.say.until) continue;
      drawBubble(g, PHRASES[p.say.id], p.say, p.x * tile - camX, p.y * tile - camY - tile * 0.62 - fontPx * 1.5, fontPx, dpr, t, W);
    }

    // Arrows at the screen edge toward players who are off screen.
    lastArrows = edgeArrows(me, peers.values(), tile, W, H, 22 * dpr);
    for (const a of lastArrows) drawArrow(g, a, fontPx, dpr);

    if (stick.on) {
      g.strokeStyle = "rgba(255,243,214,0.5)"; g.lineWidth = 2 * dpr;
      g.beginPath(); g.arc(stick.ox * dpr, stick.oy * dpr, 48 * dpr, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "rgba(255,243,214,0.35)";
      g.beginPath(); g.arc(stick.x * dpr, stick.y * dpr, 16 * dpr, 0, Math.PI * 2); g.fill();
    }
  }

  return { draw, resize, arrows: () => lastArrows.map(a => ({ id: a.id, dist: a.dist, ang: a.ang })) };
}

function drawAvatar(g, p, sx, sy, tile, isMe, t, reduce) {
  const r0 = tile * 0.33;
  const e = p.emote && t < p.emote.until ? p.emote : null;
  const name = e ? EMOTES[e.id] : "";
  const k = e ? (t - e.start) / (e.until - e.start) : 0; // 0..1 through the gesture
  let r = r0, bob = walkBob(p.moving, t, tile, reduce), dip = 0;
  if (name === "bow") dip = Math.sin(Math.PI * Math.min(1, k * 1.4)) * tile * 0.16;
  if (name === "cheer" && !reduce) bob -= Math.abs(Math.sin(k * Math.PI * 3)) * tile * 0.22;
  if (name === "sit") { r = r0 * 0.82; dip = r0 * 0.25; }
  g.fillStyle = "rgba(0,0,0,0.35)";
  g.beginPath(); g.ellipse(sx, sy + r0 * 0.9, r0 * 0.9, r0 * 0.35, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#1c2233";
  g.beginPath(); g.arc(sx, sy + bob + dip, r, 0, Math.PI * 2); g.fill();
  g.lineWidth = Math.max(2, tile * 0.07); g.strokeStyle = p.colour;
  g.stroke();
  // The lantern, held toward the facing direction (set down in front when sitting).
  let lx = sx + Math.cos(p.d) * r * 1.15, ly = sy + bob + dip + Math.sin(p.d) * r * 1.15;
  if (name === "sit") { lx = sx + Math.cos(p.d) * r * 1.5; ly = sy + r0 * 0.75 + Math.sin(p.d) * r * 0.6; }
  g.fillStyle = p.colour;
  g.beginPath(); g.arc(lx, ly, r * 0.38, 0, Math.PI * 2); g.fill();
  if (name === "wave") { // a raised hand swinging side to side
    const hx = sx + r * 1.1 + (reduce ? 0 : Math.sin(t / 80) * r * 0.5), hy = sy - r * 1.35;
    g.strokeStyle = "#e8d3b0"; g.lineWidth = Math.max(2, tile * 0.06);
    g.beginPath(); g.moveTo(sx + r * 0.8, sy - r * 0.3); g.lineTo(hx, hy); g.stroke();
    g.fillStyle = "#e8d3b0"; g.beginPath(); g.arc(hx, hy, r * 0.22, 0, Math.PI * 2); g.fill();
  } else if (name === "point") { // an arm and arrow head along the facing direction
    const len = r * (2.5 + (reduce ? 0 : Math.sin(t / 120) * 0.2)), ax = sx + Math.cos(p.d) * len, ay = sy + bob + Math.sin(p.d) * len;
    g.strokeStyle = "#e8d3b0"; g.lineWidth = Math.max(2, tile * 0.06);
    g.beginPath(); g.moveTo(sx + Math.cos(p.d) * r, sy + bob + Math.sin(p.d) * r); g.lineTo(ax, ay); g.stroke();
    g.fillStyle = "#e8d3b0"; g.beginPath();
    g.moveTo(ax + Math.cos(p.d) * r * 0.5, ay + Math.sin(p.d) * r * 0.5);
    g.lineTo(ax + Math.cos(p.d + 2.4) * r * 0.45, ay + Math.sin(p.d + 2.4) * r * 0.45);
    g.lineTo(ax + Math.cos(p.d - 2.4) * r * 0.45, ay + Math.sin(p.d - 2.4) * r * 0.45); g.closePath(); g.fill();
  } else if (name === "cheer") { // little sparks
    g.fillStyle = "#ffe9a8";
    for (let i = 0; i < 6; i++) {
      const a = i * 1.047 + (reduce ? 0 : k * 3), d = r * (1.6 + k * 1.2);
      g.fillRect(sx + Math.cos(a) * d - 1.5, sy + bob + Math.sin(a) * d - 1.5, 3, 3);
    }
  }
  if (isMe) {
    g.strokeStyle = "rgba(255,243,214,0.55)"; g.lineWidth = 1.5;
    g.beginPath(); g.arc(sx, sy + bob + dip, r * 1.45, 0, Math.PI * 2); g.stroke();
  }
}

// A bubble with a thin bar that runs down as the phrase is about to fade. Text comes from our own list only.
function drawBubble(g, text, say, cx, bottom, fontPx, dpr, t, W) {
  if (typeof text !== "string") return;
  g.font = `${fontPx}px Georgia, serif`; g.textAlign = "center";
  const padX = 8 * dpr, h = fontPx * 1.7;
  const w = g.measureText(text).width + padX * 2;
  const x = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, cx)), y = bottom - h;
  const left = Math.min(1, Math.max(0, (say.until - t) / (say.until - say.start)));
  const fade = Math.min(1, (say.until - t) / 400);
  g.globalAlpha = fade;
  g.fillStyle = "rgba(255,248,230,0.95)"; g.strokeStyle = "rgba(5,8,18,0.8)"; g.lineWidth = 1.5 * dpr;
  g.beginPath();
  if (g.roundRect) g.roundRect(x - w / 2, y, w, h, 6 * dpr); else g.rect(x - w / 2, y, w, h);
  g.fill(); g.stroke();
  g.fillStyle = "#16120c"; g.textBaseline = "middle";
  g.fillText(text, x, y + h * 0.5 - dpr);
  g.fillStyle = "rgba(168,86,28,0.85)"; g.fillRect(x - w / 2 + 3 * dpr, y + h - 4 * dpr, (w - 6 * dpr) * left, 2 * dpr);
  g.textBaseline = "alphabetic"; g.globalAlpha = 1;
}

function drawArrow(g, a, fontPx, dpr) {
  g.save();
  g.translate(a.x, a.y); g.rotate(a.ang);
  const s = 9 * dpr;
  g.fillStyle = a.colour; g.strokeStyle = "rgba(5,8,18,0.9)"; g.lineWidth = 2 * dpr;
  g.beginPath(); g.moveTo(s, 0); g.lineTo(-s * 0.8, -s * 0.8); g.lineTo(-s * 0.4, 0); g.lineTo(-s * 0.8, s * 0.8); g.closePath();
  g.stroke(); g.fill();
  g.restore();
  // distance, tucked inward from the arrow
  const lab = `${Math.round(a.dist)}`;
  g.font = `${Math.round(fontPx * 0.9)}px Georgia, serif`; g.textAlign = "center"; g.textBaseline = "middle";
  const lx = a.x - Math.cos(a.ang) * 20 * dpr, ly = a.y - Math.sin(a.ang) * 20 * dpr;
  g.lineWidth = 3 * dpr; g.strokeStyle = "rgba(5,8,18,0.85)"; g.fillStyle = "#e6e9f2";
  g.strokeText(lab, lx, ly); g.fillText(lab, lx, ly);
  g.textBaseline = "alphabetic";
}
