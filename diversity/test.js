// Run: node test.js
var D = require("./diversity.js"), checks = require("./checks.js"), assert = require("assert");
var fails = 0;
checks.forEach(function (c) { if (!c.pass) { fails++; console.log("FAIL", c.name, c.got, c.want); } });
console.log(checks.length + " shared checks, " + fails + " failed");
// Extra properties
assert.strictEqual(D.richness([3, 0, 1, 0]), 2);
assert.ok(Math.abs(D.hill([10, 20, 30, 40], 1) - Math.exp(D.shannon([10, 20, 30, 40]))) < 1e-12);
assert.ok(Math.abs(D.hill([10, 20, 30, 40], 2) - 10 / 3) < 1e-12);
assert.ok(Math.abs(D.hill([10, 20, 30, 40], 2) - D.inverseSimpson([10, 20, 30, 40])) < 1e-12);
assert.strictEqual(D.hill([10, 20, 30, 40], Infinity), 100 / 40);
// Hill numbers never increase with q
var prev = Infinity;
[0, 0.5, 1, 2, 3, 10, Infinity].forEach(function (q) { var h = D.hill([50, 20, 10, 5, 1, 1], q); assert.ok(h <= prev + 1e-12); prev = h; });
// Rarefaction is non-decreasing, starts at 1, ends at S
var cur = D.rarefactionCurve([50, 20, 10, 5, 1, 1], 30);
assert.ok(Math.abs(cur[0].s - 1) < 1e-12 && Math.abs(cur[cur.length - 1].s - 6) < 1e-12);
for (var i = 1; i < cur.length; i++) assert.ok(cur[i].s >= cur[i - 1].s - 1e-12);
// Bad input
assert.throws(function () { D.shannon([1.5]); }, RangeError);
assert.throws(function () { D.shannon([-1]); }, RangeError);
assert.throws(function () { D.rarefy([2, 1], 4); }, RangeError);
assert.strictEqual(D.shannon([]), 0);
// Random fuzz: rarefy at n=1 is 1 and at N is S for random communities
var seed = 12345; function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
for (var t = 0; t < 200; t++) {
  var c = []; for (var k = 0, S = 1 + Math.floor(rnd() * 12); k < S; k++) c.push(1 + Math.floor(rnd() * 30));
  var N = D.abundance(c);
  assert.ok(Math.abs(D.rarefy(c, 1) - 1) < 1e-12 && Math.abs(D.rarefy(c, N) - S) < 1e-12);
  assert.ok(D.shannon(c) <= Math.log(S) + 1e-12 && D.simpson(c) >= 1 / S - 1e-12);
}
console.log(fails || "all extra assertions passed");
process.exit(fails ? 1 : 0);
