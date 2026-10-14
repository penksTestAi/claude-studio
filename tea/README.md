# Tea or Cha

A scrollable data story about one word. Most languages' word for tea comes from Chinese 茶, in one of two shapes:
*te* (the sea road, said to run through Min Nan at Xiamen/Amoy and the Dutch) or *cha* (the land road, and the Portuguese
at Macau). The page lists 31 hand-picked languages with its word, the written form and the route, and draws one marker
per language on a schematic dot-grid map (no map tiles, no external data; the outline is my own rough polygons). Colour
and shape both carry the route (circle te, triangle cha, diamond other). The counts at the top are computed by the script
from the same list. Single `index.html`, no external scripts, no build step.

## What was checked
- `node --check` on the extracted script; headless Chromium: no console errors, no horizontal scroll at 375 px and 1100 px,
  light and dark themes, map views (World, Europe, Asia), clicking a marker.
- Counts shown by the page (11 te, 18 cha, 2 other of 31) agree with the list.

## Sources
- Data basis and the three-way sorting: Östen Dahl, "Tea", chapter 138A in the World Atlas of Language Structures
  (WALS), 2013. https://wals.info/feature/138A

## Second pass (refiner)
- wals.info, Wikipedia and Wiktionary could not be fetched from this environment (DNS blocked); only web-search snippets were
  available. They confirm the WALS 138A totals (230 languages: 110 cha, 84 te, 36 other), a few unrelated datapoints
  (Afrikaans te; Basque, Tagalog, Punjabi cha; Lao other), the Macau/Portuguese cha route (English cha from the 1590s), the
  Dutch tea route (c. 1606, via Malay or Min), Persian chay by land and Arabic shay as a later Persian borrowing.
- Changed: Mandarin no longer called "the source" of cha; Thai no longer framed as a "sea-trading country" surprise; Polish
  marked as arguably te-type and a judgement call; Burmese gloss corrected (laphet-yay is milk tea); the Ceylon/Dutch link
  is called unchecked; unverified entries carry an "Unverified" note (not every entry does: none of the 31 was checked against WALS); map labels were about 7 px at 375 px, so they now
  scale to 11 px and show only for the selected language on narrow screens; larger markers and tap targets.

## Still not verified
- None of the 31 languages was checked against its WALS value, and I cannot say they are all in the WALS sample.
- Every word and spelling is from memory. Least sure: Sinhala, Tamil (tēnīr, colloquial ṭī/chai), Tibetan ཇ, Burmese,
  Hebrew תה, Arabic شاي, Persian چای, Mongolian цай, Vietnamese trà (also chè), Greek τσάι, Czech čaj, Swahili chai.
- Polish herbata and Burmese "other" are my own classification judgements.
- The history (Dutch East India Company, Macau, Min Nan around Xiamen, Dutch Ceylon, Swahili via the Indian Ocean) is the
  commonly told account, hedged in the text.
- Marker positions are approximate. The 31 languages are not a sample, so the percentages describe this list only.
- Not tried on a real phone.
