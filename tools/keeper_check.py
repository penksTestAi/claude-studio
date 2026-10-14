#!/usr/bin/env python3
"""Mechanical checks for the Workbench and every piece page, with no model needed.

    python3 tools/keeper_check.py          # report only; exit 1 if anything needs fixing
    python3 tools/keeper_check.py --fix    # also add missing doctype/charset/viewport lines to piece pages

Checks: every later piece in the README table has exactly one item in the Workbench list (id="later"), with a link
that exists and the .when/.what spans, oldest first; the LATER-VISITS marker is the last thing in the list; every
index.html starts with doctype, charset and viewport; no old names or addresses outside the journals; the letter
still says who is behind Vigil. It never rewrites text; wording is left to the keeper.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIRST = {"workbench", "plate", "harmony", "zipf"}
ROW = re.compile(r"^\|\s*\*\*(?P<title>[^*]+)\*\*\s*\|\s*(?P<what>[^|]+?)\s*\|\s*\[`(?P<folder>[^`]+?)/?`\]")
OLD = re.compile(r"penksTestAi|penkstestai\.github\.io|claude-studio|funStylePage", re.I)
HEAD = ('<!doctype html>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n')
MONTHS = {m: i for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}


def main():
    fix = "--fix" in sys.argv
    problems, fixed = [], []

    folders = []
    for line in (ROOT / "README.md").read_text(encoding="utf-8").splitlines():
        m = ROW.match(line.strip())
        if m:
            folders.append(m["folder"].strip("/"))
    expected = [f for f in folders if f not in FIRST]

    wb = (ROOT / "workbench" / "index.html").read_text(encoding="utf-8")
    ol = re.search(r'<ol class="later" id="later">(.*?)</ol>', wb, re.S)
    if not ol:
        problems.append('workbench: list <ol class="later" id="later"> not found')
        items = []
    else:
        body = ol.group(1)
        items = re.findall(r"<li>.*?</li>", body, re.S)
        if not re.search(r"<!-- LATER-VISITS.*?-->\s*$", body, re.S):
            problems.append("workbench: the LATER-VISITS marker is not the last thing inside the list")
    seen, order = {}, []
    for li in items:
        m = re.search(r'<a href="\.\./([^/"]+)/index\.html">', li)
        if not m:
            problems.append(f"workbench: item without a '../<folder>/index.html' link: {li[:90]}")
            continue
        f = m.group(1)
        seen[f] = seen.get(f, 0) + 1
        if not (ROOT / f / "index.html").exists():
            problems.append(f"workbench: link to missing folder {f}/")
        if 'class="when"' not in li or 'class="what"' not in li:
            problems.append(f"workbench: item {f} lacks the .when or .what span")
        w = re.search(r'class="when">(\d{1,2}) (\w{3}) · (\d{2}):(\d{2})<', li)
        if w and w.group(2) in MONTHS:
            order.append(((MONTHS[w.group(2)], int(w.group(1)), int(w.group(3)), int(w.group(4))), f))
        else:
            problems.append(f"workbench: item {f} has no date like '14 Oct · 12:00'")
    for f in expected:
        if f not in seen:
            problems.append(f"workbench: missing item for {f}/ (in the README table)")
    for f, n in seen.items():
        if n > 1:
            problems.append(f"workbench: {f}/ listed {n} times")
        if f not in expected:
            problems.append(f"workbench: {f}/ is listed but not in the README table")
    # Dates carry no year; a list spanning New Year would need a smarter check.
    if [f for _, f in order] != [f for _, f in sorted(order)]:
        problems.append("workbench: items are not oldest-first by their dates")
    if "Anthropic" not in wb or "not an Anthropic project" not in wb:
        problems.append("workbench: the letter no longer says plainly that Vigil is not an Anthropic project")

    for page in sorted(ROOT.glob("*/index.html")):
        text = page.read_text(encoding="utf-8")
        start = text.lstrip()[:600].lower()
        ok = start.startswith("<!doctype html") and "charset" in start and 'name="viewport"' in start
        if not ok:
            if fix:
                page.write_text(HEAD + text, encoding="utf-8", newline="\n")
                fixed.append(f"{page.parent.name}/index.html: added doctype, charset and viewport")
            else:
                problems.append(f"{page.parent.name}/index.html: missing doctype, charset or viewport at the top")

    skip = {"STUDIO.md", "JOURNAL.md", "PLAYBOOK.md"}
    try:  # only what git publishes; ignored local files are private and never pushed
        tracked = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.splitlines()
        files = [ROOT / t for t in tracked if t]
    except (OSError, subprocess.CalledProcessError):
        files = [p for p in ROOT.rglob("*") if ".git" not in p.parts]
    for p in files:
        if not p.is_file() or p.name in skip or p.suffix not in {".html", ".md", ".py", ".mjs", ".js", ".xml", ".json", ".txt"}:
            continue
        if p.relative_to(ROOT).as_posix() == "tools/keeper_check.py":
            continue
        for n, line in enumerate(p.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            if OLD.search(line):
                problems.append(f"{p.relative_to(ROOT).as_posix()}:{n}: old name or address: {line.strip()[:100]}")

    print(f"Workbench: {len(items)} later items, {len(expected)} expected from the README; page shows {len(items) + 3} pieces")
    for f in fixed:
        print("FIXED  " + f)
    for p in problems:
        print("CHECK  " + p)
    if not problems:
        print("OK: nothing to fix")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
