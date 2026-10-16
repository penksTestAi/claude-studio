/* Hanging-chain engine for "Hanging Chain, Standing Arch". Plain JS, no dependencies.
   Model: a string of N equal, rigid, weightless-or-heavy links; point loads at the N-1 joints;
   both ends held at the same level. Unknowns: horizontal pull H and left vertical reaction V0.
   Lengths of links are known, so H and V0 are found by two nested bisections (closure in x and in depth). */
(function (root) {
  "use strict";
  var N = 30; // links
  var LSTEP = 0.005; // chain-length step of the verdict scan

  // Shape of the chain for given joint loads. S span, L chain length, w = loads at joints 1..N-1 (units: link weights).
  function solve(S, L, w) {
    var n = w.length + 1, l = L / n, i, Wt = 0;
    for (i = 0; i < w.length; i++) Wt += w[i];
    if (!(Wt > 0) || !(L > S)) return null;
    var V = new Array(n);
    function shear(V0) { var v = V0; for (var k = 0; k < n; k++) { V[k] = v; if (k < n - 1) v -= w[k]; } }
    function depthSum(V0, H) { shear(V0); var s = 0; for (var k = 0; k < n; k++) s += V[k] / Math.sqrt(H * H + V[k] * V[k]); return s * l; }
    function xSum(H) { var s = 0; for (var k = 0; k < n; k++) s += H / Math.sqrt(H * H + V[k] * V[k]); return s * l; }
    var lo = 1e-2 * Wt, hi = 1e3 * Wt, H = 1, V0 = 0, it, a, b;
    for (it = 0; it < 50; it++) {
      H = Math.sqrt(lo * hi);
      a = 0; b = Wt;
      for (var j = 0; j < 50; j++) { V0 = (a + b) / 2; if (depthSum(V0, H) > 0) b = V0; else a = V0; }
      V0 = (a + b) / 2; shear(V0);
      if (xSum(H) > S) hi = H; else lo = H;
    }
    H = Math.sqrt(lo * hi);
    a = 0; b = Wt;
    for (var j2 = 0; j2 < 50; j2++) { V0 = (a + b) / 2; if (depthSum(V0, H) > 0) b = V0; else a = V0; }
    V0 = (a + b) / 2; shear(V0);
    var x = [0], d = [0], T = [];
    for (i = 0; i < n; i++) {
      var r = Math.sqrt(H * H + V[i] * V[i]);
      x.push(x[i] + l * H / r); d.push(d[i] + l * V[i] / r); T.push(r);
    }
    return { x: x, d: d, H: H, V0: V0, V: V.slice(), T: T, W: Wt, S: S, L: L, w: w.slice() };
  }

  // Joint loads. extras: integer array of length N-1. mode "chain": each link weighs 1 and half goes to each end joint.
  // mode "deck": total D spread evenly per unit of horizontal length (found by iteration), chain itself weightless.
  function loads(S, L, mode, extras, D) {
    var w = [], i;
    if (mode === "chain") {
      for (i = 0; i < N - 1; i++) w.push(1 + extras[i]);
      return { w: w, sol: solve(S, L, w) };
    }
    for (i = 0; i < N - 1; i++) w.push(D / (N)); // starting guess
    var sol = null, q = D / S;
    for (var it = 0; it < 300; it++) {
      var tot = [];
      for (i = 0; i < N - 1; i++) tot.push(w[i] + extras[i]);
      sol = solve(S, L, tot);
      if (!sol) return { w: tot, sol: null };
      var mx = 0, nw = [];
      for (i = 0; i < N - 1; i++) {
        var t = q * (sol.x[i + 2] - sol.x[i]) / 2; nw.push(t); mx = Math.max(mx, Math.abs(t - w[i]));
      }
      w = nw;
      if (mx < 1e-11) break;
    }
    var tot2 = [];
    for (i = 0; i < N - 1; i++) tot2.push(w[i] + extras[i]);
    return { w: tot2, sol: solve(S, L, tot2), iterations: it + 1 };
  }

  // Exact catenary through (0,0) and (S,0) with arc length L: depth at x.
  function catenaryParam(S, L) { // L = 2a sinh(S/(2a))
    var lo = 1e-4 * S, hi = 1e4 * S, a, k;
    for (k = 0; k < 200; k++) { a = Math.sqrt(lo * hi); if (2 * a * Math.sinh(S / (2 * a)) > L) lo = a; else hi = a; }
    return Math.sqrt(lo * hi);
  }
  function catenaryDepth(S, a, x) { return a * Math.cosh(S / (2 * a)) - a * Math.cosh((x - S / 2) / a); }
  function parabolaDepth(S, sag, x) { return 4 * sag * x * (S - x) / (S * S); }

  // Stone ring: circular-arc centre line with a given rise, vertical thickness t. Returns [lower, upper] height at x.
  function ringAt(S, rise, t, x) {
    var R = (S * S / 4 + rise * rise) / (2 * rise);
    var c = Math.sqrt(Math.max(0, R * R - (x - S / 2) * (x - S / 2))) - (R - rise);
    return [c - t / 2, c + t / 2];
  }

  // Best vertical placement of the flipped line (height = depth + s) inside the ring; margin >= 0 means it fits.
  function fit(sol, rise, t) {
    var S = sol.S, minHi = Infinity, maxLo = -Infinity, atHi = 0, atLo = 0, n = sol.x.length;
    for (var i = 0; i < n - 1; i++) {
      for (var k = 0; k < 5; k++) {
        var u = k / 5, x = sol.x[i] + (sol.x[i + 1] - sol.x[i]) * u, d = sol.d[i] + (sol.d[i + 1] - sol.d[i]) * u;
        var r = ringAt(S, rise, t, x);
        if (r[1] - d < minHi) { minHi = r[1] - d; atHi = x; }
        if (r[0] - d > maxLo) { maxLo = r[0] - d; atLo = x; }
      }
    }
    var rE = ringAt(S, rise, t, S);
    if (rE[1] - 0 < minHi) { minHi = rE[1]; atHi = S; }
    if (rE[0] - 0 > maxLo) { maxLo = rE[0]; atLo = S; }
    return { margin: (minHi - maxLo) / 2, s: (minHi + maxLo) / 2, topAt: atHi, bottomAt: atLo };
  }

  // The verdict. cfg: {S, L, mode, extras, D, rise, t}. Scans chain lengths Lmin..Lmax (times S) for another line that fits.
  function verdict(cfg, lmin, lmax) {
    var cur = loads(cfg.S, cfg.L, cfg.mode, cfg.extras, cfg.D);
    if (!cur.sol) return { branch: "noload" };
    var f = fit(cur.sol, cfg.rise, cfg.t);
    if (f.margin >= 0) return { branch: "stands", fit: f, sol: cur.sol, margin: f.margin };
    var best = null, bestL = 0, bestSol = null, tried = 0;
    for (var Lk = lmin; Lk <= lmax + 1e-9; Lk += LSTEP) {
      var r = loads(cfg.S, Lk * cfg.S, cfg.mode, cfg.extras, cfg.D);
      if (!r.sol) continue;
      tried++;
      var g = fit(r.sol, cfg.rise, cfg.t);
      if (!best || g.margin > best.margin) { best = g; bestL = Lk; bestSol = r.sol; }
    }
    if (best && best.margin >= 0) return { branch: "other", fit: f, sol: cur.sol, margin: f.margin, best: best, bestL: bestL, bestSol: bestSol, tried: tried };
    return { branch: "fails", fit: f, sol: cur.sol, margin: f.margin, best: best, bestL: bestL, bestSol: bestSol, tried: tried };
  }

  // Residual of moment balance about the left support, from positions: sum w_j x_j - Vright * S, relative to total weight * S.
  function momentResidual(sol) {
    var m = 0, i;
    for (i = 0; i < sol.w.length; i++) m += sol.w[i] * sol.x[i + 1];
    var Vr = sol.W - sol.V0;
    return Math.abs(m - Vr * sol.S) / (sol.W * sol.S);
  }

  var api = { N: N, LSTEP: LSTEP, solve: solve, loads: loads, catenaryParam: catenaryParam, catenaryDepth: catenaryDepth,
    parabolaDepth: parabolaDepth, ringAt: ringAt, fit: fit, verdict: verdict, momentResidual: momentResidual };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ArchEngine = api;
})(typeof self !== "undefined" ? self : this);
