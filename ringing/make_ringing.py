#!/usr/bin/env python3
"""Generate plain_bob_minimus.wav and manifest.json: the 24-row extent of Plain Bob Minimus on four bells.

Usage:  python3 make_ringing.py        (needs numpy; writes next to this script)

The rows are made from place notation, not typed. The bell sound is a rough additive model of a church bell
(inharmonic partials with different decay times) written from memory, not fitted to any recording.
"""
import json, wave, os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 22050
N = 4
# Plain Bob Minimus: one lead is 8 changes: x 14 x 14 x 14 x 12 (x = swap every pair; digits = places that stay).
LEAD = ["x", "14", "x", "14", "x", "14", "x", "12"]
# Design pitch of each bell (Hz). Bell 1 is the treble (highest), bell 4 the tenor (lowest).
# They are the notes C5, B4, A4 and G4 (equal temperament), treble first.
PITCH = {1: 523.25, 2: 493.88, 3: 440.00, 4: 392.00}
BLOW = 0.28          # seconds between bells in a row
GAP = 1.0            # a handstroke gap is one extra blow-length of silence after every second row
TAIL = 2.5           # seconds of ringing left after the last bell

def change(row, notation):
    places = set() if notation == "x" else {int(c) for c in notation}
    out, i = list(row), 0
    while i < len(row):
        if i + 1 in places:
            i += 1
        else:
            out[i], out[i + 1] = out[i + 1], out[i]
            i += 2
    return out

def extent():
    row = list(range(1, N + 1))
    rows = [tuple(row)]
    for k in range(24):
        row = change(row, LEAD[k % len(LEAD)])
        rows.append(tuple(row))
    return rows          # rounds, 23 other rows, and rounds again at the end

# Bell partial model: (ratio to the design pitch, relative amplitude, decay time constant in s).
# A long low "hum", a prime at the design pitch, a few inharmonic partials (1.2, 1.5, 2.5, 3.0 are not whole
# multiples), a 3 ms noise tick for the clapper, and a loud, quickly fading strike at the design pitch and its octave so each new blow stands out.
PARTIALS = [(0.5, 0.35, 1.4), (1.0, 0.6, 0.45), (1.2, 0.30, 0.25), (1.5, 0.20, 0.20),
            (2.0, 0.35, 0.30), (2.5, 0.12, 0.15), (3.0, 0.10, 0.12), (1.0, 2.2, 0.035), (2.0, 0.7, 0.03)]

def bell(freq, dur=3.0):
    t = np.arange(int(dur * SR)) / SR
    y = np.zeros_like(t)
    for k, (ratio, amp, tau) in enumerate(PARTIALS):
        y += amp * np.exp(-t / tau) * np.sin(2 * np.pi * freq * ratio * t + 0.7 * k)
    y *= 1 - np.exp(-t / 0.002)      # 2 ms attack
    rng = np.random.default_rng(freq.__int__())      # a short noise tick for the clapper, seeded so the file is repeatable
    y += 0.9 * rng.standard_normal(len(t)) * np.exp(-t / 0.003) * (t < 0.03)
    return y

def main():
    rows = extent()
    blows = []                         # (time, bell, row index, place)
    t = 0.2
    for ri, row in enumerate(rows):
        for place, b in enumerate(row, start=1):
            blows.append((round(t, 4), b, ri, place))
            t += BLOW
        if ri % 2 == 1:
            t += GAP * BLOW            # handstroke gap after each pair of rows
    total = t + TAIL
    mix = np.zeros(int(total * SR))
    cache = {b: bell(f) for b, f in PITCH.items()}
    for (bt, b, _, _) in blows:
        s = int(round(bt * SR))
        w = cache[b]
        mix[s:s + len(w)] += w[:len(mix) - s]
    mix = mix / np.max(np.abs(mix)) * 0.85
    pcm = np.round(mix * 32767).astype("<i2")
    with wave.open(os.path.join(HERE, "plain_bob_minimus.wav"), "wb") as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())
    manifest = {
        "title": "Plain Bob Minimus", "bells": N, "sample_rate": SR, "lead": LEAD,
        "design_pitch_hz": {str(b): f for b, f in PITCH.items()},
        "blow_seconds": BLOW, "gap_blows": GAP,
        "rows": [list(r) for r in rows],
        "scheduled_blow_times": [[bt, b] for (bt, b, _, _) in blows],
        "partials": [{"ratio": r, "amp": a, "tau": tau} for (r, a, tau) in PARTIALS],
    }
    with open(os.path.join(HERE, "manifest.json"), "w") as f:
        json.dump(manifest, f)
    print("rows", len(rows), "distinct", len(set(rows[:-1])), "blows", len(blows), "seconds", round(total, 2))

if __name__ == "__main__":
    main()
