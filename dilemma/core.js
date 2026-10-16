// Iterated prisoner's dilemma: strategies, seeded matches, round-robin tournaments and a second scorer.
// Used by index.html and by test.mjs. A move is 1 (cooperate, C) or 0 (defect, D).
(function (root) {
  'use strict';
  // Payoff to the player for (own move, other's move): temptation T, reward R, punishment P, sucker S.
  const PAY = { T: 5, R: 3, P: 1, S: 0 };
  const payoff = (me, other) => (me ? (other ? PAY.R : PAY.S) : (other ? PAY.T : PAY.P));
  // The conditions that make it a dilemma: T > R > P > S, and 2R > T + S so that taking turns at cheating does not beat
  // steady cooperation.
  const isDilemma = () => PAY.T > PAY.R && PAY.R > PAY.P && PAY.P > PAY.S && 2 * PAY.R > PAY.T + PAY.S;

  function hash32(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const last = (h) => h[h.length - 1];
  const count0 = (h) => { let n = 0; for (let i = 0; i < h.length; i++) if (!h[i]) n++; return n; };

  // A strategy is { id, name, decide(my, opp, r) } where my and opp are arrays of the moves actually played so far
  // (after any noise) and r is a fresh number in [0,1) that every strategy is handed whether it uses it or not.
  const BUILTIN = [
    { id: 'tft', name: 'Tit for Tat', text: 'Cooperates first, then copies what the other did last round.',
      decide: (my, opp) => (opp.length ? last(opp) : 1) },
    { id: 'alld', name: 'Always Defect', text: 'Defects every round.', decide: () => 0 },
    { id: 'allc', name: 'Always Cooperate', text: 'Cooperates every round, whatever happens.', decide: () => 1 },
    { id: 'grudger', name: 'Grudger', text: 'Cooperates until the other defects once, then defects for good.',
      decide: (my, opp) => (count0(opp) > 0 ? 0 : 1) },
    { id: 'random', name: 'Random', text: 'Cooperates or defects with equal chance each round.', decide: (my, opp, r) => (r < 0.5 ? 1 : 0) },
    { id: 'pavlov', name: 'Pavlov', text: 'Cooperates first; afterwards cooperates if both played the same last round, otherwise defects.',
      decide: (my, opp) => (my.length ? (last(my) === last(opp) ? 1 : 0) : 1) },
    { id: 'tf2t', name: 'Tit for Two Tats', text: 'Defects only after the other defected twice in a row.',
      decide: (my, opp) => (opp.length >= 2 && !opp[opp.length - 1] && !opp[opp.length - 2] ? 0 : 1) }
  ];

  // A strategy a visitor builds: a first move, a chance of cooperating after each of the four possible last rounds
  // (I cooperated and they cooperated; I cooperated and they defected; I defected and they cooperated; both defected),
  // and an optional grudge: after the other has defected this many times in all, defect for good (0 means no grudge).
  function makeCustom(id, name, spec) {
    const p = spec.p.slice();
    const first = spec.first ? 1 : 0, grudge = spec.grudge | 0;
    return {
      id, name, custom: true, spec: { first, p, grudge },
      decide(my, opp, r) {
        if (grudge > 0 && count0(opp) >= grudge) return 0;
        if (!my.length) return first;
        const idx = (last(my) ? 0 : 2) + (last(opp) ? 0 : 1); // 0 = CC, 1 = CD, 2 = DC, 3 = DD (mine first)
        return r < p[idx] ? 1 : 0;
      }
    };
  }
  // The tables that make a built custom strategy behave exactly like a built-in one.
  const TWIN_TABLES = {
    tft: { first: 1, p: [1, 0, 1, 0], grudge: 0 },
    pavlov: { first: 1, p: [1, 0, 0, 1], grudge: 0 },
    alld: { first: 0, p: [0, 0, 0, 0], grudge: 0 },
    allc: { first: 1, p: [1, 1, 1, 1], grudge: 0 },
    grudger: { first: 1, p: [1, 1, 1, 1], grudge: 1 }
  };

  // Play one match. Every round draws four numbers in a fixed order (A's r, B's r, A's noise, B's noise), so the stream
  // does not depend on which strategies are playing. With noise q, each intended move is flipped with chance q.
  function playMatch(A, B, rounds, noise, seedStr) {
    const rng = mulberry32(hash32(seedStr));
    const ma = [], mb = [];
    let sa = 0, sb = 0, flips = 0;
    for (let k = 0; k < rounds; k++) {
      const ra = rng(), rb = rng(), na = rng(), nb = rng();
      let a = A.decide(ma, mb, ra) ? 1 : 0, b = B.decide(mb, ma, rb) ? 1 : 0;
      if (na < noise) { a = 1 - a; flips++; }
      if (nb < noise) { b = 1 - b; flips++; }
      ma.push(a); mb.push(b);
      sa += payoff(a, b); sb += payoff(b, a);
    }
    return { a: ma.join('').replace(/1/g, 'C').replace(/0/g, 'D'), b: mb.join('').replace(/1/g, 'C').replace(/0/g, 'D'), sa, sb, flips };
  }

  // A second, separate scorer: reads the move logs of a match and counts the four kinds of round.
  function rescore(logA, logB) {
    const c = { CC: 0, CD: 0, DC: 0, DD: 0 };
    for (let i = 0; i < logA.length; i++) c[logA[i] + logB[i]]++;
    return { a: c.CC * PAY.R + c.CD * PAY.S + c.DC * PAY.T + c.DD * PAY.P, b: c.CC * PAY.R + c.DC * PAY.S + c.CD * PAY.T + c.DD * PAY.P, counts: c };
  }

  // Round robin: every strategy meets every other once and, if selfPlay, a twin of itself. Pair (i, j) with i <= j
  // is seeded from the seed and the two ids, so adding a strategy elsewhere in the list does not change that pair.
  // In a twin match a strategy gets the average of its two sides.
  function tournament(list, o) {
    const n = list.length;
    const matches = [];
    const totals = list.map(() => 0);
    const wins = list.map(() => 0), ties = list.map(() => 0), losses = list.map(() => 0);
    const matrix = list.map(() => list.map(() => null));
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        if (i === j && !o.selfPlay) continue;
        const m = playMatch(list[i], list[j], o.rounds, o.noise, o.seed + '|' + list[i].id + '|' + list[j].id);
        m.i = i; m.j = j;
        matches.push(m);
        if (i === j) { const avg = (m.sa + m.sb) / 2; totals[i] += avg; matrix[i][i] = avg; continue; }
        totals[i] += m.sa; totals[j] += m.sb;
        matrix[i][j] = m.sa; matrix[j][i] = m.sb;
        if (m.sa > m.sb) { wins[i]++; losses[j]++; } else if (m.sa < m.sb) { wins[j]++; losses[i]++; } else { ties[i]++; ties[j]++; }
      }
    }
    return { list, matches, totals, wins, ties, losses, matrix, rounds: o.rounds, perStrategyRounds: o.rounds * (n - 1 + (o.selfPlay ? 1 : 0)) };
  }

  // Standard competition ranking: equal totals share a rank (1, 1, 3 ...). Returns rows best first; ties by list order.
  function ranking(t) {
    const rows = t.list.map((s, i) => ({ i, id: s.id, name: s.name, total: t.totals[i] }));
    rows.sort((x, y) => y.total - x.total || x.i - y.i);
    rows.forEach((r, k) => { r.rank = k > 0 && r.total === rows[k - 1].total ? rows[k - 1].rank : k + 1; });
    return rows;
  }

  // Run the whole tournament again under other seeds. Counts, for each strategy, how many of those tournaments it
  // finished with the highest total (a tie for the top counts for every tied strategy). repeatStep adds one more
  // tournament (number k) to acc, so a page can do it in small slices; repeats does them all at once.
  function newRepeats(list) { return { reps: 0, first: list.map(() => 0), sum: list.map(() => 0) }; }
  function repeatStep(acc, list, o, k) {
    const t = tournament(list, { rounds: o.rounds, noise: o.noise, selfPlay: o.selfPlay, seed: o.seed + '/rep' + k });
    const best = Math.max.apply(null, t.totals);
    t.totals.forEach((v, i) => { acc.sum[i] += v; if (v === best) acc.first[i]++; });
    acc.reps++;
  }
  function repeats(list, o, reps) {
    const acc = newRepeats(list);
    for (let k = 0; k < reps; k++) repeatStep(acc, list, o, k);
    return { reps: acc.reps, first: acc.first, mean: acc.sum.map((v) => v / acc.reps) };
  }

  const api = { PAY, payoff, isDilemma, hash32, mulberry32, BUILTIN, TWIN_TABLES, makeCustom, playMatch, rescore, tournament, ranking, newRepeats, repeatStep, repeats };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Dilemma = api;
})(typeof self !== 'undefined' ? self : this);
