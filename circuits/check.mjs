#!/usr/bin/env node
// Checks for the circuits page. Run from anywhere:  node circuits/check.mjs [--seed0 N] [--count N]
// Runs the same checks the page runs on load, with more draws, plus a few extras. Exits 1 on any failure.
// Written by Claude, an AI model.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const require = createRequire(import.meta.url);
const C = require(path.join(path.dirname(fileURLToPath(import.meta.url)), "circuit-core.js"));
const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? Number(args[args.indexOf(k) + 1]) : d);
const seed0 = arg("--seed0", 1000), count = arg("--count", 24);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok    " + m); } else { fail++; console.log("FAIL  " + m); } };

const t0 = Date.now();
for (const r of C.runChecks(seed0, { count })) ok(r.pass, `[${r.group}] ${r.text}${r.note ? " -- " + r.note : ""}`);

// extras (not on the page)
ok(C.parseValue("4.7k").eq(C.fr(4700)) && C.parseValue("100u").eq(C.fr(1, 10000)) && C.parseValue("1e-6").eq(C.fr(1, 1000000)) && C.parseValue("2.5M").eq(C.fr(2500000)), "values parse exactly: 4.7k, 100u, 1e-6, 2.5M");
ok(C.parseValue("1x") === null && C.parseValue("") === null, "bad values are refused");
ok(C.frFromNumber(0.1).toNumber() === 0.1 && C.frFromNumber(-3).eq(C.fr(-3)), "double to fraction round-trips");
{ // a hand-solved bridge with an unbalanced middle resistor (values chosen so every answer is a small fraction)
  const n = C.parse("V1 a 0 10\nR1 a b 1\nR2 b 0 2\nR3 a c 3\nR4 c 0 3\nR5 b c 1"), s = C.solveDC(n, "open");
  const rs = C.residuals(n, s);
  ok(s.ok && rs.kcl.isZero() && rs.tellegen.isZero(), "unbalanced bridge: exact KCL and power balance");
  // by hand: node b: 10 = 2.5 b - c ; node c: 3 b - 5 c = -10  =>  b = 120/19, c = 110/19
  ok(s.ok && s.v.b.toString() === "120/19" && s.v.c.toString() === "110/19", "unbalanced bridge node voltages equal the hand-solved 120/19 and 110/19 V");
}
{ // bad netlists
  const bad = ["", "R1 a 0", "R1 a 0 0", "C1 a 0 -1u", "X1 a 0 5", "R1 a a 5", "V1 a 0 5\nV1 b 0 5", "R1 a b 5", "C1 a 0 1u v0=x"];
  const refused = bad.filter((t) => C.parse(t).errors.length).length;
  ok(refused === bad.length, `${refused} of ${bad.length} malformed netlists are refused`);
}
{ // first-run determinism: same seed, same answer
  const a = C.runChecks(seed0, { count: 4 }).map((r) => r.text + r.pass).join("|"), b = C.runChecks(seed0, { count: 4 }).map((r) => r.text + r.pass).join("|");
  ok(a === b, "same seed gives the same checks and results");
}
console.log(`\n${pass} passed, ${fail} failed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(fail ? 1 : 0);
