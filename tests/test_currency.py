import json
import unittest
import urllib.error
import urllib.request

from app import get_country_currency


class CurrencyOverrideTests(unittest.TestCase):
    def test_currency_overrides(self):
        self.assertEqual(get_country_currency("KR"), "KRW")
        self.assertEqual(get_country_currency("RU"), "RUB")
        self.assertEqual(get_country_currency("TW"), "TWD")


class FrankfurterSmokeTests(unittest.TestCase):
    def test_frankfurter_supports_required_currencies(self):
        currencies = {
            "KR": "KRW",
            "RU": "RUB",
            "TW": "TWD",
        }
        for code, currency in currencies.items():
            with self.subTest(country=code):
                url = (
                    "https://api.frankfurter.app/latest?amount=100&from="
                    f"{currency}&to=KRW"
                )
                try:
                    with urllib.request.urlopen(url, timeout=10) as response:
                        payload = json.loads(response.read().decode("utf-8"))
                except urllib.error.URLError as exc:  # pragma: no cover - network issues
                    self.skipTest(f"Frankfurter API not reachable: {exc}")

                self.assertIn("rates", payload)
                rates = payload["rates"]
                self.assertIn("KRW", rates)
                self.assertIsInstance(rates["KRW"], (int, float))
                self.assertGreater(rates["KRW"], 0)


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
