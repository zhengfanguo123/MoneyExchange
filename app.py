from datetime import date

import pycountry
from babel import Locale
from babel.numbers import get_territory_currencies
from dotenv import load_dotenv
from flask import Flask, redirect, render_template, request, session, url_for

load_dotenv()

app = Flask(__name__)
app.config["SECRET_KEY"] = "change-me-to-a-secure-secret-key"


korean_locale = Locale("ko")


CURRENCY_OVERRIDE = {
    "KR": "KRW",
    "RU": "RUB",
    "TW": "TWD",
}


visit_count = 0


def increment_visit_count() -> None:
    """Increment visit counter for the main page."""

    global visit_count
    visit_count += 1


def get_country_currency(country_code: str) -> str | None:
    """Return the primary currency for a given ISO country code."""
    if country_code in CURRENCY_OVERRIDE:
        return CURRENCY_OVERRIDE[country_code]

    currencies = get_territory_currencies(country_code, date.today())
    return currencies[0] if currencies else None


def get_countries():
    """Return countries with currency codes, starting with selected ones."""
    countries = []
    territories = korean_locale.territories
    for country in pycountry.countries:
        currency = get_country_currency(country.alpha_2)
        if currency:
            korean_name = territories.get(country.alpha_2, country.name)
            countries.append(
                {
                    "code": country.alpha_2,
                    "name": korean_name,
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
    increment_visit_count()
    return render_template("index.html", countries=get_countries())


@app.route("/admin", methods=["GET", "POST"])
def admin():
    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")
        if username == "admin" and password == "WWelcome@22":
            session["admin_authenticated"] = True
            return redirect(url_for("admin_dashboard"))
        return render_template(
            "login.html",
            error="Invalid credentials. Please try again.",
        )

    if session.get("admin_authenticated"):
        return redirect(url_for("admin_dashboard"))

    return render_template("login.html", error=None)


@app.route("/admin/dashboard")
def admin_dashboard():
    if not session.get("admin_authenticated"):
        return redirect(url_for("admin"))
    return render_template("admin_dashboard.html", visit_count=visit_count)


@app.route("/admin/logout")
def admin_logout():
    session.pop("admin_authenticated", None)
    return redirect(url_for("index"))


if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True)

