/* Circuit core: exact rational nodal analysis, an independent float time-step simulator, and the self-checks.
   Used by index.html and check.mjs. Written by Claude, an AI model. No libraries.
   Netlist (one element per line, '#' starts a comment, node 0 or gnd is ground):
     V1 a 0 12          battery, + terminal is the first node
     R1 a b 4.7k        resistor
     C1 b 0 100u v0=0   capacitor, optional starting voltage (first node minus second)
     W1 a b             ideal wire
   Current through any element is counted from its first node to its second node. */
(function (root) {
  'use strict';

  // ---------- exact fractions ----------
  const babs = (a) => (a < 0n ? -a : a);
  function gcd(a, b) { a = babs(a); b = babs(b); while (b) { const t = a % b; a = b; b = t; } return a; }
  class Fr {
    constructor(n, d = 1n) {
      if (d === 0n) throw new Error('division by zero');
      if (d < 0n) { n = -n; d = -d; }
      const g = gcd(n, d) || 1n;
      this.n = n / g; this.d = d / g;
    }
    add(o) { return new Fr(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o) { return new Fr(this.n * o.d - o.n * this.d, this.d * o.d); }
    mul(o) { return new Fr(this.n * o.n, this.d * o.d); }
    div(o) { return new Fr(this.n * o.d, this.d * o.n); }
    neg() { return new Fr(-this.n, this.d); }
    isZero() { return this.n === 0n; }
    sign() { return this.n === 0n ? 0 : this.n < 0n ? -1 : 1; }
    eq(o) { return this.n === o.n && this.d === o.d; }
    cmp(o) { const x = this.n * o.d - o.n * this.d; return x === 0n ? 0 : x < 0n ? -1 : 1; }
    toNumber() {
      let n = this.n, d = this.d;
      const extra = Math.max(n === 0n ? 0 : babs(n).toString(2).length, d.toString(2).length) - 900;
      if (extra > 0) { n >>= BigInt(extra); d >>= BigInt(extra); if (d === 0n) return n === 0n ? 0 : Infinity; }
      return Number(n) / Number(d);
    }
    toString() { return this.d === 1n ? this.n.toString() : this.n + '/' + this.d; }
  }
  const ZERO = new Fr(0n), ONE = new Fr(1n);
  const fr = (n, d = 1) => new Fr(BigInt(n), BigInt(d));
  function frFromNumber(x) {          // a double is a dyadic fraction, so this conversion is exact
    if (!Number.isFinite(x)) throw new Error('not finite');
    let k = 0;
    while (!Number.isInteger(x) && k < 1100) { x *= 2; k++; }
    return new Fr(BigInt(x), 1n << BigInt(k));
  }
  const SUFFIX = { p: -12, n: -9, u: -6, 'µ': -6, m: -3, k: 3, M: 6, G: 9 };
  function parseValue(s) {
    const m = /^([+-])?(\d+\.?\d*|\.\d+)(?:[eE]([+-]?\d+))?([pnuµmkMG]?)$/.exec(s);
    if (!m) return null;
    const mant = m[2], dot = mant.indexOf('.');
    const frac = dot < 0 ? 0 : mant.length - dot - 1;
    let n = BigInt(mant.replace('.', '')), exp = (m[3] ? parseInt(m[3], 10) : 0) + (m[4] ? SUFFIX[m[4]] : 0) - frac;
    if (Math.abs(exp) > 60) return null;
    if (m[1] === '-') n = -n;
    return exp >= 0 ? new Fr(n * 10n ** BigInt(exp)) : new Fr(n, 10n ** BigInt(-exp));
  }

  // ---------- netlist ----------
  const LIMITS = { elements: 16, nodes: 9 };
  function parse(text) {
    const els = [], errors = [], nodes = [], names = new Set();
    const node = (t) => { const k = /^(0|gnd)$/i.test(t) ? '0' : t; if (k !== '0' && !nodes.includes(k)) nodes.push(k); return k; };
    String(text).split(/\r?\n/).forEach((raw, li) => {
      const line = raw.replace(/#.*/, '').trim();
      if (!line) return;
      const t = line.split(/\s+/), at = 'line ' + (li + 1) + ': ';
      const name = t[0], kind = name[0].toUpperCase();
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || !'VRCW'.includes(kind)) { errors.push(at + '"' + name + '" must start with V, R, C or W'); return; }
      if (names.has(name.toUpperCase())) { errors.push(at + 'name ' + name + ' is used twice'); return; }
      const need = kind === 'W' ? 3 : 4;
      if (t.length < need + 0 || (kind !== 'C' && t.length !== need) || (kind === 'C' && t.length > 5)) {
        errors.push(at + (kind === 'W' ? 'write W1 node node' : kind === 'C' ? 'write C1 node node value [v0=value]' : 'write ' + name + ' node node value')); return;
      }
      for (const nn of [t[1], t[2]]) if (!/^[A-Za-z0-9_]+$/.test(nn)) { errors.push(at + 'bad node name "' + nn + '"'); return; }
      if (t[1].toLowerCase() === t[2].toLowerCase() || (/^(0|gnd)$/i.test(t[1]) && /^(0|gnd)$/i.test(t[2]))) { errors.push(at + name + ' has both ends on the same node'); return; }
      let value = ZERO, v0 = ZERO;
      if (kind !== 'W') {
        value = parseValue(t[3]);
        if (!value) { errors.push(at + 'cannot read the value "' + t[3] + '" (try 4.7k, 100u, 1e-6)'); return; }
        if ((kind === 'R' || kind === 'C') && value.sign() <= 0) { errors.push(at + name + ' must be above zero'); return; }
      }
      if (kind === 'C' && t[4]) {
        const m = /^v0=(.+)$/i.exec(t[4]);
        v0 = m && parseValue(m[1]);
        if (!v0) { errors.push(at + 'the last item of a capacitor must look like v0=2.5'); return; }
      }
      names.add(name.toUpperCase());
      els.push({ name, kind, n1: node(t[1]), n2: node(t[2]), value, v0 });
    });
    if (els.length && !els.some((e) => e.n1 === '0' || e.n2 === '0')) errors.push('no element touches ground (node 0)');
    if (els.length > LIMITS.elements) errors.push('more than ' + LIMITS.elements + ' elements');
    if (nodes.length > LIMITS.nodes) errors.push('more than ' + LIMITS.nodes + ' nodes besides ground');
    if (!els.length && !errors.length) errors.push('the netlist is empty');
    return { els, nodes, errors };
  }

  // ---------- source loops (union-find with voltage offsets) ----------
  function sourceEdges(net, capMode, capV) {
    const out = []; let ci = 0;
    for (const e of net.els) {
      if (e.kind === 'V') out.push({ e, a: e.n1, b: e.n2, E: e.value });
      else if (e.kind === 'W') out.push({ e, a: e.n1, b: e.n2, E: ZERO });
      else if (e.kind === 'C') { if (capMode === 'source') out.push({ e, a: e.n1, b: e.n2, E: capV ? capV[ci] : e.v0 }); ci++; }
    }
    return out;
  }
  // Returns null, or {kind:'contradiction'|'redundant', names:[...]} for the first loop made only of these edges.
  function findSourceLoop(edges, ignoreValues) {
    const parent = {}, off = {};
    const find = (x) => {
      if (!(x in parent)) { parent[x] = x; off[x] = ZERO; }
      if (parent[x] === x) return { r: x, o: ZERO };
      const p = find(parent[x]);
      parent[x] = p.r; off[x] = off[x].add(p.o);
      return { r: p.r, o: off[x] };
    };
    const used = [];
    for (const ed of edges) {
      const fa = find(ed.a), fb = find(ed.b);
      if (fa.r === fb.r) {
        const consistent = fa.o.sub(fb.o).eq(ed.E);
        // path between the ends through earlier edges, for the message
        const path = pathBetween(used, ed.a, ed.b).concat([ed.e.name]);
        if (ignoreValues) return { kind: 'loop', names: path, closing: ed.e };
        return { kind: consistent ? 'redundant' : 'contradiction', names: path, closing: ed.e };
      }
      parent[fa.r] = fb.r; off[fa.r] = ed.E.sub(fa.o).add(fb.o);
      used.push(ed);
    }
    return null;
  }
  function pathBetween(edges, from, to) {
    const prev = { [from]: null }, queue = [from];
    while (queue.length) {
      const x = queue.shift();
      if (x === to) break;
      for (const ed of edges) {
        const y = ed.a === x ? ed.b : ed.b === x ? ed.a : null;
        if (y !== null && !(y in prev)) { prev[y] = { x, name: ed.e.name }; queue.push(y); }
      }
    }
    const names = []; let cur = to;
    while (prev[cur]) { names.push(prev[cur].name); cur = prev[cur].x; }
    return names.reverse();
  }

  // ---------- exact linear algebra ----------
  // Solve A x = b exactly. Returns {x} or {error:'inconsistent'|'underdetermined'}.
  function gaussSolve(A, b) {
    const n = A.length, m = A.map((row, i) => row.concat([b[i]]));
    const pivCol = []; let r = 0;
    for (let c = 0; c < n && r < n; c++) {
      let p = -1;
      for (let i = r; i < n; i++) if (!m[i][c].isZero()) { p = i; break; }
      if (p < 0) continue;
      [m[r], m[p]] = [m[p], m[r]];
      const inv = ONE.div(m[r][c]);
      for (let j = c; j <= n; j++) m[r][j] = m[r][j].mul(inv);
      for (let i = 0; i < n; i++) {
        if (i === r || m[i][c].isZero()) continue;
        const f = m[i][c];
        for (let j = c; j <= n; j++) m[i][j] = m[i][j].sub(f.mul(m[r][j]));
      }
      pivCol.push(c); r++;
    }
    for (let i = r; i < n; i++) if (!m[i][n].isZero()) return { error: 'inconsistent' };
    if (r < n) return { error: 'underdetermined' };
    const x = new Array(n);
    pivCol.forEach((c, i) => { x[c] = m[i][n]; });
    return { x };
  }
  function invertExact(M) {
    const n = M.length, cols = [];
    for (let j = 0; j < n; j++) {
      const e = M.map((_, i) => (i === j ? ONE : ZERO));
      const s = gaussSolve(M, e);
      if (!s.x) return null;
      cols.push(s.x);
    }
    return M.map((_, i) => cols.map((c) => c[i]));
  }

  // ---------- DC solve (caps open, or caps replaced by voltage sources) ----------
  function unitName(e) { return e.name; }
  function describeLoop(net, loop, mode) {
    const kinds = loop.names.map((nm) => net.els.find((e) => e.name === nm));
    const has = (k) => kinds.some((e) => e.kind === k);
    const list = loop.names.join(', ');
    if (loop.kind === 'contradiction' || loop.kind === 'loop') {
      if (has('C') && !has('W') && kinds.filter((e) => e.kind === 'V').length >= 1 && mode === 'transient')
        return 'Loop of sources through a capacitor (' + list + '): the capacitor would have to change voltage instantly, which needs an infinite current. Put a resistor in the loop.';
      if (mode === 'transient')
        return 'Loop of only batteries, wires and capacitors (' + list + '): some capacitor would have to jump in voltage at once. Put a resistor in the loop.';
      if (has('W') && has('V'))
        return 'Kirchhoff\'s voltage law fails around ' + list + ': a wire holds its two ends at 0 V apart, the battery insists on its voltage. No finite answer exists; a real wire and battery have some resistance, and this model has none.';
      return 'Kirchhoff\'s voltage law fails around ' + list + ': ideal sources in a loop disagree about the voltage. No answer exists; real batteries have internal resistance, and this model has none.';
    }
    return 'Redundant loop of sources (' + list + '): the voltages agree, but nothing in the model says how the current splits between them, so the currents are not determined. Real batteries have internal resistance, which would fix the split.';
  }
  function solveDC(net, mode, capV) {
    const edges = sourceEdges(net, mode === 'source' ? 'source' : 'open', capV);
    const loop = findSourceLoop(edges, false);
    if (loop) return { ok: false, kind: loop.kind, loop, msg: describeLoop(net, loop, 'dc') };
    // nodes reachable from ground
    const reach = new Set(['0']);
    for (let again = true; again;) {
      again = false;
      for (const e of net.els) {
        if (e.kind === 'C' && mode !== 'source') continue;
        const a = reach.has(e.n1), b = reach.has(e.n2);
        if (a !== b) { reach.add(a ? e.n2 : e.n1); again = true; }
      }
    }
    const floating = net.nodes.filter((x) => !reach.has(x));
    if (floating.length)
      return { ok: false, kind: 'floating', nodes: floating, msg: 'Node ' + floating.join(', ') + ' has no path to ground except through capacitors (or none at all), so a steady voltage there is not fixed by this model: it depends on charge stored earlier, which is not solved here.' };
    const idx = {}; net.nodes.forEach((x, i) => { idx[x] = i; });
    const srcs = []; let ci = 0;
    for (const e of net.els) {
      if (e.kind === 'V' || e.kind === 'W') srcs.push({ e, E: e.kind === 'V' ? e.value : ZERO });
      else if (e.kind === 'C') { if (mode === 'source') srcs.push({ e, E: capV ? capV[ci] : e.v0 }); ci++; }
    }
    const N = net.nodes.length, n = N + srcs.length;
    const A = Array.from({ length: n }, () => new Array(n).fill(ZERO)), b = new Array(n).fill(ZERO);
    const at = (x) => (x === '0' ? -1 : idx[x]);
    for (const e of net.els) {
      if (e.kind !== 'R') continue;
      const g = ONE.div(e.value), a = at(e.n1), c = at(e.n2);
      if (a >= 0) A[a][a] = A[a][a].add(g);
      if (c >= 0) A[c][c] = A[c][c].add(g);
      if (a >= 0 && c >= 0) { A[a][c] = A[a][c].sub(g); A[c][a] = A[c][a].sub(g); }
    }
    srcs.forEach((s, k) => {
      const row = N + k, a = at(s.e.n1), c = at(s.e.n2);
      if (a >= 0) { A[a][row] = A[a][row].add(ONE); A[row][a] = A[row][a].add(ONE); }
      if (c >= 0) { A[c][row] = A[c][row].sub(ONE); A[row][c] = A[row][c].sub(ONE); }
      b[row] = s.E;
    });
    const sol = gaussSolve(A, b);
    if (!sol.x) return { ok: false, kind: 'singular', msg: 'The equations have no unique solution (' + sol.error + ').' };
    const v = { '0': ZERO }; net.nodes.forEach((x, i) => { v[x] = sol.x[i]; });
    const cur = {};
    for (const e of net.els) cur[e.name] = ZERO;
    for (const e of net.els) if (e.kind === 'R') cur[e.name] = v[e.n1].sub(v[e.n2]).div(e.value);
    srcs.forEach((s, k) => { cur[s.e.name] = sol.x[N + k]; });
    return { ok: true, v, cur };
  }

  // Full exact analysis of a parsed network: steady state, start state, state-space matrices for the capacitors.
  function analyze(net) {
    const caps = net.els.filter((e) => e.kind === 'C');
    const res = { caps, steady: solveDC(net, 'open'), start: null, M: null, g: null, tau: null, transientMsg: null };
    if (!caps.length) return res;
    const edges = sourceEdges(net, 'source', null);
    const lp = findSourceLoop(edges, true);
    if (lp) { res.transientMsg = describeLoop(net, lp, 'transient'); return res; }
    res.start = solveDC(net, 'source');
    if (!res.start.ok) { res.transientMsg = res.start.msg; return res; }
    const k = caps.length, zeros = caps.map(() => ZERO);
    const base = solveDC(net, 'source', zeros);
    if (!base.ok) { res.transientMsg = base.msg; return res; }
    const M = Array.from({ length: k }, () => new Array(k).fill(ZERO)), g = [];
    caps.forEach((c, i) => { g[i] = base.cur[c.name].div(c.value); });
    for (let m = 0; m < k; m++) {
      const cv = zeros.map((z, i) => (i === m ? ONE : ZERO));
      const s = solveDC(net, 'source', cv);
      if (!s.ok) { res.transientMsg = s.msg; return res; }
      caps.forEach((c, i) => { M[i][m] = s.cur[c.name].div(c.value).sub(g[i]); });
    }
    res.M = M; res.g = g;
    if (k === 1 && !M[0][0].isZero()) res.tau = ONE.div(M[0][0].neg());
    return res;
  }

  // Exact Kirchhoff residuals of a solved network: [worst KCL residual as Fr, power balance residual as Fr]
  function residuals(net, sol) {
    const sum = {}; net.nodes.forEach((x) => { sum[x] = ZERO; }); sum['0'] = ZERO;
    let p = ZERO;
    for (const e of net.els) {
      const i = sol.cur[e.name];
      sum[e.n1] = sum[e.n1].add(i); sum[e.n2] = sum[e.n2].sub(i);
      p = p.add(sol.v[e.n1].sub(sol.v[e.n2]).mul(i));   // sum of v*i over all elements, Tellegen: must be 0
    }
    let worst = ZERO;
    for (const x of Object.keys(sum)) if (worst.isZero() && !sum[x].isZero()) worst = sum[x];
    return { kcl: worst, tellegen: p };
  }

  // ---------- float helpers ----------
  function fInverse(M) {
    const n = M.length, a = M.map((r, i) => r.concat(M.map((_, j) => (i === j ? 1 : 0))));
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let i = c + 1; i < n; i++) if (Math.abs(a[i][c]) > Math.abs(a[p][c])) p = i;
      if (Math.abs(a[p][c]) < 1e-300) return null;
      [a[c], a[p]] = [a[p], a[c]];
      const d = a[c][c];
      for (let j = 0; j < 2 * n; j++) a[c][j] /= d;
      for (let i = 0; i < n; i++) if (i !== c) { const f = a[i][c]; if (f) for (let j = 0; j < 2 * n; j++) a[i][j] -= f * a[c][j]; }
    }
    return a.map((r) => r.slice(n));
  }
  const fNorm = (M) => Math.max(...M.map((r) => r.reduce((s, x) => s + Math.abs(x), 0)));
  const fMul = (M, v) => M.map((r) => r.reduce((s, x, j) => s + x * v[j], 0));

  // Integrate u' = A u + b with RK4 from u0 and return u at each time in `times` (ascending).
  function rk4(A, b, u0, times, maxSteps) {
    const n = u0.length, nrm = fNorm(A);
    const dt0 = nrm > 0 ? 0.3 / nrm : 1;
    const f = (u) => { const r = fMul(A, u); for (let i = 0; i < n; i++) r[i] += b[i]; return r; };
    let u = u0.slice(), t = 0, steps = 0; const out = [];
    for (const T of times) {
      while (t < T - 1e-18 * Math.max(1, T)) {
        const h = Math.min(dt0, T - t);
        const k1 = f(u), k2 = f(u.map((x, i) => x + 0.5 * h * k1[i])), k3 = f(u.map((x, i) => x + 0.5 * h * k2[i])), k4 = f(u.map((x, i) => x + h * k3[i]));
        u = u.map((x, i) => x + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
        t += h;
        if (++steps > maxSteps) return { ok: false, steps };
      }
      t = T; out.push(u.slice());
    }
    return { ok: true, out, steps, dt: dt0 };
  }

  // ---------- independent simulator: node voltages stepped in time ----------
  // Every free node gets a tiny parasitic capacitance, batteries and wires merge nodes into groups with fixed offsets,
  // and the voltages are integrated with RK4. It shares no linear algebra with the exact solver.
  // times: ascending list of seconds, or the string 'settle' (run 40 slowest time constants).
  function simulate(net, times, maxSteps = 2e6) {
    const grp = {}, off = {};
    const find = (x) => {
      if (!(x in grp)) { grp[x] = x; off[x] = 0; }
      if (grp[x] === x) return { r: x, o: 0 };
      const p = find(grp[x]); grp[x] = p.r; off[x] += p.o; return { r: p.r, o: off[x] };
    };
    find('0');
    for (const e of net.els) {
      if (e.kind !== 'V' && e.kind !== 'W') continue;
      const E = e.kind === 'V' ? e.value.toNumber() : 0;
      const fa = find(e.n1), fb = find(e.n2);
      if (fa.r === fb.r) { if (Math.abs(fa.o - fb.o - E) > 1e-12 * (1 + Math.abs(E))) return { ok: false, why: 'source loop' }; continue; }
      grp[fa.r] = fb.r; off[fa.r] = E - fa.o + fb.o;
    }
    const all = ['0'].concat(net.nodes), groundRoot = find('0').r;
    const reps = []; for (const x of all) { const r = find(x).r; if (r !== groundRoot && !reps.includes(r)) reps.push(r); }
    const ri = {}; reps.forEach((r, i) => { ri[r] = i; });
    const gOff = find('0').o;   // a node in ground's group sits at (its offset - ground's offset) volts
    const loc = (x) => { const f = find(x); return f.r === groundRoot ? { i: -1, o: f.o - gOff } : { i: ri[f.r], o: f.o }; };
    const n = reps.length;
    const caps = net.els.filter((e) => e.kind === 'C');
    const Cmin = caps.length ? Math.min(...caps.map((c) => c.value.toNumber())) : 1e-6;
    const Cp = Cmin * 1e-3;
    const K = Array.from({ length: n }, () => new Array(n).fill(0)), G = Array.from({ length: n }, () => new Array(n).fill(0)), h = new Array(n).fill(0);
    for (let i = 0; i < n; i++) K[i][i] = Cp;
    const stamp = (M, a, c, g) => { if (a >= 0) M[a][a] += g; if (c >= 0) M[c][c] += g; if (a >= 0 && c >= 0) { M[a][c] -= g; M[c][a] -= g; } };
    for (const e of net.els) {
      if (e.kind !== 'R' && e.kind !== 'C') continue;
      const a = loc(e.n1), c = loc(e.n2);
      if (e.kind === 'C') { stamp(K, a.i, c.i, e.value.toNumber()); continue; }
      const g = 1 / e.value.toNumber(), d = g * (a.o - c.o);
      stamp(G, a.i, c.i, g);
      if (a.i >= 0) h[a.i] += d;
      if (c.i >= 0) h[c.i] -= d;
    }
    if (!n) {   // every node is pinned by sources: nothing moves
      const v = { '0': 0 }; for (const x of net.nodes) v[x] = loc(x).o;
      const ts0 = times === 'settle' ? [0] : times;
      return { ok: true, times: ts0, volts: ts0.map(() => v), capV: ts0.map(() => caps.map(() => 0)), steps: 0, parasitic: Cp };
    }
    const Ki = fInverse(K), A = Ki.map((r) => r.map((_, j) => -r.reduce((s, x, m) => s + x * G[m][j], 0)));
    const bvec = fMul(Ki, h).map((x) => -x);
    // starting state: least squares so every capacitor starts at its v0
    let u0 = new Array(n).fill(0), initResidual = 0;
    if (caps.length) {
      const rows = caps.map((c) => { const a = loc(c.n1), d = loc(c.n2), r = new Array(n).fill(0); if (a.i >= 0) r[a.i] += 1; if (d.i >= 0) r[d.i] -= 1; return { r, rhs: c.v0.toNumber() - a.o + d.o }; });
      const NE = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => rows.reduce((s, q) => s + q.r[i] * q.r[j], 0) + (i === j ? 1e-12 : 0)));
      const rhs = Array.from({ length: n }, (_, i) => rows.reduce((s, q) => s + q.r[i] * q.rhs, 0));
      u0 = fMul(fInverse(NE), rhs);
      initResidual = Math.max(...rows.map((q) => Math.abs(q.r.reduce((s, x, j) => s + x * u0[j], 0) - q.rhs)));
      if (initResidual > 1e-6) return { ok: false, why: 'starting voltages cannot all be met' };
    }
    let ts = times;
    if (times === 'settle') {
      const Ai = fInverse(A);
      if (!Ai) return { ok: false, why: 'no steady state' };
      ts = [40 * fNorm(Ai)];
    }
    const run = rk4(A, bvec, u0, ts, maxSteps);
    if (!run.ok) return { ok: false, why: 'too stiff for a time-step run (' + maxSteps + ' steps)' };
    const volts = run.out.map((u) => { const v = { '0': 0 }; for (const x of net.nodes) { const l = loc(x); v[x] = (l.i >= 0 ? u[l.i] : 0) + l.o; } return v; });
    const capV = run.out.map((u) => caps.map((c) => { const a = loc(c.n1), d = loc(c.n2); return (a.i >= 0 ? u[a.i] : 0) + a.o - (d.i >= 0 ? u[d.i] : 0) - d.o; }));
    return { ok: true, times: ts, volts, capV, steps: run.steps, parasitic: Cp };
  }

  // ---------- state-space trajectory used for the plot ----------
  function trajectory(an, points = 240, maxSteps = 3e6) {
    const k = an.caps.length;
    const M = an.M.map((r) => r.map((x) => x.toNumber())), g = an.g.map((x) => x.toNumber());
    const v0 = an.caps.map((c) => c.v0.toNumber());
    let T;
    const Mi = invertExact(an.M);
    if (Mi) T = 8 * fNorm(Mi.map((r) => r.map((x) => x.toNumber())));
    else T = 10 / fNorm(M);
    const times = Array.from({ length: points + 1 }, (_, i) => (T * i) / points);
    const run = rk4(M, g, v0, times, maxSteps);
    if (!run.ok) return { ok: false, T };
    return { ok: true, T, times, v: run.out, steps: run.steps };
  }

  // ---------- seeded random ----------
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    const next = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    next.int = (n) => Math.floor(next() * n);
    next.pick = (arr) => arr[next.int(arr.length)];
    return next;
  }
  const R_CHOICES = ['100', '150', '220', '330', '470', '680', '1k', '1.5k', '2.2k', '3.3k', '4.7k'];
  const V_CHOICES = ['1.5', '3', '5', '9', '12', '-6', '24'];
  const C_CHOICES = ['10u', '22u', '47u', '100u', '220u'];

  function randomResistiveNet(seed) {
    const r = rng(seed), nn = 3 + r.int(3);
    const names = ['0']; for (let i = 1; i <= nn; i++) names.push('n' + i);
    const lines = []; let ri = 1;
    for (let i = 1; i < names.length; i++) lines.push('R' + (ri++) + ' ' + names[i] + ' ' + names[r.int(i)] + ' ' + r.pick(R_CHOICES));
    for (let extra = 1 + r.int(3); extra > 0; extra--) {
      const a = r.int(names.length), b = r.int(names.length);
      if (a !== b) lines.push('R' + (ri++) + ' ' + names[a] + ' ' + names[b] + ' ' + r.pick(R_CHOICES));
    }
    const used = new Set();
    for (let bi = 1, nb = 1 + r.int(2); bi <= nb; bi++) {
      const a = r.int(names.length), b = r.int(names.length);
      const key = Math.min(a, b) + '-' + Math.max(a, b);
      if (a === b || used.has(key)) continue;
      used.add(key); lines.push('V' + bi + ' ' + names[a] + ' ' + names[b] + ' ' + r.pick(V_CHOICES));
    }
    return lines.join('\n');
  }

  // ---------- checks ----------
  // Each check returns {group, text, pass, note?}. The page and check.mjs both run runChecks().
  function fmtNum(x, d = 3) { return Number(x.toPrecision(d)).toString(); }
  function runChecks(seed0, opts = {}) {
    const out = [], N = opts.count || 6;
    const add = (group, text, pass, note) => out.push({ group, text, pass: !!pass, note: note || '' });
    const solved = (txt) => { const n = parse(txt); if (n.errors.length) throw new Error(n.errors.join('; ')); return { n, s: solveDC(n, 'open') }; };

    // A. closed forms, exact equality on random values
    {
      let ok = 0, tot = 0, bad = '';
      for (let k = 0; k < N; k++) {
        const r = rng(seed0 + k), a = r.pick(R_CHOICES), b = r.pick(R_CHOICES), c = r.pick(R_CHOICES), V = r.pick(V_CHOICES);
        const { n, s } = solved('V1 in 0 ' + V + '\nR1 in m ' + a + '\nR2 m p ' + b + '\nR3 p 0 ' + c);
        const A = parseValue(a), B = parseValue(b), C = parseValue(c), E = parseValue(V), Rt = A.add(B).add(C), I = E.div(Rt);
        tot++;
        const good = s.ok && s.cur.R1.eq(I) && s.v.p.eq(I.mul(C)) && s.v.m.eq(I.mul(B.add(C))) && s.cur.V1.eq(I.neg());
        if (good) ok++; else bad = ' (first miss: seed ' + (seed0 + k) + ')';
      }
      add('closed form', 'Series chain of three resistors: current = V / (R1+R2+R3) and each node voltage = current x the resistance below it, exact equality on ' + tot + ' seeded draws', ok === tot, ok + ' of ' + tot + bad);
    }
    {
      let ok = 0, tot = 0;
      for (let k = 0; k < N; k++) {
        const r = rng(seed0 + 100 + k), a = r.pick(R_CHOICES), b = r.pick(R_CHOICES), c = r.pick(R_CHOICES), V = r.pick(V_CHOICES);
        const { s } = solved('V1 in 0 ' + V + '\nR1 in 0 ' + a + '\nR2 in 0 ' + b + '\nR3 in 0 ' + c);
        const E = parseValue(V), g = ONE.div(parseValue(a)).add(ONE.div(parseValue(b))).add(ONE.div(parseValue(c)));
        tot++; if (s.ok && s.cur.V1.eq(E.mul(g).neg())) ok++;
      }
      add('closed form', 'Three resistors in parallel: battery current = V x (1/R1 + 1/R2 + 1/R3), exact equality on ' + tot + ' seeded draws', ok === tot, ok + ' of ' + tot);
    }
    {
      let ok = 0, tot = 0;
      for (let k = 0; k < N; k++) {
        const r = rng(seed0 + 200 + k), a = r.pick(R_CHOICES), b = r.pick(R_CHOICES), V = r.pick(V_CHOICES);
        const { s } = solved('V1 in 0 ' + V + '\nR1 in out ' + a + '\nR2 out 0 ' + b);
        const E = parseValue(V), A = parseValue(a), B = parseValue(b);
        tot++; if (s.ok && s.v.out.eq(E.mul(B).div(A.add(B)))) ok++;
      }
      add('closed form', 'Unloaded voltage divider: Vout = V x R2 / (R1+R2), exact equality on ' + tot + ' seeded draws', ok === tot, ok + ' of ' + tot);
    }
    {
      let ok = 0, tot = 0;
      for (let k = 0; k < N; k++) {
        const r = rng(seed0 + 300 + k), a = r.pick(R_CHOICES), b = r.pick(R_CHOICES), m = r.pick(['2', '3', '1.5', '0.5']), mid = r.pick(R_CHOICES), V = r.pick(V_CHOICES);
        const M = parseValue(m);
        const { s } = solved('V1 a 0 ' + V + '\nR1 a b ' + a + '\nR2 b 0 ' + b + '\nR3 a c ' + M.mul(parseValue(a)).toNumber() + '\nR4 c 0 ' + M.mul(parseValue(b)).toNumber() + '\nR5 b c ' + mid);
        tot++; if (s.ok && s.cur.R5.isZero() && s.v.b.eq(s.v.c)) ok++;
      }
      add('closed form', 'Balanced bridge (R3/R1 = R4/R2): the middle resistor carries exactly zero current, ' + tot + ' seeded draws', ok === tot, ok + ' of ' + tot);
    }
    {
      let ok = 0, tot = 0;
      for (let k = 0; k < N; k++) {
        const r = rng(seed0 + 400 + k), a = r.pick(R_CHOICES), b = r.pick(R_CHOICES), c = r.pick(C_CHOICES), V = r.pick(V_CHOICES);
        const n = parse('V1 in 0 ' + V + '\nR1 in x ' + a + '\nR2 x 0 ' + b + '\nC1 x 0 ' + c + ' v0=0');
        const an = analyze(n), A = parseValue(a), B = parseValue(b), C = parseValue(c), E = parseValue(V);
        const tauWant = A.mul(B).div(A.add(B)).mul(C), vinf = E.mul(B).div(A.add(B));
        tot++;
        if (an.tau && an.tau.eq(tauWant) && an.steady.ok && an.steady.v.x.eq(vinf)) ok++;
      }
      add('closed form', 'Capacitor behind R1 with R2 across it: time constant = (R1 parallel R2) x C and final voltage = the divider value, exact equality on ' + tot + ' seeded draws', ok === tot, ok + ' of ' + tot);
    }

    // B. exact Kirchhoff residuals on random networks
    {
      let ok = 0, tot = 0, skipped = 0;
      for (let k = 0; k < N * 2; k++) {
        const n = parse(randomResistiveNet(seed0 + 500 + k)), s = solveDC(n, 'open');
        if (!s.ok) { skipped++; continue; }
        const rs = residuals(n, s); tot++;
        if (rs.kcl.isZero() && rs.tellegen.isZero()) ok++;
      }
      add('exact', 'Random resistor and battery networks: current into every node sums to exactly 0 and the power the batteries give equals the power the resistors take, exactly, on ' + tot + ' networks that solved (' + skipped + ' more were refused as unsolvable)', ok === tot && tot > 0, ok + ' of ' + tot);
    }

    // C. independent time-step simulation
    {
      let ok = 0, tot = 0, worst = 0, steps = 0, skipped = 0;
      for (let k = 0; k < N * 2; k++) {
        const n = parse(randomResistiveNet(seed0 + 600 + k)), s = solveDC(n, 'open');
        const sim = simulate(n, 'settle', 4e6);
        if (!s.ok || !sim.ok) { if (!!s.ok !== !!sim.ok) { tot++; worst = Infinity; } else skipped++; continue; }
        let err = 0, scale = 1e-9;
        for (const x of n.nodes) { err = Math.max(err, Math.abs(sim.volts[0][x] - s.v[x].toNumber())); scale = Math.max(scale, Math.abs(s.v[x].toNumber())); }
        tot++; steps += sim.steps; worst = Math.max(worst, err / scale);
        if (err / scale < 1e-6) ok++;
      }
      add('simulation', 'Random networks, seeded: a time-step simulation (tiny capacitance on every node, RK4) settles to the exact node voltages. Largest relative gap ' + (worst === Infinity ? 'infinite' : worst.toExponential(1)) + ' over ' + tot + ' networks, ' + steps + ' steps in all; ' + skipped + ' more were unsolvable for both methods', ok === tot && tot > 0, ok + ' of ' + tot);
    }
    {
      // loops: sim and exact solver must agree on which random source arrangements are refused
      let agree = 0, tot = 0;
      for (let k = 0; k < N * 3; k++) {
        const n = parse(randomResistiveNet(seed0 + 700 + k) + '\nW1 n1 0'), s = solveDC(n, 'open'), sim = simulate(n, 'settle', 4e6);
        tot++;
        const simRefused = !sim.ok && sim.why === 'source loop', exactRefused = !s.ok && s.kind === 'contradiction';
        if (simRefused === exactRefused && (!s.ok || sim.ok || exactRefused)) agree++;
      }
      add('simulation', 'The same random networks with an ideal wire added from n1 to ground: the solver and the simulation refuse (or accept) exactly the same ones, ' + tot + ' networks', agree === tot, agree + ' of ' + tot);
    }
    {
      let ok = 0, tot = 0, worst = 0;
      for (let k = 0; k < Math.max(3, N / 2); k++) {
        const r = rng(seed0 + 800 + k), a = r.pick(R_CHOICES), c = r.pick(C_CHOICES), V = r.pick(V_CHOICES);
        const n = parse('V1 in 0 ' + V + '\nR1 in x ' + a + '\nC1 x 0 ' + c + ' v0=0'), an = analyze(n);
        const tau = an.tau.toNumber(), E = parseValue(V).toNumber();
        const sim = simulate(n, [tau, 3 * tau, 5 * tau], 4e6);
        tot++;
        if (!sim.ok) { worst = Infinity; continue; }
        const e1 = Math.abs(sim.capV[0][0] / E - (1 - Math.exp(-1))), e3 = Math.abs(sim.capV[1][0] / E - (1 - Math.exp(-3))), e5 = Math.abs(sim.capV[2][0] / E - (1 - Math.exp(-5)));
        worst = Math.max(worst, e1, e3, e5);
        if (Math.max(e1, e3, e5) < 3e-3) ok++;
      }
      add('simulation', 'Charging a capacitor through one resistor: after one time constant the simulated voltage is within ' + (3e-3 * 100).toFixed(1) + '% of the supply of 1 - 1/e = ' + (100 * (1 - Math.exp(-1))).toFixed(1) + '% (3 and 5 time constants too). Largest gap ' + worst.toExponential(1) + ' of the supply, ' + tot + ' seeded draws', ok === tot, ok + ' of ' + tot);
    }
    {
      let ok = 0, tot = 0, worst = 0;
      for (let k = 0; k < Math.max(3, N / 2); k++) {
        const r = rng(seed0 + 900 + k), a = r.pick(R_CHOICES), b = r.pick(R_CHOICES), c1 = r.pick(C_CHOICES), c2 = r.pick(C_CHOICES), V = r.pick(V_CHOICES);
        const n = parse('V1 in 0 ' + V + '\nR1 in x ' + a + '\nC1 x 0 ' + c1 + ' v0=0\nR2 x y ' + b + '\nC2 y 0 ' + c2 + ' v0=1'), an = analyze(n);
        const tr = trajectory(an, 40);
        if (!an.steady.ok || !tr.ok) { tot++; worst = Infinity; continue; }
        const pick = [4, 12, 40], times = pick.map((i) => tr.times[i]);
        const sim = simulate(n, times, 4e6);
        tot++;
        if (!sim.ok) { worst = Infinity; continue; }
        let e = 0; const scale = Math.max(1, Math.abs(parseValue(V).toNumber()));
        pick.forEach((i, j) => { for (let m = 0; m < 2; m++) e = Math.max(e, Math.abs(sim.capV[j][m] - tr.v[i][m]) / scale); });
        worst = Math.max(worst, e);
        const fin = tr.v[40]; if (Math.abs(fin[0] - an.steady.v.x.toNumber()) / scale > 2e-3 || Math.abs(fin[1] - an.steady.v.y.toNumber()) / scale > 2e-3) e = 1;
        if (e < 5e-3) ok++;
      }
      add('simulation', 'Two-stage RC ladder with a starting charge: the exact state-space curve (matrix from the exact solver) and the node-by-node simulation agree at three times, within ' + (0.5).toFixed(1) + '% of the supply; the curve also ends at the exact steady state. Largest gap ' + worst.toExponential(1) + ' of the supply, ' + tot + ' seeded draws', ok === tot, ok + ' of ' + tot);
    }

    // D. weaker, not independent: a textbook figure from a search summary
    {
      const { s } = solved('V1 a 0 12\nV2 b a 6\nR1 b c 8\nR2 c 0 10');
      add('weaker', 'Textbook figure (weaker, not independent): a lecture slide found by web search gives a loop with 6.0 V and 12.0 V batteries aiding, 8.0 and 10 ohm, and a current of 1.0 A; the page gets ' + (s.ok ? fmtNum(-s.cur.V1.toNumber()) : '?') + ' A. The slide could not be fetched here, only its search summary was read, so the battery orientation is my reading', s.ok && s.cur.V1.eq(fr(-1)));
    }

    // E. the model's limits are detected, not hidden
    {
      const wire = analyze(parse('V1 a 0 12\nR1 a 0 100\nW1 a 0'));
      add('limits', 'Ideal wire across the battery: refused as a voltage loop that contradicts itself, no number invented', !wire.steady.ok && wire.steady.kind === 'contradiction', wire.steady.kind || 'solved');
      const two = analyze(parse('V1 a 0 12\nV2 a 0 9\nR1 a 0 100'));
      add('limits', 'Two batteries of different voltage in parallel: refused', !two.steady.ok && two.steady.kind === 'contradiction', two.steady.kind || 'solved');
      const same = analyze(parse('V1 a 0 12\nV2 a 0 12\nR1 a 0 100'));
      add('limits', 'Two equal batteries in parallel: voltages fine, but the split of current is reported as undetermined', !same.steady.ok && same.steady.kind === 'redundant', same.steady.kind || 'solved');
      const jump = analyze(parse('V1 a 0 5\nC1 a 0 10u'));
      add('limits', 'Battery straight across a capacitor: steady state is solved, the charging curve is refused (infinite current)', jump.steady.ok && !jump.M && !!jump.transientMsg, jump.transientMsg ? 'refused' : 'drawn');
      const flo = analyze(parse('V1 a 0 5\nC1 a b 10u\nC2 b 0 10u\nR1 a 0 1k'));
      add('limits', 'Two capacitors in series: the middle node floats, so its steady voltage is refused', !flo.steady.ok && flo.steady.kind === 'floating', flo.steady.kind || 'solved');
    }
    return out;
  }


  // Checks of the network the reader is looking at. pass may be null (skipped, with a reason in note).
  function checkNetwork(net, an) {
    const out = [], add = (text, pass, note) => out.push({ group: 'this network', text, pass, note: note || '' });
    const states = [];
    if (an.steady.ok) states.push(['steady state', an.steady]);
    if (an.start && an.start.ok) states.push(['starting instant', an.start]);
    for (const [nm, st] of states) {
      const r = residuals(net, st);
      add('At the ' + nm + ': current into every node sums to exactly 0 and the power given equals the power taken, exactly', r.kcl.isZero() && r.tellegen.isZero());
    }
    const rel = (a, b, sc) => Math.abs(a - b) / sc;
    if (!an.caps.length) {
      if (!an.steady.ok) return out;
      const sim = simulate(net, 'settle', 2e6);
      if (!sim.ok) { add('Time-step simulation settles to the exact node voltages', null, 'skipped: ' + sim.why); return out; }
      let err = 0, sc = 1e-9;
      for (const x of net.nodes) { err = Math.max(err, Math.abs(sim.volts[0][x] - an.steady.v[x].toNumber())); sc = Math.max(sc, Math.abs(an.steady.v[x].toNumber())); }
      add('Time-step simulation (' + sim.steps + ' steps) settles to the exact node voltages, largest relative gap ' + (err / sc).toExponential(1), err / sc < 1e-6);
      return out;
    }
    if (!an.M) return out;
    const tr = trajectory(an, 60);
    if (!tr.ok) { add('Time-step simulation matches the exact curve', null, 'skipped: too stiff to step in time'); return out; }
    const pick = [6, 20, 60], times = pick.map((i) => tr.times[i]);
    const sim = simulate(net, times, 2e6);
    if (!sim.ok) { add('Time-step simulation matches the exact curve', null, 'skipped: ' + sim.why); return out; }
    let sc = 1e-9; for (const x of net.nodes) sc = Math.max(sc, Math.abs((an.steady.ok ? an.steady.v[x] : an.start.v[x]).toNumber()));
    for (const e of net.els) if (e.kind === 'V') sc = Math.max(sc, Math.abs(e.value.toNumber()));
    let err = 0;
    pick.forEach((i, j) => an.caps.forEach((c, m) => { err = Math.max(err, rel(sim.capV[j][m], tr.v[i][m], sc)); }));
    add('Node-by-node time-step simulation (' + sim.steps + ' steps) matches the exact state-space curve at 3 times, largest gap ' + (100 * err).toFixed(2) + '% of the largest voltage (allowed 0.5%)', err < 5e-3);
    if (an.steady.ok) {
      let e2 = 0; for (const x of net.nodes) e2 = Math.max(e2, rel(tr.v[60] ? voltsAt(net, an, tr.v[60])[x] : 0, an.steady.v[x].toNumber(), sc));
      add('The curve has reached the exact steady-state voltages by the end of the plot, largest gap ' + (100 * e2).toFixed(2) + '% of the largest voltage (allowed 0.2%)', e2 < 2e-3);
    }
    return out;
  }
  function voltsAt(net, an, capVals) {
    const s = solveDC(net, 'source', capVals.map(frFromNumber));
    const v = {}; if (s.ok) for (const x of net.nodes) v[x] = s.v[x].toNumber();
    return v;
  }

  const api = { checkNetwork, voltsAt, Fr, fr, ZERO, ONE, frFromNumber, parseValue, parse, solveDC, analyze, residuals, simulate, trajectory, rng, runChecks, randomResistiveNet, findSourceLoop, sourceEdges, LIMITS, invertExact };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Circuit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
