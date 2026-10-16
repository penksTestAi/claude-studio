// Base-rate model: exact fractions (BigInt) and a seeded crowd. Used by index.html and by test.mjs.
// A person is sick with chance P/1000. The test says "positive" to a sick person with chance S/1000 (sensitivity)
// and to a healthy person with chance (1000-C)/1000 (C/1000 is the specificity). Up to four tests in a row:
// with chance R/100 a later result simply repeats the person's previous result, otherwise it is a fresh draw.
(function (root) {
  'use strict';
  const N = 10000, MAXK = 4;

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---- exact fractions ----
  const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { const t = a % b; a = b; b = t; } return a; };
  function F(n, d) {
    n = BigInt(n); d = d === undefined ? 1n : BigInt(d);
    if (d === 0n) throw new Error('zero denominator');
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d) || 1n;
    return { n: n / g, d: d / g };
  }
  const add = (a, b) => F(a.n * b.d + b.n * a.d, a.d * b.d);
  const sub = (a, b) => F(a.n * b.d - b.n * a.d, a.d * b.d);
  const mul = (a, b) => F(a.n * b.n, a.d * b.d);
  const div = (a, b) => (b.n === 0n ? null : F(a.n * b.d, a.d * b.n));
  const eq = (a, b) => (a === null || b === null ? a === b : a.n === b.n && a.d === b.d);
  const ONE = F(1), ZERO = F(0);
  // Number for a fraction with possibly large parts (scaled division keeps precision).
  function num(f) {
    if (f === null) return NaN;
    const scale = 10n ** 15n;
    return Number(f.n * scale / f.d) / 1e15;
  }
  const fracText = (f) => (f.d === 1n ? String(f.n) : f.n + '/' + f.d);

  function checkParams(q) {
    const ok = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
    if (!ok(q.P, 1, 999) || !ok(q.S, 0, 1000) || !ok(q.C, 0, 1000) || !ok(q.R, 0, 100)) throw new Error('bad parameters');
  }

  // Exact answers. prob[k] is the chance, for one person picked at random, of being sick (or healthy) AND
  // testing positive on each of the first k tests. ppv[k] = tp/(tp+fp), null when nobody can reach k.
  function exact(q) {
    checkParams(q);
    const p = F(q.P, 1000), s = F(q.S, 1000), f = F(1000 - q.C, 1000), r = F(q.R, 100);
    const stay = (x) => add(r, mul(sub(ONE, r), x)); // chance of a positive after a positive
    const tp = [F(q.P, 1000)], fp = [sub(ONE, p)]; // index 0 = everybody
    let a = p, b = sub(ONE, p);
    for (let k = 1; k <= MAXK; k++) {
      a = mul(a, k === 1 ? s : stay(s));
      b = mul(b, k === 1 ? f : stay(f));
      tp.push(a); fp.push(b);
    }
    const ppv = tp.map((t, k) => (k === 0 ? p : div(t, add(t, fp[k]))));
    return { p, s, f, r, tp, fp, ppv };
  }

  // A second route to the same answer: update the odds of being sick one positive result at a time.
  function sequentialBayes(q) {
    checkParams(q);
    const s = F(q.S, 1000), f = F(1000 - q.C, 1000), r = F(q.R, 100);
    let post = F(q.P, 1000);
    const out = [post];
    for (let k = 1; k <= MAXK; k++) {
      const a = k === 1 ? s : add(r, mul(sub(ONE, r), s));
      const b = k === 1 ? f : add(r, mul(sub(ONE, r), f));
      const num_ = mul(post, a), den = add(num_, mul(sub(ONE, post), b));
      post = div(num_, den);
      out.push(post);
      if (post === null) { for (let j = k + 1; j <= MAXK; j++) out.push(null); break; }
    }
    return out;
  }

  // ---- seeded crowd ----
  // Every person always uses 9 draws, so changing a setting changes the outcomes but never shifts the stream.
  function simulate(q, seed) {
    checkParams(q);
    const rnd = mulberry32(seed >>> 0);
    const pP = q.P / 1000, pS = q.S / 1000, pF = (1000 - q.C) / 1000, pR = q.R / 100;
    const sick = new Uint8Array(N), reach = new Uint8Array(N);
    const tp = new Array(MAXK + 1).fill(0), fp = new Array(MAXK + 1).fill(0);
    let sickN = 0;
    for (let i = 0; i < N; i++) {
      const isSick = rnd() < pP ? 1 : 0;
      const pos = isSick ? pS : pF;
      let prev = 0, run = 0, alive = true;
      for (let k = 1; k <= MAXK; k++) {
        const uc = rnd(), ut = rnd();
        const res = (k > 1 && uc < pR) ? prev : (ut < pos ? 1 : 0);
        prev = res;
        if (alive && res) run++; else alive = false;
      }
      sick[i] = isSick; reach[i] = run; sickN += isSick;
      for (let k = 1; k <= run; k++) (isSick ? tp : fp)[k]++;
    }
    tp[0] = sickN; fp[0] = N - sickN;
    return { sick, reach, tp, fp, sickN, healthyN: N - sickN };
  }

  const shareOf = (c, k) => (c.tp[k] + c.fp[k] === 0 ? null : c.tp[k] / (c.tp[k] + c.fp[k]));

  // Many crowds: totals of each count and the share of real positives in every crowd.
  function repeat(q, seed0, M, from, to) {
    const tot = { tp: new Array(MAXK + 1).fill(0), fp: new Array(MAXK + 1).fill(0) };
    const shares = [[], [], [], [], []];
    for (let i = from; i < to; i++) {
      const c = simulate(q, (seed0 + i * 7919) >>> 0);
      for (let k = 0; k <= MAXK; k++) { tot.tp[k] += c.tp[k]; tot.fp[k] += c.fp[k]; if (k) shares[k].push(shareOf(c, k)); }
    }
    return { tot, shares };
  }

  // z-score of each total against its exact expectation (each total is a count of M*N people, so binomial).
  function zscores(tot, M, ex) {
    const z = [];
    for (let k = 1; k <= MAXK; k++) {
      for (const [which, arr] of [['tp', ex.tp], ['fp', ex.fp]]) {
        const pi = num(arr[k]), n = M * N;
        const sd = Math.sqrt(n * pi * (1 - pi));
        z.push({ k, which, observed: tot[which][k], expected: n * pi, z: sd === 0 ? (tot[which][k] === n * pi ? 0 : Infinity) : (tot[which][k] - n * pi) / sd });
      }
    }
    return z;
  }

  // A total passes when it is within 4.5 standard errors; for tiny expected totals (under 30) the normal
  // approximation is poor, so a gap of at most 10 people also passes.
  const Z_LIM = 4.5, SMALL = 30, SLACK = 10;
  const zpass = (z) => Math.abs(z.z) < Z_LIM || (z.expected < SMALL && Math.abs(z.observed - z.expected) <= SLACK);

  const api = { Z_LIM, SMALL, SLACK, zpass, N, MAXK, mulberry32, F, add, sub, mul, div, eq, num, fracText, exact, sequentialBayes, simulate, shareOf, repeat, zscores };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BaseRate = api;
})(typeof self !== 'undefined' ? self : this);
