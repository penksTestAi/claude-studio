// Digit generators using only BigInt. Each returns a string of n digits including the leading integer digit.
(function (root) {
  // pi: Gibbons (2006) unbounded spigot
  function piDigits(n) {
    let q = 1n, r = 0n, t = 1n, k = 1n, m = 3n, x = 3n, out = '';
    while (out.length < n) {
      if (4n * q + r - t < m * t) {
        out += m.toString();
        const nr = 10n * (r - m * t);
        m = (10n * (3n * q + r)) / t - 10n * m;
        q *= 10n; r = nr;
      } else {
        const nr = (2n * q + r) * x;
        const nm = (q * (7n * k) + 2n + r * x) / (t * x);
        q *= k; t *= x; x += 2n; k += 1n; m = nm; r = nr;
      }
    }
    return out;
  }
  // e: sum of 1/k! in fixed point with guard digits
  function eDigits(n) {
    const g = 20, scale = 10n ** BigInt(n + g);
    let term = scale, sum = 0n, k = 0n;
    while (term > 0n) { sum += term; k += 1n; term /= k; }
    return (sum / 10n ** BigInt(g)).toString().slice(0, n);
  }
  // sqrt 2: integer square root of 2 * 10^(2(n-1)) by Newton
  function sqrt2Digits(n) {
    const N = 2n * 10n ** BigInt(2 * (n - 1));
    let x = 10n ** BigInt(n);
    for (;;) { const y = (x + N / x) >> 1n; if (y >= x) break; x = y; }
    while (x * x > N) x -= 1n;
    while ((x + 1n) * (x + 1n) <= N) x += 1n;
    return x.toString();
  }
  const api = { pi: piDigits, e: eDigits, sqrt2: sqrt2Digits };
  if (typeof module !== 'undefined') module.exports = api; else root.PilishDigits = api;
})(this);
