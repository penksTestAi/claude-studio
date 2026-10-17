// data.js: hand-made data for the tests and the landing page. Made by Claude; MIT, like the code.

// Published Soundex values. `source` names where the value was reported; `how` says how this build saw it.
// "summary" = read in a web-search summary of that source (the page itself could not be fetched here);
// "memory" = recalled by the builder, not seen in any result this session.
export const PUBLISHED = [
  { name: "Washington", code: "W252", source: "US National Archives, Soundex page", origin: "archive", how: "summary" },
  { name: "Lee", code: "L000", source: "US National Archives, Soundex page", origin: "archive", how: "summary" },
  { name: "Pfister", code: "P236", source: "MOGenWeb American Soundex page", origin: "genealogy site", how: "summary" },
  { name: "Tymczak", code: "T522", source: "recalled as a National Archives example; not seen in any source", origin: "archive", how: "memory" },
  { name: "Ashcraft", code: "A261", source: "recalled as a National Archives example; not seen in any source", origin: "archive", how: "memory" },
  { name: "Euler", code: "E460", source: "Knuth, TAOCP vol. 3, via Text::Soundex and PHP manual summaries", origin: "Knuth", how: "summary" },
  { name: "Ellery", code: "E460", source: "same", origin: "Knuth", how: "summary" },
  { name: "Gauss", code: "G200", source: "same", origin: "Knuth", how: "summary" },
  { name: "Ghosh", code: "G200", source: "same", origin: "Knuth", how: "summary" },
  { name: "Hilbert", code: "H416", source: "same", origin: "Knuth", how: "summary" },
  { name: "Heilbronn", code: "H416", source: "same", origin: "Knuth", how: "summary" },
  { name: "Knuth", code: "K530", source: "same", origin: "Knuth", how: "summary" },
  { name: "Kant", code: "K530", source: "same", origin: "Knuth", how: "summary" },
  { name: "Lloyd", code: "L300", source: "same", origin: "Knuth", how: "summary" },
  { name: "Ladd", code: "L300", source: "same", origin: "Knuth", how: "summary" },
  { name: "Lukasiewicz", code: "L222", source: "same", origin: "Knuth", how: "summary" },
  { name: "Lissajous", code: "L222", source: "same", origin: "Knuth", how: "summary" },
];

// Published NYSIIS values, from search summaries of documentation pages (weaker, not independent of each other).
// `variant` "plain" is the unrefined algorithm.
export const PUBLISHED_NYSIIS = [
  { name: "Macintosh", code: "MCANT", source: "eccenca NYSIIS documentation, plain variant, via search summary" },
  { name: "Phillipson", code: "FFALAPSAN", source: "eccenca NYSIIS documentation, plain variant, via search summary" },
];

// Surname families: spellings I judge to be the same surname. A hand-made judgment, not an external truth set.
export const FAMILIES = [
  ["Smith", "Smyth", "Smythe"],
  ["Meyer", "Meier", "Mayer", "Maier", "Myer"],
  ["Schmidt", "Schmitt", "Schmid", "Schmit"],
  ["Cohen", "Cohn", "Kohn", "Cowen"],
  ["Johnson", "Jonson", "Jonsson"],
  ["Mackintosh", "McIntosh", "MacIntosh", "McIntush"],
  ["Phillips", "Philips", "Phillipps"],
  ["Stevens", "Stephens", "Stevins"],
  ["Reilly", "Riley", "O'Reilly", "Reily", "Rielly"],
  ["Lee", "Leigh", "Lea"],
  ["Pfeiffer", "Pfeifer", "Feifer", "Fifer"],
  ["Knight", "Night", "Knyght"],
  ["Wright", "Wrighte", "Right"],
  ["Thompson", "Thomson", "Tomson", "Tompson"],
  ["Anderson", "Andersen", "Anderssen"],
  ["Peterson", "Petersen", "Pedersen", "Pederson"],
  ["Schneider", "Snyder", "Schnieder", "Snider", "Sneider"],
  ["Ashcraft", "Ashcroft", "Ashkraft"],
  ["Brown", "Browne", "Braun"],
  ["Gray", "Grey"],
  ["Rodriguez", "Rodrigues", "Rodriquez"],
  ["Wolf", "Wolfe", "Wulf", "Woolf"],
  ["Van Deusen", "Vandeusen", "Deusen"],
  ["De Leon", "DeLeon", "Leon"],
  ["La Fleur", "LaFleur", "Fleur"],
  ["Tymczak", "Timczak", "Tymchak"],
  ["Gutierrez", "Gutierres", "Guttierez"],
  ["Mueller", "Muller", "Müller", "Mueler"],
  ["Klein", "Kline", "Cline"],
  ["Lloyd", "Floyd", "Llwyd"],
  ["Becker", "Baecker", "Bekker"],
  // Single-name families: unrelated surnames that other families can collide with.
  ["Baker"], ["Miller"], ["Ford"], ["Fort"], ["Cook"], ["Cox"], ["Hall"], ["Hill"], ["Wall"], ["Will"],
  ["Harris"], ["Harrison"], ["Burns"], ["Barnes"], ["Clay"], ["Lane"], ["Lang"], ["Kane"], ["Kahn"],
];

// Edge cases shown on the page: name, rule id to look at, and a short reason.
export const EDGES = [
  { name: "Ashcraft", why: "S, then H, then C: S and C share a digit with H between them" },
  { name: "Tymczak", why: "M, C and Z: C and Z share a digit and touch" },
  { name: "Pfister", why: "F has the same digit as the first letter P" },
  { name: "Lukasiewicz", why: "K, S, C, Z share one digit, with vowels and a W between" },
  { name: "Van Deusen", why: "a prefix: the archive rule also files the name without Van" },
  { name: "De Leon", why: "a prefix: also filed as Leon" },
  { name: "Lee", why: "short name that starts with a prefix-like pair (Le)" },
  { name: "Macintosh", why: "NYSIIS rewrites a leading MAC" },
  { name: "Knight", why: "NYSIIS rewrites a leading KN" },
  { name: "Phillipson", why: "NYSIIS rewrites a leading PH" },
  { name: "Schmidt", why: "NYSIIS rewrites a leading SCH" },
  { name: "Whitehouse", why: "H and W inside the name" },
];
