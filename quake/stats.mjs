// Seeded checks of the engine under node: node quake/stats.mjs
import { createRequire } from 'node:module';
const Q = createRequire(import.meta.url)('./engine.js');
const st = Q.STATIONS, sig = [0.1, 0.2, 0.4, 0.8, 1.6];
let maxRound = 0, bad = 0, nQ = 300;
for (let s = 1; s <= nQ; s++) {
  const q = Q.makeQuake(s), k = Q.kfac(Q.VP, Q.VS);
  const p = Q.locate(st, Q.radii(Q.trueGaps(q, st, Q.VP, Q.VS), k));
  const e = Q.dist(p, q); maxRound = Math.max(maxRound, e); if (e > 1e-4) bad++;
}
console.log('round trip: quakes', nQ, 'max error km', maxRound, 'over 0.1 m:', bad);
// noise growth across many quake positions
const agg = sig.map(() => []);
for (let s = 1; s <= 40; s++) {
  const q = Q.makeQuake(s), zs = Q.zsets(s, 400, 3);
  sig.forEach((g, i) => { const m = Q.summary(Q.scatter(q, st, Q.VP, Q.VS, g, zs)); agg[i].push(m); });
}
sig.forEach((g, i) => {
  const r = agg[i].map(m => m.r90).sort((a, b) => a - b);
  console.log('sigma', g, 'r90 over 40 quakes: min', r[0].toFixed(2), 'median', r[20].toFixed(2), 'max', r[39].toFixed(2));
});
let mono = 0;
for (let s = 0; s < 40; s++) { let ok = true; for (let i = 1; i < sig.length; i++) if (agg[i][s].area <= agg[i - 1][s].area) ok = false; if (ok) mono++; }
console.log('quakes where area grows at every sigma step:', mono, 'of 40');
const sl = []; for (let s = 0; s < 40; s++) sl.push(Q.slope(sig, agg.map(a => a[s].area)));
sl.sort((a, b) => a - b); console.log('log-log slope of area vs sigma: min', sl[0].toFixed(2), 'median', sl[20].toFixed(2), 'max', sl[39].toFixed(2));
// page quake
const q = Q.makeQuake(Q.SEED); console.log('page quake', q);
// ratio drill
for (const r of [0.583, 0.7, 0.8, 0.9, 0.95, 0.99]) {
  const vs = 6 * r, k = Q.kfac(6, vs), m = Q.summary(Q.scatter(q, st, 6, vs, 0.2, Q.zsets(1, 400, 3)));
  console.log('vs/vp', r, 'k', k.toFixed(1), 'r90', m.r90.toFixed(2));
}
