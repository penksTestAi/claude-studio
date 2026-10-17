/* Subject colour contrast: the WCAG 2 formula and a page scanner.
   One file, used by the extension popup, the landing page and the Node tests.
   Made by Claude, an AI model. MIT licence (see LICENSE). No network, no storage. */
(function (root) {
  "use strict";

  // sRGB channel (0..255) to linear light. WCAG 2.0 printed 0.03928 as the knee, WCAG 2.1 errata and the sRGB
  // standard use 0.04045; for 8-bit values both give the same number (checked on the landing page).
  function lin(c8, knee) {
    var c = c8 / 255;
    return c <= (knee || 0.04045) ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function luminance(rgb, knee) {
    return 0.2126 * lin(rgb[0], knee) + 0.7152 * lin(rgb[1], knee) + 0.0722 * lin(rgb[2], knee);
  }
  function ratio(a, b, knee) {
    var la = luminance(a, knee), lb = luminance(b, knee);
    var hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }
  // Large text: at least 18 pt (24 CSS px), or 14 pt (18.66 px) and bold (weight 700 or more).
  var LIMITS = { largePx: 24, largeBoldPx: 18.66, boldWeight: 700, aa: 4.5, aaLarge: 3, aaa: 7, aaaLarge: 4.5 };
  function isLarge(px, weight) { return px >= LIMITS.largePx || (px >= LIMITS.largeBoldPx && weight >= LIMITS.boldWeight); }
  // WCAG 1.4.3 (AA) and 1.4.6 (AAA). The raw ratio is compared, never a rounded one.
  function verdict(r, large) {
    return { aa: r >= (large ? LIMITS.aaLarge : LIMITS.aa), aaa: r >= (large ? LIMITS.aaaLarge : LIMITS.aaa) };
  }
  // Shown value: cut (not rounded) to two decimals, so a display never reads 4.50 for a ratio below 4.5.
  function show(r) { return (Math.floor(r * 100 + 1e-9) / 100).toFixed(2); }

  function hex(rgb) {
    return "#" + rgb.map(function (v) { return ("0" + Math.round(v).toString(16)).slice(-2); }).join("").toUpperCase();
  }
  function parseHex(s) {
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(s).trim());
    if (!m) return null;
    var h = m[1];
    if (h.length === 3) h = h.replace(/./g, "$&$&");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  // rgb(), rgba() (comma or space syntax) and #hex. Returns [r,g,b,a] or null.
  function parseCss(s) {
    s = String(s).trim();
    var h = parseHex(s);
    if (h) return [h[0], h[1], h[2], 1];
    var m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/i.exec(s);
    if (!m) return null;
    var a = m[4] === undefined ? 1 : parseFloat(m[4]) / (m[5] ? 100 : 1);
    return [+m[1], +m[2], +m[3], Math.max(0, Math.min(1, a))];
  }
  // Source-over: a colour with alpha laid on an opaque colour.
  function over(top, base) {
    var a = top[3] === undefined ? 1 : top[3];
    return [0, 1, 2].map(function (i) { return top[i] * a + base[i] * (1 - a); });
  }

  // ---- page scanner (needs a DOM) ----
  var canvasCtx = null;
  function toRgba(doc, str) {
    var p = parseCss(str);
    if (p) return p;
    // Colours the browser reports in another syntax (lab, oklch, color()): let a canvas convert to sRGB.
    try {
      if (!canvasCtx) { var c = doc.createElement("canvas"); c.width = c.height = 1; canvasCtx = c.getContext("2d", { willReadFrequently: true }); }
      canvasCtx.clearRect(0, 0, 1, 1);
      canvasCtx.fillStyle = "#000"; canvasCtx.fillStyle = str;
      canvasCtx.fillRect(0, 0, 1, 1);
      var d = canvasCtx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    } catch (e) { return null; }
  }
  function describe(el) {
    var s = el.tagName.toLowerCase();
    if (el.id) s += "#" + el.id;
    else if (el.classList && el.classList.length) s += "." + el.classList[0];
    return s;
  }

  function collect(doc, opts) {
    var limit = (opts && opts.limit) || 4000;
    var win = doc.defaultView;
    var seen = new Set(), groups = new Map(), order = [];
    var scanned = 0, skippedHidden = 0, truncated = false;
    var walker = doc.createTreeWalker(doc.body || doc.documentElement, NodeFilter.SHOW_TEXT);
    var n;
    while ((n = walker.nextNode())) {
      var el = n.parentElement;
      if (!el || seen.has(el) || !n.nodeValue.trim()) continue;
      seen.add(el);
      var tag = el.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEMPLATE") continue;
      if (scanned >= limit) { truncated = true; break; }
      var cs = win.getComputedStyle(el);
      var rect = el.getBoundingClientRect();
      if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse" || (rect.width === 0 && rect.height === 0)) { skippedHidden++; continue; }
      scanned++;
      var flags = [];
      var fg = toRgba(doc, cs.color);
      var layers = [], bgImage = false, opaque = false, opacity = 1;
      for (var node = el; node && node.nodeType === 1; node = node.parentElement) {
        var s2 = win.getComputedStyle(node);
        var o = parseFloat(s2.opacity); if (!isNaN(o)) opacity *= o;
        if (!opaque && !bgImage) {
          if (s2.backgroundImage && s2.backgroundImage !== "none") { bgImage = true; }
          else {
            var b = toRgba(doc, s2.backgroundColor);
            if (b && b[3] > 0) { layers.push(b); if (b[3] >= 1) opaque = true; }
          }
        }
      }
      var size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
      if (cs.fontWeight === "bold") weight = 700;
      var large = isLarge(size, weight);
      var row = { text: n.nodeValue.trim().replace(/\s+/g, " ").slice(0, 60), tag: describe(el), size: size, weight: weight, large: large, flags: flags };
      if (!fg) { flags.push("unreadable"); row.ratio = null; }
      else if (bgImage) { flags.push("image"); row.ratio = null; row.fg = hex(fg); }
      else {
        var base = [255, 255, 255];
        if (!opaque) flags.push("assumed-white");
        var bg = base;
        for (var i = layers.length - 1; i >= 0; i--) { if (layers[i][3] < 1) flags.push("translucent-bg"); bg = over(layers[i], bg).map(Math.round); }
        if (fg[3] < 1) flags.push("translucent-text");
        var fgOpaque = over(fg, bg).map(Math.round);
        if (opacity < 0.999) flags.push("opacity");
        row.fg = hex(fgOpaque); row.bg = hex(bg);
        row.ratio = ratio(fgOpaque, bg);
        var v = verdict(row.ratio, large); row.aa = v.aa; row.aaa = v.aaa;
      }
      flags = flags.filter(function (f, k) { return flags.indexOf(f) === k; }); row.flags = flags;
      var key = [row.fg, row.bg, row.large, flags.join("+"), row.ratio === null ? row.tag : ""].join("|");
      var g = groups.get(key);
      if (g) { g.count++; if (g.examples.length < 3) g.examples.push(row.tag + ": " + row.text); }
      else { row.count = 1; row.examples = [row.tag + ": " + row.text]; groups.set(key, row); order.push(row); }
    }
    return { rows: order, scanned: scanned, skippedHidden: skippedHidden, truncated: truncated };
  }

  // Counts, computed from the rows (one row = one group of elements sharing colours and size class).
  function summarize(res) {
    var s = { elements: 0, groups: res.rows.length, measured: 0, notMeasured: 0, failAA: 0, passAAfailAAA: 0, passAAA: 0, estimates: 0, failGroupsAA: 0, failGroupsAAA: 0 };
    res.rows.forEach(function (r) {
      s.elements += r.count;
      if (r.ratio === null) { s.notMeasured += r.count; return; }
      s.measured += r.count;
      if (r.flags.some(function (f) { return f !== "assumed-white"; })) s.estimates += r.count;
      if (!r.aa) { s.failAA += r.count; s.failGroupsAA++; }
      else if (!r.aaa) s.passAAfailAAA += r.count;
      else s.passAAA += r.count;
      if (!r.aaa) s.failGroupsAAA++;
    });
    return s;
  }
  function sortRows(rows) {
    function rank(r) { return r.ratio === null ? 3 : !r.aa ? 0 : !r.aaa ? 1 : 2; }
    return rows.slice().sort(function (a, b) { return rank(a) - rank(b) || (a.ratio || 0) - (b.ratio || 0); });
  }

  root.VigilContrast = { LIMITS: LIMITS, lin: lin, luminance: luminance, ratio: ratio, isLarge: isLarge, verdict: verdict, show: show, hex: hex, parseHex: parseHex, parseCss: parseCss, over: over, collect: collect, summarize: summarize, sortRows: sortRows };
  if (typeof module !== "undefined" && module.exports) module.exports = root.VigilContrast;
})(typeof globalThis !== "undefined" ? globalThis : this);
