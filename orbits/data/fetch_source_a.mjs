// Fetches source A (a GitHub mirror of NASA's planetary fact sheet) and keeps only the three columns the page uses.
// Usage: node data/fetch_source_a.mjs   (needs network; writes data/source-a.json next to this script)
import { writeFileSync } from 'node:fs';
const URL_A = 'https://raw.githubusercontent.com/devstronomy/nasa-data-scraper/master/data/csv/planets.csv';
const text = await (await fetch(URL_A)).text();
const [head, ...rows] = text.trim().split('\n').map(l => l.split(','));
const col = n => head.indexOf(n);
const out = {
  source: 'devstronomy/nasa-data-scraper, data/csv/planets.csv (a scrape of the NASA Planetary Fact Sheet)',
  url: URL_A,
  retrieved: new Date().toISOString().slice(0, 10),
  note: 'distance_from_sun is the fact sheet\'s mean distance in 10^6 km; orbital_period is in Earth days. Strings are kept exactly as printed so the page can read their precision.',
  rows: rows.map(r => ({ planet: r[0], a_1e6km: r[col('distance_from_sun')], period_days: r[col('orbital_period')] })),
};
writeFileSync(new URL('./source-a.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(out.rows.length, 'rows');
