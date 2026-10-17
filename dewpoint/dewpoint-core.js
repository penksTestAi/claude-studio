// Saturation vapour pressure two ways, dew point, and the published rows they are checked against.
// Pressures in hPa (1 hPa = 100 Pa). Temperatures in degrees C.
(function (root) {
  'use strict';
  // Magnus form with the Alduchov & Eskridge (1996) constants (as I recall them; see README).
  var MAGNUS = { water: { a: 6.1094, b: 17.625, c: 243.04 }, ice: { a: 6.1121, b: 22.587, c: 273.86 } };
  function magnus(T, phase) {
    var k = MAGNUS[phase];
    return k.a * Math.exp(k.b * T / (k.c + T));
  }
  // Arden Buck (1996) form (as I recall it; see README).
  function buck(T, phase) {
    if (phase === 'ice') return 6.1115 * Math.exp((23.036 - T / 333.7) * (T / (279.82 + T)));
    return 6.1121 * Math.exp((18.678 - T / 234.5) * (T / (257.14 + T)));
  }
  var FORMULAS = { magnus: magnus, buck: buck };
  // Temperature at which saturation pressure e (hPa) is reached: bisection on the formula itself.
  function invert(e, f, phase) {
    var lo = -80, hi = 100;
    for (var i = 0; i < 80; i++) {
      var mid = (lo + hi) / 2;
      if (f(mid, phase) < e) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  // RH is a percentage: actual vapour pressure = RH/100 * saturation over water at the air temperature.
  function dewPoint(T, RH, f) { return invert(RH / 100 * f(T, 'water'), f, 'water'); }
  function framePoint(T, RH, f) { return invert(RH / 100 * f(T, 'water'), f, 'ice'); }
  // Published rows from sources of a different origin than either formula.
  var SRC = {
    EE: 'Engineers Edge, vapor pressure of ice table (IAPS 1993 sublimation equation)',
    ET: 'Engineering ToolBox, water vapor saturation pressure table',
    WP: 'Wikipedia, Vapour pressure of water table'
  };
  var ROWS = [
    { T: -80, phase: 'ice', ref: 0.055 / 100, src: 'EE' },
    { T: -40, phase: 'ice', ref: 12.84 / 100, src: 'EE' },
    { T: -20, phase: 'ice', ref: 103.26 / 100, src: 'EE' },
    { T: -10, phase: 'ice', ref: 259.90 / 100, src: 'EE' },
    { T: 0, phase: 'ice', ref: 611.15 / 100, src: 'EE' },
    { T: 0.01, phase: 'water', ref: 6.1165, src: 'ET' },
    { T: 10, phase: 'water', ref: 12.281, src: 'WP' },
    { T: 20, phase: 'water', ref: 23.393, src: 'ET' },
    { T: 30, phase: 'water', ref: 42.470, src: 'ET' },
    { T: 40, phase: 'water', ref: 73.849, src: 'ET' },
    { T: 50, phase: 'water', ref: 123.52, src: 'ET' },
    { T: 100, phase: 'water', ref: 1014.2, src: 'ET' }
  ];
  ROWS.push({ T: -100, phase: 'ice', ref: 1.405e-3 / 100, src: 'EE' });
  ROWS.sort(function (x, y) { return x.T - y.T || (x.phase < y.phase ? -1 : 1); });
  var TOL = 0.005; // flag when a formula differs from the published value by more than 0.5 %
  function checkRows(tol) {
    tol = tol == null ? TOL : tol;
    return ROWS.map(function (r) {
      var m = magnus(r.T, r.phase), b = buck(r.T, r.phase);
      var em = (m - r.ref) / r.ref, eb = (b - r.ref) / r.ref;
      return { T: r.T, phase: r.phase, src: r.src, ref: r.ref, magnus: m, buck: b, errM: em, errB: eb,
               flagM: Math.abs(em) > tol, flagB: Math.abs(eb) > tol };
    });
  }
  // Relative gap between the two formulas on a grid, and the first/last temperature where it stays within tol.
  function spread(phase, lo, hi, step) {
    var out = [];
    for (var T = lo; T <= hi + 1e-9; T += step) {
      var m = magnus(T, phase), b = buck(T, phase);
      out.push({ T: Math.round(T * 100) / 100, gap: (m - b) / b });
    }
    return out;
  }
  function agreeRange(phase, lo, hi, tol) {
    var s = spread(phase, lo, hi, 1), best = null, cur = null;
    s.forEach(function (p) {
      if (Math.abs(p.gap) <= tol) { if (!cur) cur = { from: p.T, to: p.T }; else cur.to = p.T; }
      else { if (cur && (!best || cur.to - cur.from > best.to - best.from)) best = cur; cur = null; }
    });
    if (cur && (!best || cur.to - cur.from > best.to - best.from)) best = cur;
    return best;
  }
  // Verdict for a surface (glass) at temperature Ts in air at T, RH.
  function verdict(T, RH, Ts, f) {
    var td = dewPoint(T, RH, f), fp = framePoint(T, RH, f);
    if (Ts >= 0) {
      if (Ts <= td) return { kind: 'sweat', td: td, fp: fp, text: 'The surface is at or below the dew point, so water condenses on it: it sweats.' };
      return { kind: 'dry', td: td, fp: fp, text: 'The surface is above the dew point, so it stays dry in this model.' };
    }
    if (Ts <= fp) return { kind: 'frost', td: td, fp: fp, text: 'The surface is below freezing and at or below the frost point, so vapour can settle on it as frost.' };
    return { kind: 'dry', td: td, fp: fp, text: 'The surface is below freezing but warmer than the frost point, so no frost forms in this model.' };
  }
  var api = { magnus: magnus, buck: buck, FORMULAS: FORMULAS, MAGNUS: MAGNUS, dewPoint: dewPoint, framePoint: framePoint,
              ROWS: ROWS, SRC: SRC, TOL: TOL, checkRows: checkRows, spread: spread, agreeRange: agreeRange, verdict: verdict, invert: invert };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Dew = api;
})(typeof self !== 'undefined' ? self : this);
