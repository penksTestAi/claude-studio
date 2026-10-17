"use strict";
(function () {
  var B = window.Benford, D = window.BENFORD_DATA;
  var $ = function (id) { return document.getElementById(id); };
  var P = B.P;
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function f2(x) { return x.toFixed(2); }
  function f4(x) { return x.toFixed(4); }

  /* ---------- histogram ---------- */
  function hist(counts, n, label) {
    var W = 320, H = 150, L = 34, R = 6, T = 8, Bm = 22, pw = W - L - R, ph = H - T - Bm, d, mx = 0;
    for (d = 1; d <= 9; d++) mx = Math.max(mx, counts[d] / n, P[d]);
    var ymax = mx <= 0.4 ? 0.4 : Math.ceil(mx * 10) / 10;
    var s = '<svg class="hist" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label) + '">';
    [0, ymax / 2, ymax].forEach(function (v) {
      var y = T + ph - v / ymax * ph;
      s += '<line class="axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (L - 4) + '" y="' + (y + 3.5) + '" font-size="10" text-anchor="end">' + Math.round(v * 100) + '%</text>';
    });
    var bw = pw / 9;
    for (d = 1; d <= 9; d++) {
      var sh = counts[d] / n, x = L + (d - 1) * bw, h = sh / ymax * ph;
      s += '<rect class="bar" x="' + (x + 4) + '" y="' + (T + ph - h) + '" width="' + (bw - 8) + '" height="' + h + '"><title>digit ' + d + ': ' + counts[d] + ' of ' + n + '</title></rect>';
      var cy = T + ph - P[d] / ymax * ph;
      s += '<circle class="mk" cx="' + (x + bw / 2) + '" cy="' + cy + '" r="5"/>';
      s += '<text x="' + (x + bw / 2) + '" y="' + (H - 6) + '" font-size="11" text-anchor="middle">' + d + '</text>';
    }
    return s + '</svg>';
  }
  function shareTable(counts, n) {
    var s = '<details><summary>Counts and shares</summary><div class="tablewrap"><table><tr><th>Digit</th><th>Count</th><th>Share</th><th>Benford</th></tr>';
    for (var d = 1; d <= 9; d++) s += '<tr><td>' + d + '</td><td>' + counts[d] + '</td><td>' + B.pct(counts[d], n) + '</td><td>' + (100 * P[d]).toFixed(1) + '%</td></tr>';
    return s + '</table></div></details>';
  }
  function verdict(counts) {
    var c = B.chiSquare(counts), m = B.mad(counts), rej = c.p < 0.05;
    var t = 'n = ' + c.n + '. Chi-square ' + f2(c.x) + ' on ' + c.df + ' degrees of freedom, ' + B.pText(c.p) + ': ' +
      (rej ? '<span class="rej">rejected</span>' : '<span class="okv">not rejected</span>') + ' at 0.05. MAD ' + f4(m) +
      ' (convention band: ' + B.madBand(m) + ').';
    if (!rej && c.n < 300) t += ' With so few values, not rejecting is weak evidence.';
    if (c.n < 1000) t += ' MAD bands are meant for large samples; see the True Benford row of the "Verdict by sample size" table for how large MAD is by chance at nearby sizes.';
    if (c.small) t += ' ' + c.small + (c.small === 1 ? ' of 9 digits expects' : ' of 9 digits expect') + ' fewer than 5 values, so this p is approximate.';
    return { html: t, rej: rej, c: c, m: m };
  }
  function label(name, counts, n) {
    var a = []; for (var d = 1; d <= 9; d++) a.push(d + ': ' + B.pct(counts[d], n));
    return name + ', first-digit shares ' + a.join(', ') + '. Benford shares ring each bar.';
  }

  /* ---------- ruler ---------- */
  (function () {
    var s = '', x0 = 10, w = 320, d;
    for (d = 1; d <= 9; d++) {
      var a = x0 + w * Math.log10(d), b = x0 + w * Math.log10(d + 1);
      s += '<rect class="band bar" style="opacity:' + (d % 2 ? 1 : .6) + '" x="' + a + '" y="14" width="' + (b - a) + '" height="34"/>';
      s += '<text x="' + ((a + b) / 2) + '" y="36" font-size="13" text-anchor="middle" class="dg">' + d + '</text>';
    }
    s += '<text x="' + x0 + '" y="66" font-size="11" text-anchor="middle">1</text><text x="' + (x0 + w) + '" y="66" font-size="11" text-anchor="middle">10</text>';
    s += '<text x="' + (x0 + w * Math.log10(2)) + '" y="66" font-size="11" text-anchor="middle">2</text><text x="' + (x0 + w * Math.log10(5)) + '" y="66" font-size="11" text-anchor="middle">5</text>';
    s += '<text x="170" y="86" font-size="11" text-anchor="middle">position on the ruler = log10 of the number</text>';
    $("ruler").innerHTML = s;
    var t = '<tr><th>Digit</th>', r = '<tr><td>Share</td>';
    for (d = 1; d <= 9; d++) { t += '<th>' + d + '</th>'; r += '<td>' + (100 * P[d]).toFixed(1) + '%</td>'; }
    $("ptable").innerHTML = t + '</tr>' + r + '</tr>';
  })();

  /* ---------- exact sequences ---------- */
  var SEQN = [10, 20, 30, 50, 100, 200, 300, 500, 1000, 2000, 3000], MAXN = 3000;
  var SEQ = [
    { id: "p2", name: "Powers of 2", terms: "2, 4, 8, 16, ...", digs: B.powers2(MAXN) },
    { id: "fib", name: "Fibonacci", terms: "1, 1, 2, 3, 5, ...", digs: B.fibonacci(MAXN) },
    { id: "fac", name: "Factorials", terms: "1, 2, 6, 24, ...", digs: B.factorials(MAXN) }
  ];
  var seqSel = 0;
  function drawSeq() {
    var N = SEQN[+$("seqN").value], q = SEQ[seqSel], c = B.countsOf(q.digs, N);
    $("seqNval").textContent = N + " terms";
    $("seqOut").innerHTML = hist(c, N, label(q.name + ' with ' + N + ' terms', c, N)) +
      '<p class="stats">' + esc(q.name) + ' (' + q.terms + '), first ' + N + ' terms. ' + verdict(c).html + '</p>' + shareTable(c, N);
    [].forEach.call($("seqbtns").children, function (b, i) { b.setAttribute("aria-pressed", i === seqSel ? "true" : "false"); });
  }
  SEQ.forEach(function (q, i) {
    var b = document.createElement("button"); b.type = "button"; b.textContent = q.name;
    b.onclick = function () { seqSel = i; drawSeq(); }; $("seqbtns").appendChild(b);
  });
  $("seqN").oninput = drawSeq;
  $("seqNote").textContent = "The sequences are computed as exact integers up to " + MAXN + " terms (the largest factorial here has " + (function () { var v = 1n; for (var i = 2; i <= MAXN; i++) v *= BigInt(i); return v.toString().length; })() + " digits).";
  drawSeq();

  /* ---------- studio data cards ---------- */
  function stats(values) {
    var pos = values.map(Math.abs).filter(function (v) { return v > 0; });
    var mn = Math.min.apply(null, pos), mx = Math.max.apply(null, pos);
    return { mn: mn, mx: mx, orders: Math.log10(mx / mn) };
  }
  function fnum(v) { return v >= 100 ? String(Math.round(v)) : v >= 1 ? String(+v.toPrecision(4)) : String(+v.toPrecision(3)); }
  var CARDS = [];
  function addCard(group, name, values, src) {
    var t = B.tally(values), st = stats(values), v = verdict(t.counts);
    CARDS.push({ name: name, rej: v.rej, n: t.n });
    var html = '<div class="panel"><h3>' + esc(name) + '</h3><div class="small">' + esc(src) + '</div>' +
      hist(t.counts, t.n, label(name, t.counts, t.n)) +
      '<p class="stats">Range ' + fnum(st.mn) + ' to ' + fnum(st.mx) + ', ' + f2(st.orders) + ' powers of ten' +
      (t.skipped ? '; ' + t.skipped + ' left out' : '') + '. ' + v.html + '</p>' + shareTable(t.counts, t.n) + '</div>';
    $(group).insertAdjacentHTML("beforeend", html);
  }
  var S = D.sources;
  addCard("wide", "Tide constituent amplitudes, NOAA list (m)", D.tideNoaa, S.tideNoaa);
  addCard("wide", "Tide constituent amplitudes, TICON-4 list (m)", D.tideTicon, S.tideTicon + ". Fits the same gauge as the first list, so not independent of it.");
  addCard("narrow", "Leap-second offset TAI-UTC (s)", D.leapOffset, S.leapOffset);
  addCard("narrow", "Leap-second row dates as MJD", D.leapMjd, S.leapMjd);
  addCard("narrow", "Element discovery years", D.elementYear, S.elementYear);
  addCard("narrow", "Star right ascension (hours)", D.starRA, S.starRA);
  addCard("narrow", "Star declination, absolute (degrees)", D.starDec.map(Math.abs), S.starDec);
  addCard("narrow", "Star catalogue row ids (assigned)", D.starId, S.starId);
  (function () {
    var a = [], b = []; for (var i = 1; i <= 1999; i++) a.push(i); for (i = 1; i <= 9999; i++) b.push(i);
    addCard("narrow", "Counting numbers 1 to 1999", a, "Generated by the page.");
    addCard("narrow", "Counting numbers 1 to 9999", b, "Generated by the page.");
  })();
  (function () {
    var rej = CARDS.filter(function (c) { return c.rej; }).map(function (c) { return c.name; });
    var s = CARDS.length + ' lists were tested. ';
    if (!rej.length) s += 'None was rejected at 0.05.';
    else if (rej.length === 1) s += 'One was rejected at 0.05: ' + esc(rej[0]) + '.';
    else s += rej.length + ' were rejected at 0.05: ' + rej.map(esc).join('; ') + '.';
    var nr = CARDS.filter(function (c) { return !c.rej; }).map(function (c) { return c.name + ' (n = ' + c.n + ')'; });
    s += nr.length ? ' Not rejected: ' + nr.map(esc).join('; ') + '.' : '';
    $("summary").innerHTML = s;
  })();

  /* ---------- sample size ---------- */
  var SZN = [10, 30, 100, 300, 1000, 3000, 10000, 30000, 100000];
  var NUDGE_PP = 2, NUDGE = P.slice(); NUDGE[1] -= NUDGE_PP / 100; NUDGE[2] += NUDGE_PP / 100;
  $("nNudge").textContent = NUDGE_PP;
  var cumB = B.cumulative(P), cumN = B.cumulative(NUDGE);
  var nudgeMad = (function () { var s = 0; for (var d = 1; d <= 9; d++) s += Math.abs(NUDGE[d] - P[d]); return s / 9; })();
  var SRC = [
    { id: "benford", name: "True Benford draws", seeded: true, gen: function (N, seed) { return B.sampleDigits(cumB, N, B.mulberry32(seed)); } },
    { id: "nudged", name: "Nudged draws", seeded: true, gen: function (N, seed) { return B.sampleDigits(cumN, N, B.mulberry32(seed)); } },
    { id: "sq", name: "Squares 1, 4, 9, ...", gen: function (N) { return B.countsOf(B.squares(N), N); } },
    { id: "cnt", name: "Counting numbers", gen: function (N) { return B.countsOf(B.counting(N), N); } },
    { id: "p2", name: "Powers of 2", max: 3000, gen: function (N) { return B.countsOf(SEQ[0].digs, N); } }
  ];
  var szSel = 0, seed = 1;
  function drawSz() {
    var q = SRC[szSel], idx = +$("szN").value;
    while (q.max && SZN[idx] > q.max) idx--;
    $("szN").value = idx;
    var N = SZN[idx], c = q.gen(N, seed);
    $("szNval").textContent = N + (q.seeded ? " (seed " + seed + ")" : "");
    $("redraw").style.display = q.seeded ? "" : "none";
    $("szOut").innerHTML = hist(c, N, label(q.name + ' with ' + N + ' values', c, N)) + '<p class="stats">' + esc(q.name) + ', ' + N + ' values. ' + verdict(c).html + '</p>' + shareTable(c, N);
    [].forEach.call($("szbtns").children, function (b, i) { b.setAttribute("aria-pressed", i === szSel ? "true" : "false"); });
  }
  SRC.forEach(function (q, i) {
    var b = document.createElement("button"); b.type = "button"; b.textContent = q.name;
    b.onclick = function () { szSel = i; drawSz(); }; $("szbtns").appendChild(b);
  });
  $("szN").oninput = drawSz;
  $("redraw").onclick = function () { seed++; drawSz(); };
  drawSz();

  var MN = [10, 30, 100, 300, 1000, 3000, 30000];
  (function () {
    var s = '<tr><th>Source</th>' + MN.map(function (n) { return '<th>n = ' + n + '</th>'; }).join('') + '</tr>';
    SRC.forEach(function (q) {
      s += '<tr><td>' + esc(q.name) + '</td>';
      MN.forEach(function (n) {
        if (q.max && n > q.max) { s += '<td class="small">not computed</td>'; return; }
        var v = verdict(q.gen(n, 1));
        s += '<td>' + (v.rej ? '<span class="rej">rejected</span>' : '<span class="okv">not rejected</span>') + '<br>' + B.pText(v.c.p) + '<br>MAD ' + f4(v.m) + '</td>';
      });
      s += '</tr>';
    });
    $("matrix").innerHTML = s;
    $("matrixNote").textContent = "Seed 1 for the two random sources. Nudged draws have an expected MAD of " + f4(nudgeMad) + " by construction. Each cell is one sample, so it can differ with another seed; the next table counts that.";
  })();

  /* ---------- repeated samples (async) ---------- */
  var TN = [20, 50, 100, 300, 1000, 3000, 10000], TRIALS = 1000, SEEDS = [11, 12, 13], TOTAL = TRIALS * SEEDS.length, CHK_N = 1000;
  $("nTrials").textContent = TRIALS;
  var trialResult = { pooled1000: null };
  function runTrials(done) {
    var rows = [], i = 0;
    function one() {
      if (i >= TN.length) { finish(); return; }
      var N = TN[i], nul = [], nud = 0, k, s;
      SEEDS.forEach(function (sd) {
        var rnd = B.mulberry32(sd * 1000 + N), r = 0;
        for (k = 0; k < TRIALS; k++) if (B.chiSquare(B.sampleDigits(cumB, N, rnd)).p < 0.05) r++;
        nul.push(r);
      });
      var rn = B.mulberry32(777 + N);
      for (k = 0; k < TRIALS; k++) if (B.chiSquare(B.sampleDigits(cumN, N, rn)).p < 0.05) nud++;
      rows.push({ N: N, nul: nul, nud: nud });
      if (N === CHK_N) trialResult.pooled1000 = nul.reduce(function (a, b) { return a + b; }, 0);
      i++; setTimeout(one, 0);
    }
    function finish() {
      var s = '<tr><th>Sample size</th><th>True Benford: rejected, by seed (' + SEEDS.join(', ') + ')</th><th>Nudged: rejected</th></tr>';
      rows.forEach(function (r) {
        s += '<tr><td>' + r.N + '</td><td>' + r.nul.map(function (v) { return v === 0 ? 'none' : v; }).join(', ') + ' of ' + TRIALS + ' each</td><td>' + (r.nud === 0 ? 'none' : r.nud === TRIALS ? 'all' : r.nud) + ' of ' + TRIALS + '</td></tr>';
      });
      $("trials").innerHTML = s;
      var last = rows[rows.length - 1];
      $("trialNote").textContent = "Nudged draws have a MAD of " + f4(nudgeMad) + " (convention band: " + B.madBand(nudgeMad) + ") and are rejected in " + last.nud + " of " + TRIALS + " samples at n = " + last.N + ", but in " + rows[0].nud + " of " + TRIALS + " at n = " + rows[0].N + ". Counts of samples rejected at p < 0.05 out of " + TRIALS + ". The chi-square tail is least reliable at the smallest sizes, where several digits expect fewer than 5 values.";
      done();
    }
    one();
  }

  /* ---------- self-checks ---------- */
  var checks = [];
  function add(name, fn) { checks.push({ name: name, fn: fn, state: "pending", detail: "" }); }
  add("The nine Benford shares add to 1 (tolerance 1e-12).", function () {
    var s = 0; for (var d = 1; d <= 9; d++) s += P[d]; return { ok: Math.abs(s - 1) < 1e-12, detail: "sum minus 1 = " + (s - 1).toExponential(2) };
  });
  add("Each exact sequence's nine counts add to its number of terms (" + MAXN + ").", function () {
    var bad = SEQ.filter(function (q) { var c = B.countsOf(q.digs, MAXN), t = 0; for (var d = 1; d <= 9; d++) t += c[d]; return t !== MAXN || c[0] !== 0; });
    return { ok: !bad.length, detail: bad.length ? bad.map(function (q) { return q.name; }).join(", ") + " differ" : "all " + SEQ.length + " match" };
  });
  add("Powers of 2: the exact first digit of 2^n matches the digit from the fractional part of n x log10(2), for n = 1 to " + MAXN + " (the float result is nudged up by 1e-9: 2^3 = 8 exactly but 10^frac comes out as 7.999999999999999).", function () {
    var bad = 0, L = Math.log10(2);
    for (var n = 1; n <= MAXN; n++) { var fr = n * L - Math.floor(n * L); if (Math.floor(Math.pow(10, fr) + 1e-9) !== SEQ[0].digs[n - 1]) bad++; }
    return { ok: bad === 0, detail: bad ? bad + " of " + MAXN + " terms differ" : "no term differs" };
  });
  add("Fibonacci: the exact first digit of F(n) matches the digit from n x log10(phi) - log10(sqrt 5), for n = 10 to " + MAXN + ".", function () {
    var bad = 0, L = Math.log10((1 + Math.sqrt(5)) / 2), K = Math.log10(Math.sqrt(5));
    for (var n = 10; n <= MAXN; n++) { var y = n * L - K, fr = y - Math.floor(y); if (Math.floor(Math.pow(10, fr) + 1e-9) !== SEQ[1].digs[n - 1]) bad++; }
    return { ok: bad === 0, detail: bad ? bad + " of " + (MAXN - 9) + " terms differ" : "no term differs" };
  });
  add("Factorials: the exact first digit of n! matches the digit from the running sum of log10(k), for n = 1 to " + MAXN + ".", function () {
    var bad = 0, s = 0;
    for (var n = 1; n <= MAXN; n++) { s += Math.log10(n); var fr = s - Math.floor(s); if (Math.floor(Math.pow(10, fr) + 1e-9) !== SEQ[2].digs[n - 1]) bad++; }
    return { ok: bad === 0, detail: bad ? bad + " of " + MAXN + " terms differ" : "no term differs" };
  });
  add("The chi-square tail (closed form for 8 degrees of freedom) agrees with numerical integration of the density, at 5% and 1%.", function () {
    function integ(c) { var a = c, b = 120, n = 20000, h = (b - a) / n, s = 0; function f(x) { return x * x * x * Math.exp(-x / 2) / 96; } for (var i = 0; i <= n; i++) s += f(a + i * h) * (i === 0 || i === n ? 1 : i % 2 ? 4 : 2); return s * h / 3; }
    var c5 = B.critical(8, 0.05), c1 = B.critical(8, 0.01), e5 = Math.abs(integ(c5) - 0.05), e1 = Math.abs(integ(c1) - 0.01);
    return { ok: e5 < 1e-6 && e1 < 1e-6, detail: "critical values " + c5.toFixed(3) + " and " + c1.toFixed(3) + "; integral errors " + e5.toExponential(1) + ", " + e1.toExponential(1) };
  });
  var SAMP_N = 200000, SAMP_TOL = 0.005;
  add("The sampler: " + SAMP_N.toLocaleString("en-US") + " draws from the Benford shares land within " + SAMP_TOL + " of every share.", function () {
    var N = SAMP_N, c = B.sampleDigits(cumB, N, B.mulberry32(5)), w = 0;
    for (var d = 1; d <= 9; d++) w = Math.max(w, Math.abs(c[d] / N - P[d]));
    return { ok: w < SAMP_TOL, detail: "largest gap " + w.toFixed(4) };
  });
  add("Every studio list's counted digits plus left-out values equal its length.", function () {
    var bad = [], names = ["tideNoaa", "tideTicon", "starRA", "starDec", "starId", "elementYear", "leapOffset", "leapMjd"];
    names.forEach(function (k) { var t = B.tally(D[k]); if (t.n + t.skipped !== D[k].length || t.n !== t.counts.reduce(function (a, b) { return a + b; }, 0)) bad.push(k); });
    return { ok: !bad.length, detail: bad.length ? bad.join(", ") + " differ" : names.length + " lists, " + names.map(function (k) { return D[k].length; }).join(" + ") + " values" };
  });
  add("The false-alarm rate of the chi-square test at n = " + CHK_N + " on true Benford draws is between 4% and 6% (" + TOTAL + " samples).", function () {
    var k = trialResult.pooled1000; if (k === null) return { ok: null, detail: "waiting for the repeated samples" };
    var r = k / TOTAL;
    return { ok: r >= 0.04 && r <= 0.06, detail: "rate " + B.pct(k, TOTAL) + " (" + k + " of " + TOTAL + ")" };
  });
  function fetchText(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }); }
  function same(a, b) { return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); }
  function slice(text, start, closer) { var i = text.indexOf(start) + start.length, j = text.indexOf(closer, i); return JSON.parse(text.slice(i, j + closer.length - 1)); }
  add("Re-read from the source files in the browser: leap-second offsets and MJDs match data.js.", function () {
    return fetchText("../leapseconds/leapseconds.csv").then(function (t) {
      var rows = t.trim().split(/\r?\n/).slice(1).map(function (l) { return l.split(","); });
      var ok = same(rows.map(function (r) { return +r[2]; }), D.leapOffset) && same(rows.map(function (r) { return +r[1]; }), D.leapMjd);
      return { ok: ok, detail: rows.length + " rows read" };
    });
  });
  add("Re-read from the source files in the browser: both tide amplitude lists match data.js.", function () {
    return fetchText("../tides/data.js").then(function (t) {
      var j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
      var ok = same(j.noaa.map(function (c) { return c.a; }), D.tideNoaa) && same(j.ticon.list.map(function (c) { return c.a; }), D.tideTicon);
      return { ok: ok, detail: j.noaa.length + " and " + j.ticon.list.length + " amplitudes read" };
    });
  });
  add("Re-read from the source files in the browser: star RA, Dec and row ids match data.js.", function () {
    return fetchText("../star-hop/index.html").then(function (t) {
      var ref = slice(t, "var REF = ", "};"), k = Object.keys(ref);
      var ok = same(k.map(function (n) { return ref[n][1]; }), D.starRA) && same(k.map(function (n) { return ref[n][2]; }), D.starDec) && same(k.map(function (n) { return ref[n][4]; }), D.starId);
      return { ok: ok, detail: k.length + " stars read" };
    });
  });
  add("Re-read from the source files in the browser: element discovery years match data.js.", function () {
    return fetchText("../elements/index.html").then(function (t) {
      var rows = slice(t, "var ROWS = ", "];"), yrs = rows.map(function (r) { return r[3]; }).filter(function (v) { return typeof v === "number"; });
      return { ok: same(yrs, D.elementYear), detail: rows.length + " rows read, " + yrs.length + " with a year" };
    });
  });

  var ul = $("checks");
  function render() {
    var pass = 0, fail = 0, other = 0;
    ul.innerHTML = checks.map(function (c) {
      if (c.state === "pass") pass++; else if (c.state === "fail") fail++; else other++;
      var w = c.state === "pass" ? '<span class="pass">pass</span>' : c.state === "fail" ? '<span class="fail">fail</span>' : '<span class="notrun">' + (c.state === "pending" ? "running" : "not run") + '</span>';
      return '<li>' + w + ' ' + esc(c.name) + ' <span class="small">' + esc(c.detail) + '</span></li>';
    }).join("");
    $("tally").textContent = checks.length + " self-checks: " + pass + " passed, " + fail + " failed, " + other + " not finished or not run. The four re-read checks read the same files as make_data.py with different code, written by the same author; all checks are by the same author.";
  }
  function runCheck(c) {
    return Promise.resolve().then(c.fn).then(function (r) {
      if (r.ok === null) { c.state = "pending"; c.detail = r.detail; } else { c.state = r.ok ? "pass" : "fail"; c.detail = r.detail; }
    }, function (e) { c.state = "notrun"; c.detail = "could not read the file (" + (e && e.message) + "); open the page from a web server"; });
  }
  render();
  Promise.all(checks.slice(0, -4).map(function (c) { return c.fn === undefined ? 0 : runCheck(c); })).then(render);
  checks.slice(-4).forEach(function (c) { runCheck(c).then(render); });
  setTimeout(function () {
    runTrials(function () { var c = checks[8]; runCheck(c).then(render); });
  }, 30);
  window.__benford = { checks: checks };
})();
