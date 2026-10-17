/* Benford maths, shared by the page and the node tests. No DOM here. */
(function (root) {
  "use strict";
  var P = [0]; // P[d] = log10(1 + 1/d)
  for (var d = 1; d <= 9; d++) P.push(Math.log10(1 + 1 / d));

  function firstDigit(x) { // first significant digit of a positive finite number, or 0 if none
    x = Math.abs(x);
    if (!(x > 0) || !isFinite(x)) return 0;
    return +x.toExponential(12)[0];
  }
  function tally(values) { // counts[1..9], plus how many were left out (zero or not a number)
    var c = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], skipped = 0;
    for (var i = 0; i < values.length; i++) { var f = firstDigit(values[i]); if (f) c[f]++; else skipped++; }
    return { counts: c, n: values.length - skipped, skipped: skipped };
  }
  function chiSquare(counts) { // against Benford, 8 degrees of freedom
    var n = 0, d; for (d = 1; d <= 9; d++) n += counts[d];
    var x = 0, small = 0;
    for (d = 1; d <= 9; d++) { var e = n * P[d]; if (e < 5) small++; x += (counts[d] - e) * (counts[d] - e) / e; }
    return { x: x, df: 8, n: n, small: small, p: chiP(x, 8) };
  }
  function chiP(x, df) { // upper tail, df even: exp(-x/2) * sum_{k<df/2} (x/2)^k / k!  (exact)
    var h = x / 2, term = 1, s = 1;
    for (var k = 1; k < df / 2; k++) { term *= h / k; s += term; }
    return Math.exp(-h) * s;
  }
  function critical(df, alpha) { // bisection on chiP
    var lo = 0, hi = 200;
    for (var i = 0; i < 200; i++) { var m = (lo + hi) / 2; if (chiP(m, df) > alpha) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  function mad(counts) { // mean absolute deviation of the nine shares from Benford
    var n = 0, d, s = 0; for (d = 1; d <= 9; d++) n += counts[d];
    if (!n) return NaN;
    for (d = 1; d <= 9; d++) s += Math.abs(counts[d] / n - P[d]);
    return s / 9;
  }
  /* Conventional MAD bands as I remember them from the forensic-accounting literature (Nigrini). Not checked
     against the source; shown as a convention, never counted as a check. */
  function madBand(m) { return m <= 0.006 ? "close" : m <= 0.012 ? "acceptable" : m <= 0.015 ? "marginal" : "nonconforming"; }

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function cumulative(p) { var c = [0], s = 0; for (var d = 1; d <= 9; d++) { s += p[d]; c.push(s); } return c; }
  function sampleDigits(cum, n, rnd) { // n first digits drawn from the digit distribution with cumulative cum
    var c = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (var i = 0; i < n; i++) { var u = rnd(), d = 1; while (d < 9 && u >= cum[d]) d++; c[d]++; }
    return c;
  }

  /* Exact sequences, first digits of terms 1..N as arrays (index 0 = term 1). */
  function powers2(N) { var a = [], v = 1n; for (var i = 1; i <= N; i++) { v *= 2n; a.push(+v.toString()[0]); } return a; }
  function fibonacci(N) { var a = [], x = 0n, y = 1n; for (var i = 1; i <= N; i++) { a.push(+y.toString()[0]); var z = x + y; x = y; y = z; } return a; }
  function factorials(N) { var a = [], v = 1n; for (var i = 1; i <= N; i++) { v *= BigInt(i); a.push(+v.toString()[0]); } return a; }
  function squares(N) { var a = []; for (var i = 1; i <= N; i++) a.push(firstDigit(i * i)); return a; }
  function counting(N) { var a = []; for (var i = 1; i <= N; i++) a.push(firstDigit(i)); return a; }
  function countsOf(digs, n) { var c = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; for (var i = 0; i < n; i++) c[digs[i]]++; return c; }

  /* Percent text that never says 0.0% or 100.0% for something that is neither none nor all. */
  function pct(k, n) {
    if (!n) return "n/a";
    if (k === 0) return "none";
    if (k === n) return "all";
    var v = 100 * k / n, s = v.toFixed(1);
    if (s === "0.0") return "under 0.1%";
    if (s === "100.0") return "over 99.9%";
    return s + "%";
  }
  function pText(p) { return p < 0.001 ? "p < 0.001" : p > 0.999 ? "p > 0.999" : "p = " + p.toFixed(3); }

  root.Benford = { P: P, firstDigit: firstDigit, tally: tally, chiSquare: chiSquare, chiP: chiP, critical: critical, mad: mad, madBand: madBand,
    mulberry32: mulberry32, cumulative: cumulative, sampleDigits: sampleDigits, powers2: powers2, fibonacci: fibonacci,
    factorials: factorials, squares: squares, counting: counting, countsOf: countsOf, pct: pct, pText: pText };
  if (typeof module !== "undefined") module.exports = root.Benford;
})(typeof window !== "undefined" ? window : globalThis);
