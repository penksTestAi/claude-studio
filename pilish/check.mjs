// Run: node pilish/check.mjs   (same checks as the page, in Node)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const D = require('./digits.js'), P = require('./poems.js');
let fail = 0;
const N = 300, dig = { pi: D.pi(N), e: D.e(N), sqrt2: D.sqrt2(N) };
for (const k of Object.keys(P.listB)) {
  const ok = dig[k].startsWith(P.listB[k]); if (!ok) fail++;
  console.log(`spigot ${k} vs list B (${P.listB[k].length} digits):`, ok ? 'agree' : 'DIFFER');
}
if (dig.pi.length !== N || dig.e.length !== N || dig.sqrt2.length !== N) { fail++; console.log('wrong digit counts'); }
let words = 0;
for (const p of P.poems) {
  const ws = p.lines.join('\n').match(/[A-Za-z]+/g);
  let bad = 0;
  ws.forEach((w, i) => { const d = dig[p.constant][p.start - 1 + i]; const want = d === '0' ? 10 : +d; if (w.length !== want) { bad++; console.log('  MISMATCH', p.title, i + 1, w, w.length, 'wanted', want); } });
  words += ws.length; fail += bad;
  console.log(`${p.title}: ${ws.length} words, ${bad} mismatches`);
}
const broken = P.poems[0].lines.join('\n').replace('moonlight', 'moon').match(/[A-Za-z]+/g);
const bm = broken.filter((w, i) => w.length !== (dig.pi[i] === '0' ? 10 : +dig.pi[i])).length;
console.log('deliberate error caught:', bm > 0, `(${bm} mismatches)`); if (!bm) fail++;
console.log(words, 'words;', fail ? 'FAIL' : 'all pass'); process.exit(fail ? 1 : 0);
