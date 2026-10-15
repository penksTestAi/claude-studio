// Talk without typing: gestures and preset phrases. The network carries only small integer ids:
//   { k:"say", p:<phrase id> }   { k:"em", e:<gesture id> }
// The words below live in every browser's own code; a peer can only pick from this list, never write.
// Anything that is not exactly one of those two shapes with a known id is dropped. Both sides enforce the
// cooldown, so a modified client cannot spam bubbles.
import { createGuard } from "./guard.js";

export const PHRASES = [
  "Over here!", "Follow me", "Thank you", "Need light", "Goodnight", "Hello", "Yes", "No",
  "Wait for me", "Well done", "Look!", "Careful", "I will keep watch", "Lead on", "Sorry", "Safe travels",
];
export const EMOTES = ["wave", "bow", "point", "cheer", "sit"];
export const SIT = EMOTES.indexOf("sit");

export const PHRASE_COOLDOWN_MS = 3000, EMOTE_COOLDOWN_MS = 1500;
export const BUBBLE_MS = 4500, EMOTE_MS = 2600, SIT_MS = 8000;
const SLACK = 0.8; // a receiver accepts a message slightly early, to forgive network jitter

const validPhrase = (m) => Object.keys(m).length === 2 && Number.isInteger(m.p) && m.p >= 0 && m.p < PHRASES.length;
const validEmote = (m) => Object.keys(m).length === 2 && Number.isInteger(m.e) && m.e >= 0 && m.e < EMOTES.length;

// `me` and every entry of `peers` get { say:{id,start,until}|null, emote:{id,start,until}|null }.
export function createTalk(net, me, peers, onHear = () => {}) {
  const guard = createGuard(6, 10);
  const lastSay = new Map(), lastEmote = new Map(); // peerId -> time of the last accepted one
  let sayReady = 0, emoteReady = 0;

  net.onPeerLeave((id) => { guard.forget(id); lastSay.delete(id); lastEmote.delete(id); });
  net.onMessage((msg, id) => {
    if (!msg || typeof msg !== "object" || (msg.k !== "say" && msg.k !== "em")) return;
    const p = peers.get(id);
    if (!p) return; // only people who said hello
    const now = performance.now();
    if (!guard.allow(id, now)) return;
    if (msg.k === "say") {
      if (!validPhrase(msg)) return;
      if (now - (lastSay.get(id) ?? -1e9) < PHRASE_COOLDOWN_MS * SLACK) return;
      lastSay.set(id, now);
      p.say = { id: msg.p, start: now, until: now + BUBBLE_MS };
      onHear(p, msg.p);
    } else {
      if (!validEmote(msg)) return;
      if (now - (lastEmote.get(id) ?? -1e9) < EMOTE_COOLDOWN_MS * SLACK) return;
      lastEmote.set(id, now);
      p.emote = { id: msg.e, start: now, until: now + (msg.e === SIT ? SIT_MS : EMOTE_MS) };
    }
  });

  return {
    // Return true when sent. false means still cooling down (or a bad id).
    say(i, now = performance.now()) {
      if (!Number.isInteger(i) || i < 0 || i >= PHRASES.length || now < sayReady) return false;
      sayReady = now + PHRASE_COOLDOWN_MS;
      me.say = { id: i, start: now, until: now + BUBBLE_MS };
      net.send({ k: "say", p: i });
      return true;
    },
    emote(i, now = performance.now()) {
      if (!Number.isInteger(i) || i < 0 || i >= EMOTES.length || now < emoteReady) return false;
      emoteReady = now + EMOTE_COOLDOWN_MS;
      me.emote = { id: i, start: now, until: now + (i === SIT ? SIT_MS : EMOTE_MS) };
      net.send({ k: "em", e: i });
      return true;
    },
    // 0 = ready, 1 = just used; used to draw the cooldown on the buttons.
    cooldowns(now = performance.now()) {
      return { say: Math.max(0, Math.min(1, (sayReady - now) / PHRASE_COOLDOWN_MS)), emote: Math.max(0, Math.min(1, (emoteReady - now) / EMOTE_COOLDOWN_MS)) };
    },
    // Called every frame: expire bubbles and gestures; sitting ends as soon as the player walks.
    tick(now) {
      for (const p of [me, ...peers.values()]) {
        if (p.say && now >= p.say.until) p.say = null;
        if (p.emote && (now >= p.emote.until || (p.emote.id === SIT && p.moving))) p.emote = null;
      }
    },
  };
}
