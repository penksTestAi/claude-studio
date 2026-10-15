// Quake engine: flat uniform crust, epicentre on a plane, S-minus-P gaps -> distances -> location.
// Used by index.html in the browser and by stats.mjs under node. Wave speeds are typical values from memory.
(function (root) {
  'use strict';
  var VP = 6, VS = 3.5;                       // km/s, approximate
  var BOX = { w: 110, h: 100 };               // km
  var STATIONS = [
    { name: 'Alder', x: 18, y: 22 },
    { name: 'Birch', x: 94, y: 34 },
    { name: 'Cedar', x: 52, y: 84 }
  ];
  var SEED = 5, COV = 0.9;

  function rng(seed) {                        // mulberry32
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) {
    var u = 0, v = 0;
    while (u === 0) u = r();
    v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  // km of distance per second of S-minus-P gap: d = gap * vp*vs/(vp-vs). Not finite when vs >= vp.
  function kfac(vp, vs) { return vs < vp ? vp * vs / (vp - vs) : Infinity; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function makeQuake(seed) {
    var r = rng(seed * 7919 + 13);
    return { x: 15 + r() * (BOX.w - 30), y: 15 + r() * (BOX.h - 30), t0: 3 + r() * 6 };
  }
  // Fixed unit-noise draws for a seed, so a noise slider scales them instead of reshuffling them.
  function unitNoise(seed, n) {
    var r = rng(seed * 104729 + 5), z = [];
    for (var i = 0; i < n; i++) z.push(gauss(r));
    return z;
  }
  function trueGaps(q, st, vp, vs) {
    return st.map(function (s) { return dist(q, s) * (1 / vs - 1 / vp); });
  }
  function noisyGaps(q, st, vp, vs, sigma, z) {
    return trueGaps(q, st, vp, vs).map(function (g, i) { return Math.max(0, g + sigma * z[i]); });
  }
  function radii(gaps, k) { return gaps.map(function (g) { return g * k; }); }

  // Least-squares position from distance circles (Levenberg-Marquardt, several starts).
  function locate(st, d) {
    var best = null, sx, sy;
    var starts = [{ x: BOX.w / 2, y: BOX.h / 2 }];
    for (sx = 0; sx < 4; sx++) for (sy = 0; sy < 4; sy++)
      starts.push({ x: BOX.w * (sx + 0.5) / 4, y: BOX.h * (sy + 0.5) / 4 });
    starts.forEach(function (p0) {
      var p = { x: p0.x, y: p0.y }, lam = 1e-3, cost = sse(p);
      for (var it = 0; it < 80; it++) {
        var a = 0, b = 0, c = 0, gx = 0, gy = 0;
        for (var i = 0; i < st.length; i++) {
          var dx = p.x - st[i].x, dy = p.y - st[i].y, L = Math.hypot(dx, dy) || 1e-9;
          var jx = dx / L, jy = dy / L, r = L - d[i];
          a += jx * jx; b += jx * jy; c += jy * jy; gx += jx * r; gy += jy * r;
        }
        var a2 = a + lam * (a || 1), c2 = c + lam * (c || 1), det = a2 * c2 - b * b;
        if (Math.abs(det) < 1e-12) { lam *= 10; continue; }
        var stepx = -(c2 * gx - b * gy) / det, stepy = -(-b * gx + a2 * gy) / det;
        var np = { x: p.x + stepx, y: p.y + stepy }, nc = sse(np);
        if (nc < cost) { p = np; cost = nc; lam = Math.max(lam / 3, 1e-12); if (Math.hypot(stepx, stepy) < 1e-12) break; }
        else lam *= 4;
      }
      if (!best || cost < best.cost) best = { x: p.x, y: p.y, cost: cost };
    });
    function sse(p) { var s = 0; for (var i = 0; i < st.length; i++) { var r = dist(p, st[i]) - d[i]; s += r * r; } return s; }
    best.rms = Math.sqrt(best.cost / st.length);
    return best;
  }

  // Two circles meet in 0, 1 or 2 points.
  function twoCircles(s1, s2, r1, r2) {
    var D = dist(s1, s2);
    if (D === 0 || D > r1 + r2 || D < Math.abs(r1 - r2)) return [];
    var a = (r1 * r1 - r2 * r2 + D * D) / (2 * D), h2 = r1 * r1 - a * a, h = Math.sqrt(Math.max(0, h2));
    var ux = (s2.x - s1.x) / D, uy = (s2.y - s1.y) / D, mx = s1.x + a * ux, my = s1.y + a * uy;
    if (h < 1e-9) return [{ x: mx, y: my }];
    return [{ x: mx - h * uy, y: my + h * ux }, { x: mx + h * uy, y: my - h * ux }];
  }

  // n seeded noisy runs at one timing noise; returns the location errors in km (common random numbers across sigmas).
  function scatter(q, st, vp, vs, sigma, zs) {
    var k = kfac(vp, vs);
    return zs.map(function (z) {
      var p = locate(st, radii(noisyGaps(q, st, vp, vs, sigma, z), k));
      return { dx: p.x - q.x, dy: p.y - q.y, err: Math.hypot(p.x - q.x, p.y - q.y) };
    });
  }
  function zsets(seed, n, m) {
    var r = rng(seed * 15485863 + 3), out = [];
    for (var j = 0; j < n; j++) { var z = []; for (var i = 0; i < m; i++) z.push(gauss(r)); out.push(z); }
    return out;
  }
  function quantile(arr, p) {
    var s = arr.slice().sort(function (a, b) { return a - b; }), x = p * (s.length - 1), i = Math.floor(x);
    return i + 1 < s.length ? s[i] + (s[i + 1] - s[i]) * (x - i) : s[i];
  }
  function summary(runs) {
    var errs = runs.map(function (r) { return r.err; }), r90 = quantile(errs, COV);
    return { median: quantile(errs, 0.5), r90: r90, area: Math.PI * r90 * r90 };
  }
  function slope(xs, ys) {                    // least-squares slope of log y on log x
    var n = xs.length, lx = xs.map(Math.log), ly = ys.map(Math.log), mx = 0, my = 0, i, sxy = 0, sxx = 0;
    for (i = 0; i < n; i++) { mx += lx[i] / n; my += ly[i] / n; }
    for (i = 0; i < n; i++) { sxy += (lx[i] - mx) * (ly[i] - my); sxx += (lx[i] - mx) * (lx[i] - mx); }
    return sxy / sxx;
  }

  var api = { COV: COV, VP: VP, VS: VS, BOX: BOX, STATIONS: STATIONS, SEED: SEED, rng: rng, gauss: gauss, kfac: kfac, dist: dist,
    makeQuake: makeQuake, unitNoise: unitNoise, trueGaps: trueGaps, noisyGaps: noisyGaps, radii: radii, locate: locate,
    twoCircles: twoCircles, scatter: scatter, zsets: zsets, quantile: quantile, summary: summary, slope: slope };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Quake = api;
})(typeof self !== 'undefined' ? self : this);
