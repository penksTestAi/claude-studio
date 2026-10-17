// namematch.test.mjs: runs in Node (node namematch.test.mjs) and in the landing page, which imports runTests().
import { clean, soundex, soundexAll, nysiis, RULES, matches } from "./namematch.js";
import { PUBLISHED, PUBLISHED_NYSIIS, FAMILIES } from "./data.js";

export function runTests() {
  const results = [];
  const t = (name, fn) => {
    try { const r = fn(); results.push({ name, ok: r === undefined || r === true, detail: r === undefined || r === true ? "" : String(r) }); }
    catch (e) { results.push({ name, ok: false, detail: String(e && e.message || e) }); }
  };
  const eq = (got, want) => (got === want ? true : "got " + JSON.stringify(got) + ", wanted " + JSON.stringify(want));

  for (const row of PUBLISHED) t((row.how === "memory" ? "recalled Soundex: " : "published Soundex: ") + row.name, () => eq(soundex(row.name), row.code));

  // Traced by hand from the rules (not from a source): code, then the reading of the rule.
  const hand = [
    ["", "", "empty name gives no code"],
    ["A", "A000", "one letter is padded"],
    ["Aeiou", "A000", "vowels only"],
    ["Bb", "B000", "double letter is one"],
    ["Jackson", "J250", "C and K touch and share a digit"],
    ["Ashcraft", "A261", "H skipped, so S and C merge"],
    ["Rupert", "R163", "P and R after U"],
    ["Robert", "R163", "same code as Rupert"],
    ["Rubin", "R150", "different from Robert"],
    ["O'Reilly", "O640", "apostrophe dropped"],
    ["Müller", "M460", "accent dropped"],
    ["Smith2", "S530", "typed digit ignored"],
  ];
  for (const [n, want, why] of hand) t("hand-traced Soundex: " + (n || "(empty)") + " (" + why + ")", () => eq(soundex(n), want));

  t("H/W variants differ on Ashcraft only through the separator reading", () =>
    eq(soundex("Ashcraft", { hw: "separator" }) + "/" + soundex("Ashcraft"), "A226/A261"));
  t("W between equal digits: Bwb merges when skipped", () => eq(soundex("Bwb") + "/" + soundex("Bwb", { hw: "separator" }), "B000/B100"));
  t("H and W variants agree on every published row except Ashcraft", () => {
    const diff = PUBLISHED.filter((r) => soundex(r.name) !== soundex(r.name, { hw: "separator" })).map((r) => r.name);
    return eq(diff.join(","), "Ashcraft");
  });

  t("prefix rule: Van Deusen has two codes", () => eq(soundexAll("Van Deusen").join(","), "V532,D250"));
  t("prefix rule: Lee keeps one code", () => eq(soundexAll("Lee").join(","), "L000"));
  t("prefix rule: Van Deusen matches Deusen only with the rule", () => {
    const [plain, , pre] = RULES;
    return eq(matches(plain, "Van Deusen", "Deusen").match + "/" + matches(pre, "Van Deusen", "Deusen").match, "false/true");
  });

  // NYSIIS traced by hand from the steps as recalled.
  const ny = [
    ["Macintosh", "MCANT"], ["Knight", "NAGT"], ["Phillipson", "FALAPS"], ["Schmidt", "SNAD"],
    ["Smith", "SNAT"], ["Smyth", "SNYT"], ["Reilly", "RALY"], ["Mackintosh", "MCANT"],
  ];
  for (const [n, want] of ny) t("hand-traced NYSIIS: " + n, () => eq(nysiis(n), want));
  for (const row of PUBLISHED_NYSIIS) {
    if (row.name === "Macintosh") t("published NYSIIS (search summary): " + row.name, () => eq(nysiis(row.name), row.code));
  }
  t("NYSIIS without the six-letter cut keeps the whole key for Phillipson", () => eq(nysiis("Phillipson", { maxLen: 0 }), "FALAPSAN"));

  t("clean strips everything but letters", () => eq(clean("  d'Angélo-Smith 3 "), "DANGELOSMITH"));
  t("every Soundex code is a letter and three digits, or empty", () => {
    const bad = FAMILIES.flat().filter((n) => !/^[A-Z]\d{3}$/.test(soundex(n)));
    return eq(bad.join(","), "");
  });
  t("every NYSIIS key is at most six letters", () => {
    const bad = FAMILIES.flat().filter((n) => !/^[A-Z]{1,6}$/.test(nysiis(n)));
    return eq(bad.join(","), "");
  });
  t("matching a name with itself is true under every rule", () => {
    const bad = [];
    for (const r of RULES) for (const n of FAMILIES.flat()) if (!matches(r, n, n).match) bad.push(r.id + ":" + n);
    return eq(bad.join(","), "");
  });
  t("matching is symmetric on every pair of listed names", () => {
    const names = FAMILIES.flat(); const bad = [];
    for (const r of RULES) for (const a of names) for (const b of names) if (matches(r, a, b).match !== matches(r, b, a).match) bad.push(r.id + ":" + a + "/" + b);
    return eq(bad.length, 0);
  });
  return results;
}

const isMain = typeof process !== "undefined" && process.argv && process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop());
if (isMain) {
  const res = runTests();
  for (const r of res) console.log((r.ok ? "ok   " : "FAIL ") + r.name + (r.detail ? "  -> " + r.detail : ""));
  const failed = res.filter((r) => !r.ok).length;
  console.log(`${res.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
