#!/usr/bin/env python3
"""Run every code cell of coasting.ipynb (only numpy needed; `plot` cells are skipped without matplotlib)
and report the notebook's own asserts. Usage: python3 check.py"""
import ast, json, os, sys
os.environ.setdefault("MPLBACKEND", "Agg")
here = os.path.dirname(os.path.abspath(__file__))
nb = json.load(open(os.path.join(here, "coasting.ipynb"), encoding="utf-8"))
try:
    import matplotlib  # noqa: F401
    have_plt = True
except ImportError:
    have_plt = False
ns, n_assert, ran, skipped = {"__name__": "__notebook__"}, 0, 0, 0
for i, cell in enumerate(nb["cells"]):
    if cell["cell_type"] != "code":
        continue
    src = "".join(cell["source"])
    if "plot" in cell.get("metadata", {}).get("tags", []) and not have_plt:
        skipped += 1
        continue
    n_assert += sum(isinstance(n, ast.Assert) for n in ast.walk(ast.parse(src)))
    try:
        exec(compile(src, f"cell {i}", "exec"), ns)
    except AssertionError as e:
        print(f"FAIL in cell {i}: {e}")
        sys.exit(1)
    ran += 1
# every number typed into index.html must equal what the notebook just computed
import re
page = open(os.path.join(here, "index.html"), encoding="utf-8").read().replace("&nbsp;", " ")
tot, d = ns["total"], {r["R0"]: r for r in ns["rows"]}
want = [f"{ns['e0']:.1f} years", f"{ns['r_mat']*100:.2f} % a year", f"reaches {tot[5]:.0f} after 25 years, {tot[10]:.0f} after 50 and settles at {tot[-1]:.0f}",
        f"<b>{ns['M_proj']:.3f}</b>, that is {(ns['M_proj']-1)*100:.0f} % more", f"{ns['rows'][3]['young']:.0f} % of people are under 15",
        f"{ns['reach'][50]} years, 90 % in {ns['reach'][90]} and 99 % in {ns['reach'][99]}", f"eigenvalue {ns['lam']:.10f}", f"root {ns['lam_EL']:.10f}",
        f"({ns['M_eig']:.6f})", f"projection ({ns['M_proj']:.6f})", f"projected {ns['M_proj']:.3f} against {ns['K_full']:.3f}",
        f"which is {ns['gap']:.1f} % lower"]
for r in ns["rows"]:
    want.append(f'<td class="n">{r["R0"]}</td><td class="n">{r["tfr"]:.1f}</td><td class="n">{r["r"]:.2f}</td><td class="n">{r["young"]:.0f}</td>'
                f'<td class="n">{r["M"]:.3f}</td><td class="n">{r["keyfitz"]:.3f}</td><td class="n">{r["gap"]:.1f}</td>')
miss = [w for w in want if w not in page]
if miss:
    print("FAIL: index.html disagrees with the notebook:", *miss, sep="\n  ")
    sys.exit(1)
print(f"ok: {ran} code cells run, {skipped} plot cells skipped, {n_assert} assert statements and {len(want)} page-number matches passed")
print(f"momentum M = {ns['M_proj']:.4f}; Keyfitz gap {ns['gap']:.1f} %; eigenvalue vs Euler-Lotka difference {abs(ns['lam']-ns['lam_EL']):.1e}")
