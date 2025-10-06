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
    def test_frankfurter_two_step_conversion(self):
        currencies = {
            "KR": "KRW",
            "RU": "RUB",
            "TW": "TWD",
        }

        for code, currency in currencies.items():
            with self.subTest(country=code):
                amount = 100
                if currency == "KRW":
                    usd_amount = amount
                else:
                    url_to_usd = (
                        "https://api.frankfurter.app/latest?amount="
                        f"{amount}&from={currency}&to=USD"
                    )
                    try:
                        with urllib.request.urlopen(url_to_usd, timeout=10) as response:
                            to_usd_payload = json.loads(response.read().decode("utf-8"))
                    except urllib.error.URLError as exc:  # pragma: no cover - network issues
                        self.skipTest(f"Frankfurter API not reachable: {exc}")

                    self.assertIn("rates", to_usd_payload)
                    rates = to_usd_payload["rates"]
                    self.assertIn("USD", rates)
                    usd_amount = rates["USD"]
                    self.assertIsInstance(usd_amount, (int, float))
                    self.assertGreater(usd_amount, 0)

                url_to_krw = (
                    "https://api.frankfurter.app/latest?amount="
                    f"{usd_amount}&from=USD&to=KRW"
                )
                try:
                    with urllib.request.urlopen(url_to_krw, timeout=10) as response:
                        to_krw_payload = json.loads(response.read().decode("utf-8"))
                except urllib.error.URLError as exc:  # pragma: no cover - network issues
                    self.skipTest(f"Frankfurter API not reachable: {exc}")

                self.assertIn("rates", to_krw_payload)
                krw_rates = to_krw_payload["rates"]
                self.assertIn("KRW", krw_rates)
                krw_amount = krw_rates["KRW"]
                self.assertIsInstance(krw_amount, (int, float))
                self.assertGreater(krw_amount, 0)


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
