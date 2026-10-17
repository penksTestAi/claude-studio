#!/usr/bin/env node
// Runs game test files N times each, one file and one run at a time, and prints one exact count line per file.
// Builders and testers use it so a run's counts come from the loop itself, not from output cut by `tail`.
//
//   node game/tests/loop.mjs 5 beacon talk     run beacon.test.mjs 5 times, then talk.test.mjs 5 times
//   node game/tests/loop.mjs 1                 run every *.test.mjs in this folder once
//   LOGDIR=/some/dir node ...                  keep each run's full output there (default: a new folder in the OS temp dir)
//   RUN_TIMEOUT_S=600                          kill a single run after this many seconds and count it failed (default 600)
//   CHROME=/path/to/headless_shell             passed on to the tests (warned about if missing)
//
// Runs in the foreground and exits 1 if any run failed. Prints for each file: "<name> passed/N", and for every failed
// run its first failing lines (lines starting with FAIL) and the path of its full log.
import { spawn } from "node:child_process";
import { readdirSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const n = Math.max(1, Math.min(50, Number.parseInt(args[0], 10) || 1));
const all = readdirSync(here).filter(f => f.endsWith(".test.mjs")).sort();
const wanted = args.slice(1).map(a => a.replace(/\.test\.mjs$/, "").replace(/^.*\//, ""));
const files = wanted.length ? wanted.map(w => `${w}.test.mjs`) : all;
for (const f of files) if (!all.includes(f)) { console.error(`no such test file: ${f}`); process.exit(2); }
const timeoutS = Math.max(10, Number(process.env.RUN_TIMEOUT_S) || 600);
const logDir = process.env.LOGDIR || mkdtempSync(path.join(tmpdir(), "longwatch-loop-"));
mkdirSync(logDir, { recursive: true });
if (!process.env.CHROME) console.log("warning: CHROME is not set; the tests will try Playwright's default browser");
console.log(`# ${files.length} file(s) x ${n} run(s), logs in ${logDir}`);

function runOnce(file) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [path.join(here, file)], { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", d => { out += d; });
    child.stderr.on("data", d => { out += d; });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutS * 1000);
    child.on("close", code => {
      clearTimeout(timer);
      resolve({ code: timedOut ? "timeout" : code, out, secs: (Date.now() - t0) / 1000 });
    });
  });
}

const summary = [];
let anyFail = false;
for (const file of files) {
  const name = file.replace(/\.test\.mjs$/, "");
  let passed = 0;
  for (let i = 1; i <= n; i++) {
    const r = await runOnce(file);
    const okLines = (r.out.match(/^ok /gm) || []).length;
    const failLines = r.out.split("\n").filter(l => l.startsWith("FAIL"));
    const log = path.join(logDir, `${name}-${i}.log`);
    writeFileSync(log, r.out);
    const good = r.code === 0 && failLines.length === 0;
    if (good) passed++; else anyFail = true;
    console.log(`${name} run ${i}/${n}: ${good ? "pass" : "FAIL"} (exit ${r.code}, ${okLines} ok, ${failLines.length} FAIL, ${r.secs.toFixed(0)} s)`);
    if (!good) {
      for (const l of failLines.slice(0, 5)) console.log(`    ${l}`);
      console.log(`    full log: ${log}`);
    }
  }
  summary.push(`${name} ${passed}/${n}`);
  console.log(`${name} ${passed}/${n}`);
}
console.log(`# summary: ${summary.join(", ")}`);
process.exit(anyFail ? 1 : 0);
