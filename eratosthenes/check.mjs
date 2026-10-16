// Run: node check.mjs   (exit 1 if any check fails)
import { createRequire } from 'node:module';
const E = createRequire(import.meta.url)('./calc.js');
const c = E.compute();
let bad = 0;
function ok(name, cond, detail) { console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); if (!cond) bad++; }
const near = (a, b, t) => Math.abs(a - b) <= t;
ok('1/50 of a circle is 7.2 degrees', c.shadowDeg === 7.2);
ok('7.2 deg x 50 = 360 deg', near(c.shadowDeg * 50, 360, 1e-9));
ok('story circumference = 50 x 5000 = 250,000 stadia', c.impliedCirc === 250000);
ok('shadow of a 2 m pole at 7.2 deg is 0.253 m', near(c.shadowLenM, 0.2527, 0.0005), c.shadowLenM.toFixed(4));
// haversine control: one degree of latitude on the mean sphere
ok('haversine: 1 deg of latitude = 111.195 km', near(E.haversineKm({lat:0,lon:0},{lat:1,lon:0}), 111.195, 0.01));
ok('haversine: quarter circle on the equator = 10,007.5 km', near(E.haversineKm({lat:0,lon:0},{lat:0,lon:90}), 10007.54, 0.05));
ok('modern latitude gap near 7.11 deg', near(c.dLat, 7.11, 0.01), c.dLat.toFixed(3));
ok('modern great-circle distance near 844 km', near(c.gc, 843.6, 0.5), c.gc.toFixed(1));
ok('mean-sphere circumference near 40,030 km', near(c.sphereKm, 40030.2, 0.1), c.sphereKm.toFixed(1));
ok('Egyptian stadion gives 39,375 km (-1.6%)', near(c.stadiaRows[0].circKm, 39375, 0.01) && near(c.stadiaRows[0].errPct, -1.64, 0.01));
ok('Attic stadion gives 46,250 km (+15.5%)', near(c.stadiaRows[1].circKm, 46250, 0.01) && near(c.stadiaRows[1].errPct, 15.54, 0.01));
ok('Syene lies north of the Tropic (24.09 N), not on it', E.PLACES.syene.lat > 23.4 && E.PLACES.syene.lat < 24.5);
console.log(bad ? bad + ' failed' : 'all passed');
process.exit(bad ? 1 : 0);
