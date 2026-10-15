/* checkdigits.js: the same rules as checkdigits.py, plus the error audit the landing page runs.
   Works in the browser (window.CheckDigits) and in Node (module.exports). MIT licence. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CheckDigits = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DIG = '0123456789';
  var LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function normalise(s) { return String(s).replace(/[\s.\-]/g, '').toUpperCase(); }

  /* ---- the arithmetic. `v` names a variant; 'real' is the actual scheme.
     The other variants exist only so the page can switch one stated cause off. ---- */

  function luhnOk(s, v) {
    if (!/^[0-9]{2,}$/.test(s)) return false;
    var sum = 0, dbl = false;
    for (var i = s.length - 1; i >= 0; i--) {
      var d = s.charCodeAt(i) - 48;
      if (dbl) {
        if (v === 'nodouble') { /* leave the digit alone */ }
        else if (v === 'nofold') d = (2 * d) % 10;
        else { d *= 2; if (d > 9) d -= 9; }
      }
      sum += d; dbl = !dbl;
    }
    return sum % 10 === 0;
  }

  function isbn10Ok(s, v) {
    var mod = v === 'mod10' ? 10 : 11;
    if (!(mod === 10 ? /^[0-9]{10}$/ : /^[0-9]{9}[0-9X]$/).test(s)) return false;
    var sum = 0;
    for (var i = 0; i < 10; i++) {
      var c = s.charAt(i);
      sum += (10 - i) * (c === 'X' ? 10 : c.charCodeAt(0) - 48);
    }
    return sum % mod === 0;
  }

  var EAN_WEIGHTS = { real: [1, 3], allones: [1, 1], w15: [1, 5] };
  function ean13Ok(s, v) {
    if (!/^[0-9]{13}$/.test(s)) return false;
    var w = EAN_WEIGHTS[v] || EAN_WEIGHTS.real, sum = 0;
    for (var i = 0; i < 13; i++) sum += (s.charCodeAt(i) - 48) * w[i % 2];
    return sum % 10 === 0;
  }
  function isbn13Ok(s, v) { return ean13Ok(s, v) && /^97[89]/.test(s); }

  function ibanOk(s, v) {
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(s)) return false;
    var mod = v === 'mod100' ? 100 : 97;
    if (v !== 'mod100') { var cd = +s.slice(2, 4); if (cd < 2 || cd > 98) return false; }
    var t = s.slice(4) + s.slice(0, 4), rem = 0;
    for (var i = 0; i < t.length; i++) {
      var c = t.charCodeAt(i);
      if (c >= 48 && c <= 57) rem = (rem * 10 + (c - 48)) % mod;
      else { var n = c - 55; rem = (rem * 100 + n) % mod; }
    }
    return rem === 1;
  }

  var OK = { luhn: luhnOk, isbn10: isbn10Ok, isbn13: isbn13Ok, ean13: ean13Ok, iban: ibanOk };

  /* ---- verdicts for ordinary use ---- */

  function verdict(scheme, raw) {
    var s = normalise(raw), f = OK[scheme];
    if (!f) throw new Error('unknown scheme ' + scheme);
    var shape = {
      luhn: /^[0-9]{2,}$/, isbn10: /^[0-9]{9}[0-9X]$/, ean13: /^[0-9]{13}$/, isbn13: /^[0-9]{13}$/,
      iban: /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/
    }[scheme];
    if (!shape.test(s)) return { ok: false, kind: 'format', why: 'wrong shape for ' + scheme };
    if (scheme === 'isbn13' && !/^97[89]/.test(s)) return { ok: false, kind: 'format', why: 'an ISBN-13 starts with 978 or 979' };
    if (scheme === 'iban' && (+s.slice(2, 4) < 2 || +s.slice(2, 4) > 98)) return { ok: false, kind: 'format', why: 'check digits must be 02 to 98' };
    var ok = f(s, 'real');
    return { ok: ok, kind: ok ? 'ok' : 'checksum', why: ok ? 'check passes' : 'check fails' };
  }

  function guess(raw) {
    var s = normalise(raw);
    if (/^[A-Z]{2}[0-9]{2}/.test(s)) return 'iban';
    if (/^[0-9]{9}[0-9X]$/.test(s)) return 'isbn10';
    if (/^[0-9]{13}$/.test(s)) return /^97[89]/.test(s) ? 'isbn13' : 'ean13';
    if (/^[0-9]{2,}$/.test(s)) return 'luhn';
    return null;
  }

  /* ---- the audit ---- */

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* One layout per scheme: how long the code is, which symbols may stand at each position,
     which positions hold the check symbol(s). */
  var LAYOUTS = {
    luhn: {
      label: 'Luhn, 16 digits', len: 16, check: [15],
      alpha: function () { return DIG; }
    },
    isbn10: {
      label: 'ISBN-10', len: 10, check: [9],
      alpha: function (i, v) { return i === 9 && v !== 'mod10' ? DIG + 'X' : DIG; }
    },
    ean13: {
      label: 'EAN-13 / ISBN-13', len: 13, check: [12],
      alpha: function () { return DIG; }
    },
    iban: {
      label: 'IBAN, 22 characters (GB layout)', len: 22, check: [2, 3],
      alpha: function (i) { return (i < 2 || (i >= 4 && i < 8)) ? LET : DIG; }
    }
  };

  function makeValid(layout, v, ok, rnd) {
    for (var attempt = 0; attempt < 50; attempt++) {
      var code = [], i;
      for (i = 0; i < layout.len; i++) {
        var a = layout.alpha(i, v);
        code.push(a.charAt(Math.floor(rnd() * a.length)));
      }
      var cands = [];
      if (layout.check.length === 1) {
        var p = layout.check[0], a1 = layout.alpha(p, v);
        for (i = 0; i < a1.length; i++) {
          code[p] = a1.charAt(i);
          if (ok(code.join(''), v)) cands.push(a1.charAt(i));
        }
        if (cands.length) { code[p] = cands[Math.floor(rnd() * cands.length)]; return code; }
      } else {
        for (i = 0; i < 100; i++) {
          code[2] = DIG.charAt(Math.floor(i / 10)); code[3] = DIG.charAt(i % 10);
          if (ok(code.join(''), v)) cands.push(i);
        }
        if (cands.length) {
          var pick = cands[Math.floor(rnd() * cands.length)];
          code[2] = DIG.charAt(Math.floor(pick / 10)); code[3] = DIG.charAt(pick % 10);
          return code;
        }
      }
    }
    throw new Error('no valid code found for ' + layout.label + ' / ' + v);
  }

  /* Try every single-symbol substitution and every adjacent swap (of two different symbols)
     on `n` seeded random valid codes. Returns the tallies and what was missed. */
  function audit(schemeId, v, n, seed) {
    var layout = LAYOUTS[schemeId], ok = OK[schemeId === 'ean13' ? 'ean13' : schemeId];
    var rnd = mulberry32(seed >>> 0);
    var sub = { tried: 0, caught: 0, missed: {}, positions: {} };
    var swp = { tried: 0, caught: 0, skipped: 0, missed: {}, positions: {} };
    var validCount = 0;
    for (var k = 0; k < n; k++) {
      var code = makeValid(layout, v, ok, rnd);
      if (!ok(code.join(''), v)) throw new Error('generated code is not valid');
      validCount++;
      var i, j, a;
      for (i = 0; i < layout.len; i++) {
        a = layout.alpha(i, v);
        var orig = code[i];
        for (j = 0; j < a.length; j++) {
          var sym = a.charAt(j);
          if (sym === orig) continue;
          code[i] = sym;
          sub.tried++;
          if (ok(code.join(''), v)) {
            var key = orig + '>' + sym;
            sub.missed[key] = (sub.missed[key] || 0) + 1;
            sub.positions[i] = (sub.positions[i] || 0) + 1;
          } else sub.caught++;
        }
        code[i] = orig;
      }
      for (i = 0; i + 1 < layout.len; i++) {
        var x = code[i], y = code[i + 1];
        if (x === y) continue;
        if (layout.alpha(i, v).indexOf(y) < 0 || layout.alpha(i + 1, v).indexOf(x) < 0) { swp.skipped++; continue; }
        code[i] = y; code[i + 1] = x;
        swp.tried++;
        if (ok(code.join(''), v)) {
          var pk = x < y ? x + '<>' + y : y + '<>' + x;
          swp.missed[pk] = (swp.missed[pk] || 0) + 1;
          swp.positions[i] = (swp.positions[i] || 0) + 1;
        } else swp.caught++;
        code[i] = x; code[i + 1] = y;
      }
    }
    return { scheme: schemeId, variant: v, codes: validCount, layout: layout, sub: sub, swap: swp };
  }

  function sum(obj) { var t = 0; for (var k in obj) t += obj[k]; return t; }

  /* Facts the page quotes as causes. Each is computed here, not typed. */
  function isPrime(n) { if (n < 2) return false; for (var d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; }
  function gcd(a, b) { return b ? gcd(b, a % b) : Math.abs(a); }
  function luhnTable(v) {
    var t = [];
    for (var d = 0; d < 10; d++) t.push(v === 'nofold' ? (2 * d) % 10 : (function (x) { x *= 2; return x > 9 ? x - 9 : x; })(d));
    return t;
  }
  function isbn10Weights(mod) {
    var w = [], zero = 0, seen = {}, distinct = true;
    for (var i = 0; i < 10; i++) {
      var x = (10 - i) % mod; w.push(x);
      if (x === 0) zero++;
      if (seen[x]) distinct = false;
      seen[x] = 1;
    }
    return { weightsMod: w, distinctMod: distinct, zeroWeights: zero };
  }

  return {
    normalise: normalise, verdict: verdict, guess: guess, OK: OK, LAYOUTS: LAYOUTS,
    audit: audit, sum: sum, isPrime: isPrime, gcd: gcd, luhnTable: luhnTable, isbn10Weights: isbn10Weights,
    EAN_WEIGHTS: EAN_WEIGHTS
  };
});
