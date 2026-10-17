// Renders popup.html in Chromium with a stubbed extension API (the real toolbar flow cannot be driven here),
// feeding it the real scanner's result for a fixture, then scans the popup itself with the same code.
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const here = path.dirname(new URL(import.meta.url).pathname);
const pw = require("/opt/node-tools/node_modules/playwright");
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell" });
const fixture = await browser.newPage();
await fixture.setContent(`<body style="background:#fff"><p style="color:#777">low</p><p style="color:#000">fine</p><div style="background:linear-gradient(red,blue)"><b style="color:#fff">grad</b></div></body>`);
await fixture.addScriptTag({ path: path.join(here, "../extension/contrast.js") });
const result = await fixture.evaluate(() => globalThis.VigilContrast.collect(document));
for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 400, height: 500 } });
  const p = await ctx.newPage();
  const errors = []; p.on("pageerror", e => errors.push(String(e))); p.on("console", m => m.type() === "error" && errors.push(m.text()));
  await p.addInitScript(r => { window.chrome = { tabs: { query: async () => [{ id: 1 }] }, scripting: { executeScript: async () => [{ result: r }] } }; }, result);
  await p.goto("file://" + path.join(here, "../extension/popup.html"));
  await p.click("#scan");
  await p.waitForSelector("li .r");
  console.log(scheme, JSON.stringify(await p.evaluate(() => [document.getElementById("status").textContent, document.getElementById("summary").innerText, [...document.querySelectorAll("li")].map(l => l.innerText.replace(/\n/g, " / "))])), "errors:", errors.length);
  await p.screenshot({ path: `/tmp/popup-${scheme}.png` });
  await p.uncheck("#onlyfail");
  await p.addScriptTag({ path: path.join(here, "../extension/contrast.js") });
  const self = await p.evaluate(() => { const r = globalThis.VigilContrast.collect(document); return { s: globalThis.VigilContrast.summarize(r), bad: r.rows.filter(x => x.ratio !== null && !x.aaa).map(x => [x.examples[0], globalThis.VigilContrast.show(x.ratio)]) }; });
  console.log(scheme, "popup scanned by itself:", JSON.stringify(self));
}
await browser.close();
