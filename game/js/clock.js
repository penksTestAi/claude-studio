// The clock check (milestone 17). Shades, weather, the night hour and the keeper's day are all worked out by each browser
// from its own device clock, so two players whose clocks disagree by minutes see shades in different places and may
// even share no keeper's notes. Nothing can fix another player's clock, but each browser can notice and say so.
//
// Message, numbers only: { k:"ck", t }  t = my device clock in whole seconds since 1970 (UTC). Sent to each player the
// first time they are seen in the room and to everyone every CLOCK_SEND_MS. A receiver needs a known sender (one who
// said hello), exactly these two fields, a whole number in a plausible range, and at most 1 a second per sender (a
// burst of 3). The offset kept is (their t) - (my clock); travel time (well under a second) is ignored, which is
// why only differences of CLOCK_WARN_S or more are shown. Nothing is saved; an offset is forgotten when the player
// leaves. A modified client can claim any clock; that changes only the note other players read.
import { createGuard } from "./guard.js";

export const CLOCK_WARN_S = 10;    // differences smaller than this are not mentioned
export const CLOCK_SEND_MS = 30000; // everyone is told again this often
const REPEAT_MS = 3000;             // a newcomer is told a second time after this
const T_MIN = 1e9, T_MAX = 1e10;    // 2001 to 2286: anything else is not a clock reading

export function validClockMsg(msg) {
  return !!msg && typeof msg === "object" && msg.k === "ck" && Object.keys(msg).length === 2 && Number.isInteger(msg.t) && msg.t >= T_MIN && msg.t <= T_MAX;
}

// "about 2 minutes" style words for a difference in seconds (sign ignored). Whole units only.
export function clockWords(seconds) {
  const s = Math.abs(Number(seconds) || 0);
  if (s < 90) return `about ${Math.round(s)} seconds`;
  if (s < 90 * 60) { const m = Math.round(s / 60); return `about ${m} minute${m === 1 ? "" : "s"}`; }
  if (s < 36 * 3600) { const h = Math.round(s / 3600); return `about ${h} hour${h === 1 ? "" : "s"}`; }
  const d = Math.round(s / 86400); return `about ${d} day${d === 1 ? "" : "s"}`;
}

// The note shown to this player, or "" when no one in the room differs by CLOCK_WARN_S or more.
// `off` is (their clock) - (mine) in seconds: positive means mine is behind theirs.
export function clockNote(name, off) {
  if (!Number.isFinite(off) || Math.abs(off) < CLOCK_WARN_S || typeof name !== "string") return "";
  return `Your device clock and ${name}'s differ by ${clockWords(off)} (yours is ${off > 0 ? "behind" : "ahead"}), so the two of you may see the shades, the weather and the night's hour differently, and from about midnight UTC the keeper's notes too. Setting both devices to network time should fix it.`;
}

// `peers` is presence's map (id -> player). `clock()` returns my clock in ms (Date.now, plus a test skew).
export function createClockCheck(net, peers, opts = {}) {
  const clock = opts.clock || (() => Date.now());
  const now = opts.now || (() => performance.now());
  const guard = createGuard(1, 3);
  const offsets = new Map(); // id -> seconds (theirs - mine)
  const told = new Map();    // id -> { at, n }: when we first sent them our clock, and how many times (at most 2)
  let lastAll = -1e12;
  const msg = () => ({ k: "ck", t: Math.floor(clock() / 1000) });

  net.onPeerLeave((id) => { offsets.delete(id); told.delete(id); guard.forget(id); });
  net.onMessage((m, id) => {
    if (!m || typeof m !== "object" || m.k !== "ck" || typeof id !== "string") return;
    if (!peers.has(id)) return;                 // only from a player who said hello
    if (!guard.allow(id, now())) return;
    if (!validClockMsg(m)) return;
    offsets.set(id, m.t - clock() / 1000);
  });

  return {
    // called each frame or so: tell newcomers once, and everyone every CLOCK_SEND_MS
    // (a newcomer is told twice, at once and REPEAT_MS later, because our first message can arrive before our hello
    // and is then dropped by them, like any message from a stranger)
    tick() {
      const t = now();
      for (const id of [...told.keys()]) if (!peers.has(id)) told.delete(id);
      for (const id of [...offsets.keys()]) if (!peers.has(id)) offsets.delete(id);
      if (t - lastAll >= CLOCK_SEND_MS && peers.size) { lastAll = t; net.send(msg()); }
      for (const id of peers.keys()) {
        const e = told.get(id);
        if (!e) { net.send(msg(), id); told.set(id, { at: t, n: 1 }); }
        else if (e.n === 1 && t - e.at >= REPEAT_MS) { net.send(msg(), id); e.n = 2; }
      }
    },
    // the player whose clock differs most from mine, or null
    worst() {
      let best = null;
      for (const [id, off] of offsets) if (peers.has(id) && (!best || Math.abs(off) > Math.abs(best.off))) best = { id, off };
      return best;
    },
    offsets: () => [...offsets].map(([id, off]) => ({ id, off })),
  };
}

// ?clockskew=N (tests only, loopback pages): this page pretends its device clock is N whole seconds off, for the clock
// check alone (the shades, weather and night still read the real clock). |N| at most two days.
export function pickClockSkew(search, onLoopback) {
  if (!onLoopback) return 0;
  const m = /[?&]clockskew=(-?\d{1,6})(?:&|$)/.exec(search || "");
  const n = m ? Number(m[1]) : 0;
  return Number.isInteger(n) && Math.abs(n) <= 172800 ? n : 0;
}
