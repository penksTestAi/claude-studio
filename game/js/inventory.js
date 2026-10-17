// The saved pack and the giving ledger. Pure code (no DOM, no storage), so the tests run it in node.
//
// What is saved in the player's own browser, next to the seed and position:
//   inv  { driftwood, reeds, berries }  whole numbers
//   out  [{ t, i, s }]  gifts already taken out of the pack and sent, not yet confirmed received (t = gift number,
//                       i = kind index, s = the receiver's seed). They are re-sent until the receiver confirms.
//   exp  [{ t, i, s }]  gifts this player accepted and is waiting for (s = the giver's seed)
//   got  [{ t, s }]     gifts already received, so a re-sent one is never added twice
// Everything read back from storage (or from another tab) is checked and clamped; nothing is trusted.
import { KINDS } from "./resources.js";

// Crafted things live next to the pack: cr { wick, amber, jade, azure } whole numbers, and lamp = which lantern the
// player holds (0 = the plain starting lantern, 1 amber, 2 jade, 3 azure). Holding one does not use it up.
export const CRAFTED = ["wick", "amber", "jade", "azure"];
export const LAMP_KEYS = ["amber", "jade", "azure"]; // lamp number n (1..3) is LAMP_KEYS[n - 1]

// Everything that can be handed to another player, by index: the three gathered kinds first (so old saved gifts keep
// their numbers), then the crafted things (3 wick, 4 amber, 5 jade, 6 azure lantern).
// Fished things (milestone 19): lamp oil, counted in the pack next to the gathered kinds (inv.oil) but not a gatherable
// kind. It takes number 7, after the crafted things, so every older saved gift keeps its number.
export const FISHED = ["oil"];
export const ITEMS = [...KINDS, ...CRAFTED, ...FISHED];

export const SOFT_STACK = 999;      // a player with this many of one kind declines more of it
export const HARD_STACK = 100000;   // nothing above this is ever read back from a save
export const MAX_OUT = 20, MAX_EXP = 32, MAX_GOT = 1000; // oldest receipts are forgotten past this (a replay of a very old gift could then be added again)
export const MAX_GIFT_ID = 4294967295;

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
export const isGiftId = (t) => isInt(t, 1, MAX_GIFT_ID);
export const isKindIndex = (i) => isInt(i, 0, ITEMS.length - 1);
export const isSeed32 = (s) => isInt(s, 0, 0xffffffff);

export function emptyPack() { return Object.fromEntries([...KINDS, ...FISHED].map(k => [k, 0])); }
export function emptyCraft() { return Object.fromEntries(CRAFTED.map(k => [k, 0])); }
export function emptyLedger() { return { out: [], exp: [], got: [] }; }
export function packTotal(inv) { return KINDS.reduce((a, k) => a + inv[k], 0); }

function cleanList(list, max, fields) {
  if (!Array.isArray(list)) return [];
  const out = [], seen = new Set();
  for (const e of list) {
    if (!e || typeof e !== "object") continue;
    if (!isGiftId(e.t) || !isSeed32(e.s) || (fields.includes("i") && !isKindIndex(e.i))) continue;
    const key = `${e.s}.${e.t}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(fields.includes("i") ? { t: e.t, i: e.i, s: e.s } : { t: e.t, s: e.s });
    if (out.length >= max) break;
  }
  return out;
}

// Turn whatever was in storage into a safe { inv, out, exp, got }.
export function cleanSave(raw) {
  const inv = emptyPack();
  const src = raw && typeof raw === "object" && raw.inv && typeof raw.inv === "object" ? raw.inv : {};
  for (const k of [...KINDS, ...FISHED]) if (isInt(src[k], 0, HARD_STACK)) inv[k] = src[k];
  const o = raw && typeof raw === "object" ? raw : {};
  const cr = emptyCraft();
  const csrc = o.cr && typeof o.cr === "object" ? o.cr : {};
  for (const k of CRAFTED) if (isInt(csrc[k], 0, HARD_STACK)) cr[k] = csrc[k];
  const lamp = isInt(o.lamp, 1, LAMP_KEYS.length) && cr[LAMP_KEYS[o.lamp - 1]] > 0 ? o.lamp : 0; // you can only hold a lantern you own
  const help = isInt(o.help, 0, 100000) ? o.help : 0; // lamplighter points (see rank.js)
  return { inv, cr, lamp, help, out: cleanList(o.out, MAX_OUT, ["i"]), exp: cleanList(o.exp, MAX_EXP, ["i"]), got: cleanList(o.got, MAX_GOT, []) };
}

// Copy a saved state into the live objects in place (another tab of this browser saved a newer one).
export function adoptSave(live, ledger, raw, craft = null) {
  const c = cleanSave(raw);
  for (const k of [...KINDS, ...FISHED]) live[k] = c.inv[k];
  if (craft) { for (const k of CRAFTED) craft.cr[k] = c.cr[k]; craft.held.lamp = c.lamp; }
  ledger.out.splice(0, ledger.out.length, ...c.out);
  ledger.exp.splice(0, ledger.exp.length, ...c.exp);
  ledger.got.splice(0, ledger.got.length, ...c.got);
}
