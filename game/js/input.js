// Movement input: arrow keys or WASD on a keyboard; on a touch screen (or with a mouse) press anywhere on
// the map and drag the way you want to walk, like a joystick that appears under your thumb.

const KEYS = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
const DEAD = 8, FULL = 48; // css px

export function createInput(canvas, isActive) {
  const held = new Set();
  const stick = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };

  const typing = (e) => e.target instanceof HTMLElement && e.target.closest("input, textarea, select");
  addEventListener("keydown", (e) => {
    if (!isActive() || typing(e) || !(e.code in KEYS)) return;
    held.add(e.code);
    if (e.code.startsWith("Arrow")) e.preventDefault();
  });
  addEventListener("keyup", (e) => held.delete(e.code));
  addEventListener("blur", () => held.clear());

  canvas.addEventListener("pointerdown", (e) => {
    if (!isActive() || stick.on) return;
    const r = canvas.getBoundingClientRect();
    Object.assign(stick, { on: true, id: e.pointerId, ox: e.clientX - r.left, oy: e.clientY - r.top });
    stick.x = stick.ox; stick.y = stick.oy;
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!stick.on || e.pointerId !== stick.id) return;
    const r = canvas.getBoundingClientRect();
    stick.x = e.clientX - r.left; stick.y = e.clientY - r.top;
  });
  const end = (e) => { if (e.pointerId === stick.id) { stick.on = false; stick.id = null; } };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  return {
    stick,
    // Returns a direction vector with length 0..1.
    read() {
      let x = 0, y = 0;
      for (const k of held) { x += KEYS[k][0]; y += KEYS[k][1]; }
      if (x || y) { const l = Math.hypot(x, y); return { x: x / l, y: y / l }; }
      if (stick.on) {
        const dx = stick.x - stick.ox, dy = stick.y - stick.oy, l = Math.hypot(dx, dy);
        if (l > DEAD) { const s = Math.min(1, (l - DEAD) / (FULL - DEAD)); return { x: dx / l * s, y: dy / l * s }; }
      }
      return { x: 0, y: 0 };
    },
  };
}
