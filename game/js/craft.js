// Crafting: turn gathered items into wicks and coloured lanterns. Pure rules first (the tests run them in node),
// then the small network part that tells the room which lantern you hold.
//
// Crafting only ever converts: the ingredients leave the pack in the same step as the result arrives, and nothing
// is crafted when an ingredient is missing or when the result's stack is full (nothing is used up then).
// Crafted things can be given (give.js, same offer, accept, commit and receipt as gathered items); giving away the
// last lantern of the one in hand puts the plain lantern back in hand.
//
// Message (all numbers, to everyone, never any text):
//   { k:"lt", l }   the lantern I hold: 0 plain, 1 amber, 2 jade, 3 azure. Sent on change, to each newcomer, every 5 s.
// A receiver checks: sender said hello, exactly two fields, l a whole number 0..3, at most 4 a second per sender.
import { createGuard } from "./guard.js";
import { SOFT_STACK, CRAFTED, LAMP_KEYS } from "./inventory.js";

export const CRAFT_STACK = SOFT_STACK;   // a stack holds this many; one more is refused
export const RESEND_MS = 5000;
export const RECIPES = {
  wick:  { reeds: 2, berries: 1 },
  amber: { wick: 1, driftwood: 2, berries: 1 },
  jade:  { wick: 2, driftwood: 3, reeds: 3, berries: 2 },
  azure: { wick: 3, driftwood: 4, reeds: 4, berries: 4 },
};
export const CRAFT_NAMES = { wick: "Wick", amber: "Amber lantern", jade: "Jade lantern", azure: "Azure lantern" };
export const ITEM_NAMES = { driftwood: "driftwood", reeds: "reeds", berries: "oil berries", wick: "wick", amber: "amber lantern", jade: "jade lantern", azure: "azure lantern" };
// The light each lantern gives: how many times the night's lantern reach, and its glow colour.
export const LAMPS = [
  { name: "Plain lantern", mult: 1, glow: null },
  { name: "Amber lantern", mult: 1.4, glow: [255, 176, 70] },
  { name: "Jade lantern", mult: 1.8, glow: [90, 230, 165] },
  { name: "Azure lantern", mult: 2.3, glow: [110, 180, 255] },
];
export const lampOf = (n) => LAMPS[Number.isInteger(n) && n >= 0 && n < LAMPS.length ? n : 0];
const ITEM_ONE = { reeds: "reed", berries: "oil berry" }; // the singular, for a count of one
export const recipeText = (name) => Object.entries(RECIPES[name]).map(([k, n]) => `${n} ${n === 1 ? ITEM_ONE[k] || ITEM_NAMES[k] : ITEM_NAMES[k]}`).join(", ");

// Try one recipe on a pack (inv) and crafted things (cr). Returns { ok:true } or { ok:false, why:"unknown"|"missing"|"full" }.
// Everything is checked first; the pack is changed only when the whole recipe can be paid and the result fits.
export function tryCraft(inv, cr, name) {
  const need = Object.hasOwn(RECIPES, name) ? RECIPES[name] : null;
  if (!need) return { ok: false, why: "unknown" };
  const have = (k) => (CRAFTED.includes(k) ? cr[k] : inv[k]);
  for (const [k, n] of Object.entries(need)) if (have(k) < n) return { ok: false, why: "missing", item: k };
  if (cr[name] >= CRAFT_STACK) return { ok: false, why: "full", item: name };
  for (const [k, n] of Object.entries(need)) { if (CRAFTED.includes(k)) cr[k] -= n; else inv[k] -= n; }
  cr[name]++;
  return { ok: true };
}

export function createCraft(net, me, peers, inv, cr, held, opts = {}) {
  const now = opts.now || (() => performance.now());
  const onEvent = opts.onEvent || (() => {});
  const persist = opts.persist || (() => {});
  const guard = createGuard(4, 8);
  let lastSent = now();
  me.lamp = held.lamp;
  const announce = (to) => net.send({ k: "lt", l: held.lamp }, to);

  net.onPeerJoin((id) => announce(id));
  net.onPeerLeave((id) => guard.forget(id));
  net.onMessage((msg, id) => {
    if (!msg || typeof msg !== "object" || msg.k !== "lt") return;
    const p = peers.get(id);
    if (!p || Object.keys(msg).length !== 2 || !Number.isInteger(msg.l) || msg.l < 0 || msg.l > LAMP_KEYS.length) return;
    if (!guard.allow(id, now())) return;
    p.lamp = msg.l;
  });

  function hold(n, quiet = false) {
    if (!Number.isInteger(n) || n < 0 || n > LAMP_KEYS.length) return false;
    if (n > 0 && cr[LAMP_KEYS[n - 1]] < 1) return false;
    held.lamp = n; me.lamp = n;
    persist(); announce();
    if (!quiet) onEvent("hold", n);
    return true;
  }
  return {
    hold: (n) => hold(n),
    craft(name) {
      const r = tryCraft(inv, cr, name);
      if (!r.ok) { onEvent("refused", name, r); return r; }
      persist(); // saved in the same step as the change
      const n = LAMP_KEYS.indexOf(name) + 1;
      if (n > held.lamp) hold(n, true); // a brighter lantern is picked up at once
      onEvent("made", name, r, held.lamp === n);
      return r;
    },
    tick() { const t = now(); if (t - lastSent >= RESEND_MS) { lastSent = t; announce(); } },
  };
}
