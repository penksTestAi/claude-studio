#!/usr/bin/env node
// Checks for the queue page. Run from anywhere:  node queues/check.mjs [--seed0 N]
// Exits 1 if any check fails. Written by Claude, an AI model.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const require = createRequire(import.meta.url);
const Q = require(path.join(path.dirname(fileURLToPath(import.meta.url)), "queue-core.js"));
const args = process.argv.slice(2);
const seed0 = args.includes("--seed0") ? Number(args[args.indexOf("--seed0") + 1]) : 1000;
const Z_LIMIT = Q.Z_LIMIT;  // |z| above this counts as disagreement (z = (simulation mean - formula) / standard error over seeds)
let fails = 0, passes = 0;
function ok(cond, msg) { if (cond) { passes++; console.log("ok    " + msg); } else { fails++; console.log("FAIL  " + msg); } }
const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

// 1. Erlang C against a direct factorial-sum formula written separately here.
function erlangCDirect(c, a) {
  let term = 1, sum = 0;                              // term = a^k / k!
  for (let k = 0; k < c; k++) { sum += term; term *= a / (k + 1); }
  const top = term / (1 - a / c);                     // term is now a^c / c!
  return top / (sum + top);
}
let worst = 0;
for (const c of [1, 2, 3, 5, 8, 12]) for (const rho of [0.1, 0.5, 0.8, 0.95]) {
  const a = rho * c; worst = Math.max(worst, Math.abs(Q.erlangC(c, a) - erlangCDirect(c, a)));
}
ok(worst < 1e-12, `Erlang C by recursion equals the direct factorial sum on 24 cases (largest difference ${worst.toExponential(1)})`);
ok(close(Q.erlangC(1, 0.7), 0.7), "Erlang C with one server equals the load (M/M/1: chance of waiting = rho)");
ok(close(Q.mmc(0.4, 0.5, 1).Wq, 0.8 / (0.5 - 0.4)), "M/M/1 mean wait equals rho / (mu - lambda)");
ok(Q.mmc(1, 0.5, 2).stable === false && Q.erlangC(2, 2) === null, "load of exactly 1 and above gives no steady-state answer");
ok(close(Q.mg1Wq(0.4, 0.5, 1), Q.mm1(0.4, 0.5).Wq), "Pollaczek-Khinchine with cv2 = 1 equals M/M/1");
ok(close(Q.mg1Wq(0.4, 0.5, 0), Q.mm1(0.4, 0.5).Wq / 2), "Pollaczek-Khinchine with constant service gives half the M/M/1 wait");

// 2. Streams: same seed same numbers; service shapes have the mean and squared variation they claim.
const a1 = Q.makeStream(5, 100, 1, 0.5, "exponential"), a2 = Q.makeStream(5, 100, 1, 0.5, "exponential");
ok(a1.arr.every((v, i) => v === a2.arr[i]) && a1.svc.every((v, i) => v === a2.svc[i]), "same seed gives the same customers");
for (const shape of Object.keys(Q.SHAPES)) {
  const means = [], cv2s = [];
  for (let s = 0; s < 20; s++) {
    const st = Q.makeStream(s, 20000, 1, 0.4, shape); let m = 0, q = 0;
    for (const x of st.svc) m += x; m /= st.n; for (const x of st.svc) q += (x - m) * (x - m); q /= st.n;
    means.push(m * 0.4); cv2s.push(q / (m * m));
  }
  const sm = Q.summarise(means), sc = Q.summarise(cv2s), want = Q.SHAPES[shape].cv2;
  ok(Math.abs(sm.mean - 1) < 4 * sm.se + 1e-12, `${shape} service: mean service time is 1/mu (measured ${sm.mean.toFixed(4)} of 1)`);
  ok(Math.abs(sc.mean - want) < 4 * sc.se + 1e-9, `${shape} service: squared variation ${sc.mean.toFixed(3)} against ${want}`);
}

// 3. The shared line against a different algorithm (event list with an explicit queue).
function sharedByEvents(st, c) {
  const start = new Float64Array(st.n), queue = []; const busyUntil = [];
  let next = 0, qh = 0;
  while (next < st.n || qh < queue.length || busyUntil.length) {
    let mi = -1; for (let i = 0; i < busyUntil.length; i++) if (mi < 0 || busyUntil[i] < busyUntil[mi]) mi = i;
    const tA = next < st.n ? st.arr[next] : Infinity, tD = mi >= 0 ? busyUntil[mi] : Infinity;
    if (tA <= tD) {
      if (busyUntil.length < c) { start[next] = tA; busyUntil.push(tA + st.svc[next]); } else queue.push(next);
      next++;
    } else {
      busyUntil.splice(mi, 1);
      if (qh < queue.length) { const k = queue[qh++]; start[k] = tD; busyUntil.push(tD + st.svc[k]); }
    }
  }
  return start;
}
for (const [c, shape] of [[1, "exponential"], [3, "bursty"], [6, "constant"]]) {
  const st = Q.makeStream(11, 3000, c * 0.45, 0.5, shape), a = Q.simShared(st, c).start, b = sharedByEvents(st, c);
  let d = 0; for (let k = 0; k < st.n; k++) d = Math.max(d, Math.abs(a[k] - b[k]));
  ok(d < 1e-9, `shared line, c = ${c}, ${shape}: start times equal an event-list simulation on 3000 customers (largest difference ${d.toExponential(1)})`);
}

// 4. Separate lines: each line is first-come first-served and the "shortest" rule really picks a shortest line.
{
  const c = 4, st = Q.makeStream(21, 600, 1.7, 0.5, "exponential"), r = Q.simSeparate(st, c, "shortest", 21);
  let fifoOK = true, shortOK = true; const lastEnd = new Float64Array(c);
  for (let k = 0; k < st.n; k++) {
    const l = r.line[k]; if (Math.abs(r.start[k] - Math.max(st.arr[k], lastEnd[l])) > 1e-9) fifoOK = false;
    lastEnd[l] = r.start[k] + st.svc[k];
    const cnt = new Array(c).fill(0);
    for (let j = 0; j < k; j++) if (r.start[j] + st.svc[j] > st.arr[k]) cnt[r.line[j]]++;
    if (cnt[l] !== Math.min(...cnt)) shortOK = false;
  }
  ok(fifoOK, "separate lines: every customer starts at max(arrival, end of the previous customer in the same line)");
  ok(shortOK, "shortest-line rule: on 600 arrivals the chosen line always had the fewest people (counted by brute force)");
}

// 5. Counting rules against brute force, and the shared line never lets anyone be overtaken.
{
  const c = 3, st = Q.makeStream(31, 500, 1.3, 0.5, "exponential");
  for (const [name, res] of [["shared", Q.simShared(st, c)], ["shortest", Q.simSeparate(st, c, "shortest", 31)], ["random", Q.simSeparate(st, c, "random", 31)]]) {
    let over = 0, pairs = 0, pairOver = 0;
    for (let k = 0; k < 300; k++) {
      let hit = false;
      for (let j = k + 1; j < st.n; j++) {
        if (st.arr[j] < res.start[k]) {
          if (res.start[j] < res.start[k]) hit = true;
          if (res.separate && res.line[j] !== res.line[k]) { pairs++; if (res.start[j] < res.start[k]) pairOver++; }
        }
      }
      if (hit) over++;
    }
    const s = Q.scan(st, res, 0, 300);
    ok(s.overtaken === over && s.pairs === pairs && s.pairOver === pairOver, `${name}: overtaken count (${over}) and pair counts (${pairOver} of ${pairs}) equal a brute-force count`);
    if (name === "shared") ok(over === 0, "shared line: nobody is overtaken (first come, first served)");
  }
}

// 6. Little's law as an identity of the bookkeeping, also where the formulas stop applying.
{
  let worstGap = 0, runs = 0;
  for (const shape of Object.keys(Q.SHAPES)) for (const rho of [0.3, 0.9, 1.0, 1.5]) for (const c of [1, 3]) {
    const p = { lambda: rho * c * 0.5, mu: 0.5, c, shape, N: 800, warm: 100 };
    const out = Q.runOne(p, 7);
    for (const k of Object.keys(out)) { worstGap = Math.max(worstGap, out[k].little.gap); runs++; }
  }
  ok(worstGap < 1e-9, `Little's law L = lambda W holds to ${worstGap.toExponential(1)} in ${runs} runs (3 shapes, loads 0.3 to 1.5, 1 and 3 tills, all three systems), including loads above 1`);
}

// 7. Simulation against the closed forms, over many seeds.
function over(p, R, base) {
  const list = []; for (let i = 0; i < R; i++) list.push(Q.runOne(p, base + i)); return list;
}
const col = (list, sys, key) => Q.summarise(list.map(o => o[sys][key]));
const R = 24, N = 20000, warm = 3000, mu = 0.5;
let nCmp = 0, nAgree = 0; const bad = [];
function cmp(label, s, theory) {
  const z = (s.mean - theory) / s.se; nCmp++;
  if (Math.abs(z) <= Z_LIMIT) nAgree++; else bad.push(`${label}: simulation ${s.mean.toFixed(4)} vs formula ${theory.toFixed(4)} (z = ${z.toFixed(1)})`);
}
for (const c of [1, 2, 4, 8]) for (const rho of [0.5, 0.8, 0.9]) {
  const lambda = rho * c * mu, p = { lambda, mu, c, shape: "exponential", N, warm }, list = over(p, R, seed0);
  const th = Q.mmc(lambda, mu, c);
  cmp(`c=${c} rho=${rho} shared mean wait vs Erlang C`, col(list, "shared", "meanWait"), th.Wq);
  cmp(`c=${c} rho=${rho} shared chance of waiting vs Erlang C`, col(list, "shared", "pWait"), th.C);
  cmp(`c=${c} rho=${rho} shared mean time in shop vs Wq + 1/mu`, col(list, "shared", "meanSojourn"), th.W);
  const m1 = Q.mm1(lambda / c, mu);
  cmp(`c=${c} rho=${rho} random lines mean wait vs M/M/1 at lambda/c`, col(list, "random", "meanWait"), m1.Wq);
}
ok(bad.length === 0, `closed forms vs simulation: ${nAgree} of ${nCmp} comparisons within ${Z_LIMIT} standard errors (24 seeds of 20000 customers each, first seed ${seed0})`);
for (const b of bad) console.log("      " + b);

// 8. Where the formulas stop: other service shapes, and the line-choice habit that has no formula.
{
  const c = 4, rho = 0.8, lambda = rho * c * mu;
  for (const shape of ["constant", "bursty"]) {
    const list = over({ lambda, mu, c, shape, N, warm }, R, seed0), cv2 = Q.SHAPES[shape].cv2;
    const wrong = Q.mmc(lambda, mu, c).Wq, s = col(list, "shared", "meanWait");
    ok(Math.abs(s.mean - wrong) > Z_LIMIT * s.se, `${shape} service: Erlang C is off (simulation ${s.mean.toFixed(3)}, Erlang C ${wrong.toFixed(3)}), as the page says`);
    const sr = col(list, "random", "meanWait"), pk = Q.mg1Wq(lambda / c, mu, cv2);
    ok(Math.abs(sr.mean - pk) <= Z_LIMIT * sr.se, `${shape} service, random lines: simulation ${sr.mean.toFixed(3)} agrees with Pollaczek-Khinchine ${pk.toFixed(3)}`);
  }
  const p = { lambda, mu, c, shape: "exponential", N, warm }, list = over(p, R, seed0);
  const d = list.filter(o => o.shared.meanWait < o.shortest.meanWait).length;
  ok(d === R, `shared beats shortest-line on mean wait in ${d} of ${R} seeds at c = 4, load 0.8 (chance range ${Q.binomRange(R, 0.5).join(" to ")})`);
}

// 9. Overload: the formulas give nothing, the simulated wait keeps growing with the run length.
{
  const c = 2, lambda = 1.2 * c * mu, means = [];
  for (const N2 of [500, 2000, 8000]) {
    const l = over({ lambda, mu, c, shape: "exponential", N: N2, warm: 0 }, 12, seed0); means.push(col(l, "shared", "meanWait").mean);
  }
  ok(means[0] < means[1] && means[1] < means[2], `load 1.2: mean wait grows with run length (${means.map(x => x.toFixed(1)).join(", ")} minutes for 500, 2000, 8000 customers)`);
  const f = Q.fluidMeanWait(lambda, mu, c, 8000);
  ok(Math.abs(means[2] - f) / f < 0.1, `load 1.2: the simple fluid estimate ${f.toFixed(1)} is within 10% of the simulated ${means[2].toFixed(1)} at 8000 customers`);
}

// 9b. The lighter run used by the page's formula grid gives the same numbers as the full run.
{
  const p = { lambda: 1.6, mu: 0.5, c: 4, shape: "bursty", N: 2000, warm: 300 }, f = Q.runOne(p, 9), q = Q.runQuick(p, 9);
  const same = ["shared", "random"].every(s => ["meanWait", "meanSojourn", "pWait"].every(k => close(f[s][k], q[s][k])));
  ok(same, "runQuick (page grid) equals runOne on mean wait, mean time in shop and chance of waiting");
}

// 10. Reproducibility of a whole run.
{
  const p = { lambda: 1.6, mu: 0.5, c: 4, shape: "exponential", N: 2000, warm: 300 };
  ok(JSON.stringify(Q.runOne(p, 3)) === JSON.stringify(Q.runOne(p, 3)), "same seed gives an identical run");
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
