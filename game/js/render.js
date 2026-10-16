// Drawing: the island is painted once into an offscreen canvas (8 px per tile), then each frame the
// visible part is scaled up with a camera on the local player, avatars are drawn, and a night layer
// with a pool of lantern light around every player goes on top.
import { T, LANDMARK_NAMES } from "./world.js";
import { KIND_NAMES } from "./resources.js";
import { PHRASES, EMOTES } from "./talk.js";
import { edgeArrows } from "./arrows.js";
import { lampOf } from "./craft.js";
import { LIT_RADIUS, BEACON_NEED } from "./beacon.js";
import { classify, D, EDGE, phaseOf, sway, foamState, sparkle, moonAt, starAlpha, STARS, fireflies, softStops, createGovernor } from "./living.js";

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
        g.fillStyle = "#173b26"; g.beginPath(); g.arc(px + 4, py + 4, 3.6, 0, Math.PI * 2); g.fill(); // the crown's lit side sways: drawn each frame by the renderer
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
  let dpr = 1, cw = 0, ch = 0, lastArrows = [], lastLights = [];
  // The living layer: animated water, foam, swaying trees and grass, fireflies, the moon. `?look=plain` switches it
  // off, `?look=low` starts at the lowest level; by default a governor lowers it on a device that cannot keep up.
  const living = classify(world), gov = createGovernor(opts.look === "low" ? 0 : 2);
  const plain = opts.look === "plain";
  const samples = new Float32Array(240), frames = new Float32Array(240); let nSamp = 0, prevT = 0, drawCalls = 0;
  let flyCount = 0;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = canvas.clientWidth; ch = canvas.clientHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    dark.width = canvas.width; dark.height = canvas.height;
  }

  // ---- the living layer: water glints, shore foam, swaying crowns and grass, all on the visible tiles only ----
  function drawGround(t, reduce, level, camX, camY, tile, W, H, light) {
    const k = tile / TILE_SRC, w = world.w, seed = world.seed;
    const x0 = Math.max(0, Math.floor(camX / tile)), x1 = Math.min(w - 1, Math.floor((camX + W) / tile));
    const y0 = Math.max(0, Math.floor(camY / tile)), y1 = Math.min(world.h - 1, Math.floor((camY + H) / tile));
    const moon = moonAt(light.hour), glintK = 0.35 + 0.5 * moon.lit, th = Math.max(1, k * 0.55);
    const lively = !plain;
    const crowns = new Path2D(), flecks = new Path2D(), blades = new Path2D(), bladesM = new Path2D();
    let nBlades = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x, d = living.deco[i], f = living.foam[i];
        if (!d && !f) continue;
        const px = x * tile - camX, py = y * tile - camY, ph = phaseOf(x, y, seed);
        if (d === D.TREE) {
          const sw = sway(t, ph, reduce || !lively);
          crowns.moveTo(px + (3.3 + sw.x) * k + 2 * k, py + (3.3 + sw.y) * k); crowns.arc(px + (3.3 + sw.x) * k, py + (3.3 + sw.y) * k, 2 * k, 0, Math.PI * 2);
          if (lively) { flecks.moveTo(px + (2.5 + sw.x * 1.7) * k + 0.9 * k, py + (2.6 + sw.y * 1.7) * k); flecks.arc(px + (2.5 + sw.x * 1.7) * k, py + (2.6 + sw.y * 1.7) * k, 0.9 * k, 0, Math.PI * 2); }
        }
        if (!lively) continue;
        if (f) {
          const fs = foamState(t, ph, reduce), off = fs.wash * 0.2 * tile;
          g.fillStyle = `rgba(226,238,250,${fs.alpha.toFixed(2)})`;
          const a0 = (ph % 1) * 0.1; // each tile's foam breaks in a slightly different place
          if (f & EDGE.N) { g.fillRect(px + (0.05 + a0) * tile, py + off, 0.45 * tile, th); g.fillRect(px + (0.58 - a0) * tile, py + off + th, 0.37 * tile, th); }
          if (f & EDGE.S) { g.fillRect(px + (0.05 + a0) * tile, py + tile - off - th, 0.4 * tile, th); g.fillRect(px + (0.55 - a0) * tile, py + tile - off - 2 * th, 0.4 * tile, th); }
          if (f & EDGE.W) { g.fillRect(px + off, py + (0.05 + a0) * tile, th, 0.45 * tile); g.fillRect(px + off + th, py + (0.58 - a0) * tile, th, 0.37 * tile); }
          if (f & EDGE.E) { g.fillRect(px + tile - off - th, py + (0.05 + a0) * tile, th, 0.4 * tile); g.fillRect(px + tile - off - 2 * th, py + (0.55 - a0) * tile, th, 0.4 * tile); }
        }
        if (d === D.SPARKLE && level >= 2) {
          const sp = sparkle(t, ph, reduce);
          if (sp > 0.02) {
            g.fillStyle = `rgba(205,224,255,${(sp * glintK).toFixed(2)})`;
            g.fillRect(px + (1 + (ph % 3.1)) * k, py + (1 + ((ph * 7) % 5)) * k, 2.2 * k, Math.max(1, 0.7 * k));
          }
        } else if (d === D.GRASS && level >= 2 && nBlades < 220) {
          nBlades++;
          const sw = sway(t, ph, reduce), bx = px + (1.5 + (ph * 3) % 5) * k, by = py + 6.6 * k, p = world.tiles[i] === T.MEADOW ? bladesM : blades;
          p.moveTo(bx, by); p.lineTo(bx + sw.x * 1.5 * k, by - 2.5 * k);
          p.moveTo(bx + k, by); p.lineTo(bx + k + sw.x * 1.5 * k + 0.4 * k, by - 1.8 * k);
        }
      }
    }
    g.fillStyle = "#215034"; g.fill(crowns);
    if (lively) { g.fillStyle = "#2f6a44"; g.fill(flecks); }
    if (nBlades) {
      g.lineWidth = Math.max(1, k * 0.5); g.lineCap = "round";
      g.strokeStyle = "rgba(96,148,86,0.8)"; g.stroke(blades);
      g.strokeStyle = "rgba(168,178,92,0.8)"; g.stroke(bladesM);
      g.lineCap = "butt";
    }
  }

  // Fireflies drift round lit beacons and every lantern; coloured lanterns draw more, in their colour.
  function drawFireflies(t, reduce, level, camX, camY, tile, W, H, all, fires) {
    if (level < 1) { flyCount = 0; return; }
    const r = tile * 0.075; let n = 0;
    const draw = (list, sx, sy, rgb) => {
      for (const f of list) {
        const x = f.x * tile - camX, y = f.y * tile - camY;
        if (x < -r * 4 || y < -r * 4 || x > W + r * 4 || y > H + r * 4) continue;
        g.fillStyle = `rgba(${rgb},${(0.2 * f.a).toFixed(2)})`; g.beginPath(); g.arc(x, y, r * 3, 0, Math.PI * 2); g.fill();
        g.fillStyle = `rgba(${rgb},${f.a.toFixed(2)})`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        n++;
      }
    };
    g.globalCompositeOperation = "lighter";
    for (const f of fires) if (f.lit) draw(fireflies(level >= 2 ? 7 : 3, 100 + f.n, f.x, f.y - 0.4, 3.4, t, reduce), 0, 0, "255,222,130");
    for (const p of all) {
      const gl = lampOf(p.lamp).glow, cnt = gl ? (level >= 2 ? 3 : 1) : (level >= 2 ? 1 : 0);
      if (cnt) draw(fireflies(cnt, 500 + ((p.seed || 0) % 997), p.x, p.y, gl ? 2.0 : 1.5, t, reduce), 0, 0, gl ? gl.join(",") : "240,226,160");
    }
    g.globalCompositeOperation = "source-over";
    flyCount = n;
  }

  // A small strip at the top centre: stars and the moon crossing from dusk to dawn.
  function drawSky(t, reduce, light, dpr) {
    const W = canvas.width, bw = Math.min(150 * dpr, W * 0.36), bh = 40 * dpr, x = W / 2 - bw / 2, y = 8 * dpr, hor = y + bh * 0.82;
    const moon = moonAt(light.hour), sa = starAlpha(light.dark);
    g.save();
    g.beginPath(); if (g.roundRect) g.roundRect(x, y, bw, bh, 8 * dpr); else g.rect(x, y, bw, bh);
    g.fillStyle = "rgba(5,8,18,0.62)"; g.fill();
    g.clip();
    const sky = g.createLinearGradient(0, y, 0, hor);
    sky.addColorStop(0, "rgba(10,18,44,0.0)"); sky.addColorStop(1, `rgba(${light.tint[0] * 2 + 20},${light.tint[1] * 2 + 20},${light.tint[2] * 2 + 40},0.55)`);
    g.fillStyle = sky; g.fillRect(x, y, bw, hor - y);
    g.fillStyle = "#fff6dc";
    for (const s of STARS) {
      const a = sa * (reduce ? 0.8 : 0.55 + 0.45 * Math.sin(t / 700 + s.ph));
      if (a < 0.05 || s.y > 0.7) continue;
      g.globalAlpha = Math.min(1, a); g.fillRect(x + s.x * bw, y + 3 * dpr + s.y * bh * 0.85, s.s * dpr, s.s * dpr);
    }
    g.globalAlpha = 1;
    const mx = x + bw * (0.1 + 0.8 * moon.x), my = hor - moon.h * bh * 0.62, mr = 6 * dpr;
    g.fillStyle = "rgba(244,236,208,0.16)"; g.beginPath(); g.arc(mx, my, mr * 2, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#f4ecd0"; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(160,150,120,0.55)"; g.beginPath(); g.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.28, 0, Math.PI * 2); g.arc(mx + mr * 0.35, my + mr * 0.3, mr * 0.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(5,8,18,0.9)"; g.fillRect(x, hor, bw, y + bh - hor); // the dark horizon
    g.restore();
    g.strokeStyle = "rgba(255,243,214,0.4)"; g.lineWidth = Math.max(1, dpr);
    g.beginPath(); if (g.roundRect) g.roundRect(x, y, bw, bh, 8 * dpr); else g.rect(x, y, bw, bh); g.stroke();
  }

  // Frame and draw times of the last 240 frames, for the tests and for measuring (never sent anywhere).
  function stats() {
    const n = Math.min(nSamp, 240); if (!n) return { frames: 0, level: gov.level };
    const a = Array.from(samples.subarray(0, n)).sort((p, q) => p - q), f = Array.from(frames.subarray(0, n)).filter(v => v > 0 && v < 500).sort((p, q) => p - q);
    const mean = (v) => v.reduce((p, q) => p + q, 0) / (v.length || 1), pct = (v, q) => v.length ? v[Math.min(v.length - 1, Math.floor(v.length * q))] : 0;
    return { frames: nSamp, level: gov.level, drawMean: mean(a), drawP95: pct(a, 0.95), drawMax: a[a.length - 1], frameMean: mean(f), frameP95: pct(f, 0.95), fps: f.length ? 1000 / mean(f) : 0, fireflies: flyCount };
  }

  function draw(me, peers, stick, t, light, nodes, reach, fires) {
    const t0 = performance.now();
    drawFrame(me, peers, stick, t, light, nodes, reach, fires);
    const i = nSamp % 240; samples[i] = performance.now() - t0; frames[i] = prevT ? t - prevT : 0; nSamp++;
    if (prevT) gov.note(t - prevT);
    prevT = t;
  }

  function drawFrame(me, peers, stick, t, light, nodes = [], reach = null, fires = []) {
    const reduce = !!(opts.reducedMotion && opts.reducedMotion());
    const level = plain ? 0 : gov.level;
    if (canvas.clientWidth !== cw || canvas.clientHeight !== ch) resize();
    const tile = (cw < 520 ? 30 : 36) * dpr; // screen px per tile
    const W = canvas.width, H = canvas.height;
    const camX = me.x * tile - W / 2, camY = me.y * tile - H / 2;
    g.imageSmoothingEnabled = false;
    g.fillStyle = PAL[T.DEEP][0]; g.fillRect(0, 0, W, H);
    const k = tile / TILE_SRC;
    g.drawImage(map, -camX, -camY, map.width * k, map.height * k);
    const lt = light || { dark: 0.5, tint: [3, 6, 18], reach: 3.2, hour: 3 };
    drawGround(t, reduce, level, camX, camY, tile, W, H, lt);

    for (const n of nodes) drawNode(g, n, n.x * tile - camX, n.y * tile - camY, tile, n === reach, t, reduce);

    for (const f of fires) drawFlame(g, f, f.x * tile - camX, (f.y - 0.85) * tile - camY, tile, t, reduce);

    const all = [...peers.values(), me];
    all.sort((a, b) => a.y - b.y);
    const fontPx = Math.round(12 * dpr);
    g.font = `${fontPx}px Georgia, serif`;
    g.textAlign = "center";
    for (const p of all) drawAvatar(g, p, p.x * tile - camX, p.y * tile - camY, tile, p === me, t, reduce);

    // Night layer with light pools.
    dg.globalCompositeOperation = "source-over";
    dg.clearRect(0, 0, W, H);
    dg.fillStyle = `rgba(${lt.tint[0]},${lt.tint[1]},${lt.tint[2]},${lt.dark.toFixed(3)})`; dg.fillRect(0, 0, W, H);
    dg.globalCompositeOperation = "destination-out";
    lastLights = [];
    for (const p of all) {
      const sx = p.x * tile - camX, sy = p.y * tile - camY, lamp = lampOf(p.lamp);
      const flick = reduce || !lamp.glow ? 1 : 1 + Math.sin(t / 140 + (p.seed || 0) % 7) * 0.012; // coloured lanterns flicker a very little
      const tiles = lt.reach * lamp.mult * flick, r = tile * tiles;
      lastLights.push({ id: p.id === "me" || p === me ? "me" : p.id, tiles: Math.round(tiles * 100) / 100, lamp: p.lamp | 0 });
      const grad = dg.createRadialGradient(sx, sy, 0, sx, sy, r);
      if (lamp.glow && !plain) for (const [s, a] of softStops(0.95)) grad.addColorStop(s, `rgba(0,0,0,${a.toFixed(3)})`); // coloured lanterns: a soft edge
      else { grad.addColorStop(0, "rgba(0,0,0,0.95)"); grad.addColorStop(0.55, "rgba(0,0,0,0.6)"); grad.addColorStop(1, "rgba(0,0,0,0)"); }
      dg.fillStyle = grad; dg.beginPath(); dg.arc(sx, sy, r, 0, Math.PI * 2); dg.fill();
    }
    // Beacons: a lit one clears a wide pool of night; one that is taking fuel gives a small ember light.
    for (const f of fires) {
      const sx = f.x * tile - camX, sy = f.y * tile - camY, tiles = f.lit ? LIT_RADIUS * (reduce ? 1 : 1 + Math.sin(t / 300 + f.n) * 0.015) : 0.8 + 1.8 * f.frac;
      if (f.fuel <= 0 && !f.lit) continue;
      const r = tile * tiles, grad = dg.createRadialGradient(sx, sy, 0, sx, sy, r);
      grad.addColorStop(0, "rgba(0,0,0,0.98)"); grad.addColorStop(0.6, f.lit ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)"); grad.addColorStop(1, "rgba(0,0,0,0)");
      dg.fillStyle = grad; dg.beginPath(); dg.arc(sx, sy, r, 0, Math.PI * 2); dg.fill();
    }
    g.drawImage(dark, 0, 0);
    // The glow of a coloured lantern: a soft pool of its colour on the ground, for everyone who can see it.
    g.globalCompositeOperation = "lighter";
    for (const p of all) {
      const lamp = lampOf(p.lamp);
      if (!lamp.glow) continue;
      const sx = p.x * tile - camX, sy = p.y * tile - camY, r = tile * lt.reach * lamp.mult * 0.85, [cr, cg, cb] = lamp.glow;
      const grad = g.createRadialGradient(sx, sy, 0, sx, sy, r);
      if (plain) { grad.addColorStop(0, `rgba(${cr},${cg},${cb},0.30)`); grad.addColorStop(0.5, `rgba(${cr},${cg},${cb},0.12)`); grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`); }
      else for (const [s, a] of softStops(0.30)) grad.addColorStop(s, `rgba(${cr},${cg},${cb},${a.toFixed(3)})`);
      g.fillStyle = grad; g.beginPath(); g.arc(sx, sy, r, 0, Math.PI * 2); g.fill();
    }
    for (const f of fires) {
      if (!f.lit) continue;
      const sx = f.x * tile - camX, sy = f.y * tile - camY, r = tile * LIT_RADIUS * 0.8;
      const grad = g.createRadialGradient(sx, sy, 0, sx, sy, r);
      grad.addColorStop(0, "rgba(255,170,70,0.28)"); grad.addColorStop(0.5, "rgba(255,150,60,0.10)"); grad.addColorStop(1, "rgba(255,150,60,0)");
      g.fillStyle = grad; g.beginPath(); g.arc(sx, sy, r, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = "source-over";
    if (!plain) drawFireflies(t, reduce, level, camX, camY, tile, W, H, all, fires);

    // Landmark names when one is close (words from our own list).
    g.font = `${fontPx}px Georgia, serif`; g.textAlign = "center";
    for (const l of world.landmarks) {
      const d = Math.hypot(l.x - me.x, l.y - me.y);
      if (d > 7) continue;
      const lx = l.x * tile - camX, ly = (l.y - (l.kind === "jetty" ? 0.2 : 1.3)) * tile - camY;
      g.globalAlpha = Math.min(1, (7 - d) / 2);
      g.lineWidth = 3 * dpr; g.strokeStyle = "rgba(5,8,18,0.85)"; g.fillStyle = "#f2d9a0";
      const f = l.kind === "beacon" ? fires.find(q => q.x === l.x && q.y === l.y) : null;
      const label = LANDMARK_NAMES[l.kind] + (f ? (f.lit ? ": lit" : `: fuel ${f.fuel} of ${BEACON_NEED}`) : ""); // words and numbers from our own code
      g.strokeText(label, lx, ly); g.fillText(label, lx, ly);
      g.globalAlpha = 1;
    }

    // The prompt over the node in reach (words from our own list).
    if (reach) {
      const lx = reach.x * tile - camX, ly = (reach.y + 1.05) * tile - camY, txt = `${KIND_NAMES[reach.kind]}: gather (E)`;
      g.lineWidth = 3 * dpr; g.strokeStyle = "rgba(5,8,18,0.85)"; g.fillStyle = "#ffe9a8";
      g.strokeText(txt, lx, ly); g.fillText(txt, lx, ly);
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

    if (!plain) drawSky(t, reduce, lt, dpr);

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

  return { draw, resize, arrows: () => lastArrows.map(a => ({ id: a.id, dist: a.dist, ang: a.ang })), lights: () => lastLights.map(l => ({ ...l })), stats, setLevel: (l) => gov.set(Math.max(0, Math.min(2, l | 0))) };
}

// A beacon basket's fire: nothing without fuel, embers while it fills, a tall flame once lit.
function drawFlame(g, f, sx, sy, tile, t, reduce) {
  if (f.fuel <= 0 && !f.lit) return;
  const u = tile / 8, wob = reduce ? 0 : Math.sin(t / 110 + f.n * 2) * 0.35, h = f.lit ? 4.6 : 1.2 + 2.2 * f.frac;
  g.fillStyle = f.lit ? "#ff9a2e" : "#c8501c";
  g.beginPath(); g.moveTo(sx - 2 * u, sy + u); g.quadraticCurveTo(sx - 2.2 * u + wob * u, sy - h * u * 0.6, sx + wob * u, sy - h * u); g.quadraticCurveTo(sx + 2.2 * u + wob * u, sy - h * u * 0.6, sx + 2 * u, sy + u); g.closePath(); g.fill();
  g.fillStyle = f.lit ? "#ffe08a" : "#ff9a2e";
  g.beginPath(); g.ellipse(sx + wob * u * 0.3, sy - u * 0.2, u, h * u * 0.4, 0, 0, Math.PI * 2); g.fill();
}

// Gatherables: a pale log, a tuft of reeds, a cluster of berries. A ring marks the one within reach.
function drawNode(g, n, sx, sy, tile, inReach, t, reduce) {
  const u = tile / 8;
  if (inReach) {
    g.strokeStyle = "rgba(255,233,168,0.85)"; g.lineWidth = Math.max(1.5, u * 0.5);
    g.beginPath(); g.arc(sx, sy, tile * (0.42 + (reduce ? 0 : Math.sin(t / 260) * 0.03)), 0, Math.PI * 2); g.stroke();
  }
  if (n.kind === "driftwood") {
    g.save(); g.translate(sx, sy); g.rotate(((n.id * 37) % 7 - 3) * 0.2);
    g.fillStyle = "#b59a72"; g.fillRect(-3 * u, -u, 6 * u, 2 * u);
    g.fillStyle = "#d8c29a"; g.fillRect(-3 * u, -u, 6 * u, 0.7 * u);
    g.fillStyle = "#7d6544"; g.fillRect(-1 * u, -2 * u, 0.8 * u, 1.2 * u); g.fillRect(1.2 * u, u, 0.8 * u, 1.2 * u);
    g.restore();
  } else if (n.kind === "reeds") {
    g.strokeStyle = "#8fb06a"; g.lineWidth = Math.max(1.5, u * 0.55);
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(sx + i * u * 0.7, sy + 2.5 * u); g.lineTo(sx + i * u * 1.1 + (reduce ? 0 : Math.sin(t / 700 + n.id + i * 0.6) * u * 0.45), sy - (2.8 - Math.abs(i) * 0.4) * u); g.stroke(); }
    g.fillStyle = "#6b4a2a"; g.fillRect(sx - 0.5 * u, sy - 3.2 * u, u, 1.4 * u);
  } else {
    g.fillStyle = "#2f5a3a"; g.beginPath(); g.arc(sx, sy + 0.3 * u, 2.6 * u, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#b07ad8";
    for (const [dx, dy] of [[-1.2, -0.6], [1.1, -0.3], [0, 1.1]]) { g.beginPath(); g.arc(sx + dx * u, sy + dy * u, 0.95 * u, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#f0d8ff"; g.fillRect(sx - 1.5 * u, sy - 1.1 * u, 0.6 * u, 0.6 * u);
  }
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
  const glow = lampOf(p.lamp).glow;
  if (glow) { g.fillStyle = `rgba(${glow[0]},${glow[1]},${glow[2]},0.35)`; g.beginPath(); g.arc(lx, ly, r * 0.75, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = glow ? `rgb(${glow[0]},${glow[1]},${glow[2]})` : p.colour;
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
