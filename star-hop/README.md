# Star Hop

A game: find named bright stars on a schematic sky map by hopping from stars you already know (the Big Dipper's
pointers to Polaris, the handle's arc to Arcturus and spike to Spica, Orion's belt to Sirius and to Aldebaran, the Great
Square to Fomalhaut). Five rounds, six stars, a score, a timer (or relaxed mode without one), a guide line that costs
points, and a best score kept in this browser only. Made by Claude, an AI model, for Vigil.

How it works: `index.html` is one static page. 51 stars are stored as RA (hours) and Dec (degrees) and drawn on a polar
chart (declination as distance from the pole). Each round frames the stars involved. The page computes great-circle
angles from the coordinates and shows them (distance of each hop, and how far the target is from the straight line).

Checked: `node tools/page_check.mjs star-hop/` (no console errors, no sideways scroll at 375px, light and dark); a
scripted play-through at 375px in light and dark (correct hits, a wrong tap, the guide line, three misses, the end
screen, best score saved); the page's own self-check (every star used exists; Dubhe-to-Polaris is 5.3 times
Merak-to-Dubhe). Offsets from a separate Node run: belt to Sirius 2.9 degrees off the line, belt to Aldebaran 5.6,
Great Square to Fomalhaut 2.4, Pointers to Polaris 1.9; the handle line misses Arcturus by 16 degrees (the arc curves).

Catalogue check (14 October 2026): the 51 coordinates were first written from memory, then compared in the page's own
code with the HYG Database v4.1 (`hygdata_v41.csv`, github.com/astronexus/HYG-Database, licence CC BY-SA 4.0, fetched
14 October 2026; reference values copied from the file, epoch J2000). The page compares each star's RA/Dec (great-circle
angle, tolerance 0.1 degrees) and constellation, shows the catalogue magnitude, and computes a matched/differs column and
the summary sentence (counts and names) when it loads. Result of the fetch: every star matched and every constellation
agreed, so no coordinate was corrected (largest difference about 0.075 degrees, Procyon). If a star ever differs, the
code swaps in the catalogue value and the page names it. The page held no magnitudes before, so magnitude is shown for
reference and was not compared. Checked at 375, 768 and 1100 px (no sideways scroll, no console errors).

Unverified: the timer feel and touch targets on a real phone, and the speed bonus balance, were not tested by a person.
Not tested: screen readers (unlabelled stars have clock-position labels only). A hop that works on the real sky may look
different on this projection, which is rotated and bent compared with a view of the sky. Only the names and positions of
the 51 stars were checked; the hop rules of thumb in the task text (such as "about five times") are checked only by the
page's own arithmetic.
