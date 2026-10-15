#!/usr/bin/env python3
"""Security scan for Vigil's three repositories, with no model needed.

    python3 tools/security_check.py                 # scans the studio and, if present, ../toys and ../vigilstudio
    VIGIL_PRIVATE_TERMS="a,b" python3 tools/security_check.py   # also searches for private words (kept out of git)

Exit 1 when anything is BLOCK (must be fixed before committing); WARN lines need a human-sized look.

BLOCK: tokens, keys and private key blocks; private terms; eval / new Function / string timers / document.write;
       HTML injection sinks (innerHTML and friends) in the game, which receives data from strangers;
       GitHub workflows that run on pull_request_target or put event text into a shell; executables;
       scripts from hosts outside the allowed CDNs; plain http:// for scripts, styles, frames or connections.
WARN:  HTML injection sinks in files that also read untrusted input (address bar, messages, network, storage); CDN scripts without a pinned version or an integrity hash;
       target="_blank" without rel="noopener"; forms or iframes pointing off-site; workflows with write permissions;
       a game page without a Content-Security-Policy.
Only files tracked by git are scanned (ignored local files are private and never published).
"""
import os
import re
import subprocess
import sys
from pathlib import Path

STUDIO = Path(__file__).resolve().parent.parent
REPOS = [STUDIO, STUDIO.parent / "toys", STUDIO.parent / "vigilstudio"]
TEXT = {".html", ".htm", ".js", ".mjs", ".cjs", ".py", ".md", ".json", ".yml", ".yaml", ".svg", ".css", ".txt", ".xml", ".sh"}
EXEC = {".exe", ".dll", ".bat", ".cmd", ".scr", ".msi", ".jar", ".apk", ".ps1", ".vbs", ".com"}
CDN = ("cdnjs.cloudflare.com", "cdn.jsdelivr.net", "unpkg.com", "esm.sh", "fonts.googleapis.com", "fonts.gstatic.com")

SECRETS = [
    ("GitHub token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})")),
    ("API key", re.compile(r"\b(?:sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|xox[abprs]-[A-Za-z0-9-]{10,})")),
    ("private key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("password or secret assignment", re.compile(r"""(?i)\b(?:password|passwd|secret|api_?key|access_?token)\s*[:=]\s*["'][^"'\s]{8,}["']""")),
]
DANGER_JS = [
    ("eval()", re.compile(r"(?<![\w.])eval\s*\(")),
    ("new Function()", re.compile(r"\bnew\s+Function\s*\(")),
    ("timer with a string", re.compile(r"\bset(?:Timeout|Interval)\s*\(\s*[\"'`]")),
    ("document.write", re.compile(r"\bdocument\.write(?:ln)?\s*\(")),
]
SINKS = re.compile(r"\.(?:innerHTML|outerHTML)\s*[+]?=|\binsertAdjacentHTML\s*\(|\bcreateContextualFragment\s*\(|\bsrcdoc\s*=")
# Where text from strangers can enter a page: the address bar, messages from other windows or players,
# network responses, and stored values. A page that has none of these only ever renders its own data.
UNTRUSTED = re.compile(r"location\.(?:hash|search|href)|URLSearchParams|addEventListener\(\s*[\"']message|onmessage|fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|document\.referrer|window\.name|onMessage|makeAction|RTCPeerConnection|WebSocket\(")
SCRIPT_SRC = re.compile(r"""<script[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>""", re.I)
URL_IMPORT = re.compile(r"""(?:\bimport\s*(?:[^"';]*?\bfrom\s*)?|\bimport\s*\()\s*["'](https?://[^"']+)["']""")
INSECURE = re.compile(r"""(?:src|href|action|data)\s*=\s*["']http://(?!localhost|127\.0\.0\.1)|new\s+WebSocket\(\s*["']ws://(?!localhost|127\.0\.0\.1)|fetch\(\s*["']http://(?!localhost|127\.0\.0\.1)""", re.I)
BLANK = re.compile(r"<a\b[^>]*target\s*=\s*[\"']_blank[\"'][^>]*>", re.I)
OFFSITE = re.compile(r"""<(?:form|iframe)\b[^>]*(?:action|src)\s*=\s*["']https?://(?!vigilstudio\.github\.io)""", re.I)


def tracked(repo):
    try:
        out = subprocess.run(["git", "ls-files"], cwd=repo, capture_output=True, text=True, check=True).stdout
        return [repo / f for f in out.splitlines() if f]
    except (OSError, subprocess.CalledProcessError):
        return []


def main():
    terms = [t.strip() for t in os.environ.get("VIGIL_PRIVATE_TERMS", "").split(",") if t.strip()]
    block, warn, quiet = [], [], [0]
    for repo in REPOS:
        if not (repo / ".git").exists():
            continue
        for path in tracked(repo):
            rel = f"{repo.name}/{path.relative_to(repo).as_posix()}"
            if not path.is_file():
                continue
            if path.suffix.lower() in EXEC:
                block.append(f"{rel}: executable file in a public repository")
                continue
            if path.suffix.lower() not in TEXT or path.stat().st_size > 2_000_000:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            vendored = "/vendor/" in "/" + rel or "/node_modules/" in rel
            is_scanner = rel.endswith("tools/security_check.py")
            in_game = "/game/" in "/" + path.relative_to(repo).as_posix() and repo == STUDIO
            reads_untrusted = bool(UNTRUSTED.search(text))
            for n, line in enumerate(text.splitlines(), 1):
                where = f"{rel}:{n}"
                if not is_scanner:
                    for label, pat in SECRETS:
                        if pat.search(line):
                            block.append(f"{where}: possible {label}")
                    low = line.lower()
                    for t in terms:
                        if t.lower() in low:
                            block.append(f"{where}: private term found")
                if vendored or is_scanner or path.suffix.lower() not in {".html", ".htm", ".js", ".mjs", ".cjs", ".svg"}:
                    continue
                for label, pat in DANGER_JS:
                    if pat.search(line):
                        block.append(f"{where}: {label}")
                if SINKS.search(line):
                    if in_game:
                        block.append(f"{where}: HTML injection sink in the game, which receives data from strangers: {line.strip()[:90]}")
                    elif reads_untrusted:
                        warn.append(f"{where}: HTML injection sink in a file that also reads untrusted input; make sure that input never reaches it: {line.strip()[:90]}")
                    else:
                        quiet[0] += 1
                for m in SCRIPT_SRC.finditer(line):
                    src = m.group(1)
                    if src.startswith("http://"):
                        block.append(f"{where}: script over plain http: {src}")
                    elif src.startswith("https://") or src.startswith("//"):
                        host = re.sub(r"^(?:https?:)?//", "", src).split("/")[0]
                        if host not in CDN:
                            block.append(f"{where}: script from a host outside the allowed CDNs: {host}")
                        else:
                            if not re.search(r"@\d+\.\d+\.\d+|/\d+\.\d+\.\d+/", src):
                                warn.append(f"{where}: CDN script without a pinned exact version: {src}")
                            if "integrity=" not in m.group(0):
                                warn.append(f"{where}: CDN script without an integrity hash (SRI): {src}")
                for m in URL_IMPORT.finditer(line):
                    host = m.group(1).split("/")[2]
                    if host not in CDN:
                        block.append(f"{where}: module imported from outside the allowed CDNs: {host}")
                if INSECURE.search(line):
                    block.append(f"{where}: plain http/ws resource: {line.strip()[:90]}")
                for m in BLANK.finditer(line):
                    if "noopener" not in m.group(0) and "noreferrer" not in m.group(0):
                        warn.append(f"{where}: target=_blank without rel=noopener")
                if OFFSITE.search(line):
                    warn.append(f"{where}: form or iframe pointing off-site: {line.strip()[:90]}")
            if path.suffix in {".yml", ".yaml"} and "/.github/workflows/" in "/" + path.relative_to(repo).as_posix():
                if re.search(r"^\s*pull_request_target\s*:", text, re.M) or "pull_request_target" in text:
                    block.append(f"{rel}: workflow runs on pull_request_target (lets strangers' pull requests run with secrets)")
                for n, line in enumerate(text.splitlines(), 1):
                    if re.search(r"\$\{\{\s*github\.event\.(?:issue|comment|pull_request|review|head_commit|discussion)", line):
                        block.append(f"{rel}:{n}: workflow puts event text into the job (script injection risk): {line.strip()[:90]}")
                if re.search(r"permissions\s*:\s*write-all|contents\s*:\s*write", text):
                    warn.append(f"{rel}: workflow has write permissions; make sure it only runs on trusted events")
    game_index = STUDIO / "game" / "index.html"
    if game_index.exists() and "Content-Security-Policy" not in game_index.read_text(encoding="utf-8", errors="ignore"):
        warn.append("vigilstudio.github.io/game/index.html: no Content-Security-Policy meta tag")

    for b in block:
        print("BLOCK  " + b)
    for w in warn:
        print("WARN   " + w)
    print(f"security_check: {len(block)} BLOCK, {len(warn)} WARN ({quiet[0]} innerHTML uses in pages that only render their own data, not listed)")
    sys.exit(1 if block else 0)


if __name__ == "__main__":
    main()
