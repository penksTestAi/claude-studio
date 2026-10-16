// Character figure poses, worked out in each browser from what it already knows about a player (moving, facing,
// gesture). Pure maths, nothing is sent or received. With reduced motion the walk cycle and lantern swing stop; gesture poses still apply.
export const STRIDE_MS = 520; // one full walk cycle (left foot, right foot)

// phase: a per-player offset so a crowd does not step in unison (any finite number).
export function walkPose(moving, t, phase, reduce) {
  if (!moving || reduce || !Number.isFinite(t)) return { stride: 0, lift: 0, swing: 0, sway: 0 };
  const a = (t / STRIDE_MS) * Math.PI * 2 + (Number.isFinite(phase) ? phase : 0);
  return { stride: Math.sin(a), lift: Math.abs(Math.sin(a)), swing: Math.sin(a - 0.9), sway: Math.sin(a * 2) };
}

// Pose numbers in units of the avatar radius r, as fractions: foot offsets along the facing direction (fwd) and
// across it (side), the lantern's swing angle in radians, the lantern arm's reach, the head's lean forward.
export function figurePose(moving, t, phase, gesture, k, reduce) {
  const w = walkPose(moving, t, phase, reduce);
  const idle = !moving || reduce ? 0 : 1;
  const kk = Number.isFinite(k) ? Math.max(0, Math.min(1, k)) : 0;
  const pose = {
    footL: { fwd: 0.55 * w.stride, side: -0.5 }, footR: { fwd: -0.55 * w.stride, side: 0.5 },
    footLift: 0.18 * w.lift, lanternSwing: 0.55 * w.swing * idle, armReach: 1.15 + 0.08 * w.sway,
    headLean: 0.1 * idle * w.lift, headUp: 0, sit: false, raiseHand: 0,
  };
  if (gesture === "bow") pose.headLean = 0.5 * Math.sin(Math.PI * Math.min(1, kk * 1.4));
  else if (gesture === "wave") pose.raiseHand = 1;
  else if (gesture === "cheer") { pose.headUp = 0.25; pose.raiseHand = 1; }
  else if (gesture === "point") pose.lanternSwing = 0;
  else if (gesture === "sit") { pose.sit = true; pose.footL = { fwd: 0.3, side: -0.55 }; pose.footR = { fwd: 0.3, side: 0.55 }; pose.footLift = 0; pose.lanternSwing = 0; }
  return pose;
}
