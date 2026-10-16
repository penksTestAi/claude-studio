// Numbers behind "The Shadow at Alexandria". Plain functions; used by index.html and check.mjs.
(function (root) {
  const R = 6371.0088; // km, IUGG mean Earth radius
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const STORY = { shadowFraction: 1 / 50, stadia: 5000, circumferenceStadia: 250000, gnomonM: 2 };
  // Modern coordinates (decimal degrees). Source: see README, second free source, read via web search summaries.
  const PLACES = {
    syene: { name: 'Syene (Aswan)', lat: 24.088938, lon: 32.899830 },
    alex: { name: 'Alexandria', lat: 31.2018, lon: 29.9158 }
  };
  // Stadion lengths in metres. Candidates only; nobody knows which one Eratosthenes meant.
  const STADIA = [
    { name: 'Egyptian / royal', m: 157.5 },
    { name: 'Attic / Olympic', m: 185 }
  ];
  function haversineKm(a, b) {
    const dφ = rad(b.lat - a.lat), dλ = rad(b.lon - a.lon);
    const h = Math.sin(dφ / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dλ / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function compute() {
    const shadowDeg = 360 * STORY.shadowFraction;
    const shadowLenM = STORY.gnomonM * Math.tan(rad(shadowDeg));
    const impliedCirc = 360 / shadowDeg * STORY.stadia;
    const dLat = PLACES.alex.lat - PLACES.syene.lat;
    const dLon = PLACES.alex.lon - PLACES.syene.lon;
    const gc = haversineKm(PLACES.syene, PLACES.alex);
    const sphereKm = 2 * Math.PI * R;
    const out = { shadowDeg, shadowLenM, impliedCirc, dLat, dLon, gc, sphereKm, stadiaRows: [] };
    out.circStadiaModernAngle = 360 / dLat * STORY.stadia; // modern latitude gap, story distance
    for (const s of STADIA) {
      const circKm = impliedCirc * s.m / 1000;
      out.stadiaRows.push({ name: s.name, m: s.m, distKm: STORY.stadia * s.m / 1000, circKm, errPct: (circKm / sphereKm - 1) * 100 });
    }
    out.impliedStadionM = sphereKm * 1000 / impliedCirc;
    out.impliedStadionFromDistM = gc * 1000 / STORY.stadia;
    return out;
  }
  const api = { R, PLACES, STADIA, STORY, haversineKm, compute, rad, deg };
  if (typeof module !== 'undefined') module.exports = api; else root.Eratos = api;
})(typeof self !== 'undefined' ? self : this);
