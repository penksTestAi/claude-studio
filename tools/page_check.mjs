#!/usr/bin/env node
// Open pages in headless Chromium at phone, tablet and desktop width, light and dark, and report what a person would notice:
// console errors, uncaught exceptions, sideways scrolling, ids used twice, tables or figures cut off. Saves a
// screenshot of each view. No model needed.
//
//   node tools/page_check.mjs [--root DIR] [--out DIR] workbench/ tea/
//
// --root is the folder served as the site (default: this repository). Paths are relative to it.
// Prints one line per view and exits 1 if any view has a problem. Screenshots go to --out (default /tmp/vigil-shots).
import { createServer } from "node:http";
import { readFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); if (i < 0) return dflt; const v = args[i + 1]; args.splice(i, 2); return v; };
const root = path.resolve(opt("--root", path.join(here, "..")));
const out = path.resolve(opt("--out", path.join(process.env.TMPDIR || "/tmp", "vigil-shots")));
const pages = args.length ? args : ["workbench/"];

const require = createRequire(import.meta.url);
let pw;
for (const id of ["playwright", "/opt/node-tools/node_modules/playwright", "playwright-core"]) {
  try { pw = require(id); break; } catch { /* try the next one */ }
}
if (!pw) { console.error("playwright not found (tried playwright, /opt/node-tools/node_modules/playwright, playwright-core)"); process.exit(2); }

async function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = "/opt/pw-browsers";
  if (!existsSync(base)) return undefined;
  for (const d of (await readdir(base)).filter(d => d.startsWith("chromium")).sort().reverse()) {
    for (const rel of ["chrome-linux/chrome", "chrome-linux64/chrome", "chrome-linux/headless_shell", "chrome-headless-shell-linux64/chrome-headless-shell"]) {
      const p = path.join(base, d, rel);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".xml": "application/xml",
  ".wasm": "application/wasm", ".woff2": "font/woff2", ".txt": "text/plain" };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try { const body = await readFile(file); res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" }).end(body); }
  catch { res.writeHead(404).end("not found"); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;

await mkdir(out, { recursive: true });
const executablePath = await findChrome();
const browser = await pw.chromium.launch(executablePath ? { executablePath } : {});
let bad = 0;
for (const page of pages) {
  // Phone, tablet (layout gaps hide at mid widths) and desktop.
  for (const [width, height] of [[375, 812], [768, 1024], [1100, 900]]) {
    for (const scheme of ["light", "dark"]) {
      const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
      const tab = await ctx.newPage();
      const errors = [];
      // "Failed to load resource" console lines carry no address; failed loads are reported below with theirs.
      tab.on("console", m => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(m.text().slice(0, 160)); });
      tab.on("pageerror", e => errors.push("exception: " + String(e.message).slice(0, 160)));
      tab.on("requestfailed", r => { if (r.url().startsWith(base)) errors.push("failed: " + r.url().slice(base.length)); });
      tab.on("response", r => { if (r.status() >= 400 && r.url().startsWith(base) && !r.url().endsWith("favicon.ico")) errors.push(`${r.status()}: ${r.url().slice(base.length)}`); });
      try { await tab.goto(base + page, { waitUntil: "networkidle", timeout: 30000 }); }
      catch (e) { errors.push("load: " + String(e.message).split("\n")[0]); }
      await tab.waitForTimeout(800);
      const info = await tab.evaluate(() => ({
        sw: document.documentElement.scrollWidth, iw: innerWidth, mode: document.compatMode,
        title: document.title, count: document.getElementById("count")?.textContent || "",
        // An id used twice makes links and labels find the wrong element.
        dupIds: (() => {
          const n = {};
          for (const el of document.querySelectorAll("[id]")) n[el.id] = (n[el.id] || 0) + 1;
          return Object.keys(n).filter(k => n[k] > 1);
        })(),
        // Wide tables, code and figures that are cut off: wider than their box with no scrolling ancestor,
        // or running past the right edge of the window.
        clipped: [...document.querySelectorAll("table, pre, figure, svg, canvas, img")].filter(el => {
          const r = el.getBoundingClientRect();
          if (!r.width || getComputedStyle(el).visibility === "hidden") return false;
          let scrolls = false;
          for (let a = el; a && a !== document.body; a = a.parentElement) {
            const ox = getComputedStyle(a).overflowX;
            if (ox === "auto" || ox === "scroll") { scrolls = true; break; }
          }
          if (scrolls) return false;
          const hiddenInside = el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === "hidden";
          return hiddenInside || r.right > innerWidth + 1 || r.left < -1;
        }).slice(0, 5).map(el => el.tagName.toLowerCase() + (el.id ? "#" + el.id : el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : "")),
      })).catch(() => ({}));
      const name = page.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "") || "root";
      const shot = path.join(out, `${name}-${width}-${scheme}.png`);
      await tab.screenshot({ path: shot }).catch(() => {});
      const issues = [...errors];
      if (info.sw > info.iw + 1) issues.push(`sideways scroll: page is ${info.sw}px wide in a ${info.iw}px window`);
      if (info.mode && info.mode !== "CSS1Compat") issues.push("quirks mode: missing <!doctype html>");
      if (info.dupIds?.length) issues.push(`id used more than once: ${info.dupIds.join(", ")}`);
      if (info.clipped?.length) issues.push(`cut off at this width (no scroll box): ${info.clipped.join(", ")}`);
      if (issues.length) bad++;
      console.log(`${issues.length ? "PROBLEM" : "ok     "} ${page} ${width}px ${scheme}${info.count ? ` | count: ${info.count}` : ""} | ${path.basename(shot)}`);
      for (const i of issues) console.log(`        - ${i}`);
      await ctx.close();
    }
  }
}
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
