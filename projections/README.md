# Tissot Circles

Circles of the same radius on the globe, drawn on a Mercator map and an Equal Earth (equal-area) map side by side.
Drag a circle on either map (or use the sliders and arrow keys) and see its area and shape change. A second panel
compares Greenland with Africa, computed from the outlines.

## How it works
- Sphere of radius 1. Mercator: x = lambda, y = ln tan(pi/4 + phi/2); scale factor sec phi. Equal Earth (Savric,
  Patterson, Jenny 2018): polynomial in the auxiliary angle, with x built from dy/dtheta so area is exact.
- Local scale is measured by projecting points 1e-5 rad apart (central differences) and taking singular values.
- A circle is 720 points at a fixed angle from its centre; the page measures the projected area with the shoelace formula.
- Outlines: Natural Earth 1:110m Admin 0 Countries (public domain), fetched 14 Oct 2026 from the natural-earth-vector
  repository; `data.js` keeps name, continent and rings rounded to 0.01 degree. Country names, counts and areas are computed.

## Checked (headless Chromium, Playwright; `node tools/page_check.mjs projections/`)
The page runs 10 checks on load and on a button: Mercator scale = sec phi at 9 latitudes (7e-9); Mercator band
inflation against psi/sin phi (3e-6); Equal Earth whole-sphere area = 4 pi two ways (5e-5); each circle's outline area
against an integral and the closed form 2 pi (1 - cos r) (all under 1e-4); spherical polygon routine; Greenland and Africa
on Equal Earth against spherical area (9e-5). All agree. 375, 768, 1100 px: no console errors, no sideways scroll.
Dragging and arrow keys tested; a circle across the date line draws on both sides.

## Not checked
- Equal Earth A1-A4 (1.340264, -0.081106, 0.000893, 0.003796): checked only against search excerpts (equalearthlab.com and
  johndcook.com; pages and paper not opened). No on-page check tests them; they only shape the map. The whole-sphere area
  check does confirm M = sqrt(3)/2, since the area condition forces it. Width/height 2.05 matches memory.
- Areas of Greenland and Africa differ somewhat from published figures (110m outlines, sphere); not compared to a source.
- Real phones, screen readers, other browsers. Touch drags only start on a circle.
