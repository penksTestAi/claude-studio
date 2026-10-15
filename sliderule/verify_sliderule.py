#!/usr/bin/env python3
"""Measure sliderule.pdf back, compare it with log10, simulate multiplications, and write results.json.

No third-party library is needed: the PDF was written uncompressed by reportlab, so the page's drawing
instructions are plain text. This script reads the vector lines (`x y m x y l S`) straight from the file and
never looks at make_sliderule.py's tick positions: it re-computes each expected position from the tick value
with its own log10 call, using only the values, the scale kind and the left index listed in manifest.json.

Run:  python3 verify_sliderule.py     (after make_sliderule.py; also fills the results into index.html)
Exit status 1 if any check fails.
"""
import json
import math
import os
import random
import re
import statistics
import sys
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
PT_MM = 25.4 / 72.0
TOL_MM = 0.002          # measured tick against log10: allowed difference (the PDF stores 5 decimals of a point)


def read_streams(path):
    raw = open(path, "rb").read()
    out = []
    for m in re.finditer(rb"<<([^>]*)>>\s*stream\r?\n(.*?)\r?\nendstream", raw, re.S):
        body = m.group(2)
        if b"/FlateDecode" in m.group(1):
            body = zlib.decompress(body)
        out.append(body.decode("latin-1"))
    return out


def parse_lines(stream):
    """Return (list of (width_pt, x1, y1, x2, y2) in pt, count of non-identity cm)."""
    cms = re.findall(r"([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) cm", stream)
    bad_cm = sum(1 for c in cms if tuple(float(v) for v in c) != (1, 0, 0, 1, 0, 0))
    width = 1.0
    lines = []
    pat = re.compile(r"([-\d.]+) w\b|n ([-\d.]+) ([-\d.]+) m ([-\d.]+) ([-\d.]+) l S")
    for m in pat.finditer(stream):
        if m.group(1) is not None:
            width = float(m.group(1))
        else:
            x1, y1, x2, y2 = (float(m.group(i)) for i in (2, 3, 4, 5))
            lines.append((width, x1, y1, x2, y2))
    return lines, bad_cm


def expected_mm(kind, value, x0, length):
    if kind in ("C", "D"):
        return x0 + length * math.log10(value)
    if kind == "CI":
        return x0 + length * (1 - math.log10(value))
    if kind == "ruler":
        return x0 + value                      # 1 mm per value step
    return x0 + (length / 2) * math.log10(value)


def embed(blob):
    """Put the results into index.html between the RESULTS markers, so the page needs no fetch."""
    path = os.path.join(HERE, "index.html")
    html = open(path, encoding="utf-8").read()
    a, b = "<!-- RESULTS:START -->", "<!-- RESULTS:END -->"
    i, j = html.index(a) + len(a), html.index(b)
    html = html[:i] + '\n<script type="application/json" id="results">' + blob.replace("</", "<\\/") + "</script>\n" + html[j:]
    open(path, "w", encoding="utf-8").write(html)


def main():
    man = json.load(open(os.path.join(HERE, "manifest.json")))
    L, x0 = man["length_mm"], man["x0_mm"]
    streams = read_streams(os.path.join(HERE, "sliderule.pdf"))
    ok = True
    problems = []
    lines, bad_cm = parse_lines(streams[0])
    if bad_cm:
        problems.append("%d non-identity cm operators on page 1; measurements would need a transform" % bad_cm)
    vertical = [(w, x1 * PT_MM, min(y1, y2) * PT_MM, max(y1, y2) * PT_MM) for (w, x1, y1, x2, y2) in lines
                if abs(x1 - x2) < 1e-6 and abs(y1 - y2) > 1e-6]

    # ---- page: the widest dashed cut line on page 1, from the rectangles ("x y w h re S"), against the page width
    rects = re.findall(r"n ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) re S", streams[0])
    cut_right_mm = max((float(x) + float(w)) * PT_MM for x, y, w, h in rects)
    cut_left_mm = min(float(x) * PT_MM for x, y, w, h in rects)
    mb = re.search(rb"/MediaBox \[ ?0 0 ([\d.]+) ([\d.]+)", open(os.path.join(HERE, "sliderule.pdf"), "rb").read())
    page_w_mm = float(mb.group(1)) * PT_MM

    # ---- tick counts that follow from the step rules, worked out by hand (not by the generator's loops)
    expect_count = {"C": 1 + 100 // 2 + 300 // 5 + 500 // 10,       # 1-2 by .02, 2-5 by .05, 5-10 by .1
                    "D": 161, "CI": 161,
                    "A": 1 + 2 * (100 // 5 + 300 // 10 + 500 // 20),  # two decades, steps .05/.1/.2 of the mantissa
                    "B": 151, "RULER": 101}
    scales_out = {}
    measured = {}
    for name, s in man["scales"].items():
        edge_mm = s["edge_mm"]
        sel = []
        for (w, x, ya, yb) in vertical:
            if abs((ya if s["dir"] > 0 else yb) - edge_mm) < 0.002:
                sel.append((x, w))
        sel.sort()
        vals = [t["value"] for t in s["ticks"]]
        # tick i of the sorted-by-position manifest list pairs with the i-th measured line
        pairs = sorted(((expected_mm(s["kind"], vals[i], x0, L), vals[i]) for i in range(len(vals))))
        if len(sel) != len(pairs):
            problems.append("%s: %d lines in the PDF, %d ticks expected" % (name, len(sel), len(pairs)))
            continue
        if len(sel) != expect_count[name]:
            problems.append("%s: %d ticks, hand count says %d" % (name, len(sel), expect_count[name]))
        res = [sel[i][0] - pairs[i][0] for i in range(len(sel))]
        xs = [p[0] for p in sel]
        gaps = [b - a for a, b in zip(xs, xs[1:])]
        # left and right end of the scale as drawn
        measured_len = xs[-1] - xs[0]
        nominal_len = (L if s["kind"] in ("C", "D", "CI") else L) if s["kind"] != "ruler" else 100.0
        worst = max(abs(r) for r in res)
        if worst > TOL_MM:
            problems.append("%s: worst tick is %.4f mm from log10 (limit %.3f)" % (name, worst, TOL_MM))
        if abs(measured_len - nominal_len) > TOL_MM:
            problems.append("%s: drawn length %.4f mm, expected %.1f" % (name, measured_len, nominal_len))
        if min(gaps) < 1.0 - 1e-6 and s["kind"] != "ruler":
            problems.append("%s: closest two ticks only %.3f mm apart" % (name, min(gaps)))
        # line widths present
        widths = sorted(set(round(p[1], 2) for p in sel))
        measured[name] = dict(values=[p[1] for p in pairs], xs=xs)
        scales_out[name] = dict(
            ticks=len(sel), hand_count=expect_count[name], length_mm=round(measured_len, 4),
            worst_mm=round(worst, 5), mean_abs_mm=round(statistics.mean(abs(r) for r in res), 5),
            min_gap_mm=round(min(gaps), 3), max_gap_mm=round(max(gaps), 3),
            left_index_mm=round(xs[0], 4), widths_pt=widths)

    # ---- the A/D, B/C and CI/C relationships, measured from the PDF only
    def at(name, value):
        m = measured[name]
        i = min(range(len(m["values"])), key=lambda k: abs(m["values"][k] - value))
        if abs(m["values"][i] - value) > 1e-9:
            return None
        return m["xs"][i]

    rel = []
    for v in (2, 3, 4, 5, 6, 7, 8):
        xa, xd = at("A", v * v), at("D", v)
        xb, xc = at("B", v * v), at("C", v)
        rel.append(dict(v=v, square=v * v, a_minus_d_mm=round(xa - xd, 5), b_minus_c_mm=round(xb - xc, 5)))
    ci = []
    for v in (1.2, 2, 2.5, 4, 5, 8):
        xci, xc = at("CI", v), at("C", v)
        # CI at v sits at (x0 + L - (x_C(v) - x0)) because CI is C mirrored
        ci.append(dict(v=v, ci_plus_c_minus_two_x0_mm=round((xci + xc) - 2 * man["x0_mm"], 5)))
    # for a mirrored scale the sum of the two positions of the same value is 2*x0 + L
    for r in ci:
        r["expected_mm"] = L
        r["diff_mm"] = round(r["ci_plus_c_minus_two_x0_mm"] - L, 5)
        if abs(r["diff_mm"]) > TOL_MM:
            problems.append("CI/C mirror check off by %.4f mm at %s" % (r["diff_mm"], r["v"]))
    for r in rel:
        for k in ("a_minus_d_mm", "b_minus_c_mm"):
            if abs(r[k]) > TOL_MM:
                problems.append("A/D or B/C alignment of %d^2 off by %.4f mm" % (r["v"], r[k]))

    # ---- reading model
    D, C = measured["D"], measured["C"]
    dv, dx = D["values"], [x - D["xs"][0] for x in D["xs"]]
    cv, cx = C["values"], [x - C["xs"][0] for x in C["xs"]]
    Lm = dx[-1]

    def pos_of_value(v, vals, xs):
        """Where a person puts a setting for v: straight-line guess between the two printed ticks around it."""
        i = max(0, min(len(vals) - 2, max(k for k in range(len(vals) - 1) if vals[k] <= v + 1e-12)))
        f = (v - vals[i]) / (vals[i + 1] - vals[i])
        return xs[i] + f * (xs[i + 1] - xs[i])

    def value_of_pos(p, vals, xs):
        """What a person reads at position p: straight-line guess between the two ticks around it."""
        p = min(max(p, xs[0]), xs[-1])
        lo, hi = 0, len(xs) - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if xs[mid] <= p:
                lo = mid
            else:
                hi = mid
        f = (p - xs[lo]) / (xs[hi] - xs[lo])
        return vals[lo] + f * (vals[hi] - vals[lo])

    def multiply(a, b, e1=0.0, e2=0.0, e3=0.0, xs_d=dx, xs_c=cx, length=Lm):
        s = pos_of_value(a, dv, xs_d) + e1                    # C's left 1 over a on D
        p = s + pos_of_value(b, cv, xs_c) + e2                # hairline on b of C
        if p > length:                                        # off the right end: use C's right 10 instead
            p -= length
        r = value_of_pos(p + e3, dv, xs_d)
        m = a * b
        while m >= 10:
            m /= 10
        # the person knows the size of the answer, so pick the power of ten nearest the true product
        cand = min((r, r * 10, r / 10), key=lambda t: abs(math.log10(t) - math.log10(m)))
        return cand, m

    def rel_err(a, b, sig, rng, **kw):
        e = [rng.gauss(0, sig) if sig else 0.0 for _ in range(3)]
        r, m = multiply(a, b, *e, **kw)
        return (r - m) / m

    sigmas = [0.0, 0.1, 0.2, 0.4]
    sim = []
    N = 20000
    for sig in sigmas:
        per_seed = []
        for seed in (1, 2, 3, 4, 5):
            rng = random.Random(seed)
            errs = []
            for _ in range(N):
                a, b = rng.randint(100, 999) / 100.0, rng.randint(100, 999) / 100.0
                errs.append(abs(rel_err(a, b, sig, rng)))
            errs.sort()
            per_seed.append(dict(median=errs[N // 2], p95=errs[int(N * 0.95)], max=errs[-1]))
            if sig == 0.0:
                break
        sim.append(dict(sigma_mm=sig, pairs=N, seeds=len(per_seed),
                        median_pct=[round(100 * min(p["median"] for p in per_seed), 3), round(100 * max(p["median"] for p in per_seed), 3)],
                        p95_pct=[round(100 * min(p["p95"] for p in per_seed), 3), round(100 * max(p["p95"] for p in per_seed), 3)],
                        max_pct=round(100 * max(p["max"] for p in per_seed), 2)))

    # ---- worst case for the straight-line reading alone, over every printed gap
    worst_gap = (0.0, None)
    for i in range(len(dv) - 1):
        for k in range(1, 400):
            v = dv[i] + (dv[i + 1] - dv[i]) * k / 400
            true_pos = Lm * math.log10(v)
            r = value_of_pos(true_pos, dv, dx)
            e = abs(r - v) / v
            if e > worst_gap[0]:
                worst_gap = (e, (dv[i], dv[i + 1]))

    # ---- named multiplications
    named = []
    for a, b in [(2, 3), (1.5, 4.2), (3.14, 2.72), (7.5, 8.4), (1.23, 4.56), (9.99, 9.99), (2.5, 4.0), (6.02, 1.38)]:
        r0, m = multiply(a, b)
        rng = random.Random(7)
        errs = sorted(rel_err(a, b, 0.2, rng) for _ in range(2000))
        named.append(dict(a=a, b=b, exact=a * b, mantissa_exact=m, reading=round(r0, 4),
                          err_pct=round(100 * (r0 - m) / m, 3),
                          noisy_p5_pct=round(100 * errs[100], 2), noisy_p95_pct=round(100 * errs[1900], 2)))

    # ---- uniform scaling (a print at 97%) with no hand error: readings should not change
    k = 0.97
    rng = random.Random(11)
    maxdiff = 0.0
    for _ in range(3000):
        a, b = rng.randint(100, 999) / 100.0, rng.randint(100, 999) / 100.0
        r1, _ = multiply(a, b)
        r2, _ = multiply(a, b, xs_d=[x * k for x in dx], xs_c=[x * k for x in cx], length=Lm * k)
        maxdiff = max(maxdiff, abs(r1 - r2) / r1)

    out = dict(
        length_mm=L, page=dict(width_mm=round(page_w_mm, 1), cut_left_mm=round(cut_left_mm, 1), cut_right_mm=round(cut_right_mm, 1), letter_width_mm=279.4), pdf=dict(pages=len(streams), bytes=os.path.getsize(os.path.join(HERE, 'sliderule.pdf'))), scales=scales_out, tol_mm=TOL_MM, relations=dict(a_over_d=rel, ci=ci),
        simulation=dict(model=("a on D, b on C, read D: a straight-line guess between printed ticks for each of the three "
                               "settings, plus a random error (normal, sigma mm) on each of the three"),
                        rows=sim, interpolation_worst_pct=round(100 * worst_gap[0], 3), interpolation_worst_gap=worst_gap[1],
                        named=named, named_sigma_mm=0.2, scaling_k=k, scaling_max_rel_diff=maxdiff),
        problems=problems,
        # data for the page's preview and its own cross-check (positions relative to each scale's left index)
        data=dict(d_values=dv, d_x=[round(x, 4) for x in dx], c_values=cv, c_x=[round(x, 4) for x in cx],
                  named_readings=[[n["a"], n["b"], n["reading"]] for n in named]))
    json.dump(out, open(os.path.join(HERE, "results.json"), "w"), indent=1)
    embed(json.dumps(out, separators=(",", ":")))
    print(json.dumps({k: out[k] for k in ("scales", "simulation", "problems")}, indent=1)[:6000])
    print("relations", rel[:2], ci[:2])
    if problems:
        print("PROBLEMS:", *problems, sep="\n  ")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
