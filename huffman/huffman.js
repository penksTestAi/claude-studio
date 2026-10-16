/* Huffman coding on bytes. Pure functions, no DOM. Made by Claude, an AI model, for Vigil. */
(function (root) {
  "use strict";

  // counts: array of 256 numbers. Returns the distinct bytes with their counts, sorted by (count, byte).
  function leavesFrom(counts) {
    var out = [];
    for (var b = 0; b < 256; b++) if (counts[b] > 0) out.push({ sym: b, w: counts[b] });
    out.sort(function (x, y) { return x.w - y.w || x.sym - y.sym; });
    return out.map(function (l, i) { return { id: i, w: l.w, sym: l.sym, left: null, right: null }; });
  }

  // rule "old": on equal weight the node made earlier goes first. rule "new": the node made later goes first.
  // The first node taken becomes the 0 side (left), the second the 1 side (right).
  function build(counts, rule) {
    var leaves = leavesFrom(counts);
    var pool = leaves.slice();
    var nextId = leaves.length;
    var steps = [];
    function better(a, b) {
      if (a.w !== b.w) return a.w < b.w;
      return rule === "new" ? a.id > b.id : a.id < b.id;
    }
    function takeMin() {
      var bi = 0;
      for (var i = 1; i < pool.length; i++) if (better(pool[i], pool[bi])) bi = i;
      return pool.splice(bi, 1)[0];
    }
    while (pool.length > 1) {
      var a = takeMin(), b = takeMin();
      var node = { id: nextId++, w: a.w + b.w, sym: -1, left: a, right: b };
      steps.push({ a: a, b: b, node: node });
      pool.push(node);
    }
    return { leaves: leaves, steps: steps, root: pool.length ? pool[0] : null };
  }

  // The forest (list of trees) after the first s merges. A merged node takes the place of its first part.
  function forestAt(built, s) {
    var f = built.leaves.slice();
    for (var t = 0; t < s; t++) {
      var st = built.steps[t];
      var ia = f.indexOf(st.a), ib = f.indexOf(st.b);
      f[ia] = st.node;
      f.splice(ib, 1);
    }
    return f;
  }

  // Code words as strings of 0 and 1, read off the tree. A tree of one leaf gets "0" by convention.
  function codesOf(root) {
    var codes = {};
    if (!root) return codes;
    if (!root.left) { codes[root.sym] = "0"; return codes; }
    (function walk(n, path) {
      if (!n.left) { codes[n.sym] = path; return; }
      walk(n.left, path + "0");
      walk(n.right, path + "1");
    })(root, "");
    return codes;
  }

  // bytes: Uint8Array or array. Returns a Uint8Array of bits (one 0 or 1 per element).
  function encode(bytes, codes) {
    var len = 0, i, c;
    for (i = 0; i < bytes.length; i++) len += codes[bytes[i]].length;
    var bits = new Uint8Array(len), p = 0;
    for (i = 0; i < bytes.length; i++) {
      c = codes[bytes[i]];
      for (var j = 0; j < c.length; j++) bits[p++] = c.charCodeAt(j) - 48;
    }
    return bits;
  }

  // Decode by walking the tree (it does not look at the code table). Stops after `count` symbols.
  // Returns {bytes, used, ok}; ok is false if the bits run out inside a code word.
  function decode(root, bits, count) {
    var out = new Uint8Array(count), p = 0, k = 0;
    if (count === 0) return { bytes: out, used: 0, ok: true };
    if (!root) return { bytes: out, used: 0, ok: false };
    if (!root.left) { // one-leaf tree: each bit (0) is one symbol
      for (; k < count && p < bits.length; k++, p++) out[k] = root.sym;
      return { bytes: out, used: p, ok: k === count };
    }
    while (k < count) {
      var n = root;
      while (n.left) {
        if (p >= bits.length) return { bytes: out, used: p, ok: false };
        n = bits[p++] === 0 ? n.left : n.right;
      }
      out[k++] = n.sym;
    }
    return { bytes: out, used: p, ok: true };
  }

  // Pack bits into bytes (last byte padded with zeros) and unpack them again given the bit length.
  function pack(bits) {
    var out = new Uint8Array(Math.ceil(bits.length / 8));
    for (var i = 0; i < bits.length; i++) if (bits[i]) out[i >> 3] |= 128 >> (i & 7);
    return out;
  }
  function unpack(packed, nbits) {
    var bits = new Uint8Array(nbits);
    for (var i = 0; i < nbits; i++) bits[i] = (packed[i >> 3] >> (7 - (i & 7))) & 1;
    return bits;
  }

  function entropy(counts, n) {
    var h = 0;
    for (var b = 0; b < 256; b++) if (counts[b] > 0) { var p = counts[b] / n; h -= p * Math.log2(p); }
    return h;
  }

  function countBytes(bytes) {
    var c = new Array(256).fill(0);
    for (var i = 0; i < bytes.length; i++) c[bytes[i]]++;
    return c;
  }

  function isPrefixFree(codes) {
    var list = Object.keys(codes).map(function (k) { return codes[k]; });
    for (var i = 0; i < list.length; i++)
      for (var j = 0; j < list.length; j++)
        if (i !== j && list[j].indexOf(list[i]) === 0) return false;
    return true;
  }

  // Kraft sum as an exact fraction over 2^maxLen: returns {num, den} with den = 2^maxLen.
  function kraft(codes) {
    var lens = Object.keys(codes).map(function (k) { return codes[k].length; });
    var m = Math.max.apply(null, lens), num = 0;
    lens.forEach(function (l) { num += Math.pow(2, m - l); });
    return { num: num, den: Math.pow(2, m) };
  }

  function label(b) {
    if (b === 32) return "space";
    if (b === 10) return "\\n";
    if (b === 9) return "\\t";
    if (b === 13) return "\\r";
    if (b > 32 && b < 127) return String.fromCharCode(b);
    return "0x" + (b < 16 ? "0" : "") + b.toString(16).toUpperCase();
  }


  function internalWeightSum(root) {
    if (!root || !root.left) return 0;
    return root.w + internalWeightSum(root.left) + internalWeightSum(root.right);
  }
  function treeWeightSum(root) { return root ? (root.left ? treeWeightSum(root.left) + treeWeightSum(root.right) : root.w) : 0; }

  // Everything the page shows, computed from the bytes. Each check is {name, status: "pass"|"fail"|"na", detail}.
  function analyse(bytes) {
    var n = bytes.length, counts = countBytes(bytes);
    var built = build(counts, "old"), k = built.leaves.length;
    var r = { n: n, counts: counts, built: built, k: k };
    if (n === 0) { r.empty = true; r.checks = []; return r; }
    var codes = codesOf(built.root), bits = encode(bytes, codes), packed = pack(bits);
    var dec = decode(built.root, unpack(packed, bits.length), n);
    var equalPos = 0;
    for (var i = 0; i < n; i++) if (dec.bytes[i] === bytes[i]) equalPos++;
    var H = entropy(counts, n), L = bits.length / n;
    var fixed8 = 8 * n, fixedMinWidth = Math.max(1, Math.ceil(Math.log2(k)));
    var alt = build(counts, "new"), altCodes = codesOf(alt.root), altBits = 0;
    Object.keys(counts).forEach(function (b) { if (counts[b] > 0) altBits += counts[b] * altCodes[b].length; });
    var altDiffer = 0;
    Object.keys(codes).forEach(function (b) { if (codes[b] !== altCodes[b]) altDiffer++; });
    r.codes = codes; r.bits = bits; r.packed = packed; r.dec = dec; r.H = H; r.L = L;
    r.fixed8 = fixed8; r.fixedMinWidth = fixedMinWidth; r.fixedMin = fixedMinWidth * n;
    r.altBits = altBits; r.altDiffer = altDiffer;
    var cs = [];
    var rtOk = dec.ok && dec.bytes.length === n && equalPos === n && dec.used === bits.length;
    cs.push({ name: "Round trip", status: rtOk ? "pass" : "fail",
      detail: "Encoded " + n + " bytes into " + bits.length + " bits (" + packed.length + " packed bytes), unpacked and decoded them by walking the tree: " +
        equalPos + " of " + n + " bytes equal the original, decoded length " + dec.bytes.length + " against " + n + ", " + dec.used + " of " + bits.length + " bits used." });
    if (k >= 2) {
      var pf = isPrefixFree(codes), kr = kraft(codes);
      cs.push({ name: "Prefix-free code", status: pf && kr.num === kr.den ? "pass" : "fail",
        detail: "Compared all " + (k * (k - 1)) + " ordered pairs of the " + k + " code words: " + (pf ? "none starts another" : "one starts another") +
          ". Kraft sum (add 2^-length over the code words) is " + kr.num + "/" + kr.den + (kr.num === kr.den ? ", exactly 1, so the tree is full." : ", not 1.") });
    } else {
      cs.push({ name: "Prefix-free code", status: "na", detail: "One distinct byte gives one code word, \"0\"; there is no second word to compare it with." });
    }
    var cnt = 0; counts.forEach(function (c) { cnt += c; });
    var rootW = built.root.w, leafW = treeWeightSum(built.root);
    cs.push({ name: "Counts add up", status: cnt === n && rootW === n && leafW === n ? "pass" : "fail",
      detail: "Counts of the " + k + " distinct byte values sum to " + cnt + "; the tree's root weight is " + rootW + "; its leaves sum to " + leafW + "; the text has " + n + " bytes." });
    if (k >= 2) {
      var iw = internalWeightSum(built.root);
      cs.push({ name: "Merge weights = encoded bits", status: iw === bits.length ? "pass" : "fail",
        detail: "Each merge adds its weight to the length of every code word below it. The " + (k - 1) + " merge weights sum to " + iw + "; the encoded text is " + bits.length + " bits." });
    } else {
      cs.push({ name: "Merge weights = encoded bits", status: "na", detail: "There are no merges with one distinct byte." });
    }
    cs.push({ name: "Average bits per byte at least H", status: L >= H - 1e-12 ? "pass" : "fail",
      detail: "L = " + bits.length + " / " + n + " = " + L.toFixed(4) + " bits per byte; entropy H = " + H.toFixed(4) + "." });
    if (k >= 2) {
      cs.push({ name: "Average bits per byte below H + 1", status: L < H + 1 ? "pass" : "fail",
        detail: "L = " + L.toFixed(4) + " against H + 1 = " + (H + 1).toFixed(4) + "." });
    } else {
      cs.push({ name: "Average bits per byte below H + 1", status: "na",
        detail: "With one distinct byte H = 0 and L = " + L.toFixed(4) + ", which equals H + 1: a code word cannot be shorter than one bit, so the strict bound is not tested here. (A decoder told the length in advance would need no bits at all.)" });
    }
    cs.push({ name: "Not longer than fixed 8-bit codes", status: bits.length <= fixed8 ? "pass" : "fail",
      detail: bits.length + " bits against " + fixed8 + " bits (8 per byte); the table that tells a decoder the code is not counted in either." });
    cs.push({ name: "Another tie-break gives the same size", status: altBits === bits.length ? "pass" : "fail",
      detail: "Joining the newest node first on equal weights gives " + altBits + " bits against " + bits.length + "; " + altDiffer + " of the " + k + " code words differ between the two trees." });
    r.checks = cs;
    return r;
  }

  function summary(checks) {
    var p = 0, f = 0, na = 0, failed = [];
    checks.forEach(function (c) { if (c.status === "pass") p++; else if (c.status === "fail") { f++; failed.push(c.name); } else na++; });
    var text = f ? f + " of " + checks.length + " checks failed: " + failed.join("; ") + "."
      : p + " of " + checks.length + " checks passed" + (na ? "; " + na + " not applicable to this input" : "") + ".";
    return { pass: p, fail: f, na: na, text: text };
  }

  var api = { analyse: analyse, summary: summary, leavesFrom: leavesFrom, build: build, forestAt: forestAt, codesOf: codesOf, encode: encode, decode: decode,
    pack: pack, unpack: unpack, entropy: entropy, countBytes: countBytes, isPrefixFree: isPrefixFree, kraft: kraft, label: label };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Huffman = api;
})(typeof self !== "undefined" ? self : this);
