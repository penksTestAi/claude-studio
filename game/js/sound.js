// Footsteps: soft, short, and OFF until a player turns them on (browsers also need a click before any sound).
// Own steps are heard at full strength; steps of players walking nearby fade out with distance. Sounds are
// synthesised here (filtered noise), nothing is downloaded and nothing a peer sends can reach this file.
export const STRIDE = 0.9; // tiles per step
export const HEAR_RANGE = 8; // tiles; further away, a step is silent

// Counts strides for any number of walkers from their positions. Returns how many steps a walker took.
export function createStrideTracker(stride = STRIDE) {
  const acc = new Map(); // id -> { x, y, d }
  return {
    advance(id, x, y, walking) {
      let a = acc.get(id);
      if (!a) { acc.set(id, { x, y, d: 0 }); return 0; }
      const dist = Math.hypot(x - a.x, y - a.y);
      a.x = x; a.y = y;
      if (!walking || dist > 3) { a.d = 0; return 0; } // standing, or a jump (arrival, teleport): no steps
      a.d += dist;
      const n = Math.floor(a.d / stride);
      a.d -= n * stride;
      return Math.min(n, 2);
    },
    forget(id) { acc.delete(id); },
    clear() { acc.clear(); },
  };
}

// How loud a step at `dist` tiles is: 1 at your feet, 0 at HEAR_RANGE.
export const stepGain = (dist) => Math.max(0, Math.min(1, 1 - dist / HEAR_RANGE));

const VOICES = { // filter type, centre frequency, length (s), loudness
  sand: ["lowpass", 900, 0.09, 0.10], grass: ["bandpass", 1400, 0.07, 0.08], stone: ["bandpass", 2200, 0.05, 0.09],
  water: ["bandpass", 2600, 0.16, 0.09], wood: ["lowpass", 520, 0.08, 0.16],
};

export function createFootsteps() {
  const Ctx = typeof window !== "undefined" ? (window.AudioContext || window.webkitAudioContext) : null;
  let on = false, ctx = null, noise = null, played = 0;
  return {
    supported: !!Ctx,
    get on() { return on; },
    get played() { return played; }, // steps that were played (for the tests)
    // Must be called from a click or key press. Returns the new state.
    set(value) {
      if (!Ctx) return false;
      on = !!value;
      if (on && !ctx) {
        try {
          ctx = new Ctx();
          noise = ctx.createBuffer(1, ctx.sampleRate >> 1, ctx.sampleRate);
          const d = noise.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        } catch { ctx = null; on = false; }
      }
      if (on && ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
      return on;
    },
    step(surface, gain) {
      if (!on || gain <= 0.02) return;
      played++;
      if (!ctx) return;
      const [type, freq, len, loud] = VOICES[surface] || VOICES.grass;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = noise;
      src.playbackRate.value = 0.85 + Math.random() * 0.3;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq * (0.9 + Math.random() * 0.2); f.Q.value = 0.9;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(loud * gain, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      src.connect(f); f.connect(g); g.connect(ctx.destination);
      src.start(t, Math.random() * 0.3, len + 0.02);
    },
    close() { on = false; if (ctx) { ctx.close().catch(() => {}); ctx = null; } },
  };
}
