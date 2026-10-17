#!/usr/bin/env python3
"""Build data.js for the Benford page from numbers other studio pieces already ship.
Nothing here is typed by hand: every value is read from the named file. Standard library only.
Run from anywhere:  python3 benford/make_data.py"""
import csv, json, re, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
out = {}

def js_object(text, name, opener, closer):
    i = text.index("var %s = " % name) + len("var %s = " % name)
    j = text.index(closer + ";", i)
    return json.loads(text[i:j + 1])

# star-hop: HYG v4.1 values copied into the page: name -> [constellation, RA h, Dec deg, V mag, HYG id]
sh = (root / "star-hop" / "index.html").read_text(encoding="utf-8")
ref = js_object(sh, "REF", "{", "}")
names = list(ref)
out["starRA"] = [ref[n][1] for n in names]
out["starDec"] = [ref[n][2] for n in names]
out["starId"] = [ref[n][4] for n in names]

# tides: harmonic constituent amplitudes (metres) from two lists
t = (root / "tides" / "data.js").read_text(encoding="utf-8")
tj = json.loads(t[t.index("{"):t.rindex("}") + 1])
out["tideNoaa"] = [c["a"] for c in tj["noaa"]]
out["tideTicon"] = [c["a"] for c in tj["ticon"]["list"]]

# elements: discovery year where source A gives a year
el = (root / "elements" / "index.html").read_text(encoding="utf-8")
rows = js_object(el, "ROWS", "[", "]")
out["elementYear"] = [r[3] for r in rows if isinstance(r[3], int)]
out["elementRows"] = len(rows)

# leap seconds: TAI-UTC offset (s) and the modified Julian day of each row
with open(root / "leapseconds" / "leapseconds.csv", newline="", encoding="utf-8") as f:
    lr = list(csv.DictReader(f))
out["leapOffset"] = [int(r["tai_minus_utc_s"]) for r in lr]
out["leapMjd"] = [int(r["mjd"]) for r in lr]

out["sources"] = {
    "starRA": "star-hop/index.html, REF, field 2 (HYG v4.1 RA, hours)",
    "starDec": "star-hop/index.html, REF, field 3 (HYG v4.1 Dec, degrees; absolute value taken in the page)",
    "starId": "star-hop/index.html, REF, field 5 (HYG database row id)",
    "tideNoaa": "tides/data.js, noaa[].a (constituent amplitude, m)",
    "tideTicon": "tides/data.js, ticon.list[].a (constituent amplitude, m)",
    "elementYear": "elements/index.html, ROWS field 4 (source A year; 'Ancient' rows left out)",
    "leapOffset": "leapseconds/leapseconds.csv, tai_minus_utc_s",
    "leapMjd": "leapseconds/leapseconds.csv, mjd",
}
(root / "benford" / "data.js").write_text(
    "/* Built by make_data.py from files already in this repository. No values typed by hand. */\n"
    "window.BENFORD_DATA = " + json.dumps(out, separators=(",", ":")) + ";\n", encoding="utf-8")
print({k: len(v) for k, v in out.items() if isinstance(v, list)}, "element rows", out["elementRows"])
