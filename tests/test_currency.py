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
    def test_frankfurter_usd_pivot_rates(self):
        currencies = {
            "KR": "KRW",
            "RU": "RUB",
            "TW": "TWD",
        }

        for code, currency in currencies.items():
            with self.subTest(country=code):
                amount = 100
                symbols = "KRW" if currency in {"KRW", "USD"} else f"KRW,{currency}"
                url = f"https://api.frankfurter.app/latest?from=USD&to={symbols}"
                try:
                    with urllib.request.urlopen(url, timeout=10) as response:
                        payload = json.loads(response.read().decode("utf-8"))
                except urllib.error.URLError as exc:  # pragma: no cover - network issues
                    self.skipTest(f"Frankfurter API not reachable: {exc}")

                self.assertIn("rates", payload)
                rates = payload["rates"]
                self.assertIn("KRW", rates)
                usd_to_krw = rates["KRW"]
                self.assertIsInstance(usd_to_krw, (int, float))
                self.assertGreater(usd_to_krw, 0)

                if currency == "KRW":
                    krw_amount = amount
                elif currency == "USD":
                    krw_amount = amount * usd_to_krw
                else:
                    if currency not in rates:
                        self.skipTest(f"Frankfurter missing rate for {currency}")
                    usd_to_local = rates[currency]
                    self.assertIsInstance(usd_to_local, (int, float))
                    self.assertGreater(usd_to_local, 0)
                    usd_amount = amount / usd_to_local
                    krw_amount = usd_amount * usd_to_krw

                self.assertIsInstance(krw_amount, (int, float))
                self.assertGreater(krw_amount, 0)


class ExchangeRateFallbackTests(unittest.TestCase):
    def test_er_api_usd_rates(self):
        url = "https://open.er-api.com/v6/latest/USD"
        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.URLError as exc:  # pragma: no cover - network issues
            self.skipTest(f"ER API not reachable: {exc}")

        self.assertEqual(payload.get("result"), "success")
        rates = payload.get("rates", {})
        for currency in ("KRW", "RUB", "TWD"):
            with self.subTest(currency=currency):
                self.assertIn(currency, rates)
                value = rates[currency]
                self.assertIsInstance(value, (int, float))
                self.assertGreater(value, 0)


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
