// Run: node contrast/tests/test.mjs   (from the studio root; needs Playwright + Chromium for the page part)
import { createRequire } from "node:module";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const here = path.dirname(new URL(import.meta.url).pathname);
const C = require(path.join(here, "../extension/contrast.js"));
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const near = (a, b, e, m) => { assert.ok(Math.abs(a - b) <= e, m + ` (${a} vs ${b})`); n++; };

// Formula facts
near(C.luminance([255, 255, 255]), 1, 1e-12, "white luminance"); near(C.luminance([0, 0, 0]), 0, 1e-12, "black luminance");
near(C.ratio([0, 0, 0], [255, 255, 255]), 21, 1e-9, "21:1"); near(C.ratio([9, 9, 9], [9, 9, 9]), 1, 1e-12, "1:1");
near(C.ratio([10, 20, 30], [200, 210, 220]), C.ratio([200, 210, 220], [10, 20, 30]), 1e-12, "symmetric");
// Both knees agree for every 8-bit channel value
let maxd = 0; for (let v = 0; v < 256; v++) maxd = Math.max(maxd, Math.abs(C.lin(v, 0.04045) - C.lin(v, 0.03928))); ok(maxd < 1e-6, "knees agree " + maxd);
// Thresholds and the boundary
ok(C.verdict(4.5, false).aa && !C.verdict(4.4999, false).aa, "AA boundary"); ok(C.verdict(7, false).aaa && !C.verdict(6.999, false).aaa, "AAA boundary");
ok(C.verdict(3, true).aa && !C.verdict(2.99, true).aa && C.verdict(4.5, true).aaa, "large");
ok(C.isLarge(24, 400) && !C.isLarge(23.9, 400) && C.isLarge(18.66, 700) && !C.isLarge(18.66, 600) && !C.isLarge(18.6, 700), "large text size");
ok(C.show(4.4999) === "4.49" && C.show(4.5) === "4.50" && C.show(21) === "21.00", "display never rounds up");
// Parsing
ok(C.parseCss("rgb(1, 2, 3)").join() === "1,2,3,1" && C.parseCss("rgba(1,2,3,0.5)")[3] === 0.5 && C.parseCss("rgb(1 2 3 / 50%)")[3] === 0.5 && C.parseCss("#abc").join() === "170,187,204,1" && C.parseCss("oklch(0.5 0.1 20)") === null, "parse");
ok(C.over([255, 0, 0, 0.5], [255, 255, 255]).map(Math.round).join() === "255,128,128", "over");

// Page scanner in headless Chromium
let pw; for (const id of ["playwright", "/opt/node-tools/node_modules/playwright"]) { try { pw = require(id); break; } catch {} }
let exe; const base = "/opt/pw-browsers"; if (existsSync(base)) for (const d of readdirSync(base).filter(d => d.startsWith("chromium")).sort().reverse()) for (const rel of ["chrome-linux/chrome", "chrome-linux64/chrome", "chrome-linux/headless_shell", "chrome-headless-shell-linux64/chrome-headless-shell"]) if (!exe && existsSync(path.join(base, d, rel))) exe = path.join(base, d, rel);
if (!pw || !exe) { console.log("no Chromium: page part skipped; " + n + " checks passed"); process.exit(0); }
const browser = await pw.chromium.launch({ executablePath: exe });
const page = await browser.newPage();
await page.setContent(`<body style="margin:0;background:#fff;font:16px sans-serif">
<p id=a style="color:#777777">grey on white</p>
<p id=b style="color:#767676">darker grey</p>
<div style="background:#000063"><div style="background:#808080"><span id=c style="color:#000063">nested</span></div></div>
<h1 id=d style="color:#949494;font-size:24px;font-weight:400">large pale</h1>
<p id=e style="color:#949494;font-size:18.66px;font-weight:700">bold pale</p>
<div style="background:linear-gradient(red,blue)"><span id=f style="color:#fff">on gradient</span></div>
<div style="background:rgba(0,0,0,0.5)"><span id=g style="color:#fff">half black</span></div>
<p style="display:none">hidden</p><p style="visibility:hidden">hidden too</p>
<p id=h style="color:oklch(0.5 0 0)">oklch grey</p>
<p id=i style="color:#777777">grey on white again</p>
</body>`);
await page.addScriptTag({ path: path.join(here, "../extension/contrast.js") });
const res = await page.evaluate(() => globalThis.VigilContrast.collect(document));
const row = t => res.rows.find(r => r.examples.some(e => e.includes(t)));
const exp = (fg, bg) => C.ratio(C.parseHex(fg), C.parseHex(bg));
near(row("grey on white").ratio, exp("#777777", "#FFFFFF"), 1e-9, "777 on white"); ok(row("grey on white").count === 2 && !row("grey on white").aa, "grouped and fails AA");
ok(row("darker grey").aa && !row("darker grey").aaa, "767676 passes AA only");
near(row("nested").ratio, exp("#000063", "#808080"), 1e-9, "nested uses nearest opaque background"); ok(row("nested").aa, "nested AA");
ok(row("large pale").large && row("large pale").aa && !row("large pale").aaa, "large pale 3:1 AA, not AAA");
ok(row("bold pale").large && row("bold pale").aa, "bold 18.66 is large");
ok(row("on gradient").ratio === null && row("on gradient").flags.includes("image"), "gradient not measured");
ok(row("half black").flags.includes("translucent-bg") && Math.abs(row("half black").ratio - exp("#FFFFFF", "#808080")) < 0.01, "translucent estimate " + row("half black").ratio);
ok(!res.rows.some(r => r.examples.some(e => e.includes("hidden"))) && res.skippedHidden === 2, "hidden skipped");
ok(row("oklch grey").fg === "#636363", "oklch converted " + row("oklch grey").ratio + " " + row("oklch grey").fg);
const s = C.summarize(res);
ok(s.elements === s.measured + s.notMeasured && s.measured === s.failAA + s.passAAfailAAA + s.passAAA, "counts add up");
console.log(JSON.stringify(s));
await browser.close();
console.log(n + " checks passed");
