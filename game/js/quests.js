// The keeper's notes: three small quests a day, made from the island's seed and the date (UTC), the same in every
// browser, finished by the whole lantern together. Nothing here is typed by a player: a quest is a few numbers, and
// every browser turns them into words from its own lists.
//
// The three notes: gather some of one thing, make some wicks or amber lanterns, burn fuel in one old beacon.
// Progress is a grow-only counter per player per note (like the beacons' fuel): each player counts what they did
// themselves, merging keeps the larger number, so repeats, reordering and crossing messages never lose or lower a
// share. A note is done when the shares add up to its need and at least MIN_PLAYERS players have a share; one player's
// share is capped at need - 1, so no single player can finish a note alone. Progress is not saved: a lantern that
// empties forgets it (what you gathered or made stays in your pack), and at 00:00 UTC the notes change and start at 0.
// Actions done before the room's counters were heard are held back (`owed`) and added once they are, so a rejoining
// player does not start again from 0 beside the share others still hold for them.
// Messages (numbers only, never text):
//   { k:"qp", q, d, n }                 my own total on note q (0..2) on day d; sent on change, to each newcomer, every 5 s
//   { k:"qq", d }                       newcomer -> a peer: "send me the shares you know for day d"
//   { k:"qs", d, q:[..], s:[..], n:[..], f }   up to 10 shares; f=1 on the last chunk
// A receiver checks: sender said hello, exact fields, whole numbers in range, the same day as its own, at most 8 a
// second per sender, and "qs" only from a peer it asked and whose snapshot has not finished.
import { createGuard } from "./guard.js";
import { isSeed } from "./names.js";
import { hash3 } from "./world.js";
import { KINDS, KIND_NAMES } from "./resources.js";

export const NOTES = 3;
export const MIN_PLAYERS = 2;
export const MAX_NEED = 9;           // no note asks for more than this
export const MAX_SHARE = MAX_NEED - 1; // largest number that goes on the wire (a share is at most need - 1)
export const MAX_ENTRIES = 24;       // shares kept per note; a full list refuses new players, it never drops one
export const MAX_DAY = 99999;
export const RESEND_MS = 5000;
export const SYNC_WAIT_MS = 1500;
const CHUNK = 10;
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const BEACON_WORDS = ["north-west", "north-east", "south-west", "south-east"]; // only a fallback; main passes the real names

export const dayNumber = (ms) => Math.floor(ms / 86400000);
export function pickDay(search, onLoopback) { // ?day=N, for the tests, honoured only on a page served from this machine
  if (!onLoopback) return null;
  const raw = new URLSearchParams(search).get("day");
  if (raw === null || !/^\d{1,5}$/.test(raw)) return null;
  const v = Number(raw);
  return isInt(v, 0, MAX_DAY) ? v : null;
}

// The day's three notes: [{ kind:"gather", item, need }, { kind:"craft", item, need }, { kind:"fuel", beacon, need }].
export function notesFor(seed, day, beacons = 4) {
  const r = (q, salt) => hash3(day % 65536, q * 31 + salt, seed + 913);
  const gatherItem = KINDS[Math.floor(r(0, 1) * KINDS.length)];
  const craftItem = r(1, 2) < 0.4 ? "amber" : "wick";
  return [
    { kind: "gather", item: gatherItem, need: 5 + Math.floor(r(0, 3) * 5) },                 // 5..9
    { kind: "craft", item: craftItem, need: craftItem === "amber" ? 2 : 3 + Math.floor(r(1, 3) * 3) }, // amber 2, wick 3..5
    { kind: "fuel", beacon: Math.floor(r(2, 1) * beacons), need: 6 + Math.floor(r(2, 3) * 4) }, // 6..9 fuel
  ];
}
export const shareCap = (note) => note.need - 1;

// The words for a note, from the numbers only. `beaconName(b)` gives a beacon's place name.
export function noteText(note, beaconName = (b) => BEACON_WORDS[b] || "an old") {
  if (note.kind === "gather") return `Gather ${note.need} ${KIND_NAMES[note.item].toLowerCase()} together`;
  if (note.kind === "craft") return note.item === "amber" ? `Make ${note.need} amber lanterns together` : `Make ${note.need} wicks together`;
  return `Burn ${note.need} fuel together in the ${beaconName(note.beacon)} beacon`;
}

// ---- pure state: one Map(seed -> share) per note ----
export function createNoteShares(notes) {
  const maps = notes.map(() => new Map());
  const need = notes.map(n => n.need);
  return {
    count: notes.length,
    // Merge a share: keep the larger. Returns "new", "grew" or "" (nothing changed or refused).
    merge(q, seed, n) {
      if (!isInt(q, 0, notes.length - 1) || !isSeed(seed) || !isInt(n, 1, need[q] - 1)) return "";
      const m = maps[q], have = m.get(seed);
      if (have === undefined) { if (m.size >= MAX_ENTRIES) return ""; m.set(seed, n); return "new"; }
      if (n > have) { m.set(seed, n); return "grew"; }
      return "";
    },
    own: (q, seed) => maps[q].get(seed) || 0,
    total: (q) => { let s = 0; for (const n of maps[q].values()) s += n; return s; },
    players: (q) => maps[q].size,
    done(q) { return this.total(q) >= need[q] && maps[q].size >= MIN_PLAYERS; },
    entries() { const out = []; maps.forEach((m, q) => { for (const [s, n] of m) out.push([q, s, n]); }); return out; },
    clear() { maps.forEach(m => m.clear()); },
  };
}

// Does something I did count for note q? `what` is "gather", "craft" or "fuel"; `item` the thing; `beacon` the beacon index.
export function countsFor(note, what, item, beacon) {
  if (note.kind !== what) return false;
  return note.kind === "fuel" ? note.beacon === beacon : note.item === item;
}

export function createQuests(net, world, me, peers, opts = {}) {
  const now = opts.now || (() => performance.now());
  const clock = opts.clock || (() => Date.now());
  const pinned = opts.day ?? null;
  const onEvent = opts.onEvent || (() => {});
  const beacons = opts.beacons || 4;
  const today = () => pinned ?? dayNumber(clock());
  let day = today();
  let notes = notesFor(world.seed, day, beacons);
  let shares = createNoteShares(notes);
  const guard = createGuard(8, 16);
  const asked = new Set(), awaiting = new Map(), lastQq = new Map();
  const owed = notes.map(() => 0);
  const startedAt = now();
  let lastSent = now(), synced = false;
  const doneNow = () => notes.map((_, q) => shares.done(q));
  let wasDone = doneNow();
  const check = () => { const d = doneNow(); d.forEach((v, q) => { if (v && !wasDone[q]) onEvent("done", q); }); wasDone = d; };
  const announce = (to) => { for (let q = 0; q < notes.length; q++) { const n = shares.own(q, me.seed); if (n > 0) net.send({ k: "qp", q, d: day, n }, to); } };

  net.onPeerLeave((id) => { guard.forget(id); lastQq.delete(id); asked.delete(id); awaiting.delete(id); });
  net.onPeerJoin((id) => announce(id));
  net.onMessage((msg, id) => {
    if (!msg || typeof msg !== "object" || (msg.k !== "qp" && msg.k !== "qq" && msg.k !== "qs")) return;
    const p = peers.get(id);
    if (!p) return;
    if (!guard.allow(id, now())) return;
    const keys = Object.keys(msg).length;
    if (msg.d !== day) return; // another day (or a bad number): not ours
    if (msg.k === "qp") {
      if (keys !== 4) return;
      if (shares.merge(msg.q, p.seed, msg.n)) { onEvent("progress", msg.q); check(); }
    } else if (msg.k === "qq") {
      if (keys !== 2 || !synced) return;
      const t = now();
      if (t - (lastQq.get(id) ?? -1e9) < 1000) return;
      lastQq.set(id, t);
      const list = shares.entries();
      for (let i = 0; i === 0 || i < list.length; i += CHUNK) {
        const part = list.slice(i, i + CHUNK);
        net.send({ k: "qs", d: day, q: part.map(e => e[0]), s: part.map(e => e[1]), n: part.map(e => e[2]), f: i + CHUNK >= list.length ? 1 : 0 }, id);
      }
    } else {
      if (keys !== 6 || !awaiting.has(id) || !Array.isArray(msg.q) || !Array.isArray(msg.s) || !Array.isArray(msg.n)) return;
      if (msg.q.length > CHUNK || msg.q.length !== msg.s.length || msg.q.length !== msg.n.length || (msg.f !== 0 && msg.f !== 1)) return;
      if (!msg.q.every(v => isInt(v, 0, notes.length - 1)) || !msg.s.every(isSeed) || !msg.n.every(v => isInt(v, 1, MAX_SHARE))) return;
      let changed = false;
      msg.q.forEach((q, i) => { if (shares.merge(q, msg.s[i], msg.n[i])) changed = true; });
      if (changed) { onEvent("progress", -1); check(); }
      if (msg.f === 1) { synced = true; awaiting.delete(id); flush(); }
    }
  });

  // Add what I did to my own share, up to the cap. Returns the points that counted.
  function addOwn(q, points) {
    const cap = shareCap(notes[q]), have = shares.own(q, me.seed);
    const next = Math.min(cap, have + points);
    if (next <= have) return 0;
    shares.merge(q, me.seed, next);
    net.send({ k: "qp", q, d: day, n: next });
    onEvent("progress", q);
    check();
    return next - have;
  }
  function flush() { for (let q = 0; q < notes.length; q++) if (owed[q] > 0) { const p = owed[q]; owed[q] = 0; addOwn(q, p); } }
  function newDay(d) {
    day = d; notes = notesFor(world.seed, day, beacons);
    shares = createNoteShares(notes); owed.fill(0); wasDone = doneNow();
    asked.clear(); awaiting.clear(); synced = false; lastSent = now();
    onEvent("newday", -1);
  }

  return {
    get notes() { return notes; }, get shares() { return shares; }, get day() { return day; },
    synced: () => synced, pending: () => awaiting.size, owed: () => owed.slice(),
    // Tell the notes what I just did: ("gather", "reeds"), ("craft", "wick"), ("fuel", null, beaconIndex, points).
    credit(what, item, beacon = -1, points = 1) {
      if (!isInt(points, 1, 4)) return;
      notes.forEach((note, q) => {
        if (!countsFor(note, what, item, beacon)) return;
        if (!synced && peers.size > 0) owed[q] = Math.min(owed[q] + points, MAX_NEED); else addOwn(q, points);
      });
    },
    // Called every frame: change the day at midnight UTC, ask newcomers for the shares, repeat my own totals now and then.
    tick() {
      const t = now(), d = today();
      if (d !== day) newDay(d);
      for (const id of peers.keys()) if (!asked.has(id)) { asked.add(id); awaiting.set(id, { at: t, tries: 0 }); net.send({ k: "qq", d: day }, id); }
      for (const [id, w] of awaiting) if (t - w.at >= 2500) { if (w.tries >= 2) awaiting.delete(id); else { w.tries++; w.at = t; net.send({ k: "qq", d: day }, id); } }
      if (!synced && t - startedAt > SYNC_WAIT_MS && awaiting.size === 0) { synced = true; flush(); }
      else if (!synced && t - startedAt > SYNC_WAIT_MS * 4) { synced = true; flush(); }
      if (t - lastSent >= RESEND_MS) { lastSent = t; announce(); }
    },
  };
}
