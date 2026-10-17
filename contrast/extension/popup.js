(function () {
  "use strict";
  var api = typeof browser !== "undefined" ? browser : chrome;
  var C = globalThis.VigilContrast;
  var $ = function (id) { return document.getElementById(id); };
  var last = null;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  var FLAG = { image: "background image or gradient: not measured", "assumed-white": "no solid background found, white assumed", "translucent-bg": "translucent background (estimate)", "translucent-text": "translucent text colour (estimate)", opacity: "element opacity not applied (estimate)", unreadable: "colour could not be read" };

  function render() {
    if (!last) return;
    var sum = C.summarize(last), list = $("list"), onlyFail = $("onlyfail").checked;
    list.textContent = "";
    var sm = $("summary"); sm.textContent = "";
    sm.appendChild(el("p", "", sum.elements + " text element" + (sum.elements === 1 ? "" : "s") + " in " + sum.groups + " colour group" + (sum.groups === 1 ? "" : "s") + (last.truncated ? " (scan stopped at the limit)" : "") + "."));
    sm.appendChild(el("p", "", "Fail AA: " + sum.failAA + ". Pass AA but not AAA: " + sum.passAAfailAAA + ". Pass AAA: " + sum.passAAA + ". Not measured: " + sum.notMeasured + (sum.estimates ? ". Estimates: " + sum.estimates : "") + "."));
    var rows = C.sortRows(last.rows).filter(function (r) { return !onlyFail || r.ratio === null || !r.aaa; });
    if (!rows.length) list.appendChild(el("li", "", "None to show."));
    rows.forEach(function (r) {
      var li = el("li");
      var sw = el("span", "sw", "Aa"); sw.setAttribute("aria-hidden", "true");
      if (r.ratio !== null) { sw.style.color = r.fg; sw.style.background = r.bg; }
      li.appendChild(sw);
      var top = el("div", "r");
      if (r.ratio === null) top.appendChild(el("b", "", "not measured"));
      else {
        top.appendChild(el("b", "", C.show(r.ratio) + ":1"));
        top.appendChild(el("span", "mark " + (r.aa ? "pass" : "fail"), "AA " + (r.aa ? "pass" : "FAIL")));
        top.appendChild(document.createTextNode(" "));
        top.appendChild(el("span", "mark " + (r.aaa ? "pass" : "fail"), "AAA " + (r.aaa ? "pass" : "FAIL")));
        top.appendChild(document.createTextNode(" " + r.fg + " on " + r.bg + ", " + (r.large ? "large" : "normal") + " text, " + r.count + "x"));
      }
      li.appendChild(top);
      var ex = el("div", "ex", r.examples.join("  |  ") + (r.flags.length ? "  [" + r.flags.map(function (f) { return FLAG[f] || f; }).join("; ") + "]" : ""));
      li.appendChild(ex);
      list.appendChild(li);
    });
  }

  async function scan() {
    $("status").textContent = "Scanning...";
    try {
      var tabs = await api.tabs.query({ active: true, currentWindow: true });
      var tab = tabs[0];
      await api.scripting.executeScript({ target: { tabId: tab.id }, files: ["contrast.js"] });
      var out = await api.scripting.executeScript({ target: { tabId: tab.id }, func: function () { return globalThis.VigilContrast.collect(document); } });
      last = out && out[0] && out[0].result;
      if (!last) throw new Error("no result");
      $("status").textContent = "Scanned " + last.scanned + " visible text elements (" + last.skippedHidden + " hidden skipped).";
      render();
    } catch (e) {
      last = null; $("summary").textContent = ""; $("list").textContent = "";
      $("status").textContent = "This page cannot be scanned (browser pages, the extension store and some PDF viewers are off limits): " + (e && e.message ? e.message : e);
    }
  }
  $("scan").addEventListener("click", scan);
  $("onlyfail").addEventListener("change", render);
})();
