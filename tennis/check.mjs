#!/usr/bin/env node
// node tennis/check.mjs [--seeds N]
// Runs every check from the page on several settings and seeds, including the best-of-5 Markov chain,
// and counts the lede's words and the simulation flake rate. Exits 1 on any failure.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import T from './tennis-core.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf('--seeds');
const seeds = i > 0 ? +process.argv[i + 1] : 5;
const settings = [[640, 380], [700, 300], [600, 450], [550, 550], [800, 250], [500, 480]];
let total = 0, bad = 0, simRows = 0, maxZ = 0;
for (const [a, r] of settings) {
  for (let s = 1; s <= seeds; s++) {
    const res = T.runChecks(a, r, { n: 6000, seed: 1000 * s + 7 });
    for (const row of res.rows) {
      if (row.weak) continue;
      total++;
      if (row.group === 'sim') { simRows++; maxZ = Math.max(maxZ, Math.abs(row.z)); }
      if (!row.ok) { bad++; console.log('FAIL', a, r, s, row.text); }
    }
  }
}
console.log(`counted rows: ${total}, failures: ${bad}, simulation rows: ${simRows}, largest |z|: ${maxZ.toFixed(2)}`);
// lede words
const html = fs.readFileSync(path.join(here, 'index.html'), 'utf8');
const lede = html.match(/id="lede">([^<]*)</)[1];
const words = lede.trim().split(/\s+/).length;
console.log(`lede: ${words} words`);
if (words > 25) { console.log('FAIL lede too long'); bad++; }
// the relayed figure
const g = T.FRAC.toNumber(T.gameWin(T.FRAC, T.FRAC.fromThousandths(550)));
console.log('game at p=0.55:', g.toFixed(4));
process.exit(bad ? 1 : 0);
