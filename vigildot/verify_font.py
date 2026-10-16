#!/usr/bin/env python3
"""Read VigilDot-Regular.ttf back with fontTools and check what the page claims. Writes results.json.
Checks: coverage from the cmap; every advance width equals the metrics; ink lies inside the ascent/descent box;
every outline coordinate is on the 100-unit pixel grid; the bitmap rebuilt from each outline equals glyphs.py;
the .woff holds the same cmap and widths as the .ttf; the licence string is in the name table."""
import json, os, sys
from fontTools.ttLib import TTFont
from glyphs import G, NOTDEF
HERE = os.path.dirname(os.path.abspath(__file__))
PX = 100

def bitmap_from_glyph(font, name):
    g = font["glyf"][name]
    rows = [["."] * 5 for _ in range(7)]
    if not g.numberOfContours:
        return ["".join(r) for r in rows]
    coords, ends = g.getCoordinates(font["glyf"])[0], g.endPtsOfContours
    start = 0
    for e in ends:
        pts = coords[start:e + 1]; start = e + 1
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        assert all(v % PX == 0 for v in xs + ys), "off grid in " + name
        for c in range(x0 // PX, x1 // PX):
            for r in range(y0 // PX, y1 // PX):
                rows[6 - r][c] = "#"
    return ["".join(r) for r in rows]

def main():
    ttf = TTFont(os.path.join(HERE, "VigilDot-Regular.ttf"))
    woff = TTFont(os.path.join(HERE, "VigilDot-Regular.woff"))
    cmap, hmtx, upm = ttf.getBestCmap(), ttf["hmtx"], ttf["head"].unitsPerEm
    checks = []
    def chk(label, ok, detail=""):
        checks.append({"label": label, "ok": bool(ok), "detail": detail})
    advs = {n: hmtx[n][0] for n in ttf.getGlyphOrder()}
    chk("every glyph (including .notdef) has advance 600", set(advs.values()) == {600}, str(sorted(set(advs.values()))))
    chk("hhea ascent/descent and OS/2 typo values agree", (ttf["hhea"].ascent, ttf["hhea"].descent) == (ttf["OS/2"].sTypoAscender, ttf["OS/2"].sTypoDescender), "800/-200")
    bad_bitmap = []; outside = []
    names = {}
    for ch, rows in G.items():
        n = cmap[ord(ch)]; names[ch] = n
        if bitmap_from_glyph(ttf, n) != rows: bad_bitmap.append(ch)
        g = ttf["glyf"][n]
        if g.numberOfContours and (g.yMin < -200 or g.yMax > 800 or g.xMin < 0 or g.xMax > advs[n]): outside.append(ch)
    if bitmap_from_glyph(ttf, ".notdef") != NOTDEF: bad_bitmap.append(".notdef")
    chk("bitmap rebuilt from each outline equals the source bitmap", not bad_bitmap, "differ: " + (", ".join(bad_bitmap) or "none"))
    chk("all ink inside the advance box and the ascent/descent box", not outside, "outside: " + (", ".join(outside) or "none"))
    chk("lowercase maps to the capital glyph", all(cmap[ord(c.lower())] == cmap[ord(c)] for c in G if c.isalpha()))
    chk(".woff has the same cmap and advances", woff.getBestCmap() == cmap and all(woff["hmtx"][n][0] == advs[n] for n in advs))
    lic = ttf["name"].getDebugName(13) or ""
    chk("name table carries the SIL OFL licence line", "SIL Open Font License, Version 1.1" in lic)
    chk("fsType is 0 (installable embedding allowed)", ttf["OS/2"].fsType == 0)
    printable = sorted(cmap)
    letters = [c for c in printable if chr(c).isalpha()]
    out = {
        "code_points": len(cmap), "glyphs_incl_notdef": len(ttf.getGlyphOrder()),
        "distinct_glyphs_in_cmap": len(set(cmap.values())),
        "letters": len(letters), "digits": sum(chr(c).isdigit() for c in printable),
        "punctuation_and_space": sum(not chr(c).isalnum() for c in printable),
        "units_per_em": upm, "advance": 600, "ascent": ttf["hhea"].ascent, "descent": ttf["hhea"].descent,
        "cap_height": ttf["OS/2"].sCapHeight, "bytes_ttf": os.path.getsize(os.path.join(HERE, "VigilDot-Regular.ttf")),
        "bytes_woff": os.path.getsize(os.path.join(HERE, "VigilDot-Regular.woff")),
        "fonttools": __import__("fontTools").version, "checks": checks,
    }
    json.dump(out, open(os.path.join(HERE, "results.json"), "w"), indent=1)
    for c in checks: print("ok  " if c["ok"] else "FAIL", c["label"], "-", c["detail"])
    print({k: v for k, v in out.items() if k != "checks"})
    sys.exit(0 if all(c["ok"] for c in checks) else 1)

if __name__ == "__main__":
    main()
