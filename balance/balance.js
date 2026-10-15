/* Balancing chemical equations: exact integer linear algebra.
   Written by Claude. No atomic masses, no data fetched. Works in a page and in Node. */
(function (root) {
  "use strict";

  var SYMBOLS = "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og".split(" ");
  var SYMSET = {};
  SYMBOLS.forEach(function (s) { SYMSET[s] = true; });

  var MAX_SPECIES = 14;

  /* ---------- exact rationals on BigInt ---------- */
  function babs(a) { return a < 0n ? -a : a; }
  function bgcd(a, b) { a = babs(a); b = babs(b); while (b) { var t = a % b; a = b; b = t; } return a; }
  function fr(n, d) {
    if (d === undefined) d = 1n;
    if (d < 0n) { n = -n; d = -d; }
    var g = bgcd(n, d); if (g > 1n) { n /= g; d /= g; }
    return { n: n, d: d };
  }
  function fadd(a, b) { return fr(a.n * b.d + b.n * a.d, a.d * b.d); }
  function fsub(a, b) { return fr(a.n * b.d - b.n * a.d, a.d * b.d); }
  function fmul(a, b) { return fr(a.n * b.n, a.d * b.d); }
  function fdiv(a, b) { return fr(a.n * b.d, a.d * b.n); }
  function fzero(a) { return a.n === 0n; }

  /* Reduced row echelon form of an integer matrix (array of rows of BigInt). */
  function rref(M, ncols) {
    var A = M.map(function (r) { return r.map(function (x) { return fr(BigInt(x)); }); });
    var pivots = [], r = 0, i, j, k;
    for (var c = 0; c < ncols && r < A.length; c++) {
      var p = -1;
      for (i = r; i < A.length; i++) if (!fzero(A[i][c])) { p = i; break; }
      if (p < 0) continue;
      var tmp = A[r]; A[r] = A[p]; A[p] = tmp;
      var pv = A[r][c];
      for (j = 0; j < ncols; j++) A[r][j] = fdiv(A[r][j], pv);
      for (i = 0; i < A.length; i++) {
        if (i === r || fzero(A[i][c])) continue;
        var f = A[i][c];
        for (j = 0; j < ncols; j++) A[i][j] = fsub(A[i][j], fmul(f, A[r][j]));
      }
      pivots.push(c); r++;
    }
    return { A: A, pivots: pivots };
  }

  /* Null-space basis (one integer vector per free column, scaled to smallest whole numbers). */
  function nullspace(M, ncols) {
    var R = rref(M, ncols), free = [], c, k;
    for (c = 0; c < ncols; c++) if (R.pivots.indexOf(c) < 0) free.push(c);
    var basis = free.map(function (fc) {
      var v = new Array(ncols).fill(null).map(function () { return fr(0n); });
      v[fc] = fr(1n);
      R.pivots.forEach(function (pc, row) { v[pc] = fr(-R.A[row][fc].n, R.A[row][fc].d); });
      return toInts(v);
    });
    return { basis: basis, rank: R.pivots.length, free: free, rref: R.A, pivots: R.pivots };
  }

  function toInts(v) {
    var L = 1n, i;
    v.forEach(function (x) { L = L / bgcd(L, x.d) * x.d; });
    var out = v.map(function (x) { return x.n * (L / x.d); });
    var g = 0n; out.forEach(function (x) { g = bgcd(g, x); });
    if (g > 1n) out = out.map(function (x) { return x / g; });
    return out;
  }
  function vgcd(v) { var g = 0n; v.forEach(function (x) { g = bgcd(g, x); }); return g; }

  /* ---------- parsing ---------- */
  function fail(msg) { var e = new Error(msg); e.userMessage = msg; throw e; }

  function parseFormula(s, whole) {
    var pos = 0;
    function readInt() {
      var st = pos; while (pos < s.length && s[pos] >= "0" && s[pos] <= "9") pos++;
      return pos > st ? parseInt(s.slice(st, pos), 10) : null;
    }
    function add(into, from, mult) {
      Object.keys(from).forEach(function (k) { into[k] = (into[k] || 0) + from[k] * mult; });
    }
    function group(close) {
      var atoms = {}, any = false;
      while (pos < s.length) {
        var ch = s[pos];
        if (ch === ")" || ch === "]" || ch === "}") {
          if (close && ((close === ")" && ch === ")") || (close === "]" && ch === "]") || (close === "}" && ch === "}"))) return atoms;
          fail("Unmatched \"" + ch + "\" in " + whole);
        }
        if (ch === "(" || ch === "[" || ch === "{") {
          var cl = ch === "(" ? ")" : ch === "[" ? "]" : "}";
          pos++;
          var inner = group(cl);
          if (s[pos] !== cl) fail("Missing \"" + cl + "\" in " + whole);
          pos++;
          var m = readInt(); if (m === null) m = 1;
          if (m === 0) fail("A count of 0 in " + whole);
          add(atoms, inner, m); any = true;
        } else if (ch >= "A" && ch <= "Z") {
          var two = ch + (s[pos + 1] && s[pos + 1] >= "a" && s[pos + 1] <= "z" ? s[pos + 1] : "");
          var sym;
          if (two.length === 2 && SYMSET[two]) sym = two;
          else if (SYMSET[ch]) sym = ch;
          else fail("\"" + two + "\" is not an element symbol (in " + whole + ")");
          pos += sym.length;
          var n = readInt(); if (n === null) n = 1;
          if (n === 0) fail("A count of 0 in " + whole);
          atoms[sym] = (atoms[sym] || 0) + n; any = true;
        } else if (ch >= "0" && ch <= "9") {
          fail("A number in the middle of " + whole + " must follow an element or a bracket");
        } else {
          fail("Unexpected \"" + ch + "\" in " + whole);
        }
      }
      if (close) fail("Missing \"" + close + "\" in " + whole);
      if (!any) fail("Empty formula in " + whole);
      return atoms;
    }
    return group(null);
  }

  function parseSpecies(raw) {
    var text = raw.trim().replace(/[•*.]/g, "·").replace(/\s+/g, "");
    if (!text) fail("An empty species (two plus signs in a row, or a plus at an end)");
    var charge = 0, body = text;
    var m = /\^(\d*)([+-])$/.exec(text) || null;
    if (m) { charge = (m[1] ? parseInt(m[1], 10) : 1) * (m[2] === "+" ? 1 : -1); body = text.slice(0, m.index); }
    else if ((m = /\^([+-])(\d*)$/.exec(text))) { charge = (m[2] ? parseInt(m[2], 10) : 1) * (m[1] === "+" ? 1 : -1); body = text.slice(0, m.index); }
    else if (text.indexOf("^") >= 0) fail("Write a charge as ^2+ or ^- at the end (in " + text + ")");
    if (/^\d+$/.test(body)) fail("A lone number \"" + body + "\" is not a species. For a charge write Fe^3+ or Cu^2+, with the ^.");
    if (/^\d/.test(body)) fail("Leave out coefficients: \"" + text + "\" starts with a number. The page finds them.");
    var atoms = {};
    if (body === "e") {
      if (charge !== -1) fail("The electron is written e^-");
    } else {
      var parts = body.split("·");
      parts.forEach(function (p, idx) {
        var mult = 1;
        if (idx > 0) { var mm = /^(\d+)/.exec(p); if (mm) { mult = parseInt(mm[1], 10); p = p.slice(mm[1].length); } }
        if (!p) fail("Nothing after the dot in " + text);
        var a = parseFormula(p, text);
        Object.keys(a).forEach(function (k) { atoms[k] = (atoms[k] || 0) + a[k] * mult; });
      });
    }
    return { text: text, atoms: atoms, charge: charge };
  }

  /* split on "+" except a charge sign (the "+" right after ^ or ^digits) */
  function splitPlus(h) {
    var out = [], cur = "";
    for (var i = 0; i < h.length; i++) {
      if (h[i] === "+" && !/\^\d*$/.test(cur)) { out.push(cur); cur = ""; } else cur += h[i];
    }
    out.push(cur);
    return out;
  }

  function parseEquation(src) {
    var s = String(src).replace(/→|⟶|⇒|⇌|⇄/g, " -> ");
    var arrows = s.match(/-+>|=+>|=/g) || [];
    if (arrows.length === 0) fail("No arrow found. Write the reaction as  reactants -> products.");
    if (arrows.length > 1) fail("More than one arrow. This page balances one step at a time.");
    var halves = s.split(/-+>|=+>|=/);
    var sides = halves.map(function (h) {
      if (!h.trim()) fail("One side of the arrow is empty.");
      return splitPlus(h).map(parseSpecies);
    });
    var species = [];
    sides[0].forEach(function (sp) { sp.side = "R"; species.push(sp); });
    sides[1].forEach(function (sp) { sp.side = "P"; species.push(sp); });
    var seen = {};
    species.forEach(function (sp) {
      if (seen[sp.text]) fail("\"" + sp.text + "\" appears twice. List each species once; a species on both sides cancels and has no coefficient of its own.");
      seen[sp.text] = true;
    });
    if (species.length > MAX_SPECIES) fail("At most " + MAX_SPECIES + " species, please.");
    return species;
  }

  /* ---------- the matrix ---------- */
  function buildMatrix(species) {
    var elements = [], hasCharge = false;
    species.forEach(function (sp) {
      Object.keys(sp.atoms).forEach(function (k) { if (elements.indexOf(k) < 0) elements.push(k); });
      if (sp.charge !== 0) hasCharge = true;
    });
    var rows = elements.map(function (el) {
      return species.map(function (sp) { return BigInt((sp.atoms[el] || 0) * (sp.side === "R" ? 1 : -1)); });
    });
    var labels = elements.slice();
    if (hasCharge) {
      rows.push(species.map(function (sp) { return BigInt(sp.charge * (sp.side === "R" ? 1 : -1)); }));
      labels.push("charge");
    }
    return { rows: rows, labels: labels };
  }

  /* Minimal balancings: null vectors with the smallest possible support (circuits). */
  function circuits(rows, n, rank) {
    var found = [];
    for (var mask = 1; mask < (1 << n); mask++) {
      var idx = [], i;
      for (i = 0; i < n; i++) if (mask & (1 << i)) idx.push(i);
      if (idx.length > rank + 1) continue;
      var sub = rows.map(function (r) { return idx.map(function (j) { return r[j]; }); });
      var ns = nullspace(sub, idx.length);
      if (ns.basis.length !== 1) continue;
      var v = ns.basis[0];
      if (v.some(function (x) { return x === 0n; })) continue;
      var full = new Array(n).fill(0n);
      idx.forEach(function (j, t) { full[j] = v[t]; });
      found.push(full);
    }
    return found;
  }

  function nonneg(v) { return v.every(function (x) { return x >= 0n; }); }
  function neg(v) { return v.map(function (x) { return -x; }); }
  function orient(v) { // make the first nonzero entry positive
    for (var i = 0; i < v.length; i++) if (v[i] !== 0n) return v[i] < 0n ? neg(v) : v;
    return v;
  }

  /* Recount atoms on both sides straight from the parsed species (not from the matrix). */
  function recount(species, coef) {
    var L = { charge: 0n }, R = { charge: 0n };
    species.forEach(function (sp, i) {
      var T = sp.side === "R" ? L : R;
      Object.keys(sp.atoms).forEach(function (k) { T[k] = (T[k] || 0n) + BigInt(sp.atoms[k]) * coef[i]; });
      T.charge += BigInt(sp.charge) * coef[i];
    });
    var keys = [];
    [L, R].forEach(function (T) { Object.keys(T).forEach(function (k) { if (k !== "charge" && keys.indexOf(k) < 0) keys.push(k); }); });
    var hasCharge = species.some(function (sp) { return sp.charge !== 0; });
    if (hasCharge) keys.push("charge");
    return keys.map(function (k) { return { label: k, left: L[k] || 0n, right: R[k] || 0n, ok: (L[k] || 0n) === (R[k] || 0n) }; });
  }

  /* Exhaustive search over coefficients 1..B (an independent second opinion). */
  function brute(rows, n, B, limit) {
    var total = Math.pow(B, n);
    if (!(total <= limit)) return null;
    var m = rows.length, a = rows.map(function (r) { return r.map(Number); });
    var sums = new Array(m).fill(0), cur = new Array(n).fill(1), sols = [];
    function rec(j) {
      if (j === n) {
        for (var e = 0; e < m; e++) if (sums[e] !== 0) return;
        sols.push(cur.slice()); return;
      }
      for (var c = 1; c <= B; c++) {
        cur[j] = c;
        for (var e2 = 0; e2 < m; e2++) sums[e2] += a[e2][j] * c;
        rec(j + 1);
        for (var e3 = 0; e3 < m; e3++) sums[e3] -= a[e3][j] * c;
      }
    }
    rec(0);
    return { B: B, count: sols.length, solutions: sols, tried: total };
  }

  function sum(v) { return v.reduce(function (s, x) { return s + x; }, 0n); }

  function balance(src) {
    var res = { input: src };
    var species;
    try { species = parseEquation(src); }
    catch (e) { if (e.userMessage) { res.error = e.userMessage; return res; } throw e; }
    var mat = buildMatrix(species);
    var n = species.length;
    var ns = nullspace(mat.rows, n);
    res.species = species; res.labels = mat.labels; res.matrix = mat.rows;
    res.rank = ns.rank; res.nullity = ns.basis.length;
    res.basis = ns.basis.map(orient);

    var circ = circuits(mat.rows, n, ns.rank).map(orient);
    res.circuits = circ;
    var feasible = [];
    circ.forEach(function (v) {
      if (nonneg(v)) feasible.push(v);
      else if (nonneg(neg(v))) feasible.push(neg(v));
    });
    res.feasible = feasible;
    var covered = new Array(n).fill(false);
    feasible.forEach(function (v) { v.forEach(function (x, i) { if (x > 0n) covered[i] = true; }); });
    res.uncovered = [];
    covered.forEach(function (c, i) { if (!c) res.uncovered.push(i); });

    if (res.nullity === 0) { res.kind = "impossible"; return res; }
    if (res.uncovered.length > 0) {
      if (res.nullity === 1) {
        var v1 = res.basis[0];
        res.kind = (nonneg(v1) || nonneg(neg(v1))) ? "zero" : "wrongside";
        res.vector = nonneg(neg(v1)) ? neg(v1) : v1;
      } else res.kind = "partial";
      return res;
    }
    var coef;
    if (res.nullity === 1) { res.kind = "unique"; coef = feasible[0]; }
    else {
      res.kind = "multiple";
      var tot = new Array(n).fill(0n);
      feasible.forEach(function (v) { v.forEach(function (x, i) { tot[i] += x; }); });
      var g = vgcd(tot); coef = tot.map(function (x) { return x / g; });
    }
    res.coef = coef;

    // checks
    var checks = [];
    var table = recount(species, coef);
    res.table = table;
    checks.push({ ok: table.every(function (t) { return t.ok; }), text: "Atoms" + (mat.labels.indexOf("charge") >= 0 ? " and charge" : "") + " recounted from the formulas: left equals right for every row of the table below." });
    checks.push({ ok: coef.every(function (x) { return x >= 1n; }), text: "Every coefficient is a whole number of at least 1." });
    checks.push({ ok: vgcd(coef) === 1n, text: "The coefficients have no common factor (their greatest common divisor is " + vgcd(coef) + ")." });
    if (res.nullity === 1) {
      checks.push({ ok: true, text: "The null space has dimension 1, so every balancing is a rational multiple of this one; with no common factor left, it is the smallest." });
      var M = 0n; coef.forEach(function (x) { if (x > M) M = x; });
      var b = brute(mat.rows, n, Number(M), 2e7);
      res.brute = b;
      if (b) checks.push({ ok: b.count === 1 && b.solutions[0].every(function (x, i) { return BigInt(x) === coef[i]; }), text: "Exhaustive search over all " + b.tried.toLocaleString("en") + " ways to give each species a coefficient from 1 to " + M + " finds " + (b.count === 1 ? "exactly one balancing, the same one." : b.count + " balancings; expected exactly 1."), brute: true });
      else checks.push({ ok: null, text: "Exhaustive search skipped: too many combinations to run in a page." });
    } else {
      var B = 2; while (Math.pow(B + 1, n) <= 3e6 && B < 12) B++;
      var b2 = brute(mat.rows, n, B, 3e6);
      res.brute = b2;
      if (b2) {
        var sorted = b2.solutions.slice().sort(function (x, y) { return x.reduce(function (s, t) { return s + t; }, 0) - y.reduce(function (s, t) { return s + t; }, 0); });
        res.bruteSorted = sorted;
        checks.push({ ok: b2.count >= 2, text: "Exhaustive search over coefficients 1 to " + B + " finds " + b2.count + " balancings that use every species. The null space has dimension " + res.nullity + ", so there are infinitely many in all." });
      }
    }
    res.checks = checks;
    return res;
  }

  var api = { balance: balance, parseSpecies: parseSpecies, parseEquation: parseEquation, nullspace: nullspace, recount: recount, brute: brute, SYMBOLS: SYMBOLS, MAX_SPECIES: MAX_SPECIES, vgcd: vgcd };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Balance = api;
})(typeof window !== "undefined" ? window : globalThis);
