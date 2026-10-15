#!/usr/bin/env python3
"""checkdigits: test the check digit of everyday numbers.

Schemes: Luhn (card numbers and many ID numbers), ISBN-10, ISBN-13, EAN-13 and
IBAN (ISO 13616, mod 97). Python standard library only.

A passing check means the digits are consistent with the scheme's arithmetic.
It does not mean the card, book, product or account exists.

Usage:
  python3 checkdigits.py check 4111111111111111 0-306-40615-2 GB82WEST12345698765432
  python3 checkdigits.py check -s ean13 4006381333931
  printf '%s\n' 79927398713 79927398710 | python3 checkdigits.py check -
  python3 checkdigits.py complete -s luhn 7992739871
  python3 checkdigits.py schemes

Exit status of `check`: 0 if every value passed, 1 if any failed, 2 on a usage error.
License: MIT.
"""
import argparse
import json
import re
import sys

SCHEMES = ("luhn", "isbn10", "isbn13", "ean13", "iban")

DESCRIPTIONS = {
    "luhn": "Luhn mod 10: double every second digit from the right, fold, sum, divisible by 10",
    "isbn10": "ISBN-10: digits weighted 10 down to 1 (last may be X = 10), sum divisible by 11",
    "isbn13": "ISBN-13: EAN-13 arithmetic, and the number must start 978 or 979",
    "ean13": "EAN-13: digits weighted 1,3,1,3,... from the left, sum divisible by 10",
    "iban": "IBAN: move the first four characters to the end, letters become 10..35, remainder mod 97 is 1",
}


def normalise(text):
    """Remove spaces, hyphens and dots, and upper-case the rest."""
    return re.sub(r"[\s.\-]", "", str(text)).upper()


# ---------------------------------------------------------------- the arithmetic

def luhn_sum(digits):
    total = 0
    double = False
    for ch in reversed(digits):
        d = ord(ch) - 48
        if double:
            d *= 2
            if d > 9:
                d -= 9
        total += d
        double = not double
    return total


def isbn10_sum(chars):
    total = 0
    for i, ch in enumerate(chars):
        v = 10 if ch == "X" else ord(ch) - 48
        total += (10 - i) * v
    return total


def ean13_sum(digits):
    return sum((ord(ch) - 48) * (3 if i % 2 else 1) for i, ch in enumerate(digits))


def iban_remainder(text):
    """Remainder mod 97 of the rearranged IBAN, letters read as 10..35."""
    rearranged = text[4:] + text[:4]
    digits = "".join(str(int(ch, 36)) for ch in rearranged)
    return int(digits) % 97


# ---------------------------------------------------------------- checking

def check(scheme, raw):
    """Return (ok, why). `why` says what failed, or what passed."""
    s = normalise(raw)
    if scheme == "luhn":
        if not re.fullmatch(r"[0-9]{2,}", s):
            return False, "needs at least 2 digits and nothing else"
        r = luhn_sum(s) % 10
        return (r == 0, "digit sum is divisible by 10" if r == 0 else "digit sum leaves remainder %d, not 0" % r)
    if scheme == "isbn10":
        if not re.fullmatch(r"[0-9]{9}[0-9X]", s):
            return False, "needs 9 digits then a digit or X"
        r = isbn10_sum(s) % 11
        return (r == 0, "weighted sum is divisible by 11" if r == 0 else "weighted sum leaves remainder %d, not 0" % r)
    if scheme in ("ean13", "isbn13"):
        if not re.fullmatch(r"[0-9]{13}", s):
            return False, "needs exactly 13 digits"
        if scheme == "isbn13" and s[:3] not in ("978", "979"):
            return False, "an ISBN-13 starts with 978 or 979"
        r = ean13_sum(s) % 10
        return (r == 0, "weighted sum is divisible by 10" if r == 0 else "weighted sum leaves remainder %d, not 0" % r)
    if scheme == "iban":
        if not re.fullmatch(r"[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}", s):
            return False, "needs 2 letters, 2 digits, then 1 to 30 letters or digits"
        if not 2 <= int(s[2:4]) <= 98:
            return False, "check digits must be 02 to 98"
        r = iban_remainder(s)
        return (r == 1, "remainder mod 97 is 1" if r == 1 else "remainder mod 97 is %d, not 1" % r)
    raise ValueError("unknown scheme: %s" % scheme)


def guess(raw):
    """Pick a scheme from the shape of the input, or None."""
    s = normalise(raw)
    if re.match(r"[A-Z]{2}[0-9]{2}", s):
        return "iban"
    if re.fullmatch(r"[0-9]{9}[0-9X]", s):
        return "isbn10"
    if re.fullmatch(r"[0-9]{13}", s):
        return "isbn13" if s[:3] in ("978", "979") else "ean13"
    if re.fullmatch(r"[0-9]{2,}", s):
        return "luhn"
    return None


def complete(scheme, raw):
    """Return the payload with its check digit(s) appended, as a string."""
    s = normalise(raw)
    if scheme == "luhn":
        if not re.fullmatch(r"[0-9]+", s):
            raise ValueError("Luhn payload must be digits")
        return s + str((10 - luhn_sum(s + "0") % 10) % 10)
    if scheme == "isbn10":
        if not re.fullmatch(r"[0-9]{9}", s):
            raise ValueError("ISBN-10 payload must be 9 digits")
        need = (-isbn10_sum(s + "0")) % 11
        return s + ("X" if need == 10 else str(need))
    if scheme in ("ean13", "isbn13"):
        if not re.fullmatch(r"[0-9]{12}", s):
            raise ValueError("EAN-13/ISBN-13 payload must be 12 digits")
        if scheme == "isbn13" and s[:3] not in ("978", "979"):
            raise ValueError("an ISBN-13 starts with 978 or 979")
        return s + str((-ean13_sum(s + "0")) % 10)
    if scheme == "iban":
        if not re.fullmatch(r"[A-Z]{2}[A-Z0-9]{1,30}", s):
            raise ValueError("IBAN payload is the country code then the account part, without check digits")
        r = iban_remainder(s[:2] + "00" + s[2:])
        return s[:2] + "%02d" % (98 - r) + s[2:]
    raise ValueError("unknown scheme: %s" % scheme)


def hint(scheme, raw):
    """If the shape is right but the check fails, what a corrected check digit would be."""
    s = normalise(raw)
    try:
        if scheme == "iban":
            if re.fullmatch(r"[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}", s):
                fixed = complete("iban", s[:2] + s[4:])
                return "if only the check digits are wrong they should be %s" % fixed[2:4]
        elif scheme == "isbn10" and re.fullmatch(r"[0-9]{9}[0-9X]", s):
            return "if only the last character is wrong it should be %s" % complete(scheme, s[:-1])[-1]
        elif scheme in ("ean13", "isbn13") and re.fullmatch(r"[0-9]{13}", s):
            return "if only the last digit is wrong it should be %s" % complete(scheme, s[:-1])[-1]
        elif scheme == "luhn" and re.fullmatch(r"[0-9]{2,}", s):
            return "if only the last digit is wrong it should be %s" % complete(scheme, s[:-1])[-1]
    except ValueError:
        return None
    return None


# ---------------------------------------------------------------- command line

def _values(args_values):
    out = []
    for v in args_values:
        if v == "-":
            out.extend(line.strip() for line in sys.stdin if line.strip())
        else:
            out.append(v)
    return out


def cmd_check(args):
    values = _values(args.values)
    if not values:
        print("checkdigits: no values given", file=sys.stderr)
        return 2
    any_bad = False
    rows = []
    for raw in values:
        scheme = args.scheme if args.scheme != "auto" else guess(raw)
        if scheme is None:
            rows.append({"input": raw, "scheme": None, "valid": False, "why": "cannot tell which scheme; use -s"})
            any_bad = True
            continue
        ok, why = check(scheme, raw)
        row = {"input": raw, "scheme": scheme, "valid": ok, "why": why}
        if not ok:
            any_bad = True
            h = hint(scheme, raw)
            if h:
                row["hint"] = h
        rows.append(row)
    if args.json:
        print(json.dumps(rows, indent=2, ensure_ascii=False))
    elif not args.quiet:
        for r in rows:
            word = "valid  " if r["valid"] else "INVALID"
            line = "%s  %-6s  %s  (%s)" % (word, r["scheme"] or "?", r["input"], r["why"])
            if r.get("hint"):
                line += "; " + r["hint"]
            print(line)
    return 1 if any_bad else 0


def cmd_complete(args):
    status = 0
    for raw in _values(args.values):
        try:
            print(complete(args.scheme, raw))
        except ValueError as exc:
            print("checkdigits: %s: %s" % (raw, exc), file=sys.stderr)
            status = 2
    return status


def cmd_schemes(_args):
    for name in SCHEMES:
        print("%-7s %s" % (name, DESCRIPTIONS[name]))
    return 0


def build_parser():
    p = argparse.ArgumentParser(prog="checkdigits", description=__doc__.split("\n\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check", help="test values (use - to read lines from standard input)")
    c.add_argument("-s", "--scheme", choices=("auto",) + SCHEMES, default="auto")
    c.add_argument("-q", "--quiet", action="store_true", help="print nothing, only set the exit status")
    c.add_argument("--json", action="store_true", help="print results as JSON")
    c.add_argument("values", nargs="+")
    c.set_defaults(func=cmd_check)
    k = sub.add_parser("complete", help="add the check digit(s) to a payload")
    k.add_argument("-s", "--scheme", choices=SCHEMES, required=True)
    k.add_argument("values", nargs="+")
    k.set_defaults(func=cmd_complete)
    s = sub.add_parser("schemes", help="list the schemes")
    s.set_defaults(func=cmd_schemes)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
