// namematch.js: Soundex (two readings of the H/W rule, optional prefix rule) and original-style NYSIIS.
// One ES module, no dependencies, runs in browsers and Node. Code: MIT (see LICENSE).

/** Upper-case ASCII letters only: accents are stripped, digits, spaces, hyphens and apostrophes dropped. */
export function clean(name) {
  return String(name)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

const DIGIT_OF = {};
for (const [digit, letters] of [["1", "BFPV"], ["2", "CGJKQSXZ"], ["3", "DT"], ["4", "L"], ["5", "MN"], ["6", "R"]]) {
  for (const l of letters) DIGIT_OF[l] = digit;
}

/**
 * Soundex. hw "transparent": H and W are skipped as if absent, so two letters with the same digit on either side
 * of an H or W collapse to one (recalled as the US National Archives reading; not checked).
 * hw "separator": H and W break a run like a vowel does (Ashcraft is A226).
 */
export function soundex(name, { hw = "transparent" } = {}) {
  const s = clean(name);
  if (!s) return "";
  let out = s[0];
  let prev = DIGIT_OF[s[0]] || "";
  for (let i = 1; i < s.length && out.length < 4; i++) {
    const c = s[i];
    const d = DIGIT_OF[c];
    if (d) {
      if (d !== prev) out += d;
      prev = d;
    } else if (c === "H" || c === "W") {
      if (hw === "separator") prev = "";
    } else {
      prev = ""; // a vowel or Y separates equal digits
    }
  }
  return (out + "000").slice(0, 4);
}

/** Name prefixes the archive-style rule also tries the name without. Quoted from memory, see README. */
export const PREFIXES = ["VAN", "CON", "DE", "DI", "LA", "LE"];
/** Shortest remainder the prefix rule will accept (this module's choice, so that Lee is not read as Le + E). */
export const MIN_REST = 3;

/** All Soundex codes for a name: the plain one, plus the code of the name without a leading prefix. */
export function soundexAll(name, opts = {}) {
  const s = clean(name);
  const codes = [];
  const add = (c) => { if (c && !codes.includes(c)) codes.push(c); };
  add(soundex(s, opts));
  for (const p of PREFIXES) {
    if (s.startsWith(p) && s.length - p.length >= MIN_REST) add(soundex(s.slice(p.length), opts));
  }
  return codes;
}

const isVowel = (c) => c !== undefined && "AEIOU".includes(c);

/** NYSIIS following the commonly published steps (Taft 1970, recalled), key cut to six letters unless maxLen is 0. */
export function nysiis(name, { maxLen = 6 } = {}) {
  let s = clean(name);
  if (!s) return "";
  if (s.startsWith("MAC")) s = "MCC" + s.slice(3);
  else if (s.startsWith("KN")) s = "NN" + s.slice(2);
  else if (s[0] === "K") s = "C" + s.slice(1);
  else if (s.startsWith("PH") || s.startsWith("PF")) s = "FF" + s.slice(2);
  else if (s.startsWith("SCH")) s = "SSS" + s.slice(3);

  if (/(EE|IE)$/.test(s)) s = s.slice(0, -2) + "Y";
  else if (/(DT|RT|RD|NT|ND)$/.test(s)) s = s.slice(0, -2) + "D";

  const arr = s.split("");
  let key = arr[0];
  const push = (ch) => { if (key[key.length - 1] !== ch) key += ch; };
  for (let i = 1; i < arr.length; i++) {
    const c = arr[i], p = arr[i - 1], n = arr[i + 1];
    let rep = c;
    if (c === "E" && n === "V") { arr[i] = "A"; arr[i + 1] = "F"; rep = "AF"; i++; }
    else if (isVowel(c)) rep = "A";
    else if (c === "Q") rep = "G";
    else if (c === "Z") rep = "S";
    else if (c === "M") rep = "N";
    else if (c === "K") rep = n === "N" ? "N" : "C";
    else if (c === "S" && n === "C" && arr[i + 2] === "H") { arr[i + 1] = "S"; arr[i + 2] = "S"; rep = "SSS"; i += 2; }
    else if (c === "P" && n === "H") { arr[i + 1] = "F"; rep = "FF"; i++; }
    else if (c === "H" && (!isVowel(p) || !isVowel(n))) rep = p;
    else if (c === "W" && isVowel(p)) rep = p;
    if (rep.length === 1) arr[i] = rep;
    for (const ch of rep) push(ch);
  }
  if (key.length > 1 && key.endsWith("S")) key = key.slice(0, -1);
  if (key.endsWith("AY")) key = key.slice(0, -2) + "Y";
  else if (key.length > 1 && key.endsWith("A")) key = key.slice(0, -1);
  return maxLen > 0 ? key.slice(0, maxLen) : key;
}

/** The four rules the landing page compares. Each has a code function (array of codes) and a name. */
export const RULES = [
  { id: "sx", label: "Soundex, H and W skipped", codes: (n) => [soundex(n)] },
  { id: "sxsep", label: "Soundex, H and W separate", codes: (n) => [soundex(n, { hw: "separator" })] },
  { id: "sxpre", label: "Soundex, skipped, plus prefix rule", codes: (n) => soundexAll(n) },
  { id: "ny", label: "NYSIIS, six letters", codes: (n) => [nysiis(n)] },
];

/** Two names match under a rule when their code lists share a code (and neither is empty). */
export function matches(rule, a, b) {
  const ca = rule.codes(a), cb = rule.codes(b);
  const shared = ca.filter((c) => cb.includes(c));
  return { match: shared.length > 0, a: ca, b: cb };
}
