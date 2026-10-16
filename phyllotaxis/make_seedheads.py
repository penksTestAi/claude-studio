#!/usr/bin/env python3
"""Draw seed heads at several divergence angles and measure them.

Seed number i (1..N) sits at distance c*sqrt(i) from the centre, turned by i*angle from the previous one
(Vogel's 1979 model of a sunflower head). Every seed is the same size. The script writes one PNG per angle
and manifest.json with the numbers the landing page shows next to its own measurements.

    python3 make_seedheads.py          # redraw the PNGs, measure them, write manifest.json
    python3 make_seedheads.py --check  # also assert the measurements and exit 1 on a failure

Needs Python 3, Pillow and numpy (both free). No random numbers are used, so every run gives the same files.
"""
import json, math, sys, os
from collections import Counter
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SIZE = 1000            # pixels per side
N = 1500               # seeds
R = 480.0              # centre to the middle of the outermost seed, in pixels
C = R / math.sqrt(N)   # distance of seed i from the centre is C*sqrt(i)
DOT = 6.5              # seed radius in pixels
SS = 4                 # drawing at 4x size, then shrinking, for smooth edges
BG = (241, 236, 221)
INK = (27, 36, 48)
GOLDEN = 360.0 * (1 - 1 / ((1 + math.sqrt(5)) / 2))   # 137.5077640...
BANDS = [(150, 500), (500, 900), (900, 1350)]          # seed numbers (ranks) measured in
FIB = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377]

# name, label, angle in degrees, rational p/q of a full turn (or None)
HEADS = [
    ("golden",  "137.5078 (golden angle)",   GOLDEN, None),
    ("a1373",   "137.3",                     137.3,  None),
    ("a1377",   "137.7",                     137.7,  None),
    ("a1375",   "137.5 exactly",             137.5,  (55, 144)),
    ("a135",    "135 (3/8 of a turn)",       135.0,  (3, 8)),
    ("a144",    "144 (2/5 of a turn)",       144.0,  (2, 5)),
    ("a120",    "120 (1/3 of a turn)",       120.0,  (1, 3)),
    ("a90",     "90 (1/4 of a turn)",        90.0,   (1, 4)),
]


def positions(angle):
    i = np.arange(1, N + 1)
    r = C * np.sqrt(i)
    t = np.radians(angle * i)
    return SIZE / 2 + r * np.cos(t), SIZE / 2 - r * np.sin(t)


def draw(angle):
    x, y = positions(angle)
    big = Image.new("RGB", (SIZE * SS, SIZE * SS), BG)
    d = ImageDraw.Draw(big)
    for a, b in zip(x, y):
        d.ellipse([(a - DOT) * SS, (b - DOT) * SS, (a + DOT) * SS, (b + DOT) * SS], fill=INK)
    small = big.resize((SIZE, SIZE), Image.LANCZOS)
    # only two colours and their blends occur, so a 64-colour palette loses nothing visible and keeps files small
    return small.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


# ---- measuring from pixels (the landing page does the same steps in JavaScript) -------------------------------

def blobs(red):
    """Connected dark regions (4-neighbour), each as (weighted centre x, y). Uses the red channel only."""
    h, w = red.shape
    mask = red < 200
    seen = np.zeros_like(mask)
    out = []
    for sy, sx in zip(*np.nonzero(mask)):
        if seen[sy, sx]:
            continue
        stack = [(sy, sx)]
        seen[sy, sx] = True
        sw = swx = swy = 0.0
        while stack:
            yy, xx = stack.pop()
            wt = max(0.0, 241.0 - float(red[yy, xx]))
            sw += wt; swx += wt * xx; swy += wt * yy
            for ny, nx in ((yy + 1, xx), (yy - 1, xx), (yy, xx + 1), (yy, xx - 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        out.append((swx / sw + 0.5, swy / sw + 0.5))   # +0.5: pixel centres
    return out


def neighbour_triples(cx, cy, ranks):
    """For each band, the three most common |rank difference| among each seed's 6 nearest neighbours."""
    n = len(cx)
    dx = cx[:, None] - cx[None, :]
    dy = cy[:, None] - cy[None, :]
    dist = np.hypot(dx, dy)
    np.fill_diagonal(dist, 1e18)
    nn = np.argsort(dist, axis=1)[:, :6]
    result = []
    for lo, hi in BANDS:
        cnt = Counter()
        seeds = [k for k in range(n) if lo <= ranks[k] <= hi]
        for k in seeds:
            for m in nn[k]:
                cnt[abs(int(ranks[m]) - int(ranks[k]))] += 1
        top = cnt.most_common(3)
        slots = 6 * len(seeds)
        vals = sorted(v for v, _ in top)
        result.append({"band": [lo, hi], "differences": vals,
                       "share": round(sum(c for _, c in top) / slots, 3) if slots else 0.0})
    return result


def rays(red, r0=0.9 * R, steps=7200):
    """Number of dark runs met going once round a circle of radius r0 around the centre."""
    on = []
    for s in range(steps):
        t = 2 * math.pi * s / steps
        px = int(round(SIZE / 2 + r0 * math.cos(t) - 0.5))
        py = int(round(SIZE / 2 - r0 * math.sin(t) - 0.5))
        on.append(red[py, px] < 134)
    return sum(1 for s in range(steps) if on[s] and not on[s - 1])


def is_run(vals):
    """True when the sorted values are consecutive Fibonacci numbers a, b, a+b."""
    a, b, c = vals
    return a in FIB and b in FIB and c in FIB and FIB.index(b) == FIB.index(a) + 1 and c == a + b


def measure_image(path):
    red = np.asarray(Image.open(path).convert("RGB"))[:, :, 0]
    found = blobs(red)
    res = {"blobs": len(found)}
    if len(found) >= 0.97 * N:
        cx = np.array([p[0] for p in found]); cy = np.array([p[1] for p in found])
        rad = np.hypot(cx - SIZE / 2, cy - SIZE / 2)
        order = np.argsort(rad)
        ranks = np.empty(len(found), dtype=int)
        ranks[order] = np.arange(1, len(found) + 1)
        res["resolved"] = True
        res["bands"] = neighbour_triples(cx, cy, ranks)
    else:
        res["resolved"] = False
        res["rays"] = rays(red)
    return res


def measure_model(angle):
    """The same neighbour count using the true seed numbers and exact positions (no pixels involved)."""
    x, y = positions(angle)
    return neighbour_triples(x, y, np.arange(1, N + 1))


def main():
    manifest = {"seeds": N, "size": SIZE, "radius_px": R, "seed_radius_px": DOT, "bands": BANDS,
                "model": "seed i at distance c*sqrt(i), turned i*angle", "heads": []}
    for name, label, angle, frac in HEADS:
        path = os.path.join(HERE, name + ".png")
        draw(angle).save(path, optimize=True)
        entry = {"name": name, "file": name + ".png", "label": label, "angle": round(angle, 6),
                 "fraction": list(frac) if frac else None,
                 "from_pixels": measure_image(path), "from_model": measure_model(angle)}
        manifest["heads"].append(entry)
        print(name, entry["from_pixels"].get("blobs"), entry["from_pixels"].get("rays", ""),
              [b["differences"] for b in entry["from_pixels"].get("bands", [])],
              [b["differences"] for b in entry["from_model"]])
    with open(os.path.join(HERE, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)
    if "--check" in sys.argv:
        check(manifest)


def check(manifest):
    bad = 0
    def need(ok, msg):
        nonlocal bad
        print(("ok   " if ok else "FAIL ") + msg)
        bad += 0 if ok else 1
    for h in manifest["heads"]:
        im = Image.open(os.path.join(HERE, h["file"]))
        need(im.size == (SIZE, SIZE), h["name"] + " is %dx%d" % im.size)
        p = h["from_pixels"]
        if h["fraction"]:
            q = h["fraction"][1]
            if not p["resolved"]:
                need(p["rays"] == q, "%s: %d rays counted, denominator %d" % (h["name"], p["rays"], q))
        elif p["resolved"]:
            need(p["blobs"] == N, "%s: %d blobs, %d seeds" % (h["name"], p["blobs"], N))
        for pb, mb in zip(p.get("bands", []), h["from_model"]):
            need(pb["differences"] == mb["differences"], "%s band %s: pixels %s, model %s"
                 % (h["name"], pb["band"], pb["differences"], mb["differences"]))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
