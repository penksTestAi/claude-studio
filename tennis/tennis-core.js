/* Tennis scoring maths for the page and for check.mjs. No libraries.
   Four routes to the same numbers:
   1. exactDP:   rational (BigInt) recursion over scores, written from the rules, with the deuce / tiebreak tail
                 solved by a geometric series.
   2. forward:   a point-by-point score machine (advance) run as a Markov chain, pushing probability mass forward.
   3. closed form for one game (Newton-Keller style formula).
   4. simulate:  the same score machine played with a seeded random number generator.
   Routes 2 and 4 share `advance`; route 1 and route 3 share nothing with them. */
(function (root) {
  'use strict';

  // ---------- arithmetic: exact fractions and plain numbers share one recursion ----------
  function gcd(a, b) { if (a < 0n) a = -a; if (b < 0n) b = -b; while (b) { var t = a % b; a = b; b = t; } return a; }
  function Fr(n, d) {
    if (d === undefined) d = 1n;
    if (d < 0n) { n = -n; d = -d; }
    var g = gcd(n, d); if (g > 1n) { n /= g; d /= g; }
    return { n: n, d: d };
  }
  var FRAC = {
    zero: Fr(0n), one: Fr(1n),
    add: function (a, b) { return Fr(a.n * b.d + b.n * a.d, a.d * b.d); },
    sub: function (a, b) { return Fr(a.n * b.d - b.n * a.d, a.d * b.d); },
    mul: function (a, b) { return Fr(a.n * b.n, a.d * b.d); },
    div: function (a, b) { return Fr(a.n * b.d, a.d * b.n); },
    fromThousandths: function (k) { return Fr(BigInt(k), 1000n); },
    toNumber: function (a) { var S = 10n ** 18n; return Number((a.n * S) / a.d) / 1e18; }
  };
  var FLOAT = {
    zero: 0, one: 1,
    add: function (a, b) { return a + b; }, sub: function (a, b) { return a - b; },
    mul: function (a, b) { return a * b; }, div: function (a, b) { return a / b; },
    fromThousandths: function (k) { return k / 1000; },
    toNumber: function (a) { return a; }
  };

  // ---------- route 1: exact recursion ----------
  // A = the player whose numbers are given. as = P(A wins a point A serves), ar = P(A wins a point B serves).
  function gameWin(O, p) {                    // P(server wins a game), server wins each point with p
    var q = O.sub(O.one, p);
    var D = O.div(O.mul(p, p), O.add(O.mul(p, p), O.mul(q, q)));    // from deuce
    var memo = {};
    function f(i, j) {
      if (i >= 4 && i - j >= 2) return O.one;
      if (j >= 4 && j - i >= 2) return O.zero;
      if (i >= 3 && j >= 3) {
        if (i === j) return D;
        return i > j ? O.add(p, O.mul(q, D)) : O.mul(p, D);
      }
      var k = i + ',' + j; if (memo[k]) return memo[k];
      return (memo[k] = O.add(O.mul(p, f(i + 1, j)), O.mul(q, f(i, j + 1))));
    }
    return f(0, 0);
  }
  function tiebreakWin(O, as, ar, firstA) {   // P(A wins a tiebreak to 7, win by 2)
    var bs = O.sub(O.one, as), br = O.sub(O.one, ar);
    var x = O.mul(as, ar), y = O.mul(bs, br);        // a pair of points holds one serve each
    var T = O.div(x, O.add(x, y));
    var memo = {};
    function pt(n) {                                  // P(A wins point number n), serving 1,2,2,2,...
      var aServes = (Math.floor((n + 1) / 2) % 2 === 0) === firstA;
      return aServes ? as : ar;
    }
    function f(i, j) {
      if (i >= 7 && i - j >= 2) return O.one;
      if (j >= 7 && j - i >= 2) return O.zero;
      if (i === 6 && j === 6) return T;
      var k = i + ',' + j; if (memo[k]) return memo[k];
      var p = pt(i + j);
      return (memo[k] = O.add(O.mul(p, f(i + 1, j)), O.mul(O.sub(O.one, p), f(i, j + 1))));
    }
    return f(0, 0);
  }
  // Outcomes of one set: {win: P(A wins), winNextA: P(A wins and A serves first next set), loseNextA: P(A loses and A serves next)}
  function setOutcomes(O, as, ar, firstA) {
    var hold = gameWin(O, as);
    var brk = O.sub(O.one, gameWin(O, O.sub(O.one, ar)));   // A wins a game B serves
    var tb = tiebreakWin(O, as, ar, firstA);                // tiebreak starts at game 12, by the set's first server
    var res = { winA: O.zero, winB: O.zero, winNextA: O.zero, loseNextA: O.zero };
    var memo = {};
    function nextA(total) { return ((total % 2 === 0) === firstA); }   // does A serve the next set's first game
    function add(winner, total, pr) {
      if (winner) { res.winA = O.add(res.winA, pr); if (nextA(total)) res.winNextA = O.add(res.winNextA, pr); }
      else { res.winB = O.add(res.winB, pr); if (nextA(total)) res.loseNextA = O.add(res.loseNextA, pr); }
    }
    // forward mass over game scores
    var layer = { '0,0': O.one };
    for (var n = 0; n <= 12; n++) {
      var next = {};
      Object.keys(layer).forEach(function (key) {
        var parts = key.split(','), i = +parts[0], j = +parts[1], m = layer[key];
        if (i === 6 && j === 6) { add(true, 13, O.mul(m, tb)); add(false, 13, O.mul(m, O.sub(O.one, tb))); return; }
        var gA = ((i + j) % 2 === 0) === firstA ? hold : brk;
        [[i + 1, j, gA], [i, j + 1, O.sub(O.one, gA)]].forEach(function (c) {
          var pr = O.mul(m, c[2]);
          if (c[0] >= 6 && c[0] - c[1] >= 2) add(true, c[0] + c[1], pr);
          else if (c[1] >= 6 && c[1] - c[0] >= 2) add(false, c[0] + c[1], pr);
          else { var k = c[0] + ',' + c[1]; next[k] = next[k] ? O.add(next[k], pr) : pr; }
        });
      });
      layer = next;
    }
    return res;
  }
  function matchWin(O, as, ar, need) {        // A serves first in set one
    var so = { true: setOutcomes(O, as, ar, true), false: setOutcomes(O, as, ar, false) };
    var memo = {};
    function m(sa, sb, firstA) {
      if (sa === need) return O.one;
      if (sb === need) return O.zero;
      var k = sa + ',' + sb + ',' + firstA; if (memo[k]) return memo[k];
      var r = so[firstA];
      var winNextB = O.sub(r.winA, r.winNextA);          // A wins, B serves next set
      var loseNextB = O.sub(r.winB, r.loseNextA);
      var v = O.add(O.add(O.mul(r.winNextA, m(sa + 1, sb, true)), O.mul(winNextB, m(sa + 1, sb, false))),
                    O.add(O.mul(r.loseNextA, m(sa, sb + 1, true)), O.mul(loseNextB, m(sa, sb + 1, false))));
      return (memo[k] = v);
    }
    return m(0, 0, true);
  }
  // Everything the page shows, for thousandths as and ar (integers).
  function exactAll(O, asK, arK) {
    var as = O.fromThousandths(asK), ar = O.fromThousandths(arK);
    return {
      hold: gameWin(O, as),
      brk: O.sub(O.one, gameWin(O, O.sub(O.one, ar))),
      tiebreak: tiebreakWin(O, as, ar, true),
      set: setOutcomes(O, as, ar, true).winA,
      bo3: matchWin(O, as, ar, 2),
      bo5: matchWin(O, as, ar, 3)
    };
  }

  // ---------- closed form for one game ----------
  function gameClosed(p) {
    var q = 1 - p;
    return p * p * p * p * (1 + 4 * q + 10 * q * q) + 20 * Math.pow(p * q, 3) * p * p / (p * p + q * q);
  }

  // ---------- route 2 and 4: the point-by-point score machine ----------
  // state: [setsA, setsB, gamesA, gamesB, pointsA, pointsB, firstServerIsA]
  // returns bits: 1 game over, 2 set over, 4 match over, 8 A won it (of the largest unit that ended)
  function serverIsA(s) {
    if (s[2] === 6 && s[3] === 6) {
      var n = s[4] + s[5];
      return ((Math.floor((n + 1) / 2) % 2) === 0) === (s[6] === 1);
    }
    return (((s[2] + s[3]) % 2) === 0) === (s[6] === 1);
  }
  function advance(s, aWins, need) {
    var t = s.slice(), tb = t[2] === 6 && t[3] === 6, flags = 0, aWonGame = false;
    if (aWins) t[4]++; else t[5]++;
    var a = t[4], b = t[5];
    if (tb) {
      if (a >= 7 && a - b >= 2) { flags = 1; aWonGame = true; }
      else if (b >= 7 && b - a >= 2) { flags = 1; }
      else if (a >= 8 && b >= 8) { t[4] = a - 2; t[5] = b - 2; }
    } else {
      if (a >= 4 && a - b >= 2) { flags = 1; aWonGame = true; }
      else if (b >= 4 && b - a >= 2) { flags = 1; }
      else if (a >= 3 && b >= 3) { t[4] = a === b ? 3 : (a > b ? 4 : 3); t[5] = a === b ? 3 : (a > b ? 3 : 4); }
    }
    if (!flags) return { s: t, f: 0 };
    t[4] = 0; t[5] = 0;
    if (aWonGame) t[2]++; else t[3]++;
    var setA = t[2] >= 6 && t[2] - t[3] >= 2 || t[2] === 7;
    var setB = t[3] >= 6 && t[3] - t[2] >= 2 || t[3] === 7;
    var out = 1 | (aWonGame ? 8 : 0);
    if (setA || setB) {
      var k = t[2] + t[3];
      if (k % 2 === 1) t[6] = 1 - t[6];
      if (setA) t[0]++; else t[1]++;
      t[2] = 0; t[3] = 0;
      out |= 2; out = setA ? (out | 8) : (out & ~8);
      if (t[0] === need || t[1] === need) out |= 4;
    }
    return { s: t, f: out };
  }
  var START = {
    game: [0, 0, 0, 0, 0, 0, 1], tiebreak: [0, 0, 6, 6, 0, 0, 1],
    set: [0, 0, 0, 0, 0, 0, 1], match: [0, 0, 0, 0, 0, 0, 1]
  };
  var STOP = { game: 1, tiebreak: 1, set: 2, match: 4 };
  function keyOf(s) { return ((((((s[0] * 4 + s[1]) * 8 + s[2]) * 8 + s[3]) * 9 + s[4]) * 9 + s[5]) * 2 + s[6]); }
  function forward(level, asK, arK, need) {
    var as = asK / 1000, ar = arK / 1000, pA = 0, left = 1;
    var cur = new Map(); cur.set(keyOf(START[level]), { s: START[level], m: 1 });
    for (var it = 0; it < 4000 && left > 1e-13; it++) {
      var nxt = new Map();
      cur.forEach(function (e) {
        var p = serverIsA(e.s) ? as : ar;
        for (var c = 0; c < 2; c++) {
          var r = advance(e.s, c === 0, need), m = e.m * (c === 0 ? p : 1 - p);
          if (r.f & STOP[level]) { left -= m; if (r.f & 8) pA += m; }
          else { var k = keyOf(r.s); var o = nxt.get(k); if (o) o.m += m; else nxt.set(k, { s: r.s, m: m }); }
        }
      });
      cur = nxt;
    }
    return { p: pA, left: left, iterations: it };
  }

  // ---------- seeded simulation ----------
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // momentum d: P(win this point) = p + d * (won last point ? 1 : 0 - p_last). Keeps every point's chance equal to p on average.
  function simulate(level, asK, arK, need, n, seed, d) {
    var rand = rng(seed), as = asK / 1000, ar = arK / 1000, wins = 0, pts = 0, ptsWon = 0, sN = 0, sW = 0, rN = 0, rW = 0;
    d = d || 0;
    for (var i = 0; i < n; i++) {
      var s = START[level], last = -1, pLast = 0;
      for (;;) {
        var sv = serverIsA(s), p = sv ? as : ar, q = p;
        if (d !== 0 && last >= 0) { q = p + d * (last - pLast); if (q < 0.02) q = 0.02; if (q > 0.98) q = 0.98; }
        var w = rand() < q;
        pts++; if (w) ptsWon++;
        if (sv) { sN++; if (w) sW++; } else { rN++; if (w) rW++; }
        last = w ? 1 : 0; pLast = p;
        var r = advance(s, w, need); s = r.s;
        if (r.f & STOP[level]) { if (r.f & 8) wins++; break; }
      }
    }
    return { p: wins / n, n: n, pointShare: ptsWon / pts, points: pts, serveShare: sW / sN, returnShare: rW / rN };
  }

  var Z = 4;   // simulation rows pass within this many standard errors
  // ---------- the checks (used by the page and by check.mjs) ----------
  // Each row: {id, group, text, ok, weak}. `weak` rows are listed but not counted in the agreement tally.
  function runChecks(asK, arK, opts) {
    opts = opts || {};
    var N = opts.n || 8000, seed = opts.seed || 7, rows = [];
    function row(id, group, text, ok, extra) { var r = { id: id, group: group, text: text, ok: ok }; if (extra) for (var k in extra) r[k] = extra[k]; rows.push(r); }
    var ex = exactAll(FRAC, asK, arK), exN = {};
    Object.keys(ex).forEach(function (k) { exN[k] = FRAC.toNumber(ex[k]); });

    // exact vs closed form, over a grid of point chances
    var worst = 0, grid = 0;
    for (var k = 300; k <= 900; k += 25) {
      var g = FRAC.toNumber(gameWin(FRAC, FRAC.fromThousandths(k)));
      worst = Math.max(worst, Math.abs(g - gameClosed(k / 1000))); grid++;
    }
    row('closed', 'exact', 'Game: exact fractions against the closed-form formula at ' + grid + ' point chances (largest gap ' + worst.toExponential(1) + ')', worst < 1e-12);
    var gAt = FRAC.toNumber(gameWin(FRAC, FRAC.fromThousandths(asK)));
    row('closed-now', 'exact', 'Game on your serve now: exact ' + gAt.toFixed(6) + ', closed form ' + gameClosed(asK / 1000).toFixed(6), Math.abs(gAt - gameClosed(asK / 1000)) < 1e-12);

    // equal players: exact one half, with the same fractions
    var eq = exactAll(FRAC, asK, 1000 - asK), eqOk = ['set', 'bo3', 'bo5', 'tiebreak'].every(function (n) {
      var v = eq[n]; return v.n * 2n === v.d;
    });
    row('equal', 'exact', 'Two equal players (your return chance = one minus your serve chance, ' + (asK / 10) + '% and ' + ((1000 - asK) / 10) + '%): tiebreak, set, best of 3 and best of 5 are exactly 1/2', eqOk);

    // who serves first does not change a tiebreak or a set (exact equality of fractions)
    var asF = FRAC.fromThousandths(asK), arF = FRAC.fromThousandths(arK);
    var t1 = tiebreakWin(FRAC, asF, arF, true), t2 = tiebreakWin(FRAC, asF, arF, false);
    var s1 = setOutcomes(FRAC, asF, arF, true).winA, s2 = setOutcomes(FRAC, asF, arF, false).winA;
    var same = t1.n === t2.n && t1.d === t2.d && s1.n === s2.n && s1.d === s2.d;
    row('first', 'exact', 'Who serves first: tiebreak and set chances are the same fractions whether you or your opponent serves first (' + (same ? 'equal' : 'different') + ')', same);

    // exact vs score machine
    var levels = [['game', 'hold', 1], ['tiebreak', 'tiebreak', 1], ['set', 'set', 1], ['match', 'bo3', 2], ['match', 'bo5', 3]];
    var labels = { hold: 'service game', tiebreak: 'tiebreak', set: 'set', bo3: 'best of 3', bo5: 'best of 5' };
    levels.forEach(function (L) {
      if (opts.light && L[1] === 'bo5') return;        // the best-of-5 chain takes seconds; the page skips it, check.mjs runs it
      var f = forward(L[0], asK, arK, L[2]), d = Math.abs(f.p - exN[L[1]]);
      row('fwd-' + L[1], 'markov', 'Score machine run as a Markov chain, ' + labels[L[1]] + ': ' + f.p.toFixed(6) + ' against exact ' + exN[L[1]].toFixed(6) + ' (gap ' + d.toExponential(1) + ', mass left ' + f.left.toExponential(0) + ')', d < 1e-9 && f.left < 1e-9);
    });
    // float version of the recursion vs exact
    var fl = exactAll(FLOAT, asK, arK), dm = 0;
    Object.keys(fl).forEach(function (k2) { dm = Math.max(dm, Math.abs(fl[k2] - exN[k2])); });
    row('float', 'exact', 'The plain-number version of the recursion (used for the graph) against the exact fractions: largest gap ' + dm.toExponential(1), dm < 1e-12);

    // simulation vs exact
    levels.forEach(function (L, i) {
      var n = L[0] === 'match' ? Math.ceil(N / 2) : N;
      var s = simulate(L[0], asK, arK, L[2], n, seed + 101 * i, 0);
      var p = exN[L[1]], se = Math.sqrt(Math.max(p * (1 - p), 1e-4) / n), z = (s.p - p) / se;
      row('sim-' + L[1], 'sim', 'Seeded simulation of ' + n + ' ' + labels[L[1]].replace('service game', 'service games') + (L[0] === 'tiebreak' ? 's' : L[0] === 'set' ? 's' : L[0] === 'match' ? ' matches' : '') + ': ' + s.p.toFixed(4) + ' against exact ' + p.toFixed(4) + ' (' + (z >= 0 ? '+' : '-') + Math.abs(z).toFixed(1) + ' standard errors)', Math.abs(z) <= Z, { z: z, sim: s.p });
    });
    // weaker, relayed figure
    var g55 = FRAC.toNumber(gameWin(FRAC, FRAC.fromThousandths(550)));
    row('relayed', 'weak', 'Relayed figure, not counted: about 0.62 for a game at p = 0.55 (Newton and Keller, as passed on with the brief; my own search returned no number). This page gives ' + g55.toFixed(4), Math.abs(g55 - 0.62) < 0.01, { weak: true });
    return { rows: rows, exact: ex, exN: exN };
  }

  var api = {
    FRAC: FRAC, FLOAT: FLOAT, gameWin: gameWin, tiebreakWin: tiebreakWin, setOutcomes: setOutcomes, matchWin: matchWin,
    exactAll: exactAll, gameClosed: gameClosed, advance: advance, serverIsA: serverIsA, forward: forward,
    Z: Z, simulate: simulate, rng: rng, runChecks: runChecks
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Tennis = api;
})(typeof window !== 'undefined' ? window : globalThis);
