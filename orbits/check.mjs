// Run every check the page runs, in Node, and print one line per check. Exit code 1 if any check that should pass does not.
// Usage: node check.mjs            (from this folder or the studio root: node orbits/check.mjs)
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const O = require('./orbit.js'), C = require('./checks.js');
const Astronomy = require('./vendor/astronomy-engine-2.1.19.min.js');
const srcA = JSON.parse(readFileSync(new URL('./data/source-a.json', import.meta.url), 'utf8'));
const A = n => parseFloat(srcA.rows.find(r => r.planet === n).a_1e6km) * 1e9;   // 10^6 km -> m
const res = C.runAll({ Astronomy, sourceA: srcA, rEarthM: A('Earth'), rMarsM: A('Mars') });

let bad = 0, flagged = 0;
for (const c of res.checks) {
  const isPlanet = c.group.startsWith('planets');
  const tag = c.pass ? 'ok  ' : isPlanet ? 'DIFF' : 'FAIL';
  if (!c.pass) { if (isPlanet) flagged++; else bad++; }
  console.log(tag, c.id.padEnd(48), 'value', C.fmt(c.value, 3).padStart(9), 'tol', C.fmt(c.tol, 2).padStart(8), '|', c.detail);
}
// Page text rules: the opening sentence is at most 25 words
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const lede = (html.match(/<p class="lede">([\s\S]*?)<\/p>/) || [])[1];
if (lede) {
  const words = lede.replace(/<[^>]+>/g, '').trim().split(/\s+/).length;
  console.log(words <= 25 ? 'ok  ' : 'FAIL', 'lede word count', words, '(max 25)');
  if (words > 25) bad++;
} else { console.log('FAIL no <p class="lede"> found'); bad++; }
console.log(`\n${res.checks.length} checks; ${res.checks.filter(c => c.pass).length} pass; ${bad} unexpected failures; ${flagged} planetary disagreements flagged`);
const names = id => res.checks.filter(c => !c.pass && c.id.startsWith(id)).map(c => c.id.split(':')[2]);
console.log('A against B, axis differs:', names('pl:a:').join(', ') || 'none');
console.log('A against B, period differs:', names('pl:T:').join(', ') || 'none');
console.log("Kepler III inside A differs:", names('pl:kA:').join(', ') || 'none', '| inside B:', names('pl:kB:').join(', ') || 'none');
process.exit(bad ? 1 : 0);
