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

import calendar
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
BARS_DIR = ROOT / "data" / "bars"          # one candle file per ticker, loaded when it's charted
ET = ZoneInfo("America/New_York")

# chart key -> (yfinance interval, history period, sessions to keep or None for all)
# 3m and 4h candles are built in the browser from the 1m and 1h data.
BAR_SPECS = {
    "1m":  ("1m",  "5d",  2),
    "5m":  ("5m",  "1mo", 10),
    "15m": ("15m", "1mo", None),
    "1h":  ("60m", "6mo", 65),
    "1d":  ("1d",  "2y",  None),
    "1w":  ("1wk", "5y",  None),
}


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


def fetch_bars(tk: yf.Ticker, interval: str, period: str, sessions) -> list:
    """Candles as [time, open, high, low, close].
    `time` is New York wall-clock time encoded as UTC seconds, so the chart's
    time axis reads in ET without any timezone handling in the browser.
    `sessions` keeps only the last N trading days (None keeps everything)."""
    h = tk.history(period=period, interval=interval, prepost=False, auto_adjust=False)
    if h is None or h.empty:
        return []
    idx = h.index.tz_localize("UTC") if h.index.tz is None else h.index
    idx = idx.tz_convert(ET)
    dates = sorted({ts.date() for ts in idx})
    keep = set(dates if sessions is None else dates[-sessions:])
    rows = []
    for ts, (o, hi, lo, c) in zip(idx, h[["Open", "High", "Low", "Close"]].itertuples(index=False, name=None)):
        if ts.date() not in keep or any(v != v for v in (o, hi, lo, c)):  # v != v → NaN
            continue
        nd = 4 if c < 5 else 2
        t = calendar.timegm(ts.replace(tzinfo=None).timetuple())
        rows.append([t, round(o, nd), round(hi, nd), round(lo, nd), round(c, nd)])
    return rows


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

    # --- monthly: next standard monthly expiry (3rd Friday, or Thursday before a holiday) after this week
    def is_monthly(d: dt.date) -> bool:
        return (d.weekday() == 4 and 15 <= d.day <= 21) or (d.weekday() == 3 and 14 <= d.day <= 20)
    after_week = [x for x in exps if x[1] > w_date]
    monthlies = [x for x in after_week if is_monthly(x[1])]
    m_exp, m_date = monthlies[0] if monthlies else (after_week[0] if after_week else (w_exp, w_date))
    m_iv, m_straddle = atm_snapshot(tk, m_exp, price, m_date, now)
    m_iv = m_iv or w_iv
    out["monthly"] = move_block(
        price, m_iv, years_to_expiry(m_date, now), trading_days(sess, m_date), m_exp,
        straddle=round(m_straddle, 4 if price < 5 else 2) if m_straddle else None,
        isMonthly=bool(monthlies),
    )

    # Candles for the chart, every interval. Optional: the chart falls back if missing.
    bars = {}
    for key, (interval, period, sessions) in BAR_SPECS.items():
        try:
            bars[key] = fetch_bars(tk, interval, period, sessions)
        except Exception as e:
            print(f"     {sym}: no {key} bars ({e})", file=sys.stderr)
    out["_bars"] = bars
    return out


# ---------------------------------------------------------------- S&P 500 heat map
HEATMAP_OUT = ROOT / "data" / "heatmap.json"
SECTORS_FALLBACK = ROOT / "data" / "sp500-sectors.json"
SPY_HOLDINGS_URL = ("https://www.ssga.com/us/en/intermediary/library-content/products/"
                    "fund-data/etfs/us/holdings-daily-us-en-spy.xlsx")
WIKI_SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
UA = {"User-Agent": "site-data-job/1.0 (GitHub Actions)"}


def _get(url: str) -> bytes:
    import urllib.request
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def spy_weights() -> tuple[list, str]:
    """S&P 500 members and index weights from State Street's daily SPY holdings (.xlsx),
    parsed with the standard library. Returns ([(ticker, name, weight%)], as-of text)."""
    import io, re, zipfile
    import xml.etree.ElementTree as ET
    z = zipfile.ZipFile(io.BytesIO(_get(SPY_HOLDINGS_URL)))
    m = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        shared = ["".join(t.text or "" for t in si.iter(m + "t"))
                  for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(m + "si")]
    rows = []
    for r in ET.fromstring(z.read("xl/worksheets/sheet1.xml")).iter(m + "row"):
        vals = []
        for c in r.findall(m + "c"):
            v = c.find(m + "v")
            s = v.text if v is not None else ""
            if c.get("t") == "s" and s:
                s = shared[int(s)]
            elif c.get("t") == "inlineStr":
                s = "".join(x.text or "" for x in c.iter(m + "t"))
            vals.append(s or "")
        rows.append(vals)
    as_of = next((r[1] for r in rows[:6] if r and r[0].startswith("Holdings") and len(r) > 1), "")
    hdr = next(i for i, r in enumerate(rows) if "Ticker" in r and "Weight" in r)
    H = rows[hdr]
    ti, ni, wi = H.index("Ticker"), H.index("Name"), H.index("Weight")
    out = []
    for r in rows[hdr + 1:]:
        if len(r) <= wi or not re.match(r"^[A-Z]{1,5}([.\-][A-Z])?$", r[ti] or "") or not re.match(r"^[0-9.]+$", r[wi] or ""):
            continue
        out.append((r[ti].replace(".", "-"), r[ni], float(r[wi])))
    return out, as_of.replace("As of", "").strip()


def sp500_sectors() -> dict:
    """{ticker: {"n": name, "sec": GICS sector}} from Wikipedia; falls back to the saved copy."""
    from html.parser import HTMLParser

    class Table(HTMLParser):
        def __init__(self):
            super().__init__()
            self.on, self.depth, self.rows, self.row, self.cell = False, 0, [], None, None
        def handle_starttag(self, t, a):
            if t == "table" and dict(a).get("id") == "constituents":
                self.on, self.depth = True, 0
            if not self.on:
                return
            if t == "table": self.depth += 1
            if t == "tr": self.row = []
            if t in ("td", "th") and self.row is not None: self.cell = ""
        def handle_endtag(self, t):
            if not self.on:
                return
            if t in ("td", "th") and self.cell is not None:
                self.row.append(self.cell.strip()); self.cell = None
            if t == "tr" and self.row is not None:
                self.rows.append(self.row); self.row = None
            if t == "table":
                self.depth -= 1
                if self.depth == 0: self.on = False
        def handle_data(self, d):
            if self.cell is not None: self.cell += d

    try:
        p = Table()
        p.feed(_get(WIKI_SP500_URL).decode("utf-8"))
        h = p.rows[0]
        si, ni, gi = h.index("Symbol"), h.index("Security"), h.index("GICS Sector")
        m = {r[si].replace(".", "-"): {"n": r[ni], "sec": r[gi]} for r in p.rows[1:] if len(r) > gi}
        if len(m) > 400:
            return m
    except Exception as e:
        print(f"heatmap: Wikipedia sectors unavailable ({e}); using saved copy", file=sys.stderr)
    return json.loads(SECTORS_FALLBACK.read_text(encoding="utf-8"))["map"]


def build_heatmap(now: dt.datetime) -> None:
    holdings, weights_as_of = spy_weights()
    sectors = sp500_sectors()
    syms = [h[0] for h in holdings]
    df = yf.download(syms, period="5d", interval="1d", auto_adjust=False, progress=False, threads=True)
    close = df["Close"]
    stocks, as_of = [], None
    for sym, ssga_name, w in holdings:
        if sym not in close.columns:
            continue
        col = close[sym].dropna()
        if len(col) < 2:
            continue
        p, prev = float(col.iloc[-1]), float(col.iloc[-2])
        if not (p > 0 and prev > 0):
            continue
        as_of = max(as_of or col.index[-1], col.index[-1])
        info = sectors.get(sym) or {}
        stocks.append({
            "s": sym,
            "n": info.get("n") or ssga_name.title(),
            "sec": info.get("sec") or "Other",
            "w": round(w, 4),
            "p": round(p, 2),
            "c": round(p - prev, 2),
            "cp": round((p / prev - 1) * 100, 2),
        })
    if len(stocks) < 300:
        raise RuntimeError(f"only {len(stocks)} prices came back")
    HEATMAP_OUT.write_text(json.dumps({
        "generatedAt": now.isoformat(timespec="seconds"),
        "asOf": str(as_of.date()) if hasattr(as_of, "date") else str(as_of),
        "weightsAsOf": weights_as_of,
        "source": "Weights: State Street SPY daily holdings. Sectors: Wikipedia (GICS). Prices: Yahoo Finance.",
        "stocks": stocks,
    }, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"heatmap: {len(stocks)} stocks, prices as of {as_of}")


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

    # candle files: data/bars/<SYMBOL>.json, fetched by the page only for the charted symbol
    BARS_DIR.mkdir(parents=True, exist_ok=True)
    for r in results:
        bars = r.pop("_bars", None)
        if bars and any(bars.values()):
            (BARS_DIR / f"{r['symbol']}.json").write_text(
                json.dumps({"symbol": r["symbol"], "generatedAt": now.isoformat(timespec="seconds"), "bars": bars},
                           separators=(",", ":")), encoding="utf-8")

    payload = {
        "generatedAt": now.isoformat(timespec="seconds"),
        "session": sess.isoformat(),
        "sample": False,
        "source": "Yahoo Finance options chains (via yfinance)",
        "method": "price × straddle-implied IV × √time (daily: 1/252 yr; weekly/monthly: time to expiry)",
        "tickers": results,
    }
    # compact: the page downloads this every few minutes, and the candles make it large
    text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    OUT_JSON.write_text(text + "\n", encoding="utf-8")
    OUT_JS.write_text("window.EXPECTED_MOVES = " + text + ";\n", encoding="utf-8")
    print(f"Wrote {len(results) - failed}/{len(items)} tickers for session {sess}")

    # S&P 500 heat map: separate, so a problem here never blocks the expected moves
    try:
        build_heatmap(now)
    except Exception as e:
        print(f"heatmap: skipped ({e})", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
