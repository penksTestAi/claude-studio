// node baserate/test.mjs : checks the model in core.js (exact fractions against simulation) and the page's opening sentence.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const B = createRequire(import.meta.url)('./core.js');
let fails = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { fails++; console.log('FAIL', msg); } };

// 1. Worked example by hand: 1% / 90% / 90% -> 1/12 after one positive, 9/20 after two independent ones.
{
  const e = B.exact({ P: 10, S: 900, C: 900, R: 0 });
  ok(B.eq(e.ppv[1], B.F(1, 12)), 'worked example 1/12');
  ok(B.eq(e.ppv[2], B.F(9, 20)), 'worked example 9/20');
}
// 2. Two exact routes agree on 3000 random settings (including the corners).
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const settings = [{ P: 1, S: 0, C: 0, R: 0 }, { P: 999, S: 1000, C: 1000, R: 100 }, { P: 1, S: 1000, C: 1000, R: 0 }, { P: 500, S: 500, C: 500, R: 100 }];
for (let i = 0; i < 3000; i++) settings.push({ P: ri(1, 999), S: ri(0, 1000), C: ri(0, 1000), R: ri(0, 100) });
for (const q of settings) {
  const e = B.exact(q), sb = B.sequentialBayes(q);
  for (let k = 0; k <= B.MAXK; k++) ok(B.eq(e.ppv[k], sb[k]), 'routes differ ' + JSON.stringify(q) + ' k=' + k);
}
// 3. Determinism and variation of seeded crowds.
{
  const q = { P: 10, S: 900, C: 900, R: 0 };
  const a = B.simulate(q, 42), b = B.simulate(q, 42), c = B.simulate(q, 43);
  ok(a.reach.every((v, i) => v === b.reach[i] && a.sick[i] === b.sick[i]), 'same seed, same crowd');
  ok(a.reach.some((v, i) => v !== c.reach[i]), 'different seed, different crowd');
  ok(JSON.stringify(a.tp) === JSON.stringify(b.tp), 'same counts');
  ok(a.tp[0] + a.fp[0] === B.N, 'crowd size');
}
// 4. Simulation against exact fractions, 400 crowds each, five settings, three seed bases (|z| < 4.5 for every total).
const cases = [{ P: 10, S: 900, C: 900, R: 0 }, { P: 1, S: 990, C: 990, R: 0 }, { P: 200, S: 900, C: 900, R: 50 }, { P: 50, S: 700, C: 990, R: 100 }, { P: 500, S: 1000, C: 600, R: 20 }];
let worst = 0;
for (const q of cases) for (const s0 of [1000, 5000, 77777]) {
  const M = 400, r = B.repeat(q, s0, M, 0, M), e = B.exact(q);
  for (const z of B.zscores(r.tot, M, e)) { worst = Math.max(worst, Math.abs(z.z)); ok(B.zpass(z), 'z ' + JSON.stringify(q) + ' s0=' + s0 + ' k=' + z.k + z.which + ' z=' + z.z.toFixed(2)); }
  const pooled = r.tot.tp[1] / (r.tot.tp[1] + r.tot.fp[1]);
  ok(Math.abs(pooled - B.num(e.ppv[1])) < 0.01, 'pooled share ' + JSON.stringify(q));
}
// 5. Edge cases in the simulation.
{
  const c = B.simulate({ P: 100, S: 1000, C: 1000, R: 0 }, 9);
  ok(c.fp.slice(1).every(v => v === 0) && c.tp[1] === c.tp[0], 'perfect test');
  const d = B.simulate({ P: 100, S: 800, C: 800, R: 100 }, 9);
  ok(d.tp[1] === d.tp[4] && d.fp[1] === d.fp[4], 'full repeat means retests add nothing');
}
// 6. Opening sentence of the page: at most 25 words.
{
  const html = readFileSync(path.join(here, 'index.html'), 'utf8');
  const m = html.match(/<p class="lede"[^>]*>([^<]*)<\/p>/);
  const words = m ? m[1].trim().split(/\s+/).length : 999;
  ok(words <= 25, 'lede has ' + words + ' words'); console.log('lede words:', words);
}
console.log(`${n - fails}/${n} checks passed; worst |z| = ${worst.toFixed(2)}`);
process.exit(fails ? 1 : 0);
