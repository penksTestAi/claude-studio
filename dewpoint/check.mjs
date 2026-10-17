// node dewpoint/check.mjs : prints the check table and exits 1 if a self-check fails.
import { createRequire } from 'node:module';
const D = createRequire(import.meta.url)('./dewpoint-core.js');
let bad = 0;
const rows = D.checkRows();
for (const r of rows) console.log(r.T, r.phase, r.ref.toPrecision(5), (r.errM*100).toFixed(2)+'%', (r.errB*100).toFixed(2)+'%', r.flagM?'M-FLAG':'', r.flagB?'B-FLAG':'');
function ok(c, m) { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); }
ok(rows.length >= 10, rows.length + ' rows (need 10 or more)');
ok(rows.some(r => r.T < 0 && r.phase === 'ice') && rows.some(r => r.T >= 100) && rows.some(r => r.T <= 10 && r.phase === 'water'), 'cold, hot and ice rows present');
// dew point round trip: at RH 100 the dew point is the air temperature
for (const f of ['magnus', 'buck']) for (const T of [-20, 0, 15, 35]) ok(Math.abs(D.dewPoint(T, 100, D[f]) - T) < 1e-6, f + ' dew point at 100% RH equals ' + T);
// monotone: lower humidity, lower dew point
ok(D.dewPoint(25, 40, D.buck) < D.dewPoint(25, 60, D.buck), 'dew point falls with humidity');
// verdict branches
const kinds = new Set([D.verdict(25,60,8,D.buck).kind, D.verdict(25,60,20,D.buck).kind, D.verdict(-5,90,-20,D.buck).kind, D.verdict(-5,90,-1,D.buck).kind]);
ok(['sweat','dry','frost'].every(k => kinds.has(k)), 'sweat, dry and frost branches all fire: ' + [...kinds].join(','));
console.log('dew point 25 C 60%:', D.dewPoint(25,60,D.magnus).toFixed(3), D.dewPoint(25,60,D.buck).toFixed(3));
process.exit(bad ? 1 : 0);
