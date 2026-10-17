// The music stone (milestone 22). A standing stone beside the well plays one of NOTES preset notes when a player next
// to it presses a note button. The sound is made by each listener's own browser and is OFF until that player turns
// Sound on (like footsteps). When three different players each play a different note of the stone's tune of the night
// within one beat, the stone glows for everyone who saw those notes, and each of the three earns a help point.
//
// Message, a number only: { k:"mn", n }   n = note id, a whole number 0..NOTES-1. Exactly two fields.
// A receiver needs a known sender (one who said hello), an exact message, at most RATE_PER_S notes a second per sender
// (burst RATE_BURST), and a sender whose last known position is within REACH_SLACK of the stone; anything else is
// dropped. The note's name and sound come from lists here. Nothing is recorded or saved: the last note of each player
// is kept in memory for one beat, and a player who leaves is forgotten.
//
// The tune is worked out by each browser from the island's seed and the night's number (the device clock), so nothing
// about it is sent; two players whose clocks are in different nights see different tunes and cannot glow it together.
// The glow is decided by each browser from the notes IT received, so it can differ by a note's travel time.
import { createGuard } from "./guard.js";
import { hash3, isBlocked, tileAt, T } from "./world.js";
import { HOURS, HOUR_MS } from "./nightclock.js";

export const NOTES = 8;
export const NOTE_NAMES = ["low C", "D", "E", "G", "A", "high C", "high D", "high E"]; // a pentatonic scale
export const NOTE_HZ = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
export const TUNE_LEN = 3;            // notes in the tune = players needed
export const BEAT_MS = 1500;          // the three notes must all fall inside this window
export const GLOW_S = 20;             // how long the stone glows
export const REACH = 2.5;             // tiles from the stone within which a player can play it
export const REACH_SLACK = 1.5;       // extra tiles allowed for a sender's last known position (players move between messages)
export const OWN_GAP_MS = 400;        // my own notes: at least this far apart
export const RATE_PER_S = 3, RATE_BURST = 4; // notes accepted per sender
export const NIGHT_MS = HOURS * HOUR_MS;

export const nightOf = (ms) => Math.floor(ms / NIGHT_MS);

export function validStoneMsg(msg) {
  return !!msg && typeof msg === "object" && msg.k === "mn" && Object.keys(msg).length === 2 && Number.isInteger(msg.n) && msg.n >= 0 && msg.n < NOTES;
}

// The tune of a night: TUNE_LEN different notes, the same in every browser for the same seed and night.
export function tuneFor(seed, night) {
  const out = [];
  for (let i = 0; out.length < TUNE_LEN && i < 64; i++) {
    const n = Math.floor(hash3(night | 0, i, (seed | 0) + 977) * NOTES) % NOTES;
    if (!out.includes(n)) out.push(n);
  }
  for (let n = 0; out.length < TUNE_LEN; n++) if (!out.includes(n)) out.push(n); // cannot happen in practice; keeps the length
  return out;
}

// Where the stone stands: an open walkable tile 2 to 3 tiles from the well (or from the spawn if there is no well).
// The stone does not block walking.
export function stoneSpot(world) {
  const well = world.landmarks.find(l => l.kind === "well") || { x: world.spawn.x, y: world.spawn.y };
  let best = null, bs = -1;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    if (d < 2) continue;
    const x = Math.floor(well.x) + dx, y = Math.floor(well.y) + dy, t = tileAt(world, x, y);
    if ((t !== T.GRASS && t !== T.MEADOW) || isBlocked(world, x, y)) continue;
    const sc = hash3(x, y, world.seed + 71);
    if (sc > bs) { bs = sc; best = { x: x + 0.5, y: y + 0.5 }; }
  }
  return best || { x: well.x + 2.5, y: well.y + 0.5 };
}

// Given each player's latest note (id -> { n, at }) and the tune, find players who together played every note of the
// tune inside one beat. Returns the chosen player ids, or null. Pure, so the tests can use it directly.
export function findTune(latest, tune, now) {
  const chosen = [];
  for (const note of tune) {
    let who = null;
    for (const [id, e] of latest) if (e.n === note && now - e.at <= BEAT_MS && !chosen.includes(id)) { who = id; break; }
    if (who === null) return null;
    chosen.push(who);
  }
  return chosen;
}

// `peers` is presence's map (id -> player with x,y,tx,ty). Events: onEvent("note", id, n) for every counted note
// ("me" for mine) and onEvent("glow", { mine, players }) when a tune is played.
export function createStone(net, world, me, peers, opts = {}) {
  const now = opts.now || (() => performance.now());
  const clock = opts.clock || (() => Date.now());
  const onEvent = opts.onEvent || (() => {});
  const spot = stoneSpot(world);
  const guard = createGuard(RATE_PER_S, RATE_BURST);
  const latest = new Map(); // id ("me" for mine) -> { n, at }
  const pings = [];         // recent notes for drawing: { n, at, who }
  let glowAt = -1e12, glowNo = 0, lastOwn = -1e12, counted = 0, dropped = 0;

  const tuneNow = () => tuneFor(world.seed, nightOf(clock()));
  const dist = (x, y) => Math.hypot(x - spot.x, y - spot.y);

  function evaluate(t) {
    if (t - glowAt < GLOW_S * 1000) return; // already glowing
    const who = findTune(latest, tuneNow(), t);
    if (!who) return;
    glowAt = t; glowNo++;
    latest.clear();
    onEvent("glow", { mine: who.includes("me"), players: who.slice(), no: glowNo, night: nightOf(clock()) });
  }
  function record(id, n, t) {
    latest.set(id, { n, at: t });
    pings.push({ n, at: t, who: id });
    if (pings.length > 24) pings.shift();
    counted++;
    onEvent("note", id, n);
    evaluate(t);
  }

  net.onPeerLeave((id) => { latest.delete(id); guard.forget(id); });
  net.onMessage((m, id) => {
    if (!m || typeof m !== "object" || m.k !== "mn" || typeof id !== "string") return;
    const p = peers.get(id);
    if (!p) { dropped++; return; }                       // only from a player who said hello
    const t = now();
    if (!guard.allow(id, t)) { dropped++; return; }
    if (!validStoneMsg(m)) { dropped++; return; }
    const px = Number.isFinite(p.tx) ? p.tx : p.x, py = Number.isFinite(p.ty) ? p.ty : p.y;
    if (!(dist(px, py) <= REACH + REACH_SLACK)) { dropped++; return; } // not at the stone
    record(id, m.n, t);
  });

  return {
    spot,
    reach: REACH,
    near: () => dist(me.x, me.y) <= REACH,
    tune: tuneNow,
    // Play a note. Returns true when it was sent.
    play(n) {
      if (!Number.isInteger(n) || n < 0 || n >= NOTES) return false;
      if (!this.near()) return false;
      const t = now();
      if (t - lastOwn < OWN_GAP_MS) return false;
      lastOwn = t;
      net.send({ k: "mn", n });
      record("me", n, t);
      return true;
    },
    // 0..1: how bright the stone is (starts at 0.1, reaches 1 after about 0.4 s, and fades out over the last 3 s of the glow)
    glow() {
      const a = (now() - glowAt) / 1000;
      if (a < 0 || a >= GLOW_S) return 0;
      return Math.min(1, 0.1 + a / 0.4, (GLOW_S - a) / 3);
    },
    // notes played within the last 1.6 s, for drawing: { n, age (s), mine }
    recent() {
      const t = now();
      while (pings.length && t - pings[0].at > 1600) pings.shift();
      return pings.map(q => ({ n: q.n, age: (t - q.at) / 1000, mine: q.who === "me" }));
    },
    stats: () => ({ counted, dropped, glows: glowNo }),
  };
}
