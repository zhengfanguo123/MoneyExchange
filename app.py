from flask import Flask, render_template, request, jsonify
from babel.numbers import get_territory_currencies
import pycountry
import requests
from datetime import date

app = Flask(__name__)

# In-memory state for demo purposes
state = {
    "country": None,
    "currency": None,
    "budget": 0.0,
    "remaining": 0.0,
    "expenses": []
}


def get_country_currency(country_code: str):
    currencies = get_territory_currencies(country_code, date.today())
    return currencies[0] if currencies else None


def get_countries():
    countries = []
    for country in pycountry.countries:
        currency = get_country_currency(country.alpha_2)
        if currency:
            countries.append({
                "code": country.alpha_2,
                "name": country.name,
                "currency": currency,
            })
    countries.sort(key=lambda c: c["name"])
    return countries


@app.route("/")
def index():
    return render_template("index.html", countries=get_countries(), state=state)


@app.route("/set_budget", methods=["POST"])
def set_budget():
    data = request.get_json()
    country_code = data.get("country")
    budget = float(data.get("budget", 0))
    currency = get_country_currency(country_code)
    state.update(
        {
            "country": country_code,
            "currency": currency,
            "budget": budget,
            "remaining": budget,
            "expenses": [],
        }
    )
    return jsonify({"currency": currency, "remaining": state["remaining"]})


@app.route("/add_expense", methods=["POST"])
def add_expense():
    if not state.get("currency"):
        return jsonify({"error": "Budget not set"}), 400

    data = request.get_json()
    amount_local = float(data.get("amount", 0))
    note = data.get("note", "")

    try:
        resp = requests.get(
            "https://api.frankfurter.app/latest",
            params={"amount": amount_local, "from": state["currency"], "to": "KRW"},
            timeout=10,
        )
        data = resp.json()
    except Exception:
        return jsonify({"error": "Exchange rate request failed"}), 502

    krw_amount = data.get("rates", {}).get("KRW")
    if krw_amount is None:
        return jsonify({"error": "Exchange rate unavailable"}), 502

    state["remaining"] -= krw_amount
    expense = {
        "local": amount_local,
        "currency": state["currency"],
        "krw": krw_amount,
        "note": note,
        "remaining": state["remaining"],
    }
    state["expenses"].append(expense)
    return jsonify(expense)



if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True)
