#!/usr/bin/env python3
"""Build Lamplight Mono: a monospaced typeface for printable ASCII (U+0020..U+007E, 95 glyphs).

Every glyph is a few centre-line strokes. Each stroke segment becomes a rectangle with square ends
(weight 80 units); overlapping rectangles are merged with skia-pathops, so the result is clean
TrueType outlines. Needs: fonttools, skia-pathops.   Run: python3 make_lamplight.py
"""
import json, math, os
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.recordingPen import DecomposingRecordingPen
import pathops

HERE = os.path.dirname(os.path.abspath(__file__))
UPM, ADV, W = 1000, 600, 80
H = W / 2
l, r, m = 130, 470, 300          # left, right, middle of the stroke centre-lines
b, x, t, d = 40, 460, 660, -160  # baseline, x-height, cap-height, descender centre-lines


def arc(cx, cy, rx, ry, a0, a1):
    n = max(2, math.ceil(abs(a1 - a0) / 12))
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + ry * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def oval(cx, cy, rx, ry):
    return arc(cx, cy, rx, ry, 0, 360)


def dot(px, py):
    return [(px, py), (px, py + 20)]


def flipx(strokes):
    return [[(600 - px, py) for px, py in s] for s in strokes]


S_TOP = lambda cy, ry, rx=165: arc(m, cy, rx, ry, 20, 270)
S_BOT = lambda cy, ry, rx=165: arc(m, cy, rx, ry, 90, -160)

G = {}
# ---- capitals
G['A'] = [[(l, b), (m, t), (r, b)], [(190, 230), (410, 230)]]
G['B'] = [[(l, b), (l, t)], [(l, t), (340, t)] + arc(340, 505, 130, 155, 90, -90) + [(l, 350)],
          [(l, 350), (360, 350)] + arc(360, 195, 110, 155, 90, -90) + [(l, b)]]
G['C'] = [arc(m, 350, 170, 310, 45, 315)]
G['D'] = [[(l, b), (l, t)], [(l, t), (250, t)] + arc(250, 350, 220, 310, 90, -90) + [(l, b)]]
G['E'] = [[(l, t), (l, b)], [(l, t), (r, t)], [(l, 350), (410, 350)], [(l, b), (r, b)]]
G['F'] = [[(l, t), (l, b)], [(l, t), (r, t)], [(l, 350), (410, 350)]]
G['G'] = [arc(m, 350, 170, 310, 40, 360) + [(m, 350)]]
G['H'] = [[(l, t), (l, b)], [(r, t), (r, b)], [(l, 350), (r, 350)]]
G['I'] = [[(190, t), (410, t)], [(190, b), (410, b)], [(m, b), (m, t)]]
G['J'] = [[(r, t), (r, 200)] + arc(m, 200, 170, 160, 0, -180)]
G['K'] = [[(l, t), (l, b)], [(r, t), (l, 300)], [(230, 360), (r, b)]]
G['L'] = [[(l, t), (l, b), (r, b)]]
G['M'] = [[(l, b), (l, t), (m, 200), (r, t), (r, b)]]
G['N'] = [[(l, b), (l, t), (r, b), (r, t)]]
G['O'] = [oval(m, 350, 170, 310)]
G['P'] = [[(l, b), (l, t)], [(l, t), (340, t)] + arc(340, 500, 130, 160, 90, -90) + [(l, 340)]]
G['Q'] = [oval(m, 350, 170, 310), [(350, 170), (480, 0)]]
G['R'] = G['P'] + [[(260, 340), (r, b)]]
G['S'] = [S_TOP(505, 155) + S_BOT(195, 155)]
G['T'] = [[(l, t), (r, t)], [(m, t), (m, b)]]
G['U'] = [[(l, t), (l, 200)] + arc(m, 200, 170, 160, 180, 360) + [(r, t)]]
G['V'] = [[(l, t), (m, b), (r, t)]]
G['W'] = [[(l, t), (190, b), (m, 350), (410, b), (r, t)]]
G['X'] = [[(l, t), (r, b)], [(r, t), (l, b)]]
G['Y'] = [[(l, t), (m, 350), (r, t)], [(m, 350), (m, b)]]
G['Z'] = [[(l, t), (r, t), (l, b), (r, b)]]
# ---- lower case
bowl = lambda: oval(m, 250, 170, 210)
G['a'] = [oval(290, 250, 160, 210), [(450, x), (450, b)]]
G['b'] = [[(l, t), (l, b)], bowl()]
G['c'] = [arc(m, 250, 170, 210, 40, 320)]
G['d'] = [bowl(), [(r, t), (r, b)]]
G['e'] = [[(l, 250), (r, 250)] + arc(m, 250, 170, 210, 0, 320)]
G['f'] = [[(250, b), (250, 560)] + arc(350, 560, 100, 100, 180, 60), [(140, x), (400, x)]]
G['g'] = [oval(m, 250, 170, 210), [(r, x), (r, -30)] + arc(m, -30, 170, 130, 0, -160)]
G['h'] = [[(l, t), (l, b)], arc(m, 330, 170, 130, 180, 0) + [(r, b)]]
G['i'] = [[(200, x), (m, x), (m, b)], [(200, b), (400, b)], dot(m, 590)]
G['j'] = [[(320, x), (320, -30)] + arc(200, -30, 120, 130, 0, -150), dot(320, 590)]
G['k'] = [[(l, t), (l, b)], [(r, x), (l, 230)], [(220, 300), (r, b)]]
G['l'] = [[(200, t), (m, t), (m, b)], [(m, b), (410, b)]]
G['m'] = [[(l, x), (l, b)], arc(215, 370, 85, 90, 180, 0) + [(m, b)], arc(385, 370, 85, 90, 180, 0) + [(r, b)]]
G['n'] = [[(l, x), (l, b)], arc(m, 330, 170, 130, 180, 0) + [(r, b)]]
G['o'] = [oval(m, 250, 170, 210)]
G['p'] = [[(l, x), (l, d)], bowl()]
G['q'] = [bowl(), [(r, x), (r, d)]]
G['r'] = [[(l, x), (l, b)], arc(m, 330, 170, 130, 180, 75)]
G['s'] = [arc(m, 355, 160, 105, 20, 270) + arc(m, 145, 160, 105, 90, -160)]
G['t'] = [[(250, 600), (250, 150)] + arc(350, 150, 100, 110, 180, 270) + [(430, b)], [(130, x), (400, x)]]
G['u'] = [[(l, x), (l, 240)] + arc(m, 240, 170, 200, 180, 360), [(r, x), (r, b)]]
G['v'] = [[(l, x), (m, b), (r, x)]]
G['w'] = [[(l, x), (190, b), (m, 330), (410, b), (r, x)]]
G['x'] = [[(l, x), (r, b)], [(r, x), (l, b)]]
G['y'] = [[(l, x), (287, b)], [(r, x), (200, d)]]
G['z'] = [[(l, x), (r, x), (l, b), (r, b)]]
# ---- digits
G['0'] = [oval(m, 350, 170, 310), [(220, 200), (380, 500)]]
G['1'] = [[(190, 520), (m, t), (m, b)], [(190, b), (410, b)]]
G['2'] = [arc(m, 500, 170, 160, 170, -40) + [(l, b), (r, b)]]
G['3'] = [arc(290, 505, 160, 155, 150, -90) + arc(m, 195, 170, 155, 90, -150)]
G['4'] = [[(380, b), (380, t), (l, 200), (r, 200)]]
G['5'] = [[(r, t), (160, t), (150, 370)] + arc(290, 210, 180, 170, 120, -150)]
G['6'] = [[(410, t), (150, 330), (l, 215)], oval(m, 215, 170, 175)]
G['7'] = [[(l, t), (r, t), (230, b)]]
G['8'] = [oval(m, 505, 150, 155), oval(m, 195, 170, 155)]
G['9'] = [oval(m, 485, 170, 175), [(r, 485), (450, 370), (190, b)]]
# ---- punctuation
G['!'] = [[(m, t), (m, 200)], dot(m, b)]
G['"'] = [[(220, t), (220, 520)], [(380, t), (380, 520)]]
G['#'] = [[(240, 640), (190, 60)], [(410, 640), (360, 60)], [(l, 450), (r, 450)], [(l, 250), (r, 250)]]
G['$'] = [S_TOP(505, 155) + S_BOT(195, 155), [(m, 720), (m, -20)]]
G['%'] = [oval(190, 540, 70, 90), oval(410, 160, 70, 90), [(r, t), (l, b)]]
G['&'] = [oval(260, 515, 100, 145), arc(290, 195, 160, 155, 60, 350) , [(260, 340), (r, b)]]
G["'"] = [[(m, t), (m, 520)]]
G['('] = [arc(500, 350, 280, 480, 140, 220)]
G[')'] = [arc(100, 350, 280, 480, -40, 40)]
G['*'] = [[(m, 640), (m, 360)], [(180, 570), (420, 430)], [(180, 430), (420, 570)]]
G['+'] = [[(170, 350), (430, 350)], [(m, 220), (m, 480)]]
G[','] = [[(m, 60), (260, -90)]]
G['-'] = [[(170, 290), (430, 290)]]
G['.'] = [dot(m, b)]
G['/'] = [[(440, 720), (160, -60)]]
G[':'] = [dot(m, b), dot(m, 380)]
G[';'] = [[(m, 60), (260, -90)], dot(m, 380)]
G['<'] = [[(430, 520), (170, 320), (430, 120)]]
G['='] = [[(150, 430), (450, 430)], [(150, 270), (450, 270)]]
G['>'] = [[(170, 520), (430, 320), (170, 120)]]
G['?'] = [arc(m, 500, 170, 160, 160, -45) + [(m, 280), (m, 200)], dot(m, b)]
G['@'] = [arc(m, 320, 170, 300, 5, 330), oval(290, 320, 70, 100), [(360, 420), (360, 250), (r, 250)]]
G['['] = [[(370, 680), (230, 680), (230, -20), (370, -20)]]
G['\\'] = [[(160, 720), (440, -60)]]
G[']'] = flipx(G['['])
G['^'] = [[(190, 500), (m, t), (410, 500)]]
G['_'] = [[(l, -100), (r, -100)]]
G['`'] = [[(250, t), (330, 560)]]
G['{'] = [[(390, 680), (340, 640), (340, 420), (240, 350), (340, 280), (340, 60), (390, 20)]]
G['|'] = [[(m, 720), (m, -160)]]
G['}'] = flipx(G['{'])
G['~'] = [[(l + 340 * i / 16, 330 + 60 * math.sin(2 * math.pi * i / 16)) for i in range(17)]]


def seg_rect(p, q):
    """Rectangle around segment p-q, W wide, ends extended by W/2 (square caps)."""
    dx, dy = q[0] - p[0], q[1] - p[1]
    ln = math.hypot(dx, dy)
    ux, uy = dx / ln, dy / ln
    nx, ny = -uy * H, ux * H
    a = (p[0] - ux * H, p[1] - uy * H); c = (q[0] + ux * H, q[1] + uy * H)
    return [(a[0] + nx, a[1] + ny), (c[0] + nx, c[1] + ny), (c[0] - nx, c[1] - ny), (a[0] - nx, a[1] - ny)]


def glyph_for(ch):
    path = pathops.Path()
    pen = path.getPen()
    for stroke in G.get(ch, []):
        for p, q in zip(stroke, stroke[1:]):
            if math.hypot(q[0] - p[0], q[1] - p[1]) < 0.5:
                continue
            poly = seg_rect(p, q)
            if (sum(poly[i][0] * poly[(i + 1) % 4][1] - poly[(i + 1) % 4][0] * poly[i][1] for i in range(4))) < 0:
                poly.reverse()  # make every rectangle the same direction so overlaps add up
            pen.moveTo(poly[0]); [pen.lineTo(pt) for pt in poly[1:]]; pen.closePath()
    path.simplify(fix_winding=True)  # union of all the rectangles
    # round to whole units, drop repeated neighbours, and turn every contour clockwise (TrueType's ink direction)
    tt = TTGlyphPen(None)
    rec = DecomposingRecordingPen(None)
    path.draw(rec)
    contours, cur = [], []
    for op, args in rec.value:
        if op in ('moveTo', 'lineTo'):
            pt = tuple(round(v) for v in args[0])
            if not cur or cur[-1] != pt:
                cur.append(pt)
        elif op in ('closePath', 'endPath'):
            if len(cur) > 1 and cur[0] == cur[-1]:
                cur.pop()
            contours.append(cur); cur = []
        else:
            raise SystemExit('unexpected op ' + op)
    for pts in contours:
        # pathops gives outer contours counter-clockwise; flip all of them
        pts = pts[::-1]
        tt.moveTo(pts[0]); [tt.lineTo(p) for p in pts[1:]]; tt.closePath()
    return tt.glyph()


chars = [chr(c) for c in range(0x20, 0x7F)]
names = {c: ('space' if c == ' ' else 'uni%04X' % ord(c)) for c in chars}
order = ['.notdef'] + [names[c] for c in chars]
glyphs = {'.notdef': None}
for c in chars:
    glyphs[names[c]] = glyph_for(c)
# .notdef: an open box
pen = TTGlyphPen(None)
for pts in ([(90, 0), (90, 700), (510, 700), (510, 0)], [(150, 60), (450, 60), (450, 640), (150, 640)]):
    pen.moveTo(pts[0]); [pen.lineTo(p) for p in pts[1:]]; pen.closePath()
glyphs['.notdef'] = pen.glyph()

fb = FontBuilder(UPM, isTTF=True)
fb.setupGlyphOrder(order)
fb.setupCharacterMap({ord(c): names[c] for c in chars})
fb.setupGlyf(glyphs)
glyf = fb.font['glyf']
fb.setupHorizontalMetrics({n: (ADV, glyf[n].xMin if hasattr(glyf[n], 'xMin') and glyf[n].numberOfContours else 0) for n in order})
fb.setupHorizontalHeader(ascent=800, descent=-200)
fb.setupNameTable({
    'familyName': 'Lamplight Mono', 'styleName': 'Regular', 'uniqueFontIdentifier': 'Lamplight Mono Regular 1.000',
    'fullName': 'Lamplight Mono Regular', 'version': 'Version 1.000', 'psName': 'LamplightMono-Regular',
    'copyright': 'Copyright 2026 The Lamplight Mono Project Authors (made by Claude, an AI model, for Vigil)',
    'licenseDescription': 'This Font Software is licensed under the SIL Open Font License, Version 1.1. '
                          'This license is available with a FAQ at: https://openfontlicense.org',
    'licenseInfoURL': 'https://openfontlicense.org', 'designer': 'Claude (an AI model)',
    'description': 'A monospaced typeface for printable ASCII, drawn from stroke skeletons.'})
fb.setupOS2(sTypoAscender=800, sTypoDescender=-200, sTypoLineGap=0, usWinAscent=900, usWinDescent=300,
            sxHeight=500, sCapHeight=700, usWeightClass=400, fsType=0, achVendID='VGIL')
fb.setupPost(isFixedPitch=1)
fb.setupDummyDSIG = None
fb.save(os.path.join(HERE, 'LamplightMono-Regular.ttf'))

# expected values written for the page to compare against (the page re-reads the font itself)
from fontTools.ttLib import TTFont
f = TTFont(os.path.join(HERE, 'LamplightMono-Regular.ttf'))
cm = f.getBestCmap(); gl = f['glyf']; hm = f['hmtx']
man = {'unitsPerEm': UPM, 'advance': ADV, 'count': len(chars), 'range': [0x20, 0x7E],
       'glyphs': {str(cp): {'contours': gl[n].numberOfContours, 'advance': hm[n][0]} for cp, n in sorted(cm.items())}}
json.dump(man, open(os.path.join(HERE, 'manifest.json'), 'w'), indent=1)
print('wrote', len(cm), 'cmap entries; glyphs incl .notdef:', len(f.getGlyphOrder()))
