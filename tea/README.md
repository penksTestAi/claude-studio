# Tea or Cha

A scrollable data story about one word. Most languages' word for tea comes from Chinese 茶, in one of two shapes:
*te* (the sea road, said to run through Min Nan at Xiamen/Amoy and the Dutch) or *cha* (the land road, and the Portuguese
at Macau). The page lists 31 hand-picked languages with its word, the written form and the route, and draws one marker
per language on a schematic dot-grid map (no map tiles, no external data; the outline is my own rough polygons). Colour
and shape both carry the route (circle te, triangle cha, diamond other). The counts at the top are computed by the script
from the same list. Single `index.html`, no external scripts, no build step.

## What was checked
- WALS 138A: each language's route compared with its WALS value, from `cldf/values.csv` and `languages.csv` of
  github.com/cldf-datasets/wals (fetched 14 Oct 2026). The file has 230 languages, 110 cha / 84 te / 36 other, equal to the
  wals.info totals. The page holds the WALS value (and WALS's example word) per language and computes the counts in code:
  29 of 31 have a WALS entry, 29 matched, 0 differ, 2 not in WALS (Malay, Tamil).
- `node --check` on the extracted script; headless browser at 375, 768 and 1100 px; `tools/page_check.mjs`.
- Route counts shown by the page (11 te, 18 cha, 2 other of 31) agree with the list.

## Sources
- Östen Dahl, "Tea", chapter 138A in the World Atlas of Language Structures (WALS), 2013, CC BY 4.0.
  https://wals.info/feature/138A ; data: https://github.com/cldf-datasets/wals

## Still not verified
- Only the route (te / cha / other) is compared with WALS, not my spellings (WALS example words are shown beside them).
- Matching is by name; some WALS rows are a variety: Min Nan = "Min (Southern)", Arabic = "Arabic (Egyptian)",
  Mongolian = "Khalkha", Tibetan = "Tibetan (Standard Spoken)". Malay has no entry (Indonesian is te), Tamil has none.
- WALS gives one form per language, so second forms (English chai, Tamil colloquial chai) are not captured.
- Words and spellings are from memory. Least sure: Sinhala, Tamil (tēnīr), Tibetan ཇ, Burmese, Hebrew תה, Arabic شاي,
  Persian چای, Mongolian цай, Vietnamese trà (also chè), Greek τσάι, Czech čaj, Swahili chai.
- The history (Dutch East India Company, Macau, Min Nan around Xiamen, Dutch Ceylon, Swahili via the Indian Ocean) is the
  commonly told account, hedged in the text; Wikipedia could not be opened.
- Marker positions are approximate. The 31 languages are not a sample, so the percentages describe this list only.
- Not tried on a real phone.
