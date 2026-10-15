#!/usr/bin/env python3
"""Turn game/CHANGELOG.md into the player-facing patch notes on game/index.html. No model needed.

    python3 tools/game_patchnotes.py

Every `### date · title` entry in the changelog becomes one version (v0.1 is the first entry, then v0.2, ...),
shown newest first as a <details> block that opens and closes without any script. The newest is open.
From each entry it shows what players care about: "Players can now" (New), "Also fixed" (Fixed) and
"Unverified" (Not yet checked); the test logs and the network internals stay in the changelog.
The notes go between <!-- PATCHNOTES:START --> and <!-- PATCHNOTES:END -->, which are created just before the
"What this is, plainly" section the first time. Everything is HTML-escaped. Safe to run any number of times.
"""
import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOG = ROOT / "game" / "CHANGELOG.md"
PAGE = ROOT / "game" / "index.html"
START, END = "<!-- PATCHNOTES:START (written by tools/game_patchnotes.py from CHANGELOG.md) -->", "<!-- PATCHNOTES:END -->"
SHOW = [("players can now", "New"), ("also fixed", "Fixed"), ("fixed", "Fixed"), ("unverified", "Not yet checked")]


def inline(text):
    """Escape, then allow the changelog's own **bold** and `code`."""
    t = html.escape(text, quote=False)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    return t


def entries(md):
    parts = re.split(r"^### +", md, flags=re.M)[1:]
    out = []
    for part in parts:
        head, _, body = part.partition("\n")
        date, _, title = head.partition("·")
        bullets, cur = [], None
        for line in body.splitlines():
            if line.startswith("- "):
                cur = [line[2:].strip()]
                bullets.append(cur)
            elif line.startswith("  ") and cur is not None and line.strip():
                cur.append(line.strip())
        sections = {}
        for b in bullets:
            text = " ".join(b)
            m = re.match(r"\*\*(.+?)[.:]?\*\*[.:]?\s*(.*)", text, re.S)
            if not m:
                continue
            key = m.group(1).strip().lower().rstrip(":.")
            for want, label in SHOW:
                if key == want:
                    sections.setdefault(label, []).append(m.group(2).strip())
                    break
        out.append({"date": date.strip(), "title": title.strip() or date.strip(), "sections": sections})
    return out


def render(items):
    rows = [START, '<section class="panel notes" id="notes" aria-labelledby="notes-h">',
            '  <h2 id="notes-h">Patch notes</h2>',
            '  <p class="small">The game grows a little every two hours. Newest first; open a version to see what it added.</p>']
    for i, e in reversed(list(enumerate(items))):
        version = f"v0.{i + 1}"
        opened = " open" if i == len(items) - 1 else ""
        rows.append(f'  <details class="ver"{opened}>')
        rows.append(f'    <summary><b>{version}</b> · {inline(e["title"])} <span class="when">{inline(e["date"])}</span></summary>')
        if not e["sections"]:
            rows.append('    <p class="small">No player-facing changes in this version.</p>')
        for label in ("New", "Fixed", "Not yet checked"):
            for text in e["sections"].get(label, []):
                rows.append(f'    <p><span class="tag t-{label.split()[0].lower()}">{label}</span> {inline(text)}</p>')
        rows.append("  </details>")
    rows += ["</section>", END]
    return "\n".join(rows)


CSS = """
/* Patch notes (tools/game_patchnotes.py) */
.notes .ver{border-top:1px solid var(--line);padding:8px 0}
.notes .ver:first-of-type{border-top:0}
.notes summary{cursor:pointer;padding:4px 0;list-style-position:inside}
.notes summary:focus-visible{outline:2px solid var(--acc);outline-offset:2px;border-radius:4px}
.notes .when{color:var(--muted);font-size:.85em;margin-left:6px;white-space:nowrap}
.notes .ver p{margin:8px 0 0}
.notes .tag{display:inline-block;font-size:.75em;font-weight:700;padding:1px 7px;border-radius:999px;border:1px solid var(--line);margin-right:4px}
.notes .t-new{color:var(--acc)}
.notes .t-not{color:var(--muted)}
"""


def main():
    items = entries(LOG.read_text(encoding="utf-8"))
    page = PAGE.read_text(encoding="utf-8")
    block = render(items)
    if START in page:
        page = re.sub(re.escape(START) + r".*?" + re.escape(END), lambda _: block, page, count=1, flags=re.S)
    else:
        anchor = page.find('<section class="panel honest"')
        if anchor < 0:
            sys.exit('game/index.html: no "What this is, plainly" section to put the notes before')
        page = page[:anchor] + block + "\n\n  " + page[anchor:]
    if "Patch notes (tools/game_patchnotes.py)" not in page:
        page = page.replace("</style>", CSS.lstrip("\n") + "</style>", 1)
    PAGE.write_text(page, encoding="utf-8", newline="\n")
    print(f"patch notes: {len(items)} versions written to game/index.html")


if __name__ == "__main__":
    main()
