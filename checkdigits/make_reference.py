#!/usr/bin/env python3
"""Build reference_examples.json from the python-stdnum test files.

python-stdnum (Arthur de Jong, LGPL-2.1+) is a separate project with its own
code. Its test files list numbers copied from the IBAN registry and found online,
plus hand-made broken ones. We copy only the numbers and the library's own verdict
(valid or not, and why); none of our code or the library's code is used.

Usage: python3 make_reference.py DIR OUT.json
DIR holds test_iban.doctest, test_luhn.doctest, test_isbn.doctest, test_ean.doctest
downloaded from https://github.com/arthurdejong/python-stdnum/tree/master/tests
"""
import json
import re
import sys
from pathlib import Path

BASE = "https://github.com/arthurdejong/python-stdnum/blob/master/tests/"


def blocks(text):
    """Yield (preceding paragraph, [lines]) for each numbers = '''...''' block."""
    for m in re.finditer(r"\n([^\n>][^\n]*(?:\n[^\n>][^\n]*)*)\n+>>> numbers = '''\n((?:\.\.\. ?[^\n]*\n)*?)\.\.\. '''", text):
        lines = [ln[4:] if ln.startswith("... ") else ln[3:] for ln in m.group(2).splitlines()]
        yield m.group(1), [ln for ln in lines if ln.strip()]


def explicit(text, module):
    """Yield (value, valid, reason) for `module.validate('x')` doctest lines."""
    lines = text.splitlines()
    for i, ln in enumerate(lines):
        m = re.match(r"^>>> %s\.validate\('([^']*)'\)\s*(?:#.*)?$" % module, ln)
        if not m:
            continue
        nxt = lines[i + 1] if i + 1 < len(lines) else ""
        if nxt.startswith("Traceback"):
            reason = lines[i + 3].strip().split(":")[0] if i + 3 < len(lines) else ""
            yield m.group(1), False, reason
        else:
            yield m.group(1), True, ""


def isbn_scheme(value):
    n = len(re.sub(r"[\s.\-]", "", value))
    return "isbn10" if n <= 10 else "isbn13"


def main(src_dir, out):
    src = Path(src_dir)
    items = []

    seen = set()

    def add(scheme, value, valid, group, file, reason=""):
        if (scheme, value) in seen:
            return
        seen.add((scheme, value))
        items.append({"scheme": scheme, "value": value, "valid": valid, "group": group,
                      "file": file, "reference_reason": reason})

    iban = (src / "test_iban.doctest").read_text(encoding="utf-8")
    iban_groups = [
        (True, "IBAN registry sample numbers"),
        (False, "IBAN, broken checksum or mangled"),
        (False, "IBAN, wrong length but valid checksum"),
        (False, "IBAN, wrong characters or unknown country"),
        (False, "IBAN, fails only the country-specific rule"),
    ]
    got = list(blocks(iban))
    assert len(got) == len(iban_groups), len(got)
    for (para, lines), (valid, group) in zip(got, iban_groups):
        for ln in lines:
            add("iban", ln, valid, group, "test_iban.doctest")

    isbn = (src / "test_isbn.doctest").read_text(encoding="utf-8")
    for para, lines in blocks(isbn):
        for ln in lines:
            add(isbn_scheme(ln), ln, True, "ISBN numbers found online", "test_isbn.doctest")
    for value, valid, reason in explicit(isbn, "isbn"):
        add(isbn_scheme(value), value, valid, "ISBN hand-made cases", "test_isbn.doctest", reason)

    ean = (src / "test_ean.doctest").read_text(encoding="utf-8")
    for value, valid, reason in explicit(ean, "ean"):
        add("ean13", value, valid, "EAN-13 hand-made cases", "test_ean.doctest", reason)

    luhn = (src / "test_luhn.doctest").read_text(encoding="utf-8")
    for value, valid, reason in explicit(luhn, "luhn"):
        add("luhn", value, valid, "Luhn hand-made cases", "test_luhn.doctest", reason)
    lines = luhn.splitlines()
    for i, ln in enumerate(lines):
        m = re.match(r"^>>> luhn\.calc_check_digit\('([0-9]+)'\)$", ln)
        if m and i + 1 < len(lines):
            d = re.match(r"^'([0-9])'$", lines[i + 1])
            if d:
                add("luhn", m.group(1) + d.group(1), True, "Luhn payload plus the library's check digit",
                    "test_luhn.doctest")

    doc = {
        "about": "Published examples from a second source of different origin, used to test checkdigits.py.",
        "source_name": "python-stdnum test files (Arthur de Jong, LGPL-2.1+)",
        "source_url": "https://github.com/arthurdejong/python-stdnum/tree/master/tests",
        "retrieved": "2026-10-15",
        "origin_note": "The IBAN lists say they are IBAN registry samples; the ISBN list says 'found online'. "
                       "Both are the library authors' statements, not something we re-checked at the registry.",
        "items": items,
    }
    Path(out).write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print("wrote %d items to %s" % (len(items), out))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
