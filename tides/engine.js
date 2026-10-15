/* Tide engine for the Tides page: sums cosines of harmonic constituents.
   height(t) = sum over constituents of  A * f * cos( V0 + u + speed*(t - t_ref) - phase )
   A, phase  published amplitude (metres) and Greenwich (GMT) phase lag (degrees) of the station
   V0        equilibrium argument at t_ref from Doodson coefficients and the Sun and Moon's mean motions (Meeus polynomials)
   f, u      nodal factor and nodal angle (IHO formulas, evaluated at the middle of each UTC day); optional
   Plain script: works in a browser (window.TideEngine) and in node (module.exports). */
(function (root) {
  "use strict";
  var D2R = Math.PI / 180, R2D = 180 / Math.PI, DAY = 86400000;

  // Meeus polynomials in Julian centuries T from J2000, degrees (same set as the open-source engine named in README.md)
  var POLY = {
    s:  [218.3164591, 481267.88134236, -0.0013268, 1 / 538841 - 1 / 65194000],
    h:  [280.46645, 36000.76983, 0.0003032],
    p:  [83.353243, 4069.0137111, -0.0103238, -1 / 80053, 1 / 18999000],
    N:  [125.044555, -1934.1361849, 0.0020762, 1 / 467410, -1 / 60616000],
    pp: [280.46645 - 357.5291, 36000.76932 - 35999.0503, 0.0003032 + 0.0001559, 0.00000048]
  };
  function poly(c, x) { var r = 0; for (var i = 0; i < c.length; i++) r += c[i] * Math.pow(x, i); return r; }
  function dpoly(c, x) { var r = 0; for (var i = 1; i < c.length; i++) r += c[i] * i * Math.pow(x, i - 1); return r; }
  function mod(a, b) { return ((a % b) + b) % b; }
  function jd(ms) { return ms / DAY + 2440587.5; }          // Unix ms -> Julian day (UTC, no delta-T)
  function centuries(ms) { return (jd(ms) - 2451545) / 36525; }

  // Mean astronomical arguments (degrees) and their speeds (degrees per hour)
  function astro(ms) {
    var T = centuries(ms), a = {}, perHour = 1 / (24 * 36525);
    ["s", "h", "p", "N", "pp"].forEach(function (k) {
      a[k] = mod(poly(POLY[k], T), 360);
      a[k + "Speed"] = dpoly(POLY[k], T) * perHour;
    });
    var j = jd(ms);
    var hourAngle = (j - Math.floor(j)) * 360;                // 180 deg at 00:00 UTC, as Doodson's tau needs
    a.tau = hourAngle + a.h - a.s;
    a.tauSpeed = 15 + a.hSpeed - a.sSpeed;
    return a;
  }
  // Doodson coefficients: [tau, s, h, p, N', p', 90deg] with N' = -N
  function v0(c, a) {
    return c[0] * a.tau + c[1] * a.s + c[2] * a.h + c[3] * a.p + c[4] * -a.N + c[5] * a.pp + c[6] * 90;
  }
  function speedFromDoodson(c, a) {
    return c[0] * a.tauSpeed + c[1] * a.sSpeed + c[2] * a.hSpeed + c[3] * a.pSpeed + c[4] * -a.NSpeed + c[5] * a.ppSpeed;
  }

  // Nodal corrections of the fundamental constituents (IHO TWCWG formulas). N, p in radians. u in degrees.
  function fromSC(fs, fc) { return { f: Math.sqrt(fs * fs + fc * fc), u: R2D * Math.atan2(fs, fc) }; }
  var FUND = {
    Mm: function (N, p) { return { f: 1 - 0.1311 * Math.cos(N) + 0.0538 * Math.cos(2 * p) + 0.0205 * Math.cos(2 * p - N), u: 0 }; },
    Mf: function (N) { return { f: 1.084 + 0.415 * Math.cos(N) + 0.039 * Math.cos(2 * N), u: -23.7 * Math.sin(N) + 2.7 * Math.sin(2 * N) - 0.4 * Math.sin(3 * N) }; },
    O1: function (N) { return { f: 1.0176 + 0.1871 * Math.cos(N) - 0.0147 * Math.cos(2 * N), u: 10.8 * Math.sin(N) - 1.34 * Math.sin(2 * N) + 0.19 * Math.sin(3 * N) }; },
    K1: function (N) { return { f: 1.006 + 0.115 * Math.cos(N) - 0.0088 * Math.cos(2 * N) + 0.0006 * Math.cos(3 * N), u: -8.86 * Math.sin(N) + 0.68 * Math.sin(2 * N) - 0.07 * Math.sin(3 * N) }; },
    J1: function (N) { return { f: 1.1029 + 0.1676 * Math.cos(N) - 0.017 * Math.cos(2 * N) + 0.0016 * Math.cos(3 * N), u: -12.94 * Math.sin(N) + 1.34 * Math.sin(2 * N) - 0.19 * Math.sin(3 * N) }; },
    M2: function (N) { return { f: 1.0007 - 0.0373 * Math.cos(N) + 0.0002 * Math.cos(2 * N), u: -2.14 * Math.sin(N) }; },
    K2: function (N) { return { f: 1.0246 + 0.2863 * Math.cos(N) + 0.0083 * Math.cos(2 * N) - 0.0015 * Math.cos(3 * N), u: -17.74 * Math.sin(N) + 0.68 * Math.sin(2 * N) - 0.04 * Math.sin(3 * N) }; },
    M3: function (N) { var m = FUND.M2(N); return { f: Math.pow(Math.sqrt(m.f), 3), u: -3.21 * Math.sin(N) }; },
    M1: function (N, p) { return fromSC(Math.sin(p) + 0.2 * Math.sin(p - N), 2 * (Math.cos(p) + 0.2 * Math.cos(p - N))); },
    L2: function (N, p) {
      return fromSC(-0.2505 * Math.sin(2 * p) - 0.1102 * Math.sin(2 * p - N) - 0.0156 * Math.sin(2 * p - 2 * N) - 0.037 * Math.sin(N),
        1 - 0.2505 * Math.cos(2 * p) - 0.1102 * Math.cos(2 * p - N) - 0.0156 * Math.cos(2 * p - 2 * N) - 0.037 * Math.cos(N));
    }
  };
  // corr = list of [fundamental, factor]: u = sum factor*u, f = product f^|factor|; empty list = no correction
  function nodal(corr, a) {
    var N = a.N * D2R, p = a.p * D2R, f = 1, u = 0;
    for (var i = 0; i < corr.length; i++) {
      var fn = FUND[corr[i][0]];
      if (!fn) throw new Error("no nodal formula for " + corr[i][0]);
      var r = fn(N, p);
      u += corr[i][1] * r.u;
      f *= Math.pow(r.f, Math.abs(corr[i][1]));
    }
    return { f: f, u: u };
  }

  // A predictor for a list of {n, a, p} constituents. opts: {defs, nodal: bool, offset: metres added to the sum}
  function predictor(list, opts) {
    var defs = opts.defs, useNodal = opts.nodal !== false, offset = opts.offset || 0;
    var items = list.filter(function (c) { return c.a !== 0 && defs[c.n]; });
    var cache = {};
    function paramsFor(ms) {
      var k = Math.floor(ms / DAY);
      if (cache[k]) return cache[k];
      var mid = (k + 0.5) * DAY, a = astro(mid), out = [];
      items.forEach(function (c) {
        var d = defs[c.n], nc = useNodal ? nodal(d.corr, a) : { f: 1, u: 0 };
        out.push({ n: c.n, amp: c.a * nc.f, w: d.speed, ph: v0(d.doodson, a) + nc.u - c.p, f: nc.f, u: nc.u });
      });
      return (cache[k] = { mid: mid, list: out });
    }
    function height(ms) {
      var P = paramsFor(ms), dt = (ms - P.mid) / 3600000, s = 0;
      for (var i = 0; i < P.list.length; i++) s += P.list[i].amp * Math.cos((P.list[i].w * dt + P.list[i].ph) * D2R);
      return s + offset;
    }
    return { height: height, paramsFor: paramsFor, count: items.length };
  }

  // Highs and lows between t0 and t1 (Unix ms): scan on a regular step, refine each turning point with a parabola
  function extremes(height, t0, t1, stepMin) {
    var step = (stepMin || 3) * 60000, n = Math.ceil((t1 - t0) / step) + 1, h = [], i, out = [];
    for (i = 0; i < n + 2; i++) h.push(height(t0 - step + i * step));   // one spare sample each side
    for (i = 1; i < h.length - 1; i++) {
      var hi = h[i - 1] < h[i] && h[i] >= h[i + 1], lo = h[i - 1] > h[i] && h[i] <= h[i + 1];
      if (!hi && !lo) continue;
      var den = h[i - 1] - 2 * h[i] + h[i + 1], x = den === 0 ? 0 : 0.5 * (h[i - 1] - h[i + 1]) / den;
      var t = t0 - step + i * step + x * step;
      if (t < t0 || t > t1) continue;
      out.push({ t: t, h: h[i] - 0.25 * (h[i - 1] - h[i + 1]) * x, kind: hi ? "high" : "low" });
    }
    return out;
  }

  var api = { astro: astro, v0: v0, speedFromDoodson: speedFromDoodson, nodal: nodal, predictor: predictor, extremes: extremes, FUND: FUND, DAY: DAY };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.TideEngine = api;
})(typeof window !== "undefined" ? window : this);
