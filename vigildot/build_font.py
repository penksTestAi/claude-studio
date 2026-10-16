#!/usr/bin/env python3
"""Build VigilDot-Regular.ttf and .woff from glyphs.py with fontTools (pinned in requirements.txt).
Units: 1 pixel = 100 font units, 1000 units per em. Cap height 7 px = 700. Advance 6 px = 600 (5 ink + 1 gap).
Lowercase letters are mapped to the capital glyphs (one glyph, two code points)."""
import os, sys
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from glyphs import G, NOTDEF

PX, UPM, ADV, ROWS = 100, 1000, 600, 7
HERE = os.path.dirname(os.path.abspath(__file__))
LICENCE = "This Font Software is licensed under the SIL Open Font License, Version 1.1. https://openfontlicense.org"

def glyph_name(ch):
    return "space" if ch == " " else "uni%04X" % ord(ch)

def draw(rows):
    pen = TTGlyphPen(None)
    for r, line in enumerate(rows):
        y1 = (ROWS - r) * PX; y0 = y1 - PX
        c = 0
        while c < 5:
            if line[c] == "#":
                s = c
                while c < 5 and line[c] == "#": c += 1
                x0, x1 = s * PX, c * PX
                pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()
            else:
                c += 1
    return pen.glyph()

def lsb(rows):
    cols = [c for line in rows for c in range(5) if line[c] == "#"]
    return min(cols) * PX if cols else 0

def main():
    order = [".notdef"] + [glyph_name(ch) for ch in G]
    cmap = {ord(ch): glyph_name(ch) for ch in G}
    for ch in G:
        if ch.isalpha(): cmap[ord(ch.lower())] = glyph_name(ch)
    glyphs = {".notdef": draw(NOTDEF)}
    for ch, rows in G.items(): glyphs[glyph_name(ch)] = draw(rows)
    rows_of = {".notdef": NOTDEF, **{glyph_name(ch): r for ch, r in G.items()}}
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics({n: (ADV, lsb(rows_of[n])) for n in order})
    fb.setupHorizontalHeader(ascent=800, descent=-200)
    fb.setupNameTable({
        "familyName": "Vigil Dot", "styleName": "Regular",
        "copyright": "Copyright 2026 Vigil (made by Claude, an AI model). Licensed under the SIL Open Font License 1.1. No Reserved Font Name.",
        "uniqueFontIdentifier": "VigilDot-Regular-1.0", "fullName": "Vigil Dot Regular", "psName": "VigilDot-Regular",
        "version": "Version 1.000", "licenseDescription": LICENCE, "licenseInfoURL": "https://openfontlicense.org",
    })
    fb.setupOS2(sTypoAscender=800, sTypoDescender=-200, sTypoLineGap=0, usWinAscent=800, usWinDescent=200,
                sCapHeight=700, sxHeight=700, fsType=0, achVendID="VGIL", xAvgCharWidth=ADV)
    fb.setupPost(isFixedPitch=1)
    fb.font["head"].fontRevision = 1.0
    for path, flavor in (("VigilDot-Regular.ttf", None), ("VigilDot-Regular.woff", "woff")):
        fb.font.flavor = flavor
        fb.save(os.path.join(HERE, path))
    print("built", len(order), "glyphs,", len(cmap), "code points")

if __name__ == "__main__":
    main()
