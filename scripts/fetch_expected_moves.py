"""
Compute daily and weekly expected moves for the tickers in data/watchlist.json
and write them to data/expected-moves.json (+ a .js copy so the page also
works when opened straight from disk).

Method
------
Expected move (1 standard deviation) = price x IV x sqrt(time)

  * IV is backed out of the at-the-money straddle (call + put) on Yahoo Finance.
  * Daily  = IV / sqrt(252) (the "rule of 16"), using the nearest expiry that isn't
             expiring in the session itself (0DTE prices are too noisy).
  * Weekly = calendar time left until this week's last expiry (normally Friday 4pm ET).
             The ATM straddle price for that expiry is saved too. Traders often
             quote the straddle (or 0.85 x straddle) as "the expected move".

About 68% of the time the price should finish inside low..high.

Run locally:  pip install -r scripts/requirements.txt
              python scripts/fetch_expected_moves.py
"""

from __future__ import annotations

import datetime as dt
import json
import math
import sys
import time
from pathlib import Path
from zoneinfo import ZoneInfo

import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
WATCHLIST = ROOT / "data" / "watchlist.json"
OUT_JSON = ROOT / "data" / "expected-moves.json"
OUT_JS = ROOT / "data" / "expected-moves.js"
ET = ZoneInfo("America/New_York")


# ---------------------------------------------------------------- dates
def session_date(now: dt.datetime) -> dt.date:
    """The trading day the 'daily' move applies to.
    After 4pm ET (or on a weekend) that's the next weekday. Holidays are ignored."""
    d = now.date()
    if now.hour >= 16:
        d += dt.timedelta(days=1)
    while d.weekday() >= 5:
        d += dt.timedelta(days=1)
    return d


def trading_days(start: dt.date, end: dt.date) -> int:
    """Weekdays from start through end, inclusive (min 1)."""
    n, d = 0, start
    while d <= end:
        if d.weekday() < 5:
            n += 1
        d += dt.timedelta(days=1)
    return max(n, 1)


# ---------------------------------------------------------------- options
def _num(x) -> float:
    try:
        v = float(x)
        return v if math.isfinite(v) else 0.0
    except (TypeError, ValueError):
        return 0.0


def mid_price(row) -> float:
    bid, ask, last = _num(row.get("bid")), _num(row.get("ask")), _num(row.get("lastPrice"))
    if bid > 0 and ask > 0 and ask >= bid:
        return (bid + ask) / 2
    return last


def years_to_expiry(exp_date: dt.date, now: dt.datetime) -> float:
    """Calendar time from now to the 4pm ET close on expiry day (min 6 hours)."""
    close = dt.datetime.combine(exp_date, dt.time(16, 0), tzinfo=ET)
    return max((close - now).total_seconds(), 6 * 3600) / (365 * 86400)


def atm_snapshot(tk: yf.Ticker, expiry: str, price: float, exp_date: dt.date, now: dt.datetime):
    """Return (iv, straddle) at the strike closest to price for one expiry.

    IV is backed out of the ATM straddle's time value (straddle ≈ 0.798 · S · σ · √T), which
    tracks real option prices. Yahoo's own impliedVolatility field goes stale outside market
    hours, so it's only a fallback."""
    chain = tk.option_chain(expiry)
    calls, puts = chain.calls, chain.puts
    strikes = sorted(set(calls["strike"]).intersection(puts["strike"]))
    if not strikes:
        return None, None
    k = min(strikes, key=lambda s: abs(s - price))
    c = calls[calls["strike"] == k].iloc[0]
    p = puts[puts["strike"] == k].iloc[0]

    straddle = mid_price(c) + mid_price(p)
    time_value = straddle - abs(price - k)   # strip intrinsic value if the strike isn't exactly ATM

    iv = None
    if time_value > 0:
        iv = time_value / (0.7979 * price * math.sqrt(years_to_expiry(exp_date, now)))
    if iv is None or not (0.02 < iv < 5):
        ivs = [v for v in (_num(c.get("impliedVolatility")), _num(p.get("impliedVolatility"))) if 0.02 < v < 5]
        iv = sum(ivs) / len(ivs) if ivs else None
    return iv, (straddle if straddle > 0 else None)


def move_block(anchor: float, iv: float, years: float, days: int, expiry: str, **extra) -> dict:
    """Range is centred on `anchor` (prev close for the live daily session, else last price)."""
    nd = 4 if anchor < 5 else 2
    move = anchor * iv * math.sqrt(years)
    return {
        "expiry": expiry,
        "iv": round(iv, 4),
        "tradingDays": days,
        "anchor": round(anchor, nd),
        "move": round(move, nd),
        "movePct": round(move / anchor * 100, 2),
        "low": round(anchor - move, nd),
        "high": round(anchor + move, nd),
        **extra,
    }


def analyze(item: dict, sess: dt.date, now: dt.datetime) -> dict:
    today = now.date()
    sym = item["symbol"]
    out = {"symbol": sym, "tv": item.get("tv", sym), "name": item.get("name", sym), "pin": bool(item.get("pin"))}
    tk = yf.Ticker(sym)

    fi = tk.fast_info
    price = _num(getattr(fi, "last_price", None))
    prev = _num(getattr(fi, "previous_close", None))
    if price <= 0:
        raise ValueError("no price")
    out["price"] = round(price, 4 if price < 5 else 2)
    out["prevClose"] = round(prev, 4 if prev < 5 else 2) if prev else None
    out["changePct"] = round((price / prev - 1) * 100, 2) if prev else None

    exps = [(e, dt.date.fromisoformat(e)) for e in tk.options]
    exps = [(e, d) for e, d in exps if d >= sess]
    if not exps:
        raise ValueError("no listed options")

    # --- weekly: last expiry on or before this week's Friday (handles holiday Thursdays)
    friday = sess + dt.timedelta(days=(4 - sess.weekday()))
    in_week = [x for x in exps if x[1] <= friday]
    w_exp, w_date = in_week[-1] if in_week else exps[0]
    w_iv, w_straddle = atm_snapshot(tk, w_exp, price, w_date, now)

    # --- daily: nearest expiry after the session day (avoids noisy 0DTE IV)
    later = [x for x in exps if x[1] > sess]
    d_exp, d_date = later[0] if later else exps[0]
    if (d_exp, d_date) == (w_exp, w_date):
        d_iv = w_iv
    else:
        d_iv, _ = atm_snapshot(tk, d_exp, price, d_date, now)
    d_iv = d_iv or w_iv
    w_iv = w_iv or d_iv
    if not d_iv:
        raise ValueError("no usable implied volatility")

    # While the session is underway, keep the daily range anchored to yesterday's close
    # so it doesn't drift every time the job re-runs; the page shows the live price against it.
    in_session = sess == today and (now.hour, now.minute) >= (9, 30)
    d_anchor = prev if (in_session and prev > 0) else price
    # daily: one session = IV / √252 ("rule of 16"); weekly: calendar time left to expiry
    out["daily"] = move_block(d_anchor, d_iv, 1 / 252, 1, sess.isoformat(), ivExpiry=d_exp)
    out["weekly"] = move_block(
        price, w_iv, years_to_expiry(w_date, now), trading_days(sess, w_date), w_exp,
        straddle=round(w_straddle, 4 if price < 5 else 2) if w_straddle else None,
        isWeekly=bool(in_week),
    )
    return out


# ---------------------------------------------------------------- main
def main() -> int:
    items = json.loads(WATCHLIST.read_text(encoding="utf-8"))["tickers"]
    now = dt.datetime.now(ET)
    sess = session_date(now)

    results, failed = [], 0
    for item in items:
        try:
            results.append(analyze(item, sess, now))
            print(f"ok   {item['symbol']}")
        except Exception as e:  # keep going; one bad ticker shouldn't kill the run
            failed += 1
            print(f"FAIL {item['symbol']}: {e}", file=sys.stderr)
            results.append({"symbol": item["symbol"], "tv": item.get("tv"), "name": item.get("name"),
                            "pin": bool(item.get("pin")), "error": str(e)})
        time.sleep(0.4)

    if failed == len(items):
        print("Every ticker failed. Keeping the previous data file.", file=sys.stderr)
        return 1

    payload = {
        "generatedAt": now.isoformat(timespec="seconds"),
        "session": sess.isoformat(),
        "sample": False,
        "source": "Yahoo Finance options chains (via yfinance)",
        "method": "price × straddle-implied IV × √time (daily: 1/252 yr; weekly: time to expiry)",
        "tickers": results,
    }
    text = json.dumps(payload, indent=2, ensure_ascii=False)
    OUT_JSON.write_text(text + "\n", encoding="utf-8")
    OUT_JS.write_text("window.EXPECTED_MOVES = " + text + ";\n", encoding="utf-8")
    print(f"Wrote {len(results) - failed}/{len(items)} tickers for session {sess}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
