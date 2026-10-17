/* orbit.js: two-body physics shared by index.html and check.mjs (UMD: browser global `Orbit`, or require()).
   Everything is in SI units (metres, seconds) unless a name says otherwise.
   Nothing here knows about the page. The physics is: a point mass moving in the pull of one fixed centre. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Orbit = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Typed constants. They are NOT independent of the sources they come from; the README lists them.
  const GM_EARTH = 3.986004418e14;      // m^3/s^2, the EGM96/IERS value (typed in)
  const R_EARTH = 6378137;              // m, WGS84 equatorial radius (typed in)
  const GM_SUN = 1.32712440018e20;      // m^3/s^2, typed in (heliocentric gravitational constant)
  const AU = 149597870700;              // m, exact by IAU 2012 definition
  const DAY = 86400;

  // ---- state: {x, y, vx, vy}; pull toward the origin with parameter mu ----
  function accel(s, mu) {
    const r2 = s.x * s.x + s.y * s.y, r3 = r2 * Math.sqrt(r2);
    return [-mu * s.x / r3, -mu * s.y / r3];
  }

  // One classical fourth-order Runge-Kutta step.
  function rk4(s, dt, mu) {
    const f = (x, y, vx, vy) => { const a = accel({ x, y }, mu); return [vx, vy, a[0], a[1]]; };
    const k1 = f(s.x, s.y, s.vx, s.vy);
    const k2 = f(s.x + dt / 2 * k1[0], s.y + dt / 2 * k1[1], s.vx + dt / 2 * k1[2], s.vy + dt / 2 * k1[3]);
    const k3 = f(s.x + dt / 2 * k2[0], s.y + dt / 2 * k2[1], s.vx + dt / 2 * k2[2], s.vy + dt / 2 * k2[3]);
    const k4 = f(s.x + dt * k3[0], s.y + dt * k3[1], s.vx + dt * k3[2], s.vy + dt * k3[3]);
    return {
      x: s.x + dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
      y: s.y + dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
      vx: s.vx + dt / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
      vy: s.vy + dt / 6 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]),
    };
  }

  // The deliberately poor control: explicit Euler. The checks must flag it.
  function euler(s, dt, mu) {
    const a = accel(s, mu);
    return { x: s.x + dt * s.vx, y: s.y + dt * s.vy, vx: s.vx + dt * a[0], vy: s.vy + dt * a[1] };
  }

  // Step size follows the local dynamical time sqrt(r^3/mu): small steps near the body, large far away.
  function stepSize(s, mu, eps) {
    const r = Math.hypot(s.x, s.y);
    return eps * Math.sqrt(r * r * r / mu);
  }

  /* Integrate from s0 for tEnd seconds. Calls onStep(prev, next, t0, t1) for each step (t in seconds from start).
     Returns the final state. opts: {eps, method:'rk4'|'euler', stop(state,t) -> true to end early}. */
  function integrate(s0, mu, tEnd, opts, onStep) {
    const eps = (opts && opts.eps) || 0.002;
    const step = opts && opts.method === 'euler' ? euler : rk4;
    let s = s0, t = 0;
    while (t < tEnd) {
      const dt = Math.min(stepSize(s, mu, eps), tEnd - t);
      const n = step(s, dt, mu);
      if (onStep) onStep(s, n, t, t + dt);
      s = n; t += dt;
      if (opts && opts.stop && opts.stop(s, t)) break;
    }
    return { state: s, t };
  }

  // ---- orbital quantities from a state ----
  function elements(s, mu) {
    const r = Math.hypot(s.x, s.y), v2 = s.vx * s.vx + s.vy * s.vy;
    const energy = v2 / 2 - mu / r;                 // J/kg
    const h = s.x * s.vy - s.y * s.vx;              // m^2/s, signed
    const ex = (v2 - mu / r) * s.x / mu - (s.x * s.vx + s.y * s.vy) * s.vx / mu;
    const ey = (v2 - mu / r) * s.y / mu - (s.x * s.vx + s.y * s.vy) * s.vy / mu;
    const e = Math.hypot(ex, ey);
    const bound = energy < 0;
    const a = bound ? -mu / (2 * energy) : Infinity;
    return {
      r, v: Math.sqrt(v2), energy, h, e, bound, a,
      rp: bound ? a * (1 - e) : (h * h / mu) / (1 + e), // periapsis distance (valid for hyperbolas too)
      ra: bound ? a * (1 + e) : Infinity,
      period: bound ? 2 * Math.PI * Math.sqrt(a * a * a / mu) : Infinity,
      omega: Math.atan2(ey, ex),                      // direction of periapsis
    };
  }

  // Speed from vis-viva: v^2 = mu (2/r - 1/a)
  const visViva = (r, a, mu) => Math.sqrt(mu * (2 / r - 1 / a));

  // Points of the Kepler ellipse for drawing, from elements only (no integration).
  function ellipsePoints(el, mu, n) {
    const pts = [];
    if (!el.bound) return pts;
    const p = el.h * el.h / mu, sgn = Math.sign(el.h) || 1;
    for (let i = 0; i <= n; i++) {
      const nu = 2 * Math.PI * i / n;
      const r = p / (1 + el.e * Math.cos(nu));
      const ang = el.omega + sgn * nu;
      pts.push([r * Math.cos(ang), r * Math.sin(ang)]);
    }
    return pts;
  }

  // Burn: add dv (m/s) along prograde (direction of motion) and radial-out axes at once. Instant (impulsive).
  function burn(s, dvPro, dvRad) {
    const v = Math.hypot(s.vx, s.vy), r = Math.hypot(s.x, s.y);
    const px = s.vx / v, py = s.vy / v, rx = s.x / r, ry = s.y / r;
    return { x: s.x, y: s.y, vx: s.vx + dvPro * px + dvRad * rx, vy: s.vy + dvPro * py + dvRad * ry };
  }

  const circular = (r, mu, dir) => ({ x: r, y: 0, vx: 0, vy: (dir || 1) * Math.sqrt(mu / r) });

  /* Run one orbit-measuring integration and report what it measured. Returns
     {apsides:[{kind,t,r}], period, maxEnergyErr, maxHErr, samples:[{r,v}], tEnd}
     Apsides come from sign changes of the radial speed, refined with a cubic Hermite fit; the period from the
     unwrapped angle; nothing here uses the elements() of the start state. */
  function measureOrbit(s0, mu, nOrbits, opts) {
    const e0 = elements(s0, mu);
    const tEnd = nOrbits * e0.period;
    const dir = Math.sign(e0.h) || 1;
    const E0 = e0.energy, h0 = e0.h;
    let maxE = 0, maxH = 0, ang = Math.atan2(s0.y, s0.x), ang0 = ang, unwrapped = 0, lastRaw = ang;
    let crossings = [];
    const apsides = [], samples = [];
    let nextSample = 0;
    const sampleEvery = e0.period / 400;
    const rdot = s => (s.x * s.vx + s.y * s.vy) / Math.hypot(s.x, s.y);
    integrate(s0, mu, tEnd, opts, (a, b, t0, t1) => {
      const eb = elements(b, mu);
      maxE = Math.max(maxE, Math.abs((eb.energy - E0) / E0));
      maxH = Math.max(maxH, Math.abs((eb.h - h0) / h0));
      // unwrapped swept angle
      const raw = Math.atan2(b.y, b.x);
      let d = raw - lastRaw;
      if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
      const before = unwrapped;
      unwrapped += d; lastRaw = raw;
      const target = (crossings.length + 1) * 2 * Math.PI;
      if (dir * unwrapped >= target && dir * before < target) {
        const f = (target - dir * before) / (dir * (unwrapped - before));
        crossings.push(t0 + f * (t1 - t0));
      }
      // apsides
      const ra = rdot(a), rb = rdot(b);
      if (ra * rb < 0) {
        const f = ra / (ra - rb), tau = f * (t1 - t0), h = t1 - t0;
        const r0 = Math.hypot(a.x, a.y), r1 = Math.hypot(b.x, b.y);
        // Hermite cubic through (0,r0,ra) and (h,r1,rb), evaluated at the zero of rdot (linear in time)
        const u = tau / h, u2 = u * u, u3 = u2 * u;
        const rr = (2 * u3 - 3 * u2 + 1) * r0 + (u3 - 2 * u2 + u) * h * ra + (-2 * u3 + 3 * u2) * r1 + (u3 - u2) * h * rb;
        apsides.push({ kind: rb > 0 ? 'peri' : 'apo', t: t0 + tau, r: rr });
      }
      if (t1 >= nextSample) {
        samples.push({ r: eb.r, v: eb.v });
        nextSample = t1 + sampleEvery;
      }
    });
    const period = crossings.length >= 2 ? (crossings[crossings.length - 1] - crossings[0]) / (crossings.length - 1)
      : crossings.length === 1 ? crossings[0] : NaN;
    return { apsides, period, maxEnergyErr: maxE, maxHErr: maxH, samples, tEnd, crossings: crossings.length };
  }

  // ---- Hohmann transfer between circular coplanar orbits of radii r1 < r2 (or r1 > r2) ----
  function hohmann(r1, r2, mu) {
    const at = (r1 + r2) / 2;
    const v1 = Math.sqrt(mu / r1), v2 = Math.sqrt(mu / r2);
    const dv1 = v1 * (Math.sqrt(2 * r2 / (r1 + r2)) - 1);
    const dv2 = v2 * (1 - Math.sqrt(2 * r1 / (r1 + r2)));
    const time = Math.PI * Math.sqrt(at * at * at / mu);
    const n2 = Math.sqrt(mu / (r2 * r2 * r2));
    return {
      at, dv1, dv2, total: Math.abs(dv1) + Math.abs(dv2), time,
      leadAngle: Math.PI - n2 * time,                 // where the target must be, ahead of the craft, at departure
      synodic: 1 / Math.abs(1 / (2 * Math.PI * Math.sqrt(r1 ** 3 / mu)) - 1 / (2 * Math.PI * Math.sqrt(r2 ** 3 / mu))),
    };
  }

  /* "Slow down to catch up": a target on the same circular orbit of radius r is `phi` radians ahead.
     Brake at the chaser's position so that after n laps of the smaller ellipse it is back at that point just as
     the target arrives. Smaller ellipse period: Tp = T (1 - phi / (2 pi n)). Returns null when periapsis would be
     below minPeri (then more laps are needed); lapsFor() finds the smallest n that works. */
  function phasing(r, mu, phi, n, minPeri) {
    const T = 2 * Math.PI * Math.sqrt(r ** 3 / mu);
    const Tp = T * (1 - phi / (2 * Math.PI * n));
    const ap = r * Math.pow(Tp / T, 2 / 3);
    const rp = 2 * ap - r;
    const vc = Math.sqrt(mu / r);
    const dv = visViva(r, ap, mu) - vc;               // negative: a retro burn
    return { T, Tp, ap, rp, dv, n, ok: rp >= minPeri, totalTime: n * Tp };
  }
  function lapsFor(r, mu, phi, minPeri, maxN) {
    for (let n = 1; n <= (maxN || 12); n++) { const p = phasing(r, mu, phi, n, minPeri); if (p.ok) return p; }
    return null;
  }

  return { GM_EARTH, R_EARTH, GM_SUN, AU, DAY, accel, rk4, euler, integrate, elements, visViva, ellipsePoints,
    burn, circular, measureOrbit, hohmann, phasing, lapsFor, stepSize };
});
