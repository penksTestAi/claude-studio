// A tiny per-peer rate limiter (token bucket) for messages from other players. Anything over the limit is
// dropped. Used by presence and by talk, so a hostile peer cannot flood a browser.
export function createGuard(perSecond, burst) {
  const buckets = new Map(); // peerId -> { tokens, t }
  return {
    allow(id, now) {
      let b = buckets.get(id);
      if (!b) { b = { tokens: burst, t: now }; buckets.set(id, b); }
      b.tokens = Math.min(burst, b.tokens + (now - b.t) / 1000 * perSecond);
      b.t = now;
      if (b.tokens < 1) return false;
      b.tokens -= 1;
      return true;
    },
    forget(id) { buckets.delete(id); },
  };
}
