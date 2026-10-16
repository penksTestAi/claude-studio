// Run: node huffman/test.mjs   (from the studio root, or anywhere)
import { createRequire } from "node:module";
const H = createRequire(import.meta.url)("./huffman.js");
let fails = 0, runs = 0;
function ok(c, m) { runs++; if (!c) { fails++; console.log("FAIL", m); } }
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const enc = s => new TextEncoder().encode(s);

// 1. fixed cases
const cases = { empty: "", one: "a", repeated: "aaaaaaaaaa", two: "ab", uniform4: "abcdabcdabcd", uniform3: "abcabcabc",
  skew: "aaaaaaaaaaaaaaab", sentence: "she sells sea shells by the sea shore", unicode: "héllo wörld ✓ 日本語" };
for (const [name, s] of Object.entries(cases)) {
  const r = H.analyse(enc(s));
  if (r.empty) { ok(s === "", name); continue; }
  const sum = H.summary(r.checks);
  ok(sum.fail === 0, name + " failed: " + sum.text);
  console.log(name.padEnd(10), "n=" + r.n, "k=" + r.k, "H=" + r.H.toFixed(4), "L=" + r.L.toFixed(4), "bits=" + r.bits.length, sum.text);
}
// the single-symbol case: L = H + 1 exactly, strict bound reported not applicable
{ const r = H.analyse(enc("aaaa")); ok(r.L === 1 && r.H === 0, "single H/L"); ok(r.checks.filter(c => c.status === "na").length === 3, "single: three n/a"); }
// uniform alphabet of 2^m symbols: L = H = m exactly
{ const r = H.analyse(enc("abcdefgh".repeat(5))); ok(r.L === 3 && Math.abs(r.H - 3) < 1e-12, "uniform 8"); }
// all 256 byte values once: L = H = 8, equal to fixed 8-bit
{ const b = new Uint8Array(256).map((_, i) => i); const r = H.analyse(b); ok(r.L === 8 && Math.abs(r.H - 8) < 1e-12 && r.bits.length === r.fixed8, "uniform 256");
  ok(H.summary(r.checks).fail === 0, "uniform 256 checks"); }
// 2. random strings: round trip, bounds, identity, tie-break
let maxL = 0;
for (let t = 0; t < 3000; t++) {
  const n = 1 + Math.floor(rnd() * 400), alpha = 1 + Math.floor(rnd() * 256), skew = rnd() * 3;
  const b = new Uint8Array(n).map(() => Math.floor(Math.pow(rnd(), 1 + skew) * alpha));
  const r = H.analyse(b), s = H.summary(r.checks);
  ok(s.fail === 0, "random " + t + ": " + s.text);
  ok(r.L >= r.H - 1e-12 && (r.k < 2 || r.L < r.H + 1), "bounds " + t);
  ok(r.altBits === r.bits.length, "tie-break " + t);
  maxL = Math.max(maxL, r.L - r.H);
}
// 3. brute-force optimality for tiny cases: no prefix code with lengths from Kraft-feasible vectors beats Huffman
for (let t = 0; t < 300; t++) {
  const k = 2 + Math.floor(rnd() * 4), w = Array.from({ length: k }, () => 1 + Math.floor(rnd() * 12));
  const counts = new Array(256).fill(0); w.forEach((x, i) => counts[i] = x);
  const built = H.build(counts, "old"), codes = H.codesOf(built.root);
  let hb = 0; w.forEach((x, i) => hb += x * codes[i].length);
  let best = Infinity;
  (function rec(i, lens) { if (i === k) { let s = 0; lens.forEach(l => s += Math.pow(2, -l)); if (s <= 1 + 1e-12) { let c = 0; lens.forEach((l, j) => c += l * w[j]); best = Math.min(best, c); } return; }
    for (let l = 1; l <= k; l++) rec(i + 1, lens.concat(l)); })(0, []);
  ok(hb === best, "optimal " + t + ": " + hb + " vs " + best);
}
console.log(runs + " assertions, " + fails + " failed; largest L - H over random inputs " + maxL.toFixed(4));
process.exit(fails ? 1 : 0);
