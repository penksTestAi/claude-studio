/*! diversity.js 1.0.0 - species-diversity indices from abundance counts. MIT licence (see LICENSE). Made by Claude, an AI model. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Diversity = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Counts: an array of non-negative integers, one per species. Zeros are ignored.
  function clean(counts) {
    if (!Array.isArray(counts)) throw new TypeError("counts must be an array");
    var out = [];
    for (var i = 0; i < counts.length; i++) {
      var c = counts[i];
      if (typeof c !== "number" || !isFinite(c) || c < 0 || Math.floor(c) !== c)
        throw new RangeError("counts must be non-negative integers (bad value at index " + i + ")");
      if (c > 0) out.push(c);
    }
    return out;
  }
  function total(a) { var t = 0; for (var i = 0; i < a.length; i++) t += a[i]; return t; }

  function richness(counts) { return clean(counts).length; }
  function abundance(counts) { return total(clean(counts)); }

  // Shannon entropy in nats: -sum p ln p. Plug-in estimate (biased low for small samples).
  function shannon(counts) {
    var a = clean(counts), N = total(a), h = 0;
    for (var i = 0; i < a.length; i++) { var p = a[i] / N; h -= p * Math.log(p); }
    return a.length ? h + 0 : 0;
  }
  // Simpson concentration D = sum p^2 (chance two draws with replacement match).
  function simpson(counts) {
    var a = clean(counts), N = total(a), d = 0;
    for (var i = 0; i < a.length; i++) { var p = a[i] / N; d += p * p; }
    return d;
  }
  function giniSimpson(counts) { return 1 - simpson(counts); }
  function inverseSimpson(counts) { return 1 / simpson(counts); }
  // Unbiased Gini-Simpson (draws without replacement): 1 - sum n(n-1) / (N(N-1)). Needs N >= 2.
  function giniSimpsonUnbiased(counts) {
    var a = clean(counts), N = total(a), s = 0;
    if (N < 2) return NaN;
    for (var i = 0; i < a.length; i++) s += a[i] * (a[i] - 1);
    return 1 - s / (N * (N - 1));
  }
  function bergerParker(counts) { var a = clean(counts); return Math.max.apply(null, a) / total(a); }
  // Pielou evenness J = H / ln S (undefined for S < 2).
  function pielou(counts) { var S = richness(counts); return S < 2 ? NaN : shannon(counts) / Math.log(S); }

  // Hill number of order q (effective number of species). q=0 richness, q=1 exp(H), q=2 inverse Simpson.
  function hill(counts, q) {
    var a = clean(counts), N = total(a), i, s;
    if (!a.length) return 0;
    if (q === 0) return a.length;
    if (q === Infinity) return N / Math.max.apply(null, a);
    if (q === 1) return Math.exp(shannon(a));
    s = 0;
    for (i = 0; i < a.length; i++) s += Math.pow(a[i] / N, q);
    return Math.pow(s, 1 / (1 - q));
  }

  // Chao1 lower-bound richness estimate, bias-corrected form. F1 singletons, F2 doubletons.
  function chao1(counts) {
    var a = clean(counts), N = total(a), f1 = 0, f2 = 0;
    for (var i = 0; i < a.length; i++) { if (a[i] === 1) f1++; else if (a[i] === 2) f2++; }
    var k = (N - 1) / N;
    return a.length + (f2 > 0 ? k * f1 * f1 / (2 * f2) : k * f1 * (f1 - 1) / 2);
  }

  // Hurlbert (1971) rarefaction, exact: expected species in n individuals drawn at random
  // WITHOUT replacement from the sample: sum over species of 1 - C(N-Ni, n) / C(N, n).
  // C(N-Ni,n)/C(N,n) = prod_{j=0}^{n-1} (N-Ni-j)/(N-j), computed as a product (no big factorials).
  function rarefy(counts, n) {
    var a = clean(counts), N = total(a);
    if (n !== Math.floor(n) || n < 0 || n > N) throw new RangeError("n must be an integer from 0 to " + N);
    var e = 0;
    for (var i = 0; i < a.length; i++) {
      var miss;
      if (N - a[i] < n) miss = 0;
      else { miss = 1; for (var j = 0; j < n; j++) miss *= (N - a[i] - j) / (N - j); }
      e += 1 - miss;
    }
    return e;
  }
  // Rarefaction curve at up to `points` depths from 1 to N (always includes 1 and N).
  function rarefactionCurve(counts, points) {
    var N = abundance(counts), ns = [], out = [];
    if (N < 1) return out;
    points = Math.max(2, points || 60);
    if (N <= points) for (var n = 1; n <= N; n++) ns.push(n);
    else for (var k = 0; k < points; k++) { var v = Math.round(1 + (N - 1) * k / (points - 1)); if (!ns.length || ns[ns.length - 1] !== v) ns.push(v); }
    for (var i = 0; i < ns.length; i++) out.push({ n: ns[i], s: rarefy(counts, ns[i]) });
    return out;
  }

  return { richness: richness, abundance: abundance, shannon: shannon, simpson: simpson, giniSimpson: giniSimpson,
    inverseSimpson: inverseSimpson, giniSimpsonUnbiased: giniSimpsonUnbiased, bergerParker: bergerParker,
    pielou: pielou, hill: hill, chao1: chao1, rarefy: rarefy, rarefactionCurve: rarefactionCurve, version: "1.0.0" };
});
