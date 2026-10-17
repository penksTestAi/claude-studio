// Shared self-checks: run by test.js in Node and by index.html in the browser. Each returns
// {name, kind, pass, got, want, note}. kind: "exact" (hand-computable), "brute" (enumeration), "published" (weaker).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./diversity.js"));
  else root.DiversityChecks = factory(root.Diversity);
})(typeof self !== "undefined" ? self : this, function (D) {
  "use strict";
  var out = [];
  function near(a, b, tol) { return Math.abs(a - b) <= (tol || 1e-12) * Math.max(1, Math.abs(b)); }
  function add(name, kind, got, want, tol, note) {
    out.push({ name: name, kind: kind, pass: near(got, want, tol), got: got, want: want, note: note || "" });
  }
  // Brute force: list every size-n subset of the individuals (labelled), count species present, average.
  function brute(counts, n) {
    var lab = [], i;
    for (i = 0; i < counts.length; i++) for (var k = 0; k < counts[i]; k++) lab.push(i);
    var tot = 0, cnt = 0;
    (function rec(start, left, seen) {
      if (left === 0) { var s = 0; for (var j = 0; j < seen.length; j++) if (seen[j]) s++; tot += s; cnt++; return; }
      for (var x = start; x <= lab.length - left; x++) {
        var had = seen[lab[x]]; seen[lab[x]] = (had || 0) + 1;
        rec(x + 1, left - 1, seen);
        seen[lab[x]] = had;
      }
    })(0, n, []);
    return tot / cnt;
  }

  // 1. Equal abundances: every index is a function of S alone.
  [1, 2, 3, 5, 8, 20].forEach(function (S) {
    var c = []; for (var i = 0; i < S; i++) c.push(7);
    add("Equal abundances, S=" + S + ": Shannon = ln S", "exact", D.shannon(c), Math.log(S));
    add("Equal abundances, S=" + S + ": Simpson D = 1/S", "exact", D.simpson(c), 1 / S);
    add("Equal abundances, S=" + S + ": Hill q=0, 1, 2, 3, infinity all = S", "exact",
      [0, 1, 2, 3, Infinity].reduce(function (m, q) { return Math.max(m, Math.abs(D.hill(c, q) - S)); }, 0) + S, S, 1e-12);
  });
  var eq4 = [5, 5, 5, 5];
  add("Four equal species: Pielou J = 1", "exact", D.pielou(eq4), 1);
  add("Four equal species: Berger-Parker = 1/4", "exact", D.bergerParker(eq4), 0.25);
  // 2. One species.
  add("One species: Shannon = 0", "exact", D.shannon([9]), 0);
  add("One species: Hill q=2 = 1", "exact", D.hill([9], 2), 1);
  // 3. Hand cases for rarefaction.
  add("Counts 2,1: rarefied to 1 individual = 1", "exact", D.rarefy([2, 1], 1), 1);
  add("Counts 2,1: rarefied to 2 individuals = 5/3", "exact", D.rarefy([2, 1], 2), 5 / 3, 1e-12, "(1 - 0/3) + (1 - 1/3) = 5/3");
  add("Counts 2,1: rarefied to all 3 = S = 2", "exact", D.rarefy([2, 1], 3), 2);
  add("Counts 5,3,2: rarefied to 2 individuals = 76/45", "exact", D.rarefy([5, 3, 2], 2), 76 / 45, 1e-12, "35/45 + 24/45 + 17/45");
  // 4. Brute-force enumeration of every subset.
  [[3, 2, 1], [4, 1, 1, 1], [2, 2, 2, 2]].forEach(function (c) {
    [1, 2, 3, 4].forEach(function (n) {
      add("Counts " + c.join(",") + ": rarefaction at n=" + n + " equals the average over every subset", "brute",
        D.rarefy(c, n), brute(c, n), 1e-12);
    });
  });
  // 5. Chao1 by hand.
  add("Counts 1,1,2: Chao1 = 3 + (3/4)(2^2)/(2*1) = 4.5", "exact", D.chao1([1, 1, 2]), 4.5);
  add("Counts 1,1,1,3 (no doubletons, N=6, F1=3): Chao1 = 4 + (5/6)(3*2/2) = 6.5", "exact", D.chao1([1, 1, 1, 3]), 6.5);
  // 6. Unbiased Gini-Simpson, 2 individuals of one species vs 1+1.
  add("Counts 1,1: unbiased Gini-Simpson = 1", "exact", D.giniSimpsonUnbiased([1, 1]), 1);
  add("Counts 2: unbiased Gini-Simpson = 0", "exact", D.giniSimpsonUnbiased([2]), 0);
  // 7. Published worked example (weak: search-result summary of a teaching-worksheet answer key; same arithmetic as ours, so not independent).
  var w = [10, 20, 30, 40];
  [[0.230, 0.1], [0.322, 0.2], [0.361, 0.3], [0.367, 0.4]].forEach(function (r) {
    add("Worksheet row, p=" + r[1] + ": -p ln p printed as " + r[0] + " (3 decimals)", "published", -r[1] * Math.log(r[1]), r[0], 6e-4, "weaker, not independent");
  });
  add("Worksheet counts 10,20,30,40: sum of p^2 = 0.30", "published", D.simpson(w), 0.3, 1e-12, "weaker, not independent (search-summary arithmetic)");
  return out;
});
