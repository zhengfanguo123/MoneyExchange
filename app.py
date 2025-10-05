from datetime import date

import pycountry
from babel.numbers import get_territory_currencies
from dotenv import load_dotenv
from flask import Flask, render_template

load_dotenv()

app = Flask(__name__)


def get_country_currency(country_code: str) -> str | None:
    """Return the primary currency for a given ISO country code."""
    currencies = get_territory_currencies(country_code, date.today())
    return currencies[0] if currencies else None


def get_countries():
    """Return countries with currency codes, starting with selected ones."""
    countries = []
    for country in pycountry.countries:
        currency = get_country_currency(country.alpha_2)
        if currency:
            countries.append(
                {
                    "code": country.alpha_2,
                    "name": country.name,
                    "currency": currency,
                }
            )
    countries.sort(key=lambda c: c["name"])
    priority_codes = ["CN", "HK", "JP"]
    prioritized = [c for code in priority_codes for c in countries if c["code"] == code]
    remaining = [c for c in countries if c["code"] not in priority_codes]
    return prioritized + remaining


@app.route("/")
def index():
    return render_template("index.html", countries=get_countries())


if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True)

