# Site Base

A clean, minimal, multi-page starter in plain HTML/CSS/JS. There's no build step: open `index.html` in a browser and it works.
It has one shared header and footer, and **one config file** controls the name, links, colors and fonts on every page.

```
site-base/
├─ index.html            Home: hero, about, projects, contact (LinkedIn + Gmail)
├─ markets.html          Expected moves (daily/weekly) + TradingView chart
├─ launchpad.html        Quick tiles: Claude, Gemini, AI Studio, NotebookLM, Antigravity, Obsidian
├─ assets/
│  ├─ js/config.js       ← EDIT THIS: name, email, LinkedIn, nav, colors, fonts, launchpad tiles
│  ├─ js/site.js         renders the shared header/footer, theme, light/dark toggle
│  ├─ js/markets.js      markets page logic
│  ├─ css/base.css       design system: tokens, header, buttons, cards, footer
│  └─ css/pages.css      page-specific sections
├─ data/
│  ├─ watchlist.json     ← tickers for the Markets page
│  ├─ expected-moves.json  generated (sample data until the first run)
│  └─ expected-moves.js    same data, so the page also works from disk
├─ scripts/fetch_expected_moves.py   computes the expected moves
└─ .github/workflows/expected-moves.yml   runs the script every weekday
```

## 1. Make it yours (2 minutes)

Open `assets/js/config.js` and set `name`, `monogram`, `email`, `linkedin`, and `theme.accent`.
Then edit the text in `index.html` (hero line, quick facts, about, project cards).

## 2. Turn on automatic market data (one-time, free)

1. Create a GitHub repo and upload this folder (or `git init` → `git push`).
2. **Settings → Pages →** Source: *Deploy from a branch*, Branch: `main` / root. Your site goes live at `https://<you>.github.io/<repo>/`.
3. **Settings → Actions → General →** Workflow permissions: *Read and write*.
4. **Actions → Update expected moves → Run workflow** to run it once now.
   After that it runs every 30 minutes during market hours on weekdays.

**Live prices:** the Markets page streams trades from Finnhub (`finnhubKey` in `config.js`) and updates
Price, Chg and **Used** (how much of the expected move has been covered) every few seconds. The ranges
themselves come from the 30-minute job. Set `finnhubKey: ""` to turn this off, or `tickerTape: false`
to hide the scrolling price bar.

When the first run finishes, the yellow "Sample data" notice goes away.

**Change tickers:** edit `data/watchlist.json`. `symbol` is the Yahoo symbol (`BRK-B`) and `tv` is the TradingView symbol (`NYSE:BRK.B`).

**How the move is calculated:** price × implied volatility × √time. The volatility is backed out of the
at-the-money straddle (Yahoo's own IV field goes stale after hours). Daily = one trading day (IV ÷ 16),
weekly = calendar time left until this week's expiry.
That's a one-standard-deviation range, so roughly a 68% chance of finishing inside it. The weekly view also stores
the ATM straddle price. Small caps without weekly options (e.g. PDSB) fall back to the next monthly expiry and are marked **M**.

> Data comes from Yahoo Finance through `yfinance`, an unofficial library. If a run fails, check the Actions log;
> usually upgrading yfinance (it isn't pinned, so the next run picks up fixes) solves it.

## 3. Start a new site from this base

Copy the whole folder, then:
- edit `config.js` (name, nav, colors and fonts change everywhere),
- delete the pages you don't need and remove them from `nav`,
- delete the matching blocks in `pages.css`.

Keep `base.css` + `site.js` unchanged so every site shares the same crisp header.

**New page:** copy `launchpad.html`, keep the `<header id="site-header">` / `<footer id="site-footer">` tags and the
4 `<link>`/`<script>` lines in `<head>`, replace what's inside `<main>`, and add it to `nav` in `config.js`.

## Notes

- **Desktop app tiles** (Antigravity, Obsidian) open through `antigravity://` and `obsidian://` links. The browser
  asks the first time whether to allow it. If the app doesn't open, the tile offers its website instead.
  To open a specific Obsidian vault, use `obsidian://open?vault=YourVaultName`.
- **Light/dark:** follows the system by default. The header toggle remembers your choice per browser.
