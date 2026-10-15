#!/usr/bin/env python3
"""Generate sliderule.pdf (a printable paper slide rule) and manifest.json.

Needs: reportlab==4.2.5 (pip install -r requirements.txt). Nothing is fetched.

Every tick position is computed here from log10:  x = x0 + length * log10(value)
  C, D   one decade, 250 mm long, ticks every 0.02 (1-2), 0.05 (2-5), 0.1 (5-10)
  CI     the C scale reversed (x = x0 + length * (1 - log10 value)), red
  A, B   two decades, each 125 mm, ticks every 0.05 / 0.1 / 0.2 of the decade's mantissa
Values are kept as integers (hundredths of the mantissa) so there is no float drift in which ticks exist.

Run:  python3 make_sliderule.py     (writes sliderule.pdf and manifest.json next to this file)
Then: python3 verify_sliderule.py   (measures the PDF back and fills the checks into index.html)
"""
import json
import math
import os

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

HERE = os.path.dirname(os.path.abspath(__file__))
PDF = os.path.join(HERE, "sliderule.pdf")
MANIFEST = os.path.join(HERE, "manifest.json")

L_MM = 250.0            # printed length of one decade of C / D (index to index)
PAGE_W_MM = landscape(A4)[0] / mm
PAGE_H_MM = landscape(A4)[1] / mm
X0 = round((PAGE_W_MM - L_MM) / 2, 3)   # left index of every scale, mm from the page's left edge

# Tick steps, in hundredths of the mantissa, for mantissa ranges [lo, hi) in hundredths.
FINE = [(100, 200, 2), (200, 500, 5), (500, 1000, 10)]      # C, D, CI over 250 mm
COARSE = [(100, 200, 5), (200, 500, 10), (500, 1000, 20)]   # A, B: each decade is only 125 mm


def mantissas(profile):
    """Integer mantissas (hundredths) 100..1000 at which a decade has a tick; 1000 is the next decade's 1."""
    out = []
    for lo, hi, step in profile:
        out.extend(range(lo, hi, step))
    out.append(1000)
    return out


def tick_values(kind):
    """List of (value, level) for a scale. level 0 = major (numbered), 1 = medium, 2 = minor."""
    if kind in ("C", "D", "CI"):
        res = []
        for m in mantissas(FINE):
            if m % 100 == 0:
                lvl = 0
            elif (m < 200 and m % 10 == 0) or (m >= 200 and m % 50 == 0):
                lvl = 1
            else:
                lvl = 2
            res.append((m / 100.0, lvl))
        return res
    res = []
    for dec in (0, 1):
        for m in mantissas(COARSE)[:-1]:      # the closing 1000 is the next decade's 100
            if m % 100 == 0:
                lvl = 0
            elif m % 50 == 0:
                lvl = 1
            else:
                lvl = 2
            res.append((m / 100.0 * 10 ** dec, lvl))
    res.append((100.0, 0))
    return res


def position_mm(kind, value):
    """Tick position from the left index, in mm, from log10."""
    if kind in ("C", "D"):
        return L_MM * math.log10(value)
    if kind == "CI":
        return L_MM * (1 - math.log10(value))
    return (L_MM / 2) * math.log10(value)       # A, B: two decades over the same 250 mm


# name -> (edge y in mm from page bottom, direction of ticks: +1 up, -1 down, colour, side note)
STATOR_H, SLIDE_H, GAP = 20.0, 34.0, 6.0
Y_ST1_BOTTOM = 140.0
Y_SLIDE_TOP = Y_ST1_BOTTOM - GAP
Y_SLIDE_BOTTOM = Y_SLIDE_TOP - SLIDE_H
Y_ST2_TOP = Y_SLIDE_BOTTOM - GAP
Y_ST2_BOTTOM = Y_ST2_TOP - STATOR_H
Y_RULER = 48.0
SCALES = {
    "A": dict(edge=Y_ST1_BOTTOM, dir=+1, rgb=(0, 0, 0), note="x²"),
    "B": dict(edge=Y_SLIDE_TOP, dir=-1, rgb=(0, 0, 0), note="x²"),
    "CI": dict(edge=Y_SLIDE_BOTTOM + 13.0, dir=+1, rgb=(0.7, 0.05, 0.05), note="1/x"),
    "C": dict(edge=Y_SLIDE_BOTTOM, dir=+1, rgb=(0, 0, 0), note="x"),
    "D": dict(edge=Y_ST2_TOP, dir=-1, rgb=(0, 0, 0), note="x"),
}
LEN = {0: 4.5, 1: 3.2, 2: 2.0}          # tick length in mm by level
WID = {0: 0.5, 1: 0.35, 2: 0.25}        # line width in points by level


def draw_scale(c, name, spec):
    kind = name
    ticks = tick_values(kind)
    edge, d = spec["edge"], spec["dir"]
    c.setStrokeColorRGB(*spec["rgb"])
    c.setFillColorRGB(*spec["rgb"])
    entries = []
    for value, lvl in ticks:
        x = X0 + position_mm(kind, value)
        c.setLineWidth(WID[lvl])
        c.line(x * mm, edge * mm, x * mm, (edge + d * LEN[lvl]) * mm)
        entries.append(dict(value=value, level=lvl, x_mm=x))
        label = None
        size = 7
        if lvl == 0:
            label = ("%g" % value)
        elif kind in ("C", "D", "CI") and value < 2 and lvl == 1:
            label = "%.1f" % value
            size = 4.5
        if label:
            c.setFont("Helvetica", size)
            tip = edge + d * (LEN[lvl] + 0.8)
            y = tip if d > 0 else tip - 0.72 * size / 72 * 25.4
            c.drawCentredString(x * mm, y * mm, label)
    # name at the left, what it computes at the right
    c.setFont("Helvetica-Bold", 8)
    y_name = edge + d * 2.0 - (1.2 if d > 0 else 1.2)
    c.drawRightString((X0 - 3.5) * mm, y_name * mm, name)
    c.setFont("Helvetica", 7)
    c.drawString((X0 + L_MM + 6.5) * mm, y_name * mm, spec["note"])
    return entries


def cut_box(c, y_bottom, h, fill=None):
    x_left, x_right = X0 - 9.0, X0 + L_MM + 12.0
    if fill:
        c.setFillColorRGB(*fill)
        c.rect(x_left * mm, y_bottom * mm, (x_right - x_left) * mm, h * mm, stroke=0, fill=1)
    c.setStrokeColorRGB(0.45, 0.45, 0.45)
    c.setLineWidth(0.4)
    c.setDash(2, 2)
    c.rect(x_left * mm, y_bottom * mm, (x_right - x_left) * mm, h * mm, stroke=1, fill=0)
    c.setDash()


def text_lines(c, x, y, lines, size=8.5, lead=4.2):
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica", size)
    for i, t in enumerate(lines):
        c.drawString(x * mm, (y - i * lead) * mm, t)


def page_one(c, manifest):
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(X0 * mm, 196 * mm, "Paper slide rule: C/D, A/B and CI scales")
    text_lines(c, X0, 189, [
        "Print at 100%% (“Actual size”, not “Fit to page”). Cut along the dashed lines. "
        "Scale D must measure %g mm from its left “1” to its “10”; the bar at the bottom must measure 100 mm." % L_MM,
        "Glue the two outer strips to card with exactly the slide's height (%g mm) between them, slide the middle strip in "
        "between, and use the cursor from page 2. Details are on page 2." % SLIDE_H,
    ], size=8)
    # strips
    cut_box(c, Y_ST1_BOTTOM, STATOR_H, fill=(0.97, 0.96, 0.92))
    cut_box(c, Y_SLIDE_BOTTOM, SLIDE_H, fill=(0.89, 0.93, 0.98))
    cut_box(c, Y_ST2_BOTTOM, STATOR_H, fill=(0.97, 0.96, 0.92))
    c.setFillColorRGB(0.35, 0.35, 0.35)
    c.setFont("Helvetica", 6)
    c.drawString((X0 - 7.5) * mm, (Y_ST1_BOTTOM + STATOR_H - 3) * mm, "STATOR (top)")
    c.drawString((X0 + 20) * mm, (Y_SLIDE_BOTTOM + 22.5) * mm, "SLIDE (cut out; it slides between the two stator strips)")
    c.drawString((X0 - 7.5) * mm, (Y_ST2_BOTTOM + 2) * mm, "STATOR (bottom)")
    c.drawRightString((X0 + L_MM + 10.5) * mm, (Y_ST1_BOTTOM + STATOR_H - 3) * mm,
                      "Vigil paper slide rule. Made by Claude, an AI model. Marks computed from log10.")
    out = {}
    for name, spec in SCALES.items():
        out[name] = draw_scale(c, name, spec)
    # 100 mm check bar, 1 mm ticks
    c.setStrokeColorRGB(0, 0, 0)
    c.setFillColorRGB(0, 0, 0)
    bar = []
    for i in range(0, 101):
        x = X0 + i * 1.0
        lvl = 0 if i % 10 == 0 else (1 if i % 5 == 0 else 2)
        c.setLineWidth(WID[lvl])
        ln = {0: 4.5, 1: 3.2, 2: 2.0}[lvl]
        c.line(x * mm, Y_RULER * mm, x * mm, (Y_RULER + ln) * mm)
        bar.append(dict(value=i, level=lvl, x_mm=x))
        if i % 10 == 0:
            c.setFont("Helvetica", 7)
            c.drawCentredString(x * mm, (Y_RULER - 3.6) * mm, str(i))
    c.setFont("Helvetica", 7)
    c.drawString((X0 + 106) * mm, (Y_RULER + 0.5) * mm,
                 "Ruler check: this bar is 100 mm long, 1 mm per mark, when printed at 100%.")
    out["RULER"] = bar
    manifest_scales = {}
    for name, entries in out.items():
        if name == "RULER":
            manifest_scales[name] = dict(edge_mm=Y_RULER, dir=1, kind="ruler", ticks=entries)
        else:
            s = SCALES[name]
            manifest_scales[name] = dict(edge_mm=s["edge"], dir=s["dir"], kind=name, ticks=entries)
    manifest["scales"] = manifest_scales


CURSOR_W, CURSOR_H = 24.0, 80.0
Y_CURSOR = 50.0


def page_two(c, manifest):
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(X0 * mm, 196 * mm, "Making it, and using it")
    text_lines(c, X0, 187, [
        "Making it",
        "1. Print page 1 at 100% on A4 paper, landscape (thicker paper or card is better). Check the 100 mm bar with a ruler.",
        "2. Cut out the three strips along the dashed lines. The slide (middle) is %g mm tall." % SLIDE_H,
        "3. Glue the two outer strips onto card so the edge of A and the edge of D face each other, %g mm apart "
        "(the slide's height), with the slide sliding between." % SLIDE_H,
        "   Without card you can lay the three strips side by side on a table, edges touching, and slide the middle one by hand.",
        "4. Cursor: print this page on a clear transparency sheet, or draw a line with a fine pen on thin card; cut out the box on the right.",
        "",
        "Multiplying a × b (C and D)",
        "1. Slide the left “1” of C over a on D.",
        "2. Find b on C. Read what is on D directly below it. That is a × b, but check where the decimal point goes by estimating (2 × 3 is about 6).",
        "3. If b on C hangs off the right end of D, use C's right “10” over a instead, and read below b. The answer then has one digit fewer before the point.",
        "",
        "Dividing a by b",
        "Put b on C over a on D. Read D under C's left \u201c1\u201d (or under its right \u201c10\u201d if the left one is off the scale).",
        "",
        "Other scales",
        "A and B are like D and C but squeezed to cover two decades (1 to 100) in the same length. With the hairline over x on D, A shows x squared.",
        "CI is C written backwards: at any place, CI shows 10 divided by the number that C shows there.",
    ], size=8.5, lead=5.3)
    # cursor
    x = X0 + L_MM - CURSOR_W - 12
    c.setStrokeColorRGB(0.45, 0.45, 0.45)
    c.setLineWidth(0.4)
    c.setDash(2, 2)
    c.rect(x * mm, Y_CURSOR * mm, CURSOR_W * mm, CURSOR_H * mm, stroke=1, fill=0)
    c.setDash()
    hair_x = x + CURSOR_W / 2
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(0.25)
    c.line(hair_x * mm, (Y_CURSOR + 2) * mm, hair_x * mm, (Y_CURSOR + CURSOR_H - 2) * mm)
    c.setFont("Helvetica", 6.5)
    c.drawCentredString(hair_x * mm, (Y_CURSOR - 4) * mm, "Cursor hairline")
    c.drawCentredString(hair_x * mm, (Y_CURSOR - 7.5) * mm, "(%g mm tall; the three strips side by side are %g mm)" % (CURSOR_H, STATOR_H * 2 + SLIDE_H))
    manifest["cursor"] = dict(w_mm=CURSOR_W, h_mm=CURSOR_H, hairline_x_mm=hair_x)


def main():
    manifest = dict(length_mm=L_MM, x0_mm=X0, page_mm=[round(PAGE_W_MM, 2), round(PAGE_H_MM, 2)],
                    stator_mm=STATOR_H, slide_mm=SLIDE_H)
    c = canvas.Canvas(PDF, pagesize=landscape(A4), pageCompression=0, invariant=1)
    c.setTitle("Paper slide rule (C/D, A/B, CI) - Vigil")
    c.setAuthor("Claude, an AI model")
    c.setSubject("Printable slide rule; marks computed from log10")
    page_one(c, manifest)
    c.showPage()
    page_two(c, manifest)
    c.showPage()
    c.save()
    for name, s in manifest["scales"].items():
        for t in s["ticks"]:
            t["x_mm"] = round(t["x_mm"], 6)
    with open(MANIFEST, "w") as f:
        json.dump(manifest, f, indent=1)
    print("wrote", PDF, os.path.getsize(PDF), "bytes")
    for name, s in manifest["scales"].items():
        print(name, len(s["ticks"]), "ticks")


if __name__ == "__main__":
    main()
