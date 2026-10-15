#!/usr/bin/env python3
"""Tests for checkdigits.py. Run: python3 -m unittest -v test_checkdigits   (from this folder)

The published examples live in reference_examples.json (copied from the python-stdnum test files, a
second source with its own code). Every disagreement with them must be one of the known scope
differences: this tool checks the arithmetic only, not a country's IBAN length or character rules.
"""
import contextlib
import io
import json
import random
import unittest
from pathlib import Path

import checkdigits as cd

HERE = Path(__file__).resolve().parent
REFERENCE_GROUPS_OUT_OF_SCOPE = {
    "IBAN, wrong length but valid checksum",
    "IBAN, wrong characters or unknown country",
    "IBAN, fails only the country-specific rule",
}


def run_cli(*argv, stdin=None):
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        status = cd.main(list(argv))
    return status, out.getvalue()


class ReferenceExamples(unittest.TestCase):
    def setUp(self):
        self.doc = json.loads((HERE / "reference_examples.json").read_text(encoding="utf-8"))

    def test_at_least_ten_examples_and_both_verdicts(self):
        items = self.doc["items"]
        self.assertGreaterEqual(len(items), 10)
        self.assertTrue(any(i["valid"] for i in items))
        self.assertTrue(any(not i["valid"] for i in items))

    def test_every_disagreement_is_a_known_scope_difference(self):
        unexplained = []
        disagreements = 0
        for item in self.doc["items"]:
            ok, _ = cd.check(item["scheme"], item["value"])
            if ok != item["valid"]:
                disagreements += 1
                # Out of scope means: the reference rejects it, and our arithmetic passes it.
                if not (ok and not item["valid"] and item["group"] in REFERENCE_GROUPS_OUT_OF_SCOPE):
                    unexplained.append(item)
        self.assertEqual(unexplained, [])
        self.assertGreater(disagreements, 0)  # if this ever reaches 0, update the README and the page text


class Arithmetic(unittest.TestCase):
    PAYLOADS = {"luhn": "7992739871", "isbn10": "030640615", "ean13": "400638133393",
                "isbn13": "978030640615", "iban": "GB" + "WEST12345698765432"}

    def test_complete_then_check_passes(self):
        for scheme, payload in self.PAYLOADS.items():
            full = cd.complete(scheme, payload)
            self.assertTrue(cd.check(scheme, full)[0], (scheme, full))

    def test_random_payloads_round_trip(self):
        rng = random.Random(7)
        for _ in range(500):
            n = rng.randint(1, 30)
            p = "".join(rng.choice("0123456789") for _ in range(n))
            self.assertTrue(cd.check("luhn", cd.complete("luhn", p))[0])
            self.assertTrue(cd.check("isbn10", cd.complete("isbn10", p[:1] * 9))[0])
            q = "".join(rng.choice("0123456789") for _ in range(12))
            self.assertTrue(cd.check("ean13", cd.complete("ean13", q))[0])
            b = "".join(rng.choice("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ") for _ in range(rng.randint(5, 30)))
            self.assertTrue(cd.check("iban", cd.complete("iban", "DE" + b))[0])

    def test_every_single_digit_error_in_one_code_of_each_scheme_is_caught(self):
        for scheme in ("luhn", "ean13", "isbn13", "isbn10"):
            full = cd.complete(scheme, self.PAYLOADS[scheme])
            for i, ch in enumerate(full):
                for other in "0123456789":
                    if other != ch:
                        self.assertFalse(cd.check(scheme, full[:i] + other + full[i + 1:])[0], (scheme, i, other))

    def test_isbn10_x_check_character(self):
        self.assertEqual(cd.complete("isbn10", "080442957"), "080442957X")
        self.assertTrue(cd.check("isbn10", "0-8044-2957-X")[0])
        self.assertFalse(cd.check("isbn10", "0-8044-2957-9")[0])
        self.assertFalse(cd.check("isbn10", "08044X957-2")[0])  # X only allowed last

    def test_isbn13_needs_978_or_979(self):
        self.assertTrue(cd.check("ean13", "7501031311309")[0])
        self.assertFalse(cd.check("isbn13", "7501031311309")[0])

    def test_iban_check_digit_range(self):
        # 99 and 01 are never produced by the algorithm and are refused even when the remainder fits
        self.assertFalse(cd.check("iban", "GB00WEST12345698765432")[0])
        self.assertTrue(cd.check("iban", "GB82 WEST 1234 5698 7654 32")[0])

    def test_normalisation_and_guess(self):
        self.assertEqual(cd.normalise(" gb82-west.1234 "), "GB82WEST1234")
        self.assertEqual(cd.guess("0-306-40615-2"), "isbn10")
        self.assertEqual(cd.guess("978-0-306-40615-7"), "isbn13")
        self.assertEqual(cd.guess("4006381333931"), "ean13")
        self.assertEqual(cd.guess("4111 1111 1111 1111"), "luhn")
        self.assertIsNone(cd.guess("hello"))


class CommandLine(unittest.TestCase):
    def test_exit_status(self):
        self.assertEqual(run_cli("check", "79927398713")[0], 0)
        self.assertEqual(run_cli("check", "79927398710")[0], 1)
        self.assertEqual(run_cli("check", "79927398713", "79927398710")[0], 1)

    def test_json_and_hint(self):
        status, out = run_cli("check", "--json", "-s", "luhn", "79927398710")
        row = json.loads(out)[0]
        self.assertEqual(status, 1)
        self.assertFalse(row["valid"])
        self.assertIn("3", row["hint"])

    def test_complete_command(self):
        status, out = run_cli("complete", "-s", "luhn", "7992739871")
        self.assertEqual((status, out.strip()), (0, "79927398713"))

    def test_unknown_shape_is_reported_not_crashed(self):
        status, out = run_cli("check", "hello")
        self.assertEqual(status, 1)
        self.assertIn("cannot tell", out)


if __name__ == "__main__":
    unittest.main()
