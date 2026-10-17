/* checks.js: every check the page and check.mjs run. UMD: browser global `OrbitChecks`, or require().
   Each check returns {id, group, label, value, tol, unit, pass, detail}. `pass` is only ever the result of a
   comparison in this file; no verdict word is typed by hand anywhere else. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./orbit.js'));
  else root.OrbitChecks = factory(root.Orbit);
})(typeof self !== 'undefined' ? self : this, function (O) {
  'use strict';

  const TOL = { visViva: 1e-6, kepler3: 1e-5, energy: 1e-8, momentum: 1e-8, apsis: 1e-6, planet: 1e-3 };
  const MOTION_ORBITS = 10, SPAN_YEARS = 480, OSC_SAMPLES = 20;
  const fmt = (x, d) => (Math.abs(x) < 1e-3 && x !== 0 ? x.toExponential(d || 1) : (+x.toPrecision(d || 4)).toString());
  const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
  const mk = (id, group, label, value, tol, pass, detail) => ({ id, group, label, value, tol, pass, detail });

  /* ---------- 1. integrated motion against vis-viva, Kepler III, energy and angular momentum ---------- */
  const CASES = [
    { name: 'circular, 7000 km', s: () => O.circular(7000e3, O.GM_EARTH) },
    { name: 'eccentric, 6778 x 26000 km', s: () => {
      const rp = 6778e3, ra = 26000e3, a = (rp + ra) / 2;
      return { x: rp, y: 0, vx: 0, vy: O.visViva(rp, a, O.GM_EARTH) };
    } },
    { name: 'after a +1.5 km/s prograde burn', s: () => O.burn(O.circular(7000e3, O.GM_EARTH), 1500, 0) },
    { name: 'after a 700 m/s outward and 400 m/s retrograde burn', s: () => O.burn(O.circular(7000e3, O.GM_EARTH), -400, 700) },
    { name: 'retrograde circular, 12000 km', s: () => O.circular(12000e3, O.GM_EARTH, -1) },
  ];

  function motionChecks() {
    const out = [];
    for (const c of CASES) {
      const s0 = c.s();
      const m = O.measureOrbit(s0, O.GM_EARTH, MOTION_ORBITS, { eps: 0.002 });
      const peri = m.apsides.filter(x => x.kind === 'peri'), apo = m.apsides.filter(x => x.kind === 'apo');
      // Apsides measured from the integrated path (not from the start state's elements)
      const e0 = O.elements(s0, O.GM_EARTH);
      let aMeas, rpM, raM;
      if (e0.e < 1e-9) { rpM = raM = m.samples.reduce((q, x) => q + x.r, 0) / m.samples.length; }
      else { rpM = peri.reduce((s, x) => s + x.r, 0) / peri.length; raM = apo.reduce((s, x) => s + x.r, 0) / apo.length; }
      aMeas = (rpM + raM) / 2;
      // vis-viva: speed at every sampled point, against a from the measured apsides
      let worst = 0;
      for (const p of m.samples) worst = Math.max(worst, rel(p.v, O.visViva(p.r, aMeas, O.GM_EARTH)));
      out.push(mk('vv:' + c.name, 'motion', 'Vis-viva, ' + c.name, worst, TOL.visViva, worst <= TOL.visViva,
        m.samples.length + ' sampled speeds over ' + MOTION_ORBITS + ' orbits, a from the measured apsides (' + (e0.e < 1e-9 ? 'circular: mean sampled radius' : peri.length + ' perigees, ' + apo.length + ' apogees') + ')'));
      const Tk = 2 * Math.PI * Math.sqrt(aMeas ** 3 / O.GM_EARTH);
      const dT = rel(m.period, Tk);
      out.push(mk('k3:' + c.name, 'motion', "Kepler's third law, " + c.name, dT, TOL.kepler3, dT <= TOL.kepler3,
        'measured period ' + fmt(m.period / 60, 6) + ' min (swept 2 pi, mean of ' + m.crossings + ') against 2 pi sqrt(a^3/GM) = ' + fmt(Tk / 60, 6) + ' min'));
      out.push(mk('en:' + c.name, 'motion', 'Energy kept, ' + c.name, m.maxEnergyErr, TOL.energy, m.maxEnergyErr <= TOL.energy,
        'largest relative change of v^2/2 - GM/r over ' + MOTION_ORBITS + ' orbits'));
      out.push(mk('h:' + c.name, 'motion', 'Angular momentum kept, ' + c.name, m.maxHErr, TOL.momentum, m.maxHErr <= TOL.momentum,
        'largest relative change of x vy - y vx over ' + MOTION_ORBITS + ' orbits'));
    }
    return out;
  }

  // Control: explicit Euler on the same eccentric orbit. This check is expected to fail; "pass" means the page caught it.
  function controlCheck() {
    const rp = 6778e3, ra = 26000e3, a = (rp + ra) / 2;
    const s0 = { x: rp, y: 0, vx: 0, vy: O.visViva(rp, a, O.GM_EARTH) };
    const m = O.measureOrbit(s0, O.GM_EARTH, MOTION_ORBITS, { eps: 0.002, method: 'euler' });
    const flagged = m.maxEnergyErr > TOL.energy;
    return mk('control:euler', 'control', 'Control: a poor integrator (explicit Euler) is flagged by the energy check',
      m.maxEnergyErr, TOL.energy, flagged,
      'same orbit, same step rule; energy changed by ' + fmt(m.maxEnergyErr, 2) + ' (relative), so the check ' + (flagged ? 'does fail it' : 'could NOT tell the difference'));
  }

  /* ---------- 2. Hohmann transfer between two circular orbits around the Sun, flown by the integrator ---------- */
  function hohmannChecks(rEarthM, rMarsM) {
    const mu = O.GM_SUN, H = O.hohmann(rEarthM, rMarsM, mu), out = [];
    let s = O.burn(O.circular(rEarthM, mu), H.dv1, 0);
    // coast until the radial speed changes sign (apoapsis)
    let tArr = NaN, rArr = NaN, stateArr = null, prev = s;
    let tAcc = 0;
    const res = O.integrate(s, mu, 2 * H.time, {
      eps: 0.001,
      stop: (st, t) => { const rd = st.x * st.vx + st.y * st.vy; if (rd <= 0 && t > H.time * 0.2) return true; return false; },
    });
    tArr = res.t; stateArr = res.state; rArr = Math.hypot(stateArr.x, stateArr.y);
    const dT = rel(tArr, H.time);
    out.push(mk('hoh:time', 'hohmann', 'Transfer time: integrated flight against pi sqrt(a_t^3/GM)', dT, 1e-4, dT <= 1e-4,
      'integrated ' + fmt(tArr / O.DAY, 6) + ' days, formula ' + fmt(H.time / O.DAY, 6) + ' days (stops at the end of the step where radial speed first changes sign, so the time can be late by up to one step)'));
    const dR = rel(rArr, rMarsM);
    out.push(mk('hoh:reach', 'hohmann', 'Integrated craft reaches the outer orbit radius', dR, 1e-4, dR <= 1e-4,
      'distance at the far point ' + fmt(rArr / O.AU, 6) + ' AU, outer orbit ' + fmt(rMarsM / O.AU, 6) + ' AU'));
    const angle = Math.atan2(stateArr.y, stateArr.x);
    const dA = Math.abs(Math.abs(angle) - Math.PI);
    out.push(mk('hoh:half', 'hohmann', 'The far point is half a turn from departure', dA, 1e-3, dA <= 1e-3,
      'angle swept ' + fmt((Math.PI - dA) * 180 / Math.PI, 6) + ' degrees (rad error ' + fmt(dA, 2) + ')'));
    // second burn
    const s2 = O.burn(stateArr, H.dv2, 0);
    const el = O.elements(s2, mu);
    const dE = Math.max(el.e, rel(el.a, rMarsM));
    out.push(mk('hoh:circ', 'hohmann', 'After the second burn the orbit is circular at the outer radius', dE, 1e-3, dE <= 1e-3,
      'eccentricity ' + fmt(el.e, 2) + ', a differs from outer radius by ' + fmt(rel(el.a, rMarsM), 2) + ' (relative)'));
    // Fly exactly the formula's transfer time, then compare with where a circular-orbit target is at that moment.
    const flown = O.integrate(O.burn(O.circular(rEarthM, mu), H.dv1, 0), mu, H.time, { eps: 0.001 }).state;
    const n2 = Math.sqrt(mu / rMarsM ** 3), marsA = H.leadAngle + n2 * H.time;
    const mx = rMarsM * Math.cos(marsA), my = rMarsM * Math.sin(marsA);
    const gapM = Math.hypot(mx - flown.x, my - flown.y);
    out.push(mk('hoh:meet', 'hohmann', 'Flown for the formula\'s transfer time, the craft is at the target (taken as circular), which starts at the computed lead angle', gapM / rMarsM, 1e-6, gapM / rMarsM <= 1e-6,
      'gap ' + fmt(gapM / 1e3, 3) + ' km straight line; lead angle ' + fmt(H.leadAngle * 180 / Math.PI, 5) + ' degrees'));
    return { H, checks: out };
  }

  /* ---------- 3. catch-up by slowing down: a chaser brakes, laps a smaller ellipse, a target arrives ---------- */
  function phasingRun(r, phi, minPeri) {
    const mu = O.GM_EARTH, p = O.lapsFor(r, mu, phi, minPeri);
    if (!p) return { plan: null };
    let s = O.burn(O.circular(r, mu), p.dv, 0);
    const T = p.T, nT = 2 * Math.PI / T;
    const res = O.integrate(s, mu, p.totalTime, { eps: 0.001 });
    const target = phi + nT * p.totalTime;
    const chaserAng = Math.atan2(res.state.y, res.state.x);
    let d = (target - chaserAng) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
    const sepM = Math.abs(d) * r;
    const sBack = O.burn(res.state, -p.dv, 0);        // circularising burn: undo the braking
    const el = O.elements(sBack, mu);
    return { plan: p, sepM, finalE: el.e, finalA: el.a, state: res.state };
  }
  function phasingChecks(r, phi, minPeri) {
    const run = phasingRun(r, phi, minPeri), out = [];
    if (!run.plan) return { run, checks: [mk('ph:none', 'phasing', 'Catch-up plan', NaN, NaN, false, 'no plan within 12 laps')] };
    out.push(mk('ph:meet', 'phasing', 'Catch-up: after the braked laps the integrated chaser is at the target', run.sepM, 1e3, run.sepM <= 1e3,
      run.plan.n + ' lap(s) of a ' + fmt(run.plan.rp / 1e3, 5) + ' x ' + fmt(2 * run.plan.ap / 1e3 - run.plan.rp / 1e3, 5) + ' km ellipse; gap at arrival ' + fmt(run.sepM, 3) + ' m (tolerance 1 km)'));
    const dE = Math.max(run.finalE, rel(run.finalA, r));
    out.push(mk('ph:circ', 'phasing', 'The matching prograde burn restores the circular orbit', dE, 1e-6, dE <= 1e-6,
      'eccentricity ' + fmt(run.finalE, 2) + ' after burn'));
    return { run, checks: out };
  }

  /* ---------- 4. planetary table against a second source of different origin ----------
     A: the NASA planetary fact sheet as copied into a GitHub mirror (printed strings kept as text).
     B: computed here from the Astronomy Engine library's VSOP87 series (and, for Pluto, its fitted table):
        a from the osculating energy (mean and range over about 480 years), the period from the time the
        heliocentric angle takes to come round again. Neither input to B is A's data.
     Rule fixed before the run: they agree when relative difference <= 0.1% + the half-step of A's printed last digit. */
  const BODIES = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
  const SUN_GM_AUD = 0.2959122082855911e-03; // AU^3/day^2, the constant inside the Astronomy Engine (typed here from its source)
  const KM_PER_AU = 149597870.7;

  function halfStep(str) { const i = str.indexOf('.'); return 0.5 * Math.pow(10, -(i < 0 ? 0 : str.length - i - 1)); }

  function sourceB(Astronomy, name) {
    const body = name === 'Earth' ? 'EMB' : name;   // Earth-Moon barycentre: the Moon's wobble is not in the planet's orbit
    const st = d => Astronomy.HelioState(body, Astronomy.MakeTime(new Date(Date.UTC(2000, 0, 1, 12) + d * 86400000)));
    const osc = s => { const r = Math.hypot(s.x, s.y, s.z), v2 = s.vx ** 2 + s.vy ** 2 + s.vz ** 2; return -SUN_GM_AUD / (2 * (v2 / 2 - SUN_GM_AUD / r)); };
    const s0 = st(-50 * 365.25), a0 = osc(s0), T0 = 2 * Math.PI * Math.sqrt(a0 ** 3 / SUN_GM_AUD); // seed only
    const nRev = Math.max(1, Math.min(40, Math.floor(SPAN_YEARS * 365.25 / T0)));
    const start = -50 * 365.25;
    // orbital-plane basis from the first state
    const r0 = [s0.x, s0.y, s0.z], v0 = [s0.vx, s0.vy, s0.vz];
    const h = [r0[1] * v0[2] - r0[2] * v0[1], r0[2] * v0[0] - r0[0] * v0[2], r0[0] * v0[1] - r0[1] * v0[0]];
    const hn = Math.hypot(...h), hu = h.map(x => x / hn), rn = Math.hypot(...r0), ex = r0.map(x => x / rn);
    const ey = [hu[1] * ex[2] - hu[2] * ex[1], hu[2] * ex[0] - hu[0] * ex[2], hu[0] * ex[1] - hu[1] * ex[0]];
    const dt = T0 / 1000;
    let unwrapped = 0, last = 0, tPrev = start, aSum = 0, aN = 0, aMin = Infinity, aMax = -Infinity;
    let tFirst = null, tLast = null, count = 0;
    const nextA = { t: start };
    for (let t = start + dt; count < nRev; t += dt) {
      const s = st(t);
      const x = s.x * ex[0] + s.y * ex[1] + s.z * ex[2], y = s.x * ey[0] + s.y * ey[1] + s.z * ey[2];
      let raw = Math.atan2(y, x), d = raw - last;
      if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
      const before = unwrapped; unwrapped += d; last = raw;
      const target = (count + 1) * 2 * Math.PI;
      if (unwrapped >= target && before < target) {
        const tc = tPrev + (target - before) / (unwrapped - before) * (t - tPrev);
        if (tFirst === null) tFirst = tc; tLast = tc; count++;
      }
      if (t >= nextA.t) { const a = osc(s); aSum += a; aN++; aMin = Math.min(aMin, a); aMax = Math.max(aMax, a); nextA.t += T0 / OSC_SAMPLES; }
      tPrev = t;
      if (t - start > 1000 * 365.25) break;
    }
    const period = count >= 2 ? (tLast - tFirst) / (count - 1) : tFirst - start;
    return { a_AU: aSum / aN, aMin_AU: aMin, aMax_AU: aMax, period_d: period, revs: count, samples: aN };
  }

  function planetRow(Astronomy, srcA, name) {
    const A = srcA.rows.find(r => r.planet === name);
    const B = sourceB(Astronomy, name);
    const aA = parseFloat(A.a_1e6km), TA = parseFloat(A.period_days);
    const aB = B.a_AU * KM_PER_AU / 1e6, TB = B.period_d;
    const engineT = Astronomy.PlanetOrbitalPeriod(name);
    const tolA = TOL.planet + halfStep(A.a_1e6km) / aA, tolT = TOL.planet + halfStep(A.period_days) / TA;
    const dA = rel(aA, aB), dT = rel(TA, TB);
    const tolC = TOL.planet + halfStep(String(engineT)) / engineT, dC = rel(engineT, TB);
    // Kepler's third law inside each source alone, with the one GM above
    const TkA = 2 * Math.PI * Math.sqrt(Math.pow(aA * 1e6 / KM_PER_AU, 3) / SUN_GM_AUD);
    const tolK = 1.5 * halfStep(A.a_1e6km) / aA + halfStep(A.period_days) / TA + TOL.planet, dK = rel(TA, TkA);
    const TkB = 2 * Math.PI * Math.sqrt(Math.pow(B.a_AU, 3) / SUN_GM_AUD), dKB = rel(TB, TkB);
    const row = { name, A_a: aA, A_T: TA, A_aStr: A.a_1e6km, A_TStr: A.period_days, B_a: aB, B_aMin: B.aMin_AU * KM_PER_AU / 1e6, B_aMax: B.aMax_AU * KM_PER_AU / 1e6, B_T: TB, revs: B.revs,
      dA, tolA, passA: dA <= tolA, dT, tolT, passT: dT <= tolT, engineT, dC, tolC, passC: dC <= tolC,
      TkA, dK, tolK, passK: dK <= tolK, TkB, dKB, passKB: dKB <= TOL.planet,
      AinsideRange: aA >= B.aMin_AU * KM_PER_AU / 1e6 && aA <= B.aMax_AU * KM_PER_AU / 1e6 };
    const checks = [
      mk('pl:a:' + name, 'planets', name + ': semi-major axis, A against B', dA, tolA, row.passA, 'A ' + A.a_1e6km + ' x10^6 km, B mean ' + fmt(aB, 6) + ' x10^6 km (range ' + fmt(row.B_aMin, 6) + ' to ' + fmt(row.B_aMax, 6) + ')'),
      mk('pl:T:' + name, 'planets', name + ': period, A against B', dT, tolT, row.passT, 'A ' + A.period_days + ' d, B ' + fmt(TB, 7) + ' d from ' + B.revs + ' return(s)'),
      mk('pl:Te:' + name, 'planets', name + ': period, the library\'s own typed table against B', dC, tolC, row.passC, 'table ' + engineT + ' d, B ' + fmt(TB, 7) + ' d (same library as B, so not independent of it)'),
      mk('pl:kA:' + name, 'planets-k3', name + ": Kepler's third law inside source A", dK, tolK, row.passK, 'A period ' + A.period_days + ' d, from A\'s axis ' + fmt(TkA, 6) + ' d'),
      mk('pl:kB:' + name, 'planets-k3', name + ": Kepler's third law inside source B", dKB, TOL.planet, row.passKB, 'B period ' + fmt(TB, 7) + ' d, from B\'s mean osculating axis ' + fmt(TkB, 7) + ' d'),
    ];
    return { row, checks };
  }

  function planetChecks(Astronomy, srcA) {
    const rows = [], checks = [];
    for (const name of BODIES) { const r = planetRow(Astronomy, srcA, name); rows.push(r.row); checks.push(...r.checks); }
    return { rows, checks };
  }

  const tick = () => new Promise(r => setTimeout(r, 0));
  // Same checks as runAll, but gives the page a chance to paint between groups. onGroup(partialResult) is optional.
  async function runAllAsync(opts) {
    const o = opts || {}, res = { checks: [], planets: [] };
    const push = async (cs, label) => { res.checks.push(...cs); if (o.onProgress) o.onProgress(label, res); await tick(); };
    await push(motionChecks(), 'motion');
    await push([controlCheck()], 'control');
    if (o.rEarthM && o.rMarsM) { const h = hohmannChecks(o.rEarthM, o.rMarsM); res.hohmann = h.H; await push(h.checks, 'hohmann'); }
    const ph = phasingChecks(o.phasingRadiusM || 7000e3, (o.phasingDeg || 40) * Math.PI / 180, O.R_EARTH + 200e3);
    res.phasing = ph.run; await push(ph.checks, 'phasing');
    if (o.Astronomy && o.sourceA) for (const name of BODIES) { const r = planetRow(o.Astronomy, o.sourceA, name); res.planets.push(r.row); await push(r.checks, 'planets'); }
    return res;
  }
  function runAll(opts) {
    const o = opts || {}, res = { checks: [] };
    res.checks.push(...motionChecks());
    res.checks.push(controlCheck());
    if (o.rEarthM && o.rMarsM) { const h = hohmannChecks(o.rEarthM, o.rMarsM); res.hohmann = h.H; res.checks.push(...h.checks); }
    const ph = phasingChecks(o.phasingRadiusM || 7000e3, (o.phasingDeg || 40) * Math.PI / 180, O.R_EARTH + 200e3);
    res.phasing = ph.run; res.checks.push(...ph.checks);
    if (o.Astronomy && o.sourceA) { const p = planetChecks(o.Astronomy, o.sourceA); res.planets = p.rows; res.checks.push(...p.checks); }
    return res;
  }

  return { TOL, CASES, MOTION_ORBITS, SPAN_YEARS, OSC_SAMPLES, fmt, rel, motionChecks, controlCheck, hohmannChecks, phasingRun, phasingChecks, planetChecks, planetRow, sourceB, halfStep, runAll, runAllAsync, BODIES, KM_PER_AU };
});
