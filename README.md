# MoneyExchange

A web-based travel expense tracker built with Flask and jQuery. Select a destination country, set your total budget in Korean Won (KRW), and log expenses in the local currency while the app automatically converts them to KRW.

## Features
- Choose from a list of countries; the app automatically determines the local currency.
- Enter a total travel budget in KRW and view the remaining balance.
- Add expenses in the local currency with an optional note.
- Expenses are converted to KRW using [exchangerate.host](https://exchangerate.host) and deducted from your budget.
- View a history table showing the local amount, converted KRW value, note, and remaining budget.

## Setup

### Prerequisites
- Python 3.8 or later

### Install dependencies
```bash
pip install -r requirements.txt
```

### Run the app
```bash
python app.py
```
Open `http://localhost:5000` on the same machine or `http://<your-ip-address>:5000` from another device on the network.

## Usage
1. Choose a destination country and enter your total budget in KRW.
2. Click **Start Trip** to begin tracking expenses.
3. Add each expense in the local currency and provide a note if desired.
4. The table updates with the converted amount and remaining budget after each entry.
