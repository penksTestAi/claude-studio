// Boot and glue: identity, room choice, the game loop, and the small status panel.
import { generateWorld, spawnFor, isBlocked, tileAt, T, worldFingerprint } from "./world.js";
import { nameFor, colourFor, newSeed, isSeed } from "./names.js";
import { createTransport, pickKind, pickTestRelay, pickTestMute } from "./net/transport.js";
import { createPresence } from "./presence.js";
import { createInput } from "./input.js";
import { createTalk, PHRASES, EMOTES } from "./talk.js";
import { createRenderer } from "./render.js";
import { createMinimap, describeNearest } from "./minimap.js";
import { skyAt, pickWeather } from "./weather.js";
import { hourAt, lightFor, pickHour, HOURS } from "./nightclock.js";
import { createFootsteps, createStrideTracker, stepGain } from "./sound.js";
import { surfaceAt, landmarkFingerprint, BEACON_SIDES } from "./world.js";
import { generateNodes, nodeFingerprint, KINDS, KIND_NAMES } from "./resources.js";
import { createGather } from "./gather.js";
import { createGive, GIVE_RANGE } from "./give.js";
import { cleanSave, adoptSave, SOFT_STACK, CRAFTED, LAMP_KEYS } from "./inventory.js";
import { createBeacons, BEACON_NEED, BEACON_RANGE, LIT_RADIUS, MIN_PLAYERS, MAX_OWN, WORTH } from "./beacon.js";
import { createQuests, noteText, pickDay, shareCap, MIN_PLAYERS as NOTE_PLAYERS } from "./quests.js";
import { createShades, pickClockOffset, nextWaveIn, shadeCount, slotOf, SHADE_NEED, MIN_PLAYERS as SHADE_PLAYERS, EMBER_TILES, SNUFF_S, SAFE_FRACTION, MAX_SHARE as SHADE_CAP } from "./shades.js";
import { createRank, createRankNet, titleFor, pointsToNext, TITLES, THRESHOLDS } from "./rank.js";
import { createCraft, RECIPES, CRAFT_NAMES, ITEM_NAMES, LAMPS, recipeText, lampOf } from "./craft.js";

const ROOMS = 6;
const SPEED = 4.2; // tiles per second
const RADIUS = 0.28; // tiles
const STORE = "vigil.longwatch.v1";

const $ = (id) => document.getElementById(id);
const world = generateWorld();
const netKind = pickKind(location.search);
const onLoopback = location.hostname === "127.0.0.1" || location.hostname === "localhost";
const testRelay = onLoopback ? pickTestRelay(location.search) : null; // ?relay= is ignored on the live site
const testMute = onLoopback ? pickTestMute(location.search) : 0;     // so is ?mute=
const nodes = generateNodes(world);
const respawnPin = (() => { const v = Number(new URLSearchParams(location.search).get("respawn")); return Number.isInteger(v) && v >= 1 && v <= 600 ? v : 0; })(); // tests: shorter respawn

// ---- identity, saved only in this browser ----
// In local test mode each tab is its own character (sessionStorage), so two tabs can meet each other.
const store = () => (netKind === "local" ? sessionStorage : localStorage);
function loadSave() {
  try { const s = JSON.parse(store().getItem(STORE) || "null"); if (s && isSeed(s.seed)) return s; } catch { /* storage blocked */ }
  return { seed: newSeed() };
}
// The pack and the giving lists are saved with the character; every change to them is saved at once, not on a timer.
function save() {
  try { store().setItem(STORE, JSON.stringify({ seed: me.seed, x: me.x, y: me.y, inv, cr, lamp: held.lamp, help: rank.points, out: ledger.out, exp: ledger.exp, got: ledger.got })); } catch { /* storage blocked: the pack then lasts only while the page stays open */ }
}
const saved = loadSave();
const { inv, out, exp, got, cr, lamp, help } = cleanSave(saved);
const rank = createRank(help, { onEvent: rankEvent, persist: () => save() });
const held = { lamp }; // the lantern in hand: 0 plain, 1 amber, 2 jade, 3 azure
const ledger = { out, exp, got };
const start = (Number.isFinite(saved.x) && Number.isFinite(saved.y) && !isBlocked(world, saved.x, saved.y)) ? { x: saved.x, y: saved.y } : spawnFor(world, saved.seed);
const me = { id: "me", seed: saved.seed, name: nameFor(saved.seed), colour: colourFor(saved.seed), x: start.x, y: start.y, d: 0, moving: false, say: null, emote: null };
save();

// ---- room choice ----
function roomFromHash() {
  const m = /room=(\d+)/.exec(location.hash);
  const n = m ? Number(m[1]) : 1;
  return n >= 1 && n <= ROOMS ? n : 1;
}
let roomNo = roomFromHash();
const roomButtons = $("rooms");
for (let i = 1; i <= ROOMS; i++) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "room"; b.textContent = `Lantern ${i}`; b.dataset.room = i;
  b.addEventListener("click", () => { roomNo = i; history.replaceState(null, "", `#room=${i}`); markRoom(); });
  roomButtons.append(b);
}
function markRoom() { for (const b of roomButtons.children) b.setAttribute("aria-pressed", String(Number(b.dataset.room) === roomNo)); }
markRoom();
$("you").textContent = me.name;
$("you").style.setProperty("--c", me.colour);
$("netkind").textContent = netKind === "local" ? "local test mode (tabs of this browser only)" : netKind === "torrent" ? "BitTorrent trackers" : "Nostr relays";

// ---- the game ----
const canvas = $("view");
const motionQuery = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
const reducedMotion = () => !!(motionQuery && motionQuery.matches);
const lookFlag = new URLSearchParams(location.search).get("look"); // "plain" or "low" (tests, slow devices); anything else = full
const renderer = createRenderer(canvas, world, { reducedMotion, look: lookFlag === "plain" || lookFlag === "low" ? lookFlag : "full" });
const minimap = createMinimap($("minimap"), world);
const steps = createFootsteps();
const strides = createStrideTracker();
const pinnedHour = pickHour(location.search);
const pinnedWeather = pickWeather(location.search); // ?weather=clear|mist|rain (tests, screenshots); otherwise from the seed and the clock
const lightNow = () => lightFor(pinnedHour ?? hourAt(Date.now()));
let lastHud = 0, lastMap = 0, mapOn = true;
let rankNet = null, net = null, presence = null, talk = null, gather = null, give = null, craft = null, beacon = null, quests = null, shades = null, playing = false, lastT = 0, lastSave = 0, joinedAt = 0;
const input = createInput(canvas, () => playing);

async function enter() {
  if (playing) return;
  $("enter").disabled = true;
  try {
    net = await createTransport(netKind, `lantern-${roomNo}`, { relay: testRelay, mute: testMute });
  } catch (e) {
    console.error(e);
    $("status").textContent = "Could not start networking in this browser.";
    $("enter").disabled = false;
    return;
  }
  presence = createPresence(net, world, me, updatePeers);
  talk = createTalk(net, me, presence.peers, (p, id) => { $("heard").textContent = `${p.name}: ${PHRASES[id]}`; });
  gather = createGather(net, world, me, presence.peers, nodes, { respawn: respawnPin, onEvent: gatherEvent, inv });
  give = createGive(net, me, presence.peers, inv, ledger, { onEvent: giveEvent, persist: save });
  craft = createCraft(net, me, presence.peers, inv, cr, held, { onEvent: craftEvent, persist: save });
  beacon = createBeacons(net, me, presence.peers, inv, beaconList, { onEvent: beaconEvent, persist: save });
  quests = createQuests(net, world, me, presence.peers, { onEvent: questEvent, beacons: beaconList.length, day: testDay });
  shades = createShades(net, world, me, presence.peers, { onEvent: shadeEvent, clock: shadeNow, reachFor: shadeReach, safeAt: shadeSafe });
  rank.newVisit(); baseline.clear(); rankNet = createRankNet(net, me, presence.peers, rank); paintRank(true);
  me.snuffed = false; $("shadeinfo").textContent = ""; lastShadeKey = ""; paintShades(true);
  me.say = null; me.emote = null; $("questinfo").textContent = "";
  paintQuests(true);
  paintBeacon(true); $("beaconinfo").textContent = "";
  paintPack(); paintCraft(); $("craftinfo").textContent = ""; paintGive(); $("gathered").textContent = ""; $("giveinfo").textContent = "";
  strides.clear(); lastHud = 0; setMap(true);
  playing = true; joinedAt = performance.now();
  document.body.classList.add("playing");
  $("roomname").textContent = `Lantern ${roomNo}`;
  renderer.resize();
  updatePeers();
  canvas.focus({ preventScroll: true });
  lastT = performance.now();
  requestAnimationFrame(frame);
}

function leaveRoom() {
  if (!playing) return;
  presence.leave(); net.leave();
  strides.clear(); setSteps(false); steps.close();
  playing = false; net = null; presence = null; talk = null; gather = null; give = null; craft = null; beacon = null; quests = null; shades = null; rankNet = null; me.snuffed = false;
  paintShades(true); paintQuests(true); paintBeacon(true); setTalkOpen(false); $("heard").textContent = ""; paintGive();
  document.body.classList.remove("playing");
  $("enter").disabled = false;
  $("enter").focus(); // the Leave button just hid; keep keyboard focus on something visible
  save();
}

function step(dt) {
  const v = input.read();
  me.moving = !!(v.x || v.y);
  if (!me.moving) return;
  me.d = Math.atan2(v.y, v.x);
  const slow = tileAt(world, me.x, me.y) === T.SHALLOW ? 0.55 : 1;
  const dx = v.x * SPEED * slow * dt, dy = v.y * SPEED * slow * dt;
  if (!hits(me.x + dx, me.y)) me.x += dx;
  if (!hits(me.x, me.y + dy)) me.y += dy;
}
function hits(x, y) {
  for (const [ox, oy] of [[-RADIUS, -RADIUS], [RADIUS, -RADIUS], [-RADIUS, RADIUS], [RADIUS, RADIUS]]) if (isBlocked(world, x + ox, y + oy)) return true;
  return false;
}

function frame(t) {
  if (!playing) return;
  const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
  step(dt);
  presence.tick(t, dt);
  talk.tick(t);
  gather.tick();
  give.tick();
  craft.tick();
  beacon.tick();
  quests.tick();
  shades.tick(dt);
  rankNet.tick();
  watchBaselines();
  paintCooldowns(t);
  const light = lightNow();
  footsteps(light);
  const reach = gather.reach();
  const fires = fireList();
  renderer.draw(me, presence.peers, input.stick, t, light, gather.visible(), reach, fires, shades.list(), skyAt(world, shadeNow(), pinnedWeather));
  paintShades();
  paintRank();
  paintBeacon();
  paintQuests();
  $("gather").disabled = !reach;
  paintGive();
  if (mapOn && t - lastMap > 100) { lastMap = t; minimap.draw(me, presence.peers.values(), fires, shades.list()); }
  if (t - lastHud > 1000) { lastHud = t; paintHud(light); }
  if (t - lastSave > 3000) { save(); lastSave = t; updateStatus(); }
  requestAnimationFrame(frame);
}

// ---- footsteps: own steps, and steps of players walking within earshot ----
function footsteps(light) {
  const n = strides.advance("me", me.x, me.y, me.moving);
  for (let i = 0; i < n; i++) steps.step(surfaceAt(world, me.x, me.y), 1);
  for (const p of presence.peers.values()) {
    const k = strides.advance(p.id, p.x, p.y, p.moving);
    if (!k) continue;
    const g = stepGain(Math.hypot(p.x - me.x, p.y - me.y));
    for (let i = 0; i < k; i++) steps.step(surfaceAt(world, p.x, p.y), g * 0.7);
  }
}
// ---- gathering: E or the Gather button picks what is in reach; the room sees it vanish ----
function gatherEvent(type, kind) {
  if (type === "got") { if (quests) quests.credit("gather", kind); $("gathered").textContent = `You gathered ${KIND_NAMES[kind].toLowerCase()}.`; paintPack(); save(); }
  else $("gathered").textContent = `Someone was first to the ${KIND_NAMES[kind].toLowerCase()}.`;
}
function paintPack() {
  const away = ledger.out.length ? `. On its way to another player: ${ledger.out.map(e => `${KIND_NAMES[KINDS[e.i]].toLowerCase()} for ${nameFor(e.s)}`).join(", ")}` : "";
  const made = CRAFTED.filter(k => cr[k] > 0).map(k => `${CRAFT_NAMES[k]} ${cr[k]}`);
  $("pack").textContent = "Pack (saved in this browser): " + KINDS.map(k => `${KIND_NAMES[k]} ${inv[k]}`).concat(made).join(", ") + away;
}
// ---- beacons: fuel an old beacon together; it lights when enough fuel is in and two or more players added some ----
const beaconList = world.landmarks.filter(l => l.kind === "beacon");
let helpNo = 0, giftNo = 0;
// The rank counts help only from this visit: what a share was when the lantern's state arrived is the baseline, and a
// beacon, note or shade counts for you only if your own share grew past it (so a reload into a lit beacon earns nothing).
const baseline = new Map();
function grew(key, own, synced) { if (!synced) return false; if (!baseline.has(key)) { baseline.set(key, own); return false; } return own > baseline.get(key); }
function watchBaselines() {
  if (beacon) beaconList.forEach((_, b) => grew("b" + b, beacon.shares.own(b, me.seed), beacon.synced()));
  if (quests) quests.notes.forEach((_, q) => grew(`q${quests.day}.${q}`, quests.shares.own(q, me.seed), quests.synced()));
  if (shades) for (let i = 0; i < 4; i++) grew(`s${shades.slot}.${i}`, shades.shares.own(i, me.seed), shades.synced());
}
const FUEL_ITEMS = ["driftwood", "berries"];
const fireList = () => beaconList.map((l, b) => beacon ? { x: l.x, y: l.y, n: b, fuel: beacon.shares.fuel(b), frac: Math.min(1, beacon.shares.fuel(b) / BEACON_NEED), lit: beacon.shares.lit(b) } : { x: l.x, y: l.y, n: b, fuel: 0, frac: 0, lit: false });
const beaconBox = $("beaconbtns");
FUEL_ITEMS.forEach((k) => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "ghost"; b.dataset.item = k; b.textContent = `Add ${ITEM_NAMES[k]} (${WORTH[k]} fuel)`;
  b.addEventListener("click", () => { if (beacon) beacon.add(k); canvas.focus({ preventScroll: true }); });
  beaconBox.append(b);
});
function beaconEvent(type, b, r) {
  let say = "";
  if (type === "added" && quests) quests.credit("fuel", null, b, WORTH[r.item]);
  if (type === "lit" && beacon && grew("b" + b, beacon.shares.own(b, me.seed), true)) rank.credit("beacon", String(b));
  if (type === "added") say = `You added ${ITEM_NAMES[r.item]} to the beacon. It is gone from your pack.`;
  else if (type === "lit") say = "A beacon is lit! It will burn while anyone is in this lantern.";
  else if (type === "refused") say = { far: `Stand within ${BEACON_RANGE} tiles of a beacon to add fuel.`, wait: "Still hearing from the others. Try again in a moment.", lit: "This beacon is already lit.", full: `You have added as much as one player can to this beacon (${MAX_OWN} fuel). Others have to add the rest.`, missing: `You have no ${ITEM_NAMES[r && r.item] || "such item"} to add.`, }[r && r.why] || "Nothing was added.";
  if (say) $("beaconinfo").textContent = say;
  if (type === "added") { paintPack(); lastGiveKey = ""; save(); }
  lastBeaconKey = "";
}
let lastBeaconKey = "";
function paintBeacon(force) {
  if (force) lastBeaconKey = "";
  const b = beacon ? beacon.near() : -1;
  const key = [!!beacon, b, b >= 0 ? beacon.shares.fuel(b) + "/" + beacon.shares.players(b) + "/" + beacon.shares.own(b, me.seed) : "", FUEL_ITEMS.map(k => inv[k]).join()].join("|");
  if (key === lastBeaconKey) return;
  lastBeaconKey = key;
  $("beacon").hidden = !beacon || b < 0;
  if (!beacon || b < 0) return;
  const f = beacon.shares.fuel(b), n = beacon.shares.players(b), lit = beacon.shares.lit(b);
  $("beaconstate").textContent = lit ? `This beacon is lit (${f} fuel from ${n} players).` : `Fuel ${f} of ${BEACON_NEED}, from ${n} player${n === 1 ? "" : "s"}. It lights when it has ${BEACON_NEED} and at least ${MIN_PLAYERS} players added some. You added ${beacon.shares.own(b, me.seed)} (at most ${MAX_OWN}).`;
  for (const btn of beaconBox.children) btn.disabled = lit || inv[btn.dataset.item] < 1;
}
// ---- the keeper's notes: three small quests a day (from the seed and the date), finished by the lantern together ----
const testDay = pickDay(location.search, onLoopback);
$("quests-min").textContent = NOTE_PLAYERS;
const beaconName = (b) => beaconList[b] ? BEACON_SIDES[beaconList[b].side] : "old";
let lastQuestKey = "";
function questLines() {
  if (!quests) return [];
  return quests.notes.map((note, q) => {
    const sh = quests.shares, done = sh.done(q), tot = sh.total(q), pl = sh.players(q), mine = sh.own(q, me.seed);
    const text = noteText(note, beaconName);
    return { q, done, line: done ? `Done: ${text}. ${tot} from ${pl} players.` : `${text}: ${Math.min(tot, note.need)} of ${note.need}, from ${pl} player${pl === 1 ? "" : "s"}. You added ${mine} (at most ${shareCap(note)}). It needs at least ${NOTE_PLAYERS} players.` };
  });
}
function questEvent(type, q) {
  if (type === "done" && grew(`q${quests.day}.${q}`, quests.shares.own(q, me.seed), true)) rank.credit("note", `${quests.day}.${q}`);
  if (type === "done") { const n = quests.notes[q]; $("questinfo").textContent = `The keeper's note is finished: ${noteText(n, beaconName)}. Well done, all of you.`; }
  else if (type === "newday") $("questinfo").textContent = "A new day: the keeper has written new notes.";
  lastQuestKey = "";
}
function paintQuests(force) {
  if (force) lastQuestKey = "";
  const lines = questLines();
  const key = quests ? quests.day + "|" + lines.map(l => l.line).join("|") : "";
  if (key === lastQuestKey) return;
  lastQuestKey = key;
  $("quests").hidden = !quests;
  const ul = $("questlist"); ul.textContent = "";
  for (const l of lines) { const li = document.createElement("li"); li.textContent = l.line; li.dataset.done = l.done ? "1" : "0"; ul.append(li); }
}
// ---- shades: slow night creatures that snuff lanterns; light drives them off, best by several players together ----
let shadeOffset = pickClockOffset(location.search, onLoopback);
const shadeNow = () => Date.now() + shadeOffset;
const shadeReach = (p) => (p.snuffed ? EMBER_TILES : lightNow().reach * lampOf(p.lamp).mult);
const shadeSafe = (x, y) => !!beacon && beaconList.some((l, b) => beacon.shares.lit(b) && Math.hypot(l.x - x, l.y - y) <= LIT_RADIUS * SAFE_FRACTION);
const compassWord = (dx, dy) => ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"][((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
let drivenOff = 0, snuffCount = 0, lastShadeKey = "";
const snuffLog = []; // the last few snuffs (slot, shade, where), for the tests' failure messages; numbers only, kept in this page
function shadeEvent(type, k, sh) {
  const say = {
    snuffed: `A shade snuffed your lantern. Stay near another player: their light can bring yours back, or it relights by itself in ${SNUFF_S} seconds. Nothing is lost.`,
    relit: "Your lantern is lit again. A shade cannot snuff it for a few seconds.",
    expired: "Your lantern is lit again. A shade cannot snuff it for a few seconds.",
    held: "A shade is held back by a friend's light. Stay together.",
    banished: "A shade is driven off by the light of you all. Well done.",
  }[type];
  if (type === "snuffed") {
    snuffCount++;
    const s = shades && shades.list().find(q => q.k === k);
    snuffLog.push({ slot: shades ? shades.slot : -1, k, u: s ? +s.u.toFixed(2) : null, phase: s ? s.phase : null, sx: s ? +s.x.toFixed(2) : null, sy: s ? +s.y.toFixed(2) : null, x: +me.x.toFixed(2), y: +me.y.toFixed(2), peers: presence ? presence.peers.size : 0 });
    if (snuffLog.length > 8) snuffLog.shift();
  }
  if (type === "helped") rank.credit("relight", `${k}.${++helpNo}`);
  if (type === "banished" && shades && grew(`s${shades.slot}.${k}`, shades.shares.own(k, me.seed), true)) rank.credit("shade", `${shades.slot}.${k}`);
  if (type === "banished") { drivenOff++; if (sh) renderer.burst(sh.x, sh.y, performance.now()); }
  if (say) $("shadeinfo").textContent = say;
  lastShadeKey = "";
}
function shadeLines() {
  if (!shades) return [];
  const ms = shadeNow(), out = [], list = shades.list().filter(s => !s.gone && s.alpha > 0.2);
  if (me.snuffed) out.push(`Your lantern is out (${Math.ceil(shades.snuffLeft())} s left). Another player's light nearby brings it back sooner.`);
  if (list.length) {
    list.sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y));
    const n = list[0], d = Math.round(Math.hypot(n.x - me.x, n.y - me.y));
    out.push(`${list.length} shade${list.length === 1 ? " is" : "s are"} out on the island. The nearest is ${d} tiles ${compassWord(n.x - me.x, n.y - me.y)}: light ${Math.min(n.total, SHADE_NEED)} of ${SHADE_NEED} from ${n.players} player${n.players === 1 ? "" : "s"}${n.safe ? " (it cannot snuff anyone inside a lit beacon's light)" : ""}. A shade is driven off at ${SHADE_NEED} light-seconds from at least ${SHADE_PLAYERS} players; you add one for every second your lit lantern reaches it (at most ${SHADE_CAP}).`);
  } else {
    const w = nextWaveIn(world.seed, ms);
    out.push(w > 1 ? `No shades out right now. The next ones come in about ${Math.ceil(w / 10) * 10} seconds.` : "No shades out right now.");
  }
  if (drivenOff) out.push(`You have seen ${drivenOff} driven off since you came in.`);
  return out;
}
function paintShades(force) {
  if (force) lastShadeKey = "";
  const lines = shadeLines(), key = shades ? lines.join("|") : "";
  if (key === lastShadeKey) return;
  lastShadeKey = key;
  $("shades").hidden = !shades;
  $("shadestate").textContent = lines.join(" ");
}
// ---- rank: the lamplighter rank, earned only by helping others (see rank.js) ----
const DEED_WORDS = { relight: "relighting a friend's lantern", shade: "driving off a shade together", gift: "a gift that arrived", beacon: "lighting a beacon together", note: "finishing a keeper's note together" };
function rankEvent(type, a, b) {
  if (type === "deed") $("rankinfo").textContent = `A point for ${DEED_WORDS[a]}.`;
  else if (type === "rank") $("rankinfo").textContent = `You are now a ${titleFor(a)}. Thank you for helping.`;
  lastRankKey = "";
}
let lastRankKey = "";
function paintRank(force) {
  if (force) lastRankKey = "";
  const peerKey = presence ? [...presence.peers.values()].map(p => p.id + ":" + (p.rank | 0)).join() : "";
  const key = [!!rankNet, rank.points, peerKey].join("|");
  if (key === lastRankKey) return;
  lastRankKey = key;
  $("rank").hidden = !rankNet;
  const r = rank.rank, next = pointsToNext(rank.points);
  $("rankstate").textContent = (r ? `Your rank: ${titleFor(r)}. ` : "You have no rank yet. ") + `Help points: ${rank.points}.` + (next ? ` ${next} more for the next rank.` : " That is the highest rank.");
  if (presence) updatePeers();
}
// ---- crafting: wicks and lanterns; ingredients are used up, and a full stack refuses ----
const craftBox = $("craftbtns"), holdBox = $("holdbtns");
CRAFTED.forEach((name) => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "ghost"; b.dataset.recipe = name; b.textContent = `Make ${CRAFT_NAMES[name].toLowerCase()}`;
  b.title = `Uses ${recipeText(name)}`;
  b.addEventListener("click", () => { if (craft) craft.craft(name); canvas.focus({ preventScroll: true }); });
  craftBox.append(b);
});
LAMPS.forEach((l, n) => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "ghost"; b.dataset.lamp = n; b.textContent = n ? `Hold ${l.name.toLowerCase()}` : "Hold plain lantern";
  b.addEventListener("click", () => { if (craft) craft.hold(n); canvas.focus({ preventScroll: true }); });
  holdBox.append(b);
});
$("recipes").textContent = CRAFTED.map(k => `${CRAFT_NAMES[k]}: ${recipeText(k)}`).join(". ") + ".";
function craftEvent(type, what, r, holding) {
  let say = "";
  if (type === "made" && quests) quests.credit("craft", what);
  if (type === "made") say = `You made one ${ITEM_NAMES[what]}. The ingredients are used up.` + (LAMP_KEYS.includes(what) && holding ? " You hold it now." : "");
  else if (type === "refused") say = r && r.why === "full" ? `Your ${ITEM_NAMES[what]} stack is full, so nothing was made and nothing was used.` : `Not enough ${r && r.item ? ITEM_NAMES[r.item] : "ingredients"} for a ${ITEM_NAMES[what]}. Nothing was used.`;
  else if (type === "hold") say = what ? `You now hold the ${LAMPS[what].name.toLowerCase()}. Everyone near you sees its light.` : "You hold the plain lantern again.";
  if (type === "made" || type === "hold") { paintPack(); lastGiveKey = ""; }
  if (say) $("craftinfo").textContent = say;
  paintCraft();
}
function paintCraft() {
  $("craft").hidden = !craft;
  for (const b of craftBox.children) b.disabled = !craft;
  for (const b of holdBox.children) {
    const n = Number(b.dataset.lamp), owned = n === 0 || cr[LAMP_KEYS[n - 1]] > 0;
    b.disabled = !craft || !owned; b.setAttribute("aria-pressed", String(held.lamp === n)); b.hidden = !owned;
  }
}
// ---- giving: offer to the nearest player, they accept, then the item moves ----
const giveBox = $("givebtns");
KINDS.forEach((k, i) => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "ghost"; b.dataset.kind = i; b.textContent = `Give ${KIND_NAMES[k].toLowerCase()}`;
  b.addEventListener("click", () => { if (give && give.offer(i)) paintGive(); canvas.focus({ preventScroll: true }); });
  giveBox.append(b);
});
const KIND_LOWER = (i) => KIND_NAMES[KINDS[i]].toLowerCase();
function giveEvent(type, d) {
  const who = nameFor(d.seed), what = KIND_LOWER(d.kind);
  const say = {
    offering: `Offer sent to ${who}: one ${what}. Waiting for them to accept.`,
    offered: `${who} offers you one ${what}.`,
    accepted: `You accepted ${what} from ${who}. Waiting for it to arrive.`,
    sent: `You gave ${who} one ${what}; waiting for them to confirm it arrived.`,
    received: `You received one ${what} from ${who}.`,
    delivered: `${who} confirmed the ${what} arrived.`,
    declined: `${who} did not take the ${what}. It is still in your pack.`,
    cancelled: `The offer of ${what} ended. Nothing moved.`,
    expired: `The offer of ${what} timed out. Nothing moved.`,
    lost: `The offer of ${what} ended because ${who} left. Nothing moved.`,
  }[type];
  if (say) $("giveinfo").textContent = say;
  if (type === "delivered") rank.credit("gift", `${d.seed}.${++giftNo}`);
  if (type === "received" || type === "sent" || type === "delivered") paintPack();
  paintGive();
}
let lastGiveKey = "";
function paintGive() {
  const t = give ? give.target() : null, o = give ? give.outgoing : null, inc = give ? give.incoming : null;
  const key = [t ? t.id : "", o ? o.t : "", inc ? inc.t : "", KINDS.map(k => inv[k]).join(), ledger.out.length, !!give].join("|");
  if (key === lastGiveKey) return;
  lastGiveKey = key;
  $("give").hidden = !give;
  for (const b of giveBox.children) b.disabled = !give || !t || !!o || inv[KINDS[b.dataset.kind]] < 1;
  $("givetarget").textContent = o ? `Offer to ${nameFor(o.seed)} is waiting for an answer.` : t ? `Nearest player in reach: ${t.name}.` : `No one within ${GIVE_RANGE} tiles to give to.`;
  $("givecancel").hidden = !o;
  $("offerbox").hidden = !inc;
  if (inc) $("offertext").textContent = `${nameFor(inc.seed)} offers you one ${KIND_LOWER(inc.i)}. Take it?`;
}
$("givecancel").addEventListener("click", () => { if (give) give.cancel(); paintGive(); });
$("offeryes").addEventListener("click", () => { if (give) give.accept(); paintGive(); canvas.focus({ preventScroll: true }); });
$("offerno").addEventListener("click", () => { if (give) give.decline(); paintGive(); canvas.focus({ preventScroll: true }); });
paintPack();
// Another tab of this browser may have saved a newer pack (same character): adopt it instead of overwriting it.
addEventListener("storage", (e) => {
  if (netKind === "local" || e.key !== STORE || !e.newValue) return;
  try { adoptSave(inv, ledger, JSON.parse(e.newValue), { cr, held }); me.lamp = held.lamp; paintPack(); paintCraft(); lastGiveKey = ""; } catch { /* ignore */ }
});
function doGather() { if (playing) gather.pick(); }
$("gather").addEventListener("click", () => { doGather(); canvas.focus({ preventScroll: true }); });
addEventListener("keydown", (e) => {
  if (!playing || e.code !== "KeyE" || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
  doGather();
});
function paintHud(light) {
  const near = describeNearest(world, me.x, me.y);
  const hour = `${light.name}, hour ${light.index + 1} of ${HOURS}`;
  $("where").textContent = `${hour}.` + (near ? ` Nearest landmark: ${near.name}, ${near.tiles} tiles ${near.dir}.` : "");
}
function setMap(on) {
  mapOn = on;
  $("minimap").hidden = !on;
  $("maptoggle").setAttribute("aria-pressed", String(on));
}
$("maptoggle").addEventListener("click", () => setMap(!mapOn));
function setSteps(on) {
  const state = steps.set(on);
  $("stepstoggle").setAttribute("aria-pressed", String(state));
  $("stepstoggle").textContent = steps.supported ? `Footsteps: ${state ? "on" : "off"}` : "Footsteps: not available here";
}
$("stepstoggle").addEventListener("click", () => setSteps(!steps.on));
if (!steps.supported) { $("stepstoggle").disabled = true; setSteps(false); }
addEventListener("keydown", (e) => {
  if (!playing || e.code !== "KeyM" || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
  setMap(!mapOn);
});

// ---- talk: gestures and preset phrases (buttons and the T key) ----
const GESTURE_NAMES = { wave: "Wave", bow: "Bow", point: "Point", cheer: "Cheer", sit: "Sit" };
function makeButtons(host, labels, kind, fn) {
  labels.forEach((label, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "tb"; b.textContent = label; b.dataset.kind = kind; b.dataset.id = i;
    b.addEventListener("click", () => fn(i));
    host.append(b);
  });
}
makeButtons($("gestures"), EMOTES.map(e => GESTURE_NAMES[e]), "em", (i) => { if (talk) talk.emote(i); });
makeButtons($("phrases"), PHRASES, "say", (i) => { if (talk) talk.say(i); });
let lastCool = "";
function paintCooldowns(t) {
  const c = talk.cooldowns(t);
  const key = `${Math.round(c.say * 20)}/${Math.round(c.emote * 20)}`;
  if (key === lastCool) return;
  lastCool = key;
  for (const b of $("talkbox").querySelectorAll(".tb")) {
    const v = b.dataset.kind === "say" ? c.say : c.emote;
    b.style.setProperty("--cd", `${Math.round(v * 100)}%`);
    b.classList.toggle("cool", v > 0);
    b.setAttribute("aria-disabled", String(v > 0));
  }
}
function setTalkOpen(open) {
  $("talkbox").hidden = !open;
  $("talktoggle").setAttribute("aria-expanded", String(open));
}
$("talktoggle").addEventListener("click", () => setTalkOpen($("talkbox").hidden));
addEventListener("keydown", (e) => {
  if (!playing || e.code !== "KeyT" || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
  const open = $("talkbox").hidden;
  setTalkOpen(open);
  if (open) $("talkbox").querySelector(".tb").focus(); else canvas.focus({ preventScroll: true });
});

function updatePeers() {
  if (!presence) return;
  const list = $("peers");
  list.replaceChildren();
  const add = (p, you) => {
    const li = document.createElement("li");
    li.style.setProperty("--c", p.colour);
    const title = titleFor(you ? rank.rank : p.rank);
    li.textContent = p.name + (title ? ` · ${title}` : "") + (you ? " (you)" : "");
    list.append(li);
  };
  add(me, true);
  for (const p of presence.peers.values()) add(p, false);
  updateStatus();
}

function updateStatus() {
  if (!net) return;
  const n = presence.peers.size;
  const s = net.status();
  let line;
  if (n > 0) line = n === 1 ? "1 other player is here with you." : `${n} other players are here with you.`;
  else if (net.kind === "local") line = "No one else yet. Open this page in another tab with the same room to meet yourself.";
  else if (s.relaysOpen === 0) line = performance.now() - joinedAt < 8000 ? "Connecting to the signalling relays…" : "Could not reach any signalling relay. Your network may block them; the island is still yours to walk.";
  else line = `No one else in this lantern yet (listening on ${s.relaysOpen} relay${s.relaysOpen === 1 ? "" : "s"}). Others appear here when they enter the same lantern.`;
  $("status").textContent = line;
}

$("enter").addEventListener("click", enter);
$("leave").addEventListener("click", leaveRoom);
addEventListener("pagehide", () => { if (playing) { presence.leave(); save(); } });
addEventListener("hashchange", () => { if (!playing) { roomNo = roomFromHash(); markRoom(); } });

// Read-only view for the tests (and the curious): plain copies, no handles into the game.
window.__longWatch = {
  world: () => ({ seed: world.seed, fingerprint: worldFingerprint(world), landmarks: landmarkFingerprint(world), landmarkList: world.landmarks.map(l => ({ kind: l.kind, x: l.x, y: l.y })) }),
  teleport: (x, y) => { if (Number.isFinite(x) && Number.isFinite(y) && !isBlocked(world, x, y)) { me.x = x; me.y = y; return true; } return false; }, // tests only: no network message can reach this
  light: () => lightNow(),
  sky: () => skyAt(world, shadeNow(), pinnedWeather),
  hud: () => ({ rebuilds: net ? net.status().rebuilds | 0 : 0, where: $("where").textContent, mapOn, minimapMarks: minimap.markCount(), stepsOn: steps.on, stepsPlayed: steps.played, stepsSupported: steps.supported, dropped: net ? net.status().dropped : 0, reducedMotion: reducedMotion() }),
  linkHistory: () => net ? (net.status().history || []) : [],
  self: () => ({ id: net && net.selfId, name: me.name, seed: me.seed, x: me.x, y: me.y, playing, room: roomNo, net: net && net.kind }),
  peers: () => presence ? [...presence.peers.values()].map(p => ({ id: p.id, name: p.name, seed: p.seed, x: p.tx, y: p.ty, say: p.say ? p.say.id : null, emote: p.emote ? p.emote.id : null })) : [],
  nodes: () => nodes.map(n => ({ id: n.id, kind: n.kind, x: n.x, y: n.y, respawn: n.respawn })),
  nodeFingerprint: () => nodeFingerprint(nodes),
  give: () => ({ inv: { ...inv }, out: ledger.out.map(e => ({ ...e })), exp: ledger.exp.map(e => ({ ...e })), got: ledger.got.map(e => ({ ...e })), outgoing: give ? give.outgoing : null, incoming: give ? give.incoming : null, target: give && give.target() ? give.target().id : null, info: $("giveinfo").textContent, softStack: SOFT_STACK }),
  beacon: () => beacon ? { fuel: beaconList.map((_, b) => beacon.shares.fuel(b)), players: beaconList.map((_, b) => beacon.shares.players(b)), lit: beaconList.map((_, b) => beacon.shares.lit(b)), own: beaconList.map((_, b) => beacon.shares.own(b, me.seed)), near: beacon.near(), synced: beacon.synced(), pending: beacon.pending(), inv: { ...inv }, info: $('beaconinfo').textContent, panel: !$('beacon').hidden, list: beaconList.map(l => ({ x: l.x, y: l.y })), fires: fireList() } : null,
  rank: () => ({ points: rank.points, rank: rank.rank, title: titleFor(rank.rank), seen: rank.seenCount(), panel: !$("rank").hidden, text: $("rankstate").textContent, info: $("rankinfo").textContent, peerRanks: presence ? [...presence.peers.values()].map(p => ({ id: p.id, rank: p.rank | 0 })) : [], saved: (() => { try { return JSON.parse(store().getItem(STORE) || "{}").help; } catch { return null; } })(), titles: TITLES.slice(), thresholds: THRESHOLDS.slice() }),
  quests: () => quests ? { day: quests.day, synced: quests.synced(), pending: quests.pending(), owed: quests.owed(), notes: quests.notes.map(n => ({ ...n })), text: quests.notes.map(n => noteText(n, beaconName)), total: quests.notes.map((_, q) => quests.shares.total(q)), players: quests.notes.map((_, q) => quests.shares.players(q)), own: quests.notes.map((_, q) => quests.shares.own(q, me.seed)), done: quests.notes.map((_, q) => quests.shares.done(q)), panel: !$("quests").hidden, lines: [...$("questlist").children].map(li => li.textContent), info: $("questinfo").textContent } : null,
  shades: () => shades ? { slot: shades.slot, synced: shades.synced(), pending: shades.pending(), owed: shades.owed(), count: shadeCount(world.seed, shades.slot), list: shades.list().map(s => ({ k: s.k, x: s.x, y: s.y, alpha: s.alpha, phase: s.phase, gone: s.gone, safe: s.safe, total: s.total, players: s.players, own: s.own })), snuffed: !!me.snuffed, snuffLeft: shades.snuffLeft(), peerSnuffed: presence ? [...presence.peers.values()].map(p => ({ id: p.id, snuffed: !!p.snuffed })) : [], panel: !$("shades").hidden, text: $("shadestate").textContent, info: $("shadeinfo").textContent, drivenOff } : null,
  shadeNow: () => shadeNow(),
  setShadeClock: (ms) => (onLoopback && Number.isInteger(ms) && Math.abs(ms) < 1e13 ? (shadeOffset = ms, true) : false), // tests only, and only on a page served from this machine
  snuffCount: () => snuffCount,
  snuffLog: () => snuffLog.map(e => ({ ...e })),
  addFuel: (item) => beacon ? beacon.add(item) : null,
  craft: () => ({ inv: { ...inv }, cr: { ...cr }, lamp: held.lamp, info: $("craftinfo").textContent, peerLamps: presence ? [...presence.peers.values()].map(p => ({ id: p.id, lamp: p.lamp | 0 })) : [] }),
  makeItem: (name) => { if (!craft) return null; const r = craft.craft(name); return r; },
  holdLamp: (n) => !!craft && craft.hold(n),
  lights: () => renderer.lights(),
  perf: () => renderer.stats(),
  setLevel: (l) => renderer.setLevel(l),
  offer: (i) => !!give && give.offer(i),
  accept: () => !!give && give.accept(),
  decline: () => !!give && give.decline(),
  cancelOffer: () => !!give && give.cancel(),
  gather: () => gather ? { hidden: nodes.filter(n => gather.isHidden(n.id)).map(n => n.id), inv: { ...gather.inv }, synced: gather.synced, arbiter: gather.arbiterId(), isArbiter: gather.isArbiter(), reach: gather.reach()?.id ?? null } : null,
  pick: () => !!gather && !!gather.pick(),
  mine: () => ({ say: me.say ? me.say.id : null, emote: me.emote ? me.emote.id : null }),
  say: (i) => !!talk && talk.say(i),
  emote: (i) => !!talk && talk.emote(i),
  arrows: () => renderer.arrows(),
  phrases: PHRASES.length,
};
