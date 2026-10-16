// node dilemma/test.mjs : checks core.js (scoring, seeding, strategies, tournament) and the page's opening sentence.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const D = createRequire(import.meta.url)('./core.js');
let fails = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { fails++; console.log('FAIL', msg); } };
const by = (id) => D.BUILTIN.find((s) => s.id === id);
const play = (a, b, rounds, noise = 0, seed = 'x') => D.playMatch(a, b, rounds, noise, seed);

// 1. The payoffs are a dilemma, and the page uses the usual 5, 3, 1, 0.
ok(D.PAY.T === 5 && D.PAY.R === 3 && D.PAY.P === 1 && D.PAY.S === 0, 'payoffs 5/3/1/0');
ok(D.isDilemma(), 'T > R > P > S and 2R > T + S');
ok(D.payoff(1, 1) === 3 && D.payoff(1, 0) === 0 && D.payoff(0, 1) === 5 && D.payoff(0, 0) === 1, 'payoff table');

// 2. Hand-worked matches (worked on paper from the rules, then compared with the code).
{
  let m = play(by('tft'), by('alld'), 10);          // C D D D ... : 0 + 9 x 1 = 9 ; 5 + 9 x 1 = 14
  ok(m.sa === 9 && m.sb === 14, 'TFT v AllD, 10 rounds: 9 v 14, got ' + m.sa + ' v ' + m.sb);
  ok(m.a === 'CDDDDDDDDD' && m.b === 'DDDDDDDDDD', 'TFT v AllD log');
  m = play(by('tft'), by('tft'), 200); ok(m.sa === 600 && m.sb === 600, 'TFT v TFT 200: 600 each');
  m = play(by('alld'), by('alld'), 200); ok(m.sa === 200 && m.sb === 200, 'AllD v AllD 200: 200 each');
  m = play(by('allc'), by('alld'), 10); ok(m.sa === 0 && m.sb === 50, 'AllC v AllD 10: 0 v 50');
  m = play(by('grudger'), by('alld'), 10); ok(m.sa === 9 && m.sb === 14, 'Grudger v AllD 10: 9 v 14');
  m = play(by('grudger'), by('tft'), 200); ok(m.sa === 600 && m.sb === 600, 'Grudger v TFT 200: 600 each');
  m = play(by('pavlov'), by('alld'), 10);            // C D C D ... v D x 10: Pavlov 0,1,0,1,... = 5 ; AllD 5,1,5,1,... = 30
  ok(m.a === 'CDCDCDCDCD' && m.sa === 5 && m.sb === 30, 'Pavlov v AllD 10: 5 v 30, got ' + m.sa + ' v ' + m.sb);
  m = play(by('tf2t'), by('alld'), 10);              // C C D x 8 : 0 + 0 + 8 = 8 ; 5 + 5 + 8 = 18
  ok(m.sa === 8 && m.sb === 18, 'TF2T v AllD 10: 8 v 18, got ' + m.sa + ' v ' + m.sb);
  m = play(by('pavlov'), by('pavlov'), 200); ok(m.sa === 600, 'Pavlov v Pavlov 200: 600');
  // general formulas for any length
  for (const r of [1, 2, 3, 10, 57, 200, 500]) {
    m = play(by('tft'), by('alld'), r);
    ok(m.sa === (r - 1) * D.PAY.P + D.PAY.S && m.sb === D.PAY.T + (r - 1) * D.PAY.P, 'TFT v AllD formula at ' + r);
  }
}

// 3. Second scorer agrees with the first on every match of many random tournaments, with and without noise.
{
  const rnd = D.mulberry32(99);
  let matches = 0, rounds = 0;
  const all = D.BUILTIN.concat([D.makeCustom('u1', 'Mine', { first: 0, p: [0.9, 0.2, 0.6, 0.1], grudge: 3 })]);
  for (let k = 0; k < 60; k++) {
    const o = { rounds: 1 + Math.floor(rnd() * 300), noise: [0, 0.01, 0.05, 0.1][k % 4], selfPlay: k % 3 !== 0, seed: 's' + k };
    const t = D.tournament(all, o);
    const tot2 = all.map(() => 0);
    for (const m of t.matches) {
      const r = D.rescore(m.a, m.b);
      ok(r.a === m.sa && r.b === m.sb, 'rescore differs in tournament ' + k);
      ok(m.a.length === o.rounds && m.b.length === o.rounds, 'log length');
      ok(m.sa + m.sb <= 2 * D.PAY.R * o.rounds, 'pair total over 2R per round');
      ok(m.sa >= D.PAY.S * o.rounds && m.sa <= D.PAY.T * o.rounds, 'score bounds');
      if (m.i === m.j) { tot2[m.i] += (r.a + r.b) / 2; } else { tot2[m.i] += r.a; tot2[m.j] += r.b; }
      matches++; rounds += o.rounds;
    }
    ok(t.totals.every((v, i) => v === tot2[i]), 'totals from logs, tournament ' + k);
    const nm = all.length * (all.length - 1) / 2 + (o.selfPlay ? all.length : 0);
    ok(t.matches.length === nm, 'match count ' + t.matches.length + ' v ' + nm);
    ok(t.wins.reduce((a, b) => a + b, 0) === t.losses.reduce((a, b) => a + b, 0), 'wins = losses');
    ok(t.wins.every((w, i) => w + t.ties[i] + t.losses[i] === all.length - 1), 'W+T+L = opponents');
  }
  console.log('rescored', matches, 'matches,', rounds, 'rounds');
}

// 4. Same seed, same tournament; a different seed changes a Random player's total.
{
  const o = { rounds: 200, noise: 0.02, selfPlay: true, seed: 'a' };
  const t1 = D.tournament(D.BUILTIN, o), t2 = D.tournament(D.BUILTIN, o);
  ok(JSON.stringify(t1.totals) === JSON.stringify(t2.totals) && t1.matches.every((m, i) => m.a === t2.matches[i].a && m.b === t2.matches[i].b), 'same seed, same logs');
  let differs = 0;
  for (let k = 0; k < 10; k++) { const t3 = D.tournament(D.BUILTIN, { ...o, seed: 'b' + k }); if (t3.totals[4] !== t1.totals[4]) differs++; }
  ok(differs >= 9, 'Random total changes with the seed, ' + differs + ' of 10');
  // a pair's match does not depend on what else is in the field
  const small = D.tournament([by('tft'), by('random')], o), big = D.tournament(D.BUILTIN, o);
  const mSmall = small.matches.find((m) => m.i === 0 && m.j === 1), mBig = big.matches.find((m) => m.i === 0 && m.j === 4);
  ok(mSmall.a === mBig.a && mSmall.b === mBig.b, 'pair result independent of the field');
}

// 5. A strategy built from a table behaves exactly like the built-in it is set to copy, against every opponent.
{
  let compared = 0;
  const opp = D.BUILTIN.concat([D.makeCustom('u9', 'Odd', { first: 1, p: [0.5, 0.3, 0.7, 0.2], grudge: 0 })]);
  for (const id of Object.keys(D.TWIN_TABLES)) {
    const twin = D.makeCustom('t-' + id, 'Twin of ' + id, D.TWIN_TABLES[id]);
    for (const noise of [0, 0.05]) for (const o of opp) {
      const a = play(by(id), o, 200, noise, 'tw|' + id + '|' + o.id), b = play(twin, o, 200, noise, 'tw|' + id + '|' + o.id);
      ok(a.a === b.a && a.b === b.b && a.sa === b.sa, 'twin of ' + id + ' v ' + o.id + ' noise ' + noise);
      compared++;
    }
  }
  console.log('twin comparisons', compared);
}

// 6. Random v Always Defect: Random scores 0.5 a round, Always Defect 3.0 a round (400 matches of 200 rounds).
{
  let sr = 0, sd = 0;
  for (let k = 0; k < 400; k++) { const m = play(by('random'), by('alld'), 200, 0, 'rd' + k); sr += m.sa; sd += m.sb; }
  const mr = sr / (400 * 200), md = sd / (400 * 200);
  ok(Math.abs(mr - 0.5) < 0.01, 'Random per round ' + mr);
  ok(Math.abs(md - 3.0) < 0.05, 'AllD per round ' + md);
}

// 7. Noise flips about the chosen share of moves.
for (const q of [0.01, 0.05, 0.1]) {
  let flips = 0, total = 0;
  for (let k = 0; k < 200; k++) { const m = play(by('allc'), by('allc'), 200, q, 'nz' + k); flips += m.flips; total += 400; }
  const sd = Math.sqrt(total * q * (1 - q));
  ok(Math.abs(flips - total * q) < 5 * sd, 'flip rate at ' + q + ': ' + flips + ' of ' + total);
  ok(play(by('allc'), by('allc'), 200, 0, 'z').flips === 0, 'no noise, no flips');
}

// 8. Ranking handles ties and repeats counts make sense.
{
  const t = D.tournament([by('tft'), by('grudger'), by('alld')], { rounds: 50, noise: 0, selfPlay: true, seed: 'r' });
  const r = D.ranking(t);
  ok(r[0].rank === 1 && r.every((x, k) => k === 0 || x.total <= r[k - 1].total), 'ranking order');
  ok(r.filter((x) => x.rank === 1).length === 2 && r[2].rank === 3, 'tied top shares rank 1, next is 3');
  const rp = D.repeats(D.BUILTIN, { rounds: 100, noise: 0.03, selfPlay: true, seed: 'q' }, 40);
  ok(rp.reps === 40 && rp.first.every((v) => v >= 0 && v <= 40) && rp.first.reduce((a, b) => a + b, 0) >= 40, 'repeats: someone is first in each');
}

// 9. The page's opening sentence is at most 25 words.
{
  const html = readFileSync(path.join(here, 'index.html'), 'utf8');
  const m = html.match(/<p class="lede"[^>]*>([\s\S]*?)<\/p>/);
  ok(!!m, 'lede found');
  if (m) { const words = m[1].replace(/<[^>]+>/g, '').trim().split(/\s+/).length; ok(words <= 25, 'lede has ' + words + ' words'); console.log('lede words', words); }
}

console.log(n + ' checks, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
