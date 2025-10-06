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


class RateSourceSmokeTests(unittest.TestCase):
    def _fetch_json(self, url, label):
        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.URLError as exc:  # pragma: no cover - network issues
            self.skipTest(f"{label} not reachable: {exc}")

    def test_open_er_api_usd_rates(self):
        payload = self._fetch_json("https://open.er-api.com/v6/latest/USD", "open.er-api.com")
        self.assertEqual(payload.get("result"), "success")
        rates = payload.get("rates", {})
        for currency in ("KRW", "RUB", "TWD"):
            with self.subTest(currency=currency):
                self.assertIn(currency, rates)
                value = rates[currency]
                self.assertIsInstance(value, (int, float))
                self.assertGreater(value, 0)

    def test_fawaz_currency_api_usd_rates(self):
        payload = self._fetch_json(
            "https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/usd.json",
            "Fawaz currency API",
        )
        rates = payload.get("usd", {})
        for currency in ("krw", "rub", "twd"):
            with self.subTest(currency=currency):
                self.assertIn(currency, rates)
                value = rates[currency]
                self.assertIsInstance(value, (int, float))
                self.assertGreater(value, 0)

    def test_frankfurter_usd_table_conversion(self):
        payload = self._fetch_json("https://api.frankfurter.app/latest?from=USD", "Frankfurter API")
        rates = payload.get("rates", {})
        currencies = {"KR": "KRW", "RU": "RUB", "TW": "TWD"}
        usd_to_krw = rates.get("KRW")
        self.assertIsInstance(usd_to_krw, (int, float))
        self.assertGreater(usd_to_krw, 0)

        amount = 100
        for country, currency in currencies.items():
            with self.subTest(country=country):
                if currency == "KRW":
                    krw_amount = amount
                elif currency == "USD":
                    krw_amount = amount * usd_to_krw
                else:
                    local_rate = rates.get(currency)
                    if local_rate is None:
                        self.skipTest(f"Frankfurter missing rate for {currency}")
                    self.assertIsInstance(local_rate, (int, float))
                    self.assertGreater(local_rate, 0)
                    conversion_rate = usd_to_krw / local_rate
                    krw_amount = amount * conversion_rate

                self.assertIsInstance(krw_amount, (int, float))
                self.assertGreater(krw_amount, 0)


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
