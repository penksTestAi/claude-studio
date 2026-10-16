# The Shadow at Alexandria

A short story (the studio's first) about Eratosthenes measuring the Earth from noon shadows, with the story's numbers
recomputed in code on the page and compared with modern coordinates. Made by Claude, an AI model.

Files: `index.html` (story and checks), `calc.js` (the numbers), `check.mjs` (12 checks, run `node check.mjs`).
Licence: MIT, as the repository.

## What the page computes
- 1/50 of a circle is 7.2 degrees; 50 x 5,000 = 250,000 stadia; a 2 m pole at 7.2 degrees casts a 0.253 m shadow.
- Modern latitude gap between Aswan (24.088938 N) and Alexandria (31.2018 N): 7.113 degrees (story: 7.2).
- Great-circle distance by haversine, mean radius 6371.0088 km: 843.6 km. 5,000 stadia would match if a stadion were
  168.7 m.
- Aswan is 2.98 degrees of longitude east of Alexandria, so the story's "due south" is false for these coordinates
  (the page marks it).
- 250,000 stadia at 157.5 m is 39,375 km (-1.6% against 40,030 km); at 185 m it is 46,250 km (+15.5%). The page shows
  both and picks neither. **The stadion's length is uncertain.**
- Controls in `check.mjs`: 1 degree of latitude = 111.195 km; an equator quarter-circle = 10,007.5 km. All 12 pass.

## Source of the modern coordinates (second free source)
Aswan 24.088938, 32.899830: findlatitudeandlongitude.com (an archived Wikipedia page gives 24 05 20 N, 32 53 59 E).
Alexandria 31.2018, 29.9158: time-ok.com; bamwor.com gives 31.20176, 29.91582. These were read from web-search
summaries; the sandbox could not open Wikidata, Wikipedia, OpenStreetMap or the listing sites themselves, so I did not
see the pages. Such listings may share one gazetteer, so they are not independent; another listing
(worldatlas.com) puts Alexandria at 31.22 N, 29.96 E, about 5 km off.

## Invented
The courtyard pole, its height, the copyist, the boy, the scratches, all dialogue, the charcoal sum and the rubbed-out
zero. Marked with a dotted underline on the page where small.

## Unverified (from memory, never checked)
The 1/50 angle, 5,000 stadia and 250,000 stadia as the ancient figures; the variant 252,000; Cleomedes as the source;
the well at Syene; that Eratosthenes headed the Library; the obliquity near 23.7 degrees in his time; that the 5,000
stadia was a river distance; the real position of ancient Syene against modern Aswan; the exact Tropic of Cancer
latitude (about 23.4 N today). Not tested: phones, screen readers.
