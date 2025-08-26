import os
from datetime import date, datetime
from pathlib import Path

import requests
import pycountry
from babel.numbers import get_territory_currencies
from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify, session
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Numeric,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from sqlalchemy.exc import SQLAlchemyError


load_dotenv()

SQLSERVER_CONN_STR = os.environ.get("SQLSERVER_CONN_STR")
FILE_LOG_DIR = os.environ.get("FILE_LOG_DIR", "./logs")
SCHEMA_SECRET = os.environ.get("SCHEMA_SECRET", "changeme")


engine = create_engine(SQLSERVER_CONN_STR) if SQLSERVER_CONN_STR else None
SessionLocal = sessionmaker(bind=engine) if engine else None
Base = declarative_base()


class Trip(Base):
    __tablename__ = "Trip"

    id = Column(Integer, primary_key=True, autoincrement=True)
    country_code = Column(String(2))
    currency = Column(String(3))
    budget_krw = Column(Numeric(18, 2))
    remaining_krw = Column(Numeric(18, 2))
    created_at = Column(DateTime, default=datetime.utcnow)

    expenses = relationship("Expense", back_populates="trip")


class Expense(Base):
    __tablename__ = "Expense"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trip_id = Column(Integer, ForeignKey("Trip.id"), index=True)
    local_amount = Column(Numeric(18, 2))
    local_currency = Column(String(3))
    krw_amount = Column(Numeric(18, 2))
    fx_rate = Column(Numeric(18, 8))
    fx_provider = Column(String(32))
    fx_timestamp = Column(DateTime)
    note = Column(String(200))
    created_at = Column(DateTime, default=datetime.utcnow)

    trip = relationship("Trip", back_populates="expenses")


app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev")


def ensure_log_dir() -> Path:
    path = Path(FILE_LOG_DIR)
    path.mkdir(parents=True, exist_ok=True)
    return path


def log_schema_creation() -> None:
    log_dir = ensure_log_dir()
    ts = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    with (log_dir / "schema.log").open("a", encoding="utf-8") as f:
        f.write(f"{ts} | schema | created tables: Trip, Expense\n")


def log_expense(
    trip_id: int,
    local_currency: str,
    local_amount: float,
    krw_amount: float,
    fx_rate: float | None,
    note: str,
    remaining: float,
) -> None:
    log_dir = ensure_log_dir()
    now = datetime.utcnow()
    ts = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    logfile = log_dir / f"trip_{trip_id}_{now.strftime('%Y%m')}.log"
    rate_part = f"{fx_rate:.6f}" if fx_rate is not None else "None"
    with logfile.open("a", encoding="utf-8") as f:
        f.write(
            f"{ts} | trip={trip_id} | {local_currency} {local_amount:.2f} -> KRW {krw_amount:.2f} | "
            f"rate={rate_part} | note=\"{note}\" | remaining={remaining:.2f}\n"
        )


def get_country_currency(country_code: str) -> str | None:
    currencies = get_territory_currencies(country_code, date.today())
    return currencies[0] if currencies else None


def get_countries():
    countries = []
    for country in pycountry.countries:
        currency = get_country_currency(country.alpha_2)
        if currency:
            countries.append(
                {"code": country.alpha_2, "name": country.name, "currency": currency}
            )
    countries.sort(key=lambda c: c["name"])
    return countries


@app.cli.command("create-schema")
def create_schema_command():
    if not engine:
        raise RuntimeError("SQLSERVER_CONN_STR not configured")
    Base.metadata.create_all(bind=engine)
    log_schema_creation()


@app.route("/admin/create-schema", methods=["POST"])
def create_schema_endpoint():
    token = request.args.get("token")
    if token != SCHEMA_SECRET:
        return jsonify({"error": "Unauthorized"}), 403
    if not engine:
        return jsonify({"error": "Database not configured"}), 500
    Base.metadata.create_all(bind=engine)
    log_schema_creation()
    return jsonify({"ok": True, "created": ["Trip", "Expense"]})


@app.route("/")
def index():
    return render_template("index.html", countries=get_countries())


@app.route("/set_budget", methods=["POST"])
def set_budget():
    data = request.get_json()
    country_code = data.get("country")
    budget = float(data.get("budget", 0))
    currency = get_country_currency(country_code)

    if not engine:
        return jsonify({"error": "Database not configured"}), 500
    db = SessionLocal()
    trip = Trip(
        country_code=country_code,
        currency=currency,
        budget_krw=budget,
        remaining_krw=budget,
    )
    db.add(trip)
    db.commit()
    session["trip_id"] = trip.id
    db.close()
    return jsonify({"currency": currency, "remaining": budget})


@app.route("/add_expense", methods=["POST"])
def add_expense():
    trip_id = session.get("trip_id")
    if not trip_id:
        return jsonify({"error": "Budget not set"}), 400

    data = request.get_json()
    amount_local = float(data.get("amount", 0))
    note = data.get("note", "")

    if amount_local <= 0:
        return jsonify({"error": "Amount must be greater than 0"}), 400

    if not engine:
        return jsonify({"error": "Database not configured"}), 500
    db = SessionLocal()
    trip = db.get(Trip, trip_id)
    if not trip:
        db.close()
        return jsonify({"error": "Trip not found"}), 404

    try:
        resp = requests.get(
            "https://api.frankfurter.app/latest",
            params={"amount": amount_local, "from": trip.currency, "to": "KRW"},
            timeout=10,
        )
        fx_data = resp.json()
    except Exception:
        db.close()
        return jsonify({"error": "Exchange rate request failed"}), 502

    krw_amount = fx_data.get("rates", {}).get("KRW")
    if krw_amount is None:
        db.close()
        return jsonify({"error": "Exchange rate unavailable"}), 502

    fx_rate = krw_amount / amount_local if amount_local > 0 else None
    fx_timestamp = datetime.utcnow()

    db_saved = True
    db_error = None
    try:
        trip.remaining_krw = trip.remaining_krw - krw_amount
        expense = Expense(
            trip_id=trip_id,
            local_amount=amount_local,
            local_currency=trip.currency,
            krw_amount=krw_amount,
            fx_rate=fx_rate,
            fx_provider="frankfurter",
            fx_timestamp=fx_timestamp,
            note=note,
        )
        db.add(expense)
        db.commit()
        remaining = float(trip.remaining_krw)
    except SQLAlchemyError as e:
        db.rollback()
        db_saved = False
        db_error = str(e)
        remaining = float(trip.remaining_krw)
    finally:
        db.close()

    file_logged = True
    try:
        log_expense(
            trip_id,
            trip.currency,
            amount_local,
            krw_amount,
            fx_rate,
            note,
            remaining,
        )
    except Exception:
        file_logged = False

    response = {
        "local": amount_local,
        "currency": trip.currency,
        "krw": krw_amount,
        "note": note,
        "remaining": remaining,
        "db_saved": db_saved,
        "file_logged": file_logged,
    }
    if db_error:
        response["error"] = db_error
    return jsonify(response)


if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True)

