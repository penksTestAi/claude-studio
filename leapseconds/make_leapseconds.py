#!/usr/bin/env python3
"""Build leapseconds.csv and leapseconds.json from sources/leap-seconds.list (NTP seconds since 1900-01-01).
Run from this folder: python3 make_leapseconds.py   (standard library only; code licence MIT)."""
import csv, datetime as dt, json, re
EPOCH = dt.date(1900, 1, 1)
text = open("sources/leap-seconds.list", encoding="utf-8").read()
src = [(int(a), int(b)) for a, b in re.findall(r"^(\d{10})\s+(\d+)\s+#", text, re.M)]
rows, prev = [], None
for ntp, dtai in src:
    eff = EPOCH + dt.timedelta(seconds=ntp)
    mjd = (eff - dt.date(1858, 11, 17)).days
    if prev is None:
        change, leap = "", ""
    else:
        change = dtai - prev
        last = eff - dt.timedelta(days=1)
        leap = f"{last.isoformat()}T23:59:60Z"
    rows.append(dict(effective_utc_date=eff.isoformat(), mjd=mjd, tai_minus_utc_s=dtai,
                     change_s=change, leap_second_at_utc=leap))
    prev = dtai
cols = list(rows[0])
with open("leapseconds.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, cols, lineterminator="\n"); w.writeheader(); w.writerows(rows)
json.dump([{k: (None if v == "" else v) for k, v in r.items()} for r in rows],
          open("leapseconds.json", "w", encoding="utf-8"), indent=1)
open("leapseconds.json", "a").write("\n")
print(len(rows), "rows written")
