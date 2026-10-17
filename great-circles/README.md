# Great Circle Routes

Drag two airports (or free points) on a flat equirectangular map or a globe and see the shortest route between them,
with distance and bearing checked against second methods. Made by Claude, an AI model.

## How it works
- Map and globe: d3-geo 3.1.1 (`geoEquirectangular`, `geoOrthographic`, `geoPath`); the route is a `LineString`, which
  d3 draws along the sphere's great circle. The dashed line is the straight line on the map (400 samples, each piece
  measured along the sphere), so its excess over the great circle is computed, not assumed.
- Sphere distance: haversine, mean radius 6371.0088 km. Ellipsoid distance: Vincenty inverse on WGS84.
- Checks, all computed in the page on load: Vincenty against GeographicLib (Karney) on 14 airport pairs and 2,000
  random pairs; initial bearing by trigonometry against a vector formula (14 pairs, 5,000 random pairs); airport
  positions from OurAirports against OpenFlights; the sphere-versus-ellipsoid gap in km and %.
- The drawn arc is the sphere's great circle. The ellipsoid's geodesic is in the numbers only.

## Results seen (headless Chrome, 17 Oct 2026)
- Vincenty and Karney: all 14 pairs and 2,000 of 2,000 random pairs within 1 mm. Vincenty gave an answer for every
  random pair, so its non-convergence branch was only exercised by hand, with a near-antipodal point pair (0, 0) to (0.5, 179.7).
- Bearings: 14 of 14 and 5,000 of 5,000 within 0.000001 degrees. Both formulas assume a sphere.
- Sphere minus ellipsoid, 14 pairs: 0.1 to 29.9 km, 0.00% to 0.37% (largest ANC-KEF, sphere shorter).
- Flagged: OurAirports and OpenFlights differ by more than 1 km in the sphere distance for DXB-AKL and CPT-KEF (largest
  1,204 m). The 1 km limit is the builder's choice.
- Three web-search figures (JFK-LHR, LAX-SYD, SIN-JFK) are shown as "weaker, not independent" and are in no tally.
- `node tools/page_check.mjs great-circles/`: no problems at 375, 768 and 1100 px, light and dark. Dragging a dot on
  both maps, turning the globe and arrow keys tested; same point, near-antipodal, pole-crossing and date-line pairs tried.

## Not verified
- No published distance table could be fetched (Wikipedia, route calculators and jsdelivr/unpkg/cdnjs were blocked
  from the build machine; GitHub raw and the npm registry worked). The "second source" for the ellipsoid is a second
  program (GeographicLib), not a second dataset. The sphere has no independent check beyond the weak web figures.
- Real flights follow winds and airspace, not these arcs. Real phones, touch dragging and screen readers untested.

## Files and licences
- `index.html`: the page (own code, repository licence).
- `d3-geo.min.js` 3.1.1 and `d3-array.min.js` 3.2.4 (ISC; `d3-geo.LICENSE`, `d3-array.LICENSE`), from the npm registry tarballs.
- `geographiclib-geodesic.min.js` 2.1.1 (MIT; `geographiclib.LICENSE`), from the npm registry tarball.
- `data.js`: Natural Earth 1:110m land (public domain, from github.com/nvkelso/natural-earth-vector, rings rounded to
  0.05 degree); 20 airports from OurAirports (public domain) with OpenFlights positions as a second source (Open
  Database Licence; only 20 coordinate pairs used).

## Against Tissot Circles (`../projections/`)
Tissot Circles measures how projections distort shape and area. This page measures one shortest path: distance,
bearing and sphere-versus-ellipsoid gap, on a plate carree map and a globe.
