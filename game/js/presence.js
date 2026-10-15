// Presence: who is in the room and where they stand. Each player is the only authority over their own
// avatar; everyone else just draws what that player last reported.
//
// Messages (protocol version 1), all tiny JSON objects:
//   { k:"hi", v:1, s, x, y, d }  sent to every new peer, and to all on arrival: seed, position, facing
//   { k:"st", x, y, d, m }       10 times a second while moving, every 2 s while standing (m = moving)
//   { k:"by" }                   leaving
// Everything received is validated: unknown kinds are ignored, numbers are checked and clamped. There is
// no text field anywhere; a name is rebuilt locally from the seed.
import { nameFor, colourFor, isSeed } from "./names.js";
import { createGuard } from "./guard.js";

export const PROTOCOL = 1;
const SEND_MOVING_MS = 100, SEND_IDLE_MS = 2000, TIMEOUT_MS = 12000;
export const MAX_PEERS = 11; // others in one room; more are ignored (a full mesh gets heavy)
const MAX_KEYS = 8; // a presence message never has more fields than this

const num = (v, lo, hi) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);

export function createPresence(net, world, me, onChange = () => {}) {
  const peers = new Map(); // peerId -> { id, seed, name, colour, x, y, d, tx, ty, moving, seen }
  let lastSent = 0, lastSentMoving = false;
  const guard = createGuard(30, 60); // messages per second per peer; the rest are dropped

  const hi = () => ({ k: "hi", v: PROTOCOL, s: me.seed, x: round(me.x), y: round(me.y), d: round(me.d) });

  net.onPeerJoin((id) => { net.send(hi(), id); });
  net.onPeerLeave((id) => { guard.forget(id); if (peers.delete(id)) onChange(); });
  net.onMessage((msg, id) => {
    if (!msg || typeof msg !== "object" || typeof id !== "string") return;
    if (msg.k !== "hi" && msg.k !== "st" && msg.k !== "by") return; // other kinds belong to other modules
    if (Object.keys(msg).length > MAX_KEYS) return;
    const now = performance.now();
    if (!guard.allow(id, now)) return;
    if (msg.k === "hi") {
      if (msg.v !== PROTOCOL || !isSeed(msg.s)) return;
      const x = num(msg.x, 0, world.w), y = num(msg.y, 0, world.h);
      if (x === null || y === null) return;
      const known = peers.get(id);
      if (!known && peers.size >= MAX_PEERS) return;
      const p = known || { id, x, y, say: null, emote: null };
      Object.assign(p, { seed: msg.s, name: nameFor(msg.s), colour: colourFor(msg.s), tx: x, ty: y, d: num(msg.d, -4, 4) ?? 0, moving: false, seen: now });
      if (!known) { peers.set(id, p); onChange(); }
    } else if (msg.k === "st") {
      const p = peers.get(id);
      if (!p) return; // we only accept movement from someone who said hello
      const x = num(msg.x, 0, world.w), y = num(msg.y, 0, world.h);
      if (x === null || y === null) return;
      p.tx = x; p.ty = y; p.d = num(msg.d, -4, 4) ?? p.d; p.moving = msg.m === 1; p.seen = now;
    } else if (msg.k === "by") {
      if (peers.delete(id)) onChange();
    }
  });

  net.send(hi());

  return {
    peers,
    // Called every frame with the local player's state; decides when to send.
    tick(now, dt) {
      const interval = me.moving ? SEND_MOVING_MS : SEND_IDLE_MS;
      if (now - lastSent >= interval || me.moving !== lastSentMoving) {
        net.send({ k: "st", x: round(me.x), y: round(me.y), d: round(me.d), m: me.moving ? 1 : 0 });
        lastSent = now; lastSentMoving = me.moving;
      }
      // Ease drawn positions toward the reported ones; frame-rate independent.
      const a = 1 - Math.exp(-dt * 12);
      let changed = false;
      for (const p of peers.values()) {
        const dx = p.tx - p.x, dy = p.ty - p.y;
        if (dx * dx + dy * dy > 16) { p.x = p.tx; p.y = p.ty; } else { p.x += dx * a; p.y += dy * a; }
        if (now - p.seen > TIMEOUT_MS) { peers.delete(p.id); changed = true; }
      }
      if (changed) onChange();
    },
    leave() { net.send({ k: "by" }); },
  };
}

function round(v) { return Math.round(v * 100) / 100; }
