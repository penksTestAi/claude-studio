// queue-core.js: the queue model and the textbook formulas, shared by index.html and check.mjs.
// Written by Claude, an AI model. No libraries. Time is in minutes.
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m; else root.QueueCore = m;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const HYPER_CV2 = 4;          // squared coefficient of variation of the "bursty" service shape
  const TAIL = 200;             // customers simulated after the measured window so later arrivals can overtake the last ones
  const EPS = 1e-12;
  const Z_LIMIT = 4;            // |z| above this counts as "does not agree" (z = (simulated mean - formula) / standard error over seeds)

  // ---------- random numbers ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mix(seed, tag) {      // separate streams for arrivals, service times and line choice
    let h = (seed >>> 0) ^ Math.imul(tag + 1, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) >>> 0;
  }

  // ---------- service shapes (all have mean 1/mu) ----------
  const SHAPES = {
    constant: { label: "constant (all the same)", cv2: 0 },
    exponential: { label: "exponential (textbook)", cv2: 1 },
    bursty: { label: "bursty (mostly short, some long)", cv2: HYPER_CV2 }
  };
  function makeServiceDraw(shape, mu, rs) {
    if (shape === "constant") return () => 1 / mu;
    if (shape === "exponential") return () => -Math.log(1 - rs()) / mu;
    if (shape === "bursty") {
      const p1 = 0.5 * (1 + Math.sqrt((HYPER_CV2 - 1) / (HYPER_CV2 + 1)));
      const r1 = 2 * p1 * mu, r2 = 2 * (1 - p1) * mu;
      return () => { const u = rs(); return -Math.log(1 - rs()) / (u < p1 ? r1 : r2); };
    }
    throw new Error("unknown service shape " + shape);
  }

  // The same customers go to every system: arrival times and the work each customer brings.
  function makeStream(seed, n, lambda, mu, shape) {
    const ra = mulberry32(mix(seed, 1)), rs = mulberry32(mix(seed, 2));
    const draw = makeServiceDraw(shape, mu, rs);
    const arr = new Float64Array(n), svc = new Float64Array(n);
    let t = 0;
    for (let k = 0; k < n; k++) { t += -Math.log(1 - ra()) / lambda; arr[k] = t; svc[k] = draw(); }
    return { n, arr, svc, seed };
  }

  // ---------- the two ways to organise the tills ----------
  // One shared line: the next customer goes to whichever of the c tills frees up first.
  function simShared(st, c) {
    const free = new Float64Array(c), start = new Float64Array(st.n), line = new Int32Array(st.n);
    for (let k = 0; k < st.n; k++) {
      let m = 0;
      for (let i = 1; i < c; i++) if (free[i] < free[m]) m = i;
      const s = Math.max(st.arr[k], free[m]);
      start[k] = s; free[m] = s + st.svc[k]; line[k] = m;
    }
    return { start, line, separate: false };
  }
  // One line per till. A customer joins a line on arrival and never changes.
  // policy "shortest": the line with fewest people (waiting plus being served), ties broken at random.
  // policy "random": a line chosen uniformly.
  function simSeparate(st, c, policy, seed) {
    const rr = mulberry32(mix(seed, 3));
    const deps = [], head = new Int32Array(c), last = new Float64Array(c);
    for (let i = 0; i < c; i++) deps.push([]);
    const start = new Float64Array(st.n), line = new Int32Array(st.n);
    for (let k = 0; k < st.n; k++) {
      const t = st.arr[k], u = rr();
      let pick = 0;
      if (policy === "random") pick = Math.min(c - 1, Math.floor(u * c));
      else {
        let best = Infinity, ties = 0; const len = new Int32Array(c);
        for (let i = 0; i < c; i++) {
          const d = deps[i];
          while (head[i] < d.length && d[head[i]] <= t) head[i]++;
          len[i] = d.length - head[i];
          if (len[i] < best) { best = len[i]; ties = 1; } else if (len[i] === best) ties++;
        }
        let want = Math.min(ties - 1, Math.floor(u * ties));
        for (let i = 0; i < c; i++) if (len[i] === best) { if (want === 0) { pick = i; break; } want--; }
      }
      const s = Math.max(t, last[pick]);
      start[k] = s; last[pick] = s + st.svc[k]; deps[pick].push(s + st.svc[k]); line[k] = pick;
    }
    return { start, line, separate: true };
  }

  // ---------- counting ----------
  // Overtaken: customer k is overtaken if some customer who arrived after k starts service before k does.
  // Pair rule (separate lines only): take every pair (k, j) where j arrives while k is still waiting and the two
  // are in different lines; "the other line was faster" for the pair if j starts service before k.
  function scan(st, res, from, to) {
    const { arr, n } = st, start = res.start, line = res.line;
    const ovt = new Float64Array(n).fill(Infinity);
    let overtaken = 0, waited = 0, pairs = 0, pairOver = 0, firstJ = new Int32Array(n).fill(-1);
    for (let k = from; k < to; k++) {
      if (start[k] - arr[k] > EPS) waited++;
      let hit = false;
      for (let j = k + 1; j < n && arr[j] < start[k]; j++) {
        if (start[j] < start[k]) {
          hit = true;
          if (start[j] < ovt[k] && (!res.separate || line[j] !== line[k])) { ovt[k] = start[j]; firstJ[k] = j; }
        }
        if (res.separate && line[j] !== line[k]) { pairs++; if (start[j] < start[k]) pairOver++; }
      }
      if (hit) overtaken++;
    }
    return { ovt, firstJ, overtaken, waited, pairs, pairOver, count: to - from };
  }

  function quantile(sorted, q) {
    const pos = q * (sorted.length - 1), lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  // Little's law on the whole run: the run starts with an empty shop and ends when the last customer leaves,
  // so L (time-average number in the shop, from an arrival/departure sweep) must equal (n / T) * W
  // (mean time in the shop). This is an identity of the bookkeeping, not a test of the model.
  function little(st, res) {
    const { arr, svc, n } = st, start = res.start;
    const dep = new Float64Array(n); let sumSoj = 0, T = 0;
    for (let k = 0; k < n; k++) { dep[k] = start[k] + svc[k]; sumSoj += dep[k] - arr[k]; if (dep[k] > T) T = dep[k]; }
    dep.sort();
    let i = 0, j = 0, inShop = 0, prev = 0, area = 0;
    while (i < n || j < n) {
      const takeArr = j >= n || (i < n && arr[i] <= dep[j]);
      const t = takeArr ? arr[i] : dep[j];
      area += inShop * (t - prev); prev = t;
      if (takeArr) { inShop++; i++; } else { inShop--; j++; }
    }
    const L = area / T, lam = n / T, W = sumSoj / n;
    return { L, lam, W, lamW: lam * W, gap: Math.abs(L - lam * W) / L, T };
  }

  function measure(st, res, from, to) {
    const waits = new Float64Array(to - from); let sw = 0, sj = 0, nw = 0;
    for (let k = from; k < to; k++) {
      const w = res.start[k] - st.arr[k]; waits[k - from] = w; sw += w; sj += w + st.svc[k];
      if (w > EPS) nw++;
    }
    const sorted = waits.slice().sort();
    const sc = scan(st, res, from, to);
    return {
      meanWait: sw / (to - from), meanSojourn: sj / (to - from), pWait: nw / (to - from),
      p90Wait: quantile(sorted, 0.9), overtaken: sc.overtaken / (to - from),
      pairs: sc.pairs, pairOver: sc.pairOver, pairShare: res.separate && sc.pairs ? sc.pairOver / sc.pairs : null,
      little: little(st, res)
    };
  }

  // p = {lambda, mu, c, shape, N, warm}; returns per-system measures for one seed.
  function runOne(p, seed) {
    const n = p.warm + p.N + TAIL, st = makeStream(seed, n, p.lambda, p.mu, p.shape);
    const from = p.warm, to = p.warm + p.N;
    const sys = {
      shared: simShared(st, p.c),
      shortest: simSeparate(st, p.c, "shortest", seed),
      random: simSeparate(st, p.c, "random", seed)
    };
    const out = {};
    for (const k of Object.keys(sys)) out[k] = measure(st, sys[k], from, to);
    return out;
  }
  // Lighter run for the formula grid: shared line and random lines only, no overtaking counts.
  function runQuick(p, seed) {
    const n = p.warm + p.N, st = makeStream(seed, n, p.lambda, p.mu, p.shape), out = {};
    const sys = { shared: simShared(st, p.c), random: simSeparate(st, p.c, "random", seed) };
    for (const key of Object.keys(sys)) {
      let sw = 0, sj = 0, nw = 0;
      for (let k = p.warm; k < n; k++) { const w = sys[key].start[k] - st.arr[k]; sw += w; sj += w + st.svc[k]; if (w > EPS) nw++; }
      out[key] = { meanWait: sw / p.N, meanSojourn: sj / p.N, pWait: nw / p.N };
    }
    return out;
  }
  function simulate(p, seed, n) {   // full arrays for a short run (the picture)
    const st = makeStream(seed, n, p.lambda, p.mu, p.shape);
    return { st, shared: simShared(st, p.c), shortest: simSeparate(st, p.c, "shortest", seed), random: simSeparate(st, p.c, "random", seed) };
  }

  // ---------- statistics over seeds ----------
  function summarise(v) {
    const n = v.length; let s = 0; for (const x of v) s += x;
    const mean = s / n; let q = 0; for (const x of v) q += (x - mean) * (x - mean);
    const sd = n > 1 ? Math.sqrt(q / (n - 1)) : 0;
    return { n, mean, sd, se: sd / Math.sqrt(n), min: Math.min(...v), max: Math.max(...v) };
  }
  // Central range holding at least 95% of Binomial(n, p) outcomes (what pure chance allows for a count out of n).
  function binomRange(n, p) {
    const pmf = [Math.pow(1 - p, n)];
    for (let k = 1; k <= n; k++) pmf.push(pmf[k - 1] * ((n - k + 1) / k) * (p / (1 - p)));
    let c = 0, lo = 0; while (c + pmf[lo] <= 0.025) { c += pmf[lo]; lo++; }
    c = 0; let hi = n; while (c + pmf[hi] <= 0.025) { c += pmf[hi]; hi--; }
    return [lo, hi];
  }

  // ---------- formulas (typed from memory; the page checks them against its own simulation) ----------
  function erlangB(c, a) { let b = 1; for (let k = 1; k <= c; k++) b = a * b / (k + a * b); return b; }
  function erlangC(c, a) { const rho = a / c; if (rho >= 1) return null; const b = erlangB(c, a); return b / (1 - rho * (1 - b)); }
  function mmc(lambda, mu, c) {
    const a = lambda / mu, rho = a / c;
    if (rho >= 1) return { stable: false, rho, a };
    const C = erlangC(c, a), Wq = C / (c * mu - lambda), W = Wq + 1 / mu;
    return { stable: true, rho, a, C, Wq, W, Lq: lambda * Wq, L: lambda * W };
  }
  function mm1(lambda, mu) { return mmc(lambda, mu, 1); }
  function mg1Wq(lambda, mu, cv2) {      // Pollaczek-Khinchine
    const rho = lambda / mu; if (rho >= 1) return null;
    return rho * (1 + cv2) / (2 * mu * (1 - rho));
  }
  function leeLongtonWq(lambda, mu, c, cv2) {   // M/G/c approximation: the M/M/c wait scaled by (1 + cv2) / 2
    const m = mmc(lambda, mu, c); return m.stable ? m.Wq * (1 + cv2) / 2 : null;
  }
  function fluidMeanWait(lambda, mu, c, N) {    // overload: customer k waits about k (1/(c mu) - 1/lambda)
    return N / 2 * (1 / (c * mu) - 1 / lambda);
  }

  return { HYPER_CV2, TAIL, Z_LIMIT, runQuick, SHAPES, mulberry32, mix, makeStream, simShared, simSeparate, scan, little, measure, runOne, simulate,
    summarise, binomRange, erlangB, erlangC, mmc, mm1, mg1Wq, leeLongtonWq, fluidMeanWait };
});
