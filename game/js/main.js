// Boot and glue: identity, room choice, the game loop, and the small status panel.
import { generateWorld, spawnFor, isBlocked, tileAt, T, worldFingerprint } from "./world.js";
import { nameFor, colourFor, newSeed, isSeed } from "./names.js";
import { createTransport, pickKind, pickTestRelay } from "./net/transport.js";
import { createPresence } from "./presence.js";
import { createInput } from "./input.js";
import { createRenderer } from "./render.js";

const ROOMS = 6;
const SPEED = 4.2; // tiles per second
const RADIUS = 0.28; // tiles
const STORE = "vigil.longwatch.v1";

const $ = (id) => document.getElementById(id);
const world = generateWorld();
const netKind = pickKind(location.search);
const testRelay = pickTestRelay(location.search);

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
const me = { id: "me", seed: saved.seed, name: nameFor(saved.seed), colour: colourFor(saved.seed), x: start.x, y: start.y, d: 0, moving: false };
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
const renderer = createRenderer(canvas, world);
let net = null, presence = null, playing = false, lastT = 0, lastSave = 0, joinedAt = 0;
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
  playing = false; net = null; presence = null;
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
  renderer.draw(me, presence.peers, input.stick, t);
  if (t - lastSave > 3000) { save(); lastSave = t; updateStatus(); }
  requestAnimationFrame(frame);
}

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
  world: () => ({ seed: world.seed, fingerprint: worldFingerprint(world) }),
  self: () => ({ name: me.name, seed: me.seed, x: me.x, y: me.y, playing, room: roomNo, net: net && net.kind }),
  peers: () => presence ? [...presence.peers.values()].map(p => ({ name: p.name, seed: p.seed, x: p.tx, y: p.ty })) : [],
};
