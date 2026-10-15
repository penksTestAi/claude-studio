// Boot and glue: identity, room choice, the game loop, and the small status panel.
import { generateWorld, spawnFor, isBlocked, tileAt, T, worldFingerprint } from "./world.js";
import { nameFor, colourFor, newSeed, isSeed } from "./names.js";
import { createTransport, pickKind, pickTestRelay } from "./net/transport.js";
import { createPresence } from "./presence.js";
import { createInput } from "./input.js";
import { createTalk, PHRASES, EMOTES } from "./talk.js";
import { createRenderer } from "./render.js";
import { createMinimap, describeNearest } from "./minimap.js";
import { hourAt, lightFor, pickHour, HOURS } from "./nightclock.js";
import { createFootsteps, createStrideTracker, stepGain } from "./sound.js";
import { surfaceAt, landmarkFingerprint } from "./world.js";
import { generateNodes, nodeFingerprint, KINDS, KIND_NAMES } from "./resources.js";
import { createGather } from "./gather.js";

const ROOMS = 6;
const SPEED = 4.2; // tiles per second
const RADIUS = 0.28; // tiles
const STORE = "vigil.longwatch.v1";

const $ = (id) => document.getElementById(id);
const world = generateWorld();
const netKind = pickKind(location.search);
const testRelay = pickTestRelay(location.search);
const nodes = generateNodes(world);
const respawnPin = (() => { const v = Number(new URLSearchParams(location.search).get("respawn")); return Number.isInteger(v) && v >= 1 && v <= 600 ? v : 0; })(); // tests: shorter respawn

// ---- identity, saved only in this browser ----
// In local test mode each tab is its own character (sessionStorage), so two tabs can meet each other.
const store = () => (netKind === "local" ? sessionStorage : localStorage);
function loadSave() {
  try { const s = JSON.parse(store().getItem(STORE) || "null"); if (s && isSeed(s.seed)) return s; } catch { /* storage blocked */ }
  return { seed: newSeed() };
}
function save() {
  try { store().setItem(STORE, JSON.stringify({ seed: me.seed, x: me.x, y: me.y })); } catch { /* storage blocked */ }
}
const saved = loadSave();
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
const renderer = createRenderer(canvas, world, { reducedMotion });
const minimap = createMinimap($("minimap"), world);
const steps = createFootsteps();
const strides = createStrideTracker();
const pinnedHour = pickHour(location.search);
const lightNow = () => lightFor(pinnedHour ?? hourAt(Date.now()));
let lastHud = 0, lastMap = 0, mapOn = true;
let net = null, presence = null, talk = null, gather = null, playing = false, lastT = 0, lastSave = 0, joinedAt = 0;
const input = createInput(canvas, () => playing);

async function enter() {
  if (playing) return;
  $("enter").disabled = true;
  try {
    net = await createTransport(netKind, `lantern-${roomNo}`, { relay: testRelay });
  } catch (e) {
    console.error(e);
    $("status").textContent = "Could not start networking in this browser.";
    $("enter").disabled = false;
    return;
  }
  presence = createPresence(net, world, me, updatePeers);
  talk = createTalk(net, me, presence.peers, (p, id) => { $("heard").textContent = `${p.name}: ${PHRASES[id]}`; });
  gather = createGather(net, world, me, presence.peers, nodes, { respawn: respawnPin, onEvent: gatherEvent });
  me.say = null; me.emote = null;
  paintPack(); $("gathered").textContent = "";
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
  playing = false; net = null; presence = null; talk = null; gather = null;
  setTalkOpen(false); $("heard").textContent = "";
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
  paintCooldowns(t);
  const light = lightNow();
  footsteps(light);
  const reach = gather.reach();
  renderer.draw(me, presence.peers, input.stick, t, light, gather.visible(), reach);
  $("gather").disabled = !reach;
  if (mapOn && t - lastMap > 100) { lastMap = t; minimap.draw(me, presence.peers.values()); }
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
  if (type === "got") { $("gathered").textContent = `You gathered ${KIND_NAMES[kind].toLowerCase()}.`; paintPack(); }
  else $("gathered").textContent = `Someone was first to the ${KIND_NAMES[kind].toLowerCase()}.`;
}
function paintPack() {
  $("pack").textContent = "Pack (this visit): " + KINDS.map(k => `${KIND_NAMES[k]} ${gather ? gather.inv[k] : 0}`).join(", ");
}
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
    li.textContent = p.name + (you ? " (you)" : "");
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
  hud: () => ({ where: $("where").textContent, mapOn, minimapMarks: minimap.markCount(), stepsOn: steps.on, stepsPlayed: steps.played, stepsSupported: steps.supported, dropped: net ? net.status().dropped : 0, reducedMotion: reducedMotion() }),
  self: () => ({ id: net && net.selfId, name: me.name, seed: me.seed, x: me.x, y: me.y, playing, room: roomNo, net: net && net.kind }),
  peers: () => presence ? [...presence.peers.values()].map(p => ({ id: p.id, name: p.name, seed: p.seed, x: p.tx, y: p.ty, say: p.say ? p.say.id : null, emote: p.emote ? p.emote.id : null })) : [],
  nodes: () => nodes.map(n => ({ id: n.id, kind: n.kind, x: n.x, y: n.y, respawn: n.respawn })),
  nodeFingerprint: () => nodeFingerprint(nodes),
  gather: () => gather ? { hidden: nodes.filter(n => gather.isHidden(n.id)).map(n => n.id), inv: { ...gather.inv }, synced: gather.synced, arbiter: gather.arbiterId(), isArbiter: gather.isArbiter(), reach: gather.reach()?.id ?? null } : null,
  pick: () => !!gather && !!gather.pick(),
  mine: () => ({ say: me.say ? me.say.id : null, emote: me.emote ? me.emote.id : null }),
  say: (i) => !!talk && talk.say(i),
  emote: (i) => !!talk && talk.emote(i),
  arrows: () => renderer.arrows(),
  phrases: PHRASES.length,
};
