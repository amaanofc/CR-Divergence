# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Clash Markets** — a Bloomberg Terminal-style quantitative analytics platform for Clash Royale, built for Quantihack '26. Applies real quant-finance methodologies (Markowitz optimization, Kaplan-Meier survival analysis, UCB multi-armed bandits) to card game data. Cards are assets, decks are portfolios, balance patches are earnings events.

## Development Commands

### Backend (Python 3.11+)
```bash
cd backend/
pip install -r requirements.txt
uvicorn main:app --reload --port 9001        # Start API server
python -m data.generate_full_data            # Regenerate 120-card datasets
python -m data.scraper                       # Re-scrape from RoyaleAPI (optional)
pytest                                       # Run all tests (78/79 pass)
pytest tests/test_api.py                     # Run API endpoint tests
pytest tests/test_metrics.py::test_name      # Run a single test
```

### Frontend
```bash
cd frontend/
npm install
npm run dev       # Vite dev server (proxies /api -> backend)
npm run build     # Production bundle
npm run lint      # ESLint check
npm run preview   # Preview production build locally
```

### Environment
Copy `.env.example` to `.env` and fill in:
- `CR_API_TOKEN` — Official Clash Royale API key
- `ANTHROPIC_API_KEY` — Claude API key (for AI analyst)

## Architecture

### Data Flow
```
CSV files (120 cards x 3 markets) + patch_history.csv + cards_meta.json
  -> loaded at startup into app.state.cards_data (pandas DataFrame)
  -> engine/ modules compute statistics on demand
  -> FastAPI (main.py) exposes 12 REST endpoints
  -> React frontend (5-page SPA with React Router) consumes via /api proxy
```

No database — all data lives in `backend/data/` files, loaded once at startup.

### Backend Modules

**`backend/data/`** — Data layer
- `generate_full_data.py` — Generates all 120-card CSVs and expanded patch history (seeded RNG)
- `scraper.py` — BeautifulSoup scraper for RoyaleAPI.com
- `cr_api.py` — Official Clash Royale API client
- CSVs: `cards_ladder.csv`, `cards_gc.csv`, `cards_top200.csv` — `card_name,win_rate,usage_rate`
- `cards_meta.json` — 120 cards with elixir cost, rarity, type
- `patch_history.csv` — ~363 balance change events (2023-2026)

**`backend/engine/`** — Computation layer
- `metrics.py` — Six statistics + `build_card_history()` (daily noise + sigmoid patch transitions) + `compute_deck_ca()`
- `optimizer.py` — Markowitz efficient frontier via 2000-sample Monte Carlo
- `ucb.py` — Multi-armed bandit card recommendations (EXPLOIT/EXPLORE/AVOID/HOLD)
- `survival.py` — Kaplan-Meier + Cox hazards for post-buff alpha decay
- `backtest.py` — Three strategy equity curves (Patch Momentum, UCB-Optimal, Contrarian)

**`backend/copilot/analyst.py`** — Claude API integration for AI research reports

**`backend/main.py`** — FastAPI server with 12 endpoints (original 9 + market-summary, profile, rebalance)

### REST API

```
GET  /api/cards?market={ladder|gc|top200|all}     Card screener (120 cards)
GET  /api/cards/{card_name}/history               180-day win-rate time series
GET  /api/frontier?budget={2.5-5.0}               Efficient frontier points
GET  /api/optimize?budget={2.5-5.0}               Max-Sharpe deck
GET  /api/ucb?player_tag={#XXXX}                  UCB recommendations
GET  /api/survival                                Kaplan-Meier curves
GET  /api/backtest                                Strategy equity curves
GET  /api/cross-market                            Cross-market MPS analysis
GET  /api/market-summary                          Landing page summary stats
GET  /api/profile/{player_tag}                    Player profile + deck analysis
GET  /api/rebalance/{player_tag}                  Deck rebalance suggestions
POST /api/analyst  { query, context }             AI research report
```

### Frontend (5-page SPA)

- React 18 + Vite 5 + Tailwind CSS + Recharts + React Router v6
- **Pages:** Landing (/) -> Connect (/connect) -> Profile (/profile) -> Build Deck (/build) -> Portfolio (/portfolio)
- **Key components:** NavBar, TickerTape, DeckGrid (4x2 CR format), StatCard, CardSearchInput, MetricTooltip
- **Contexts:** MetricContext (hover highlighting), PlayerContext (player tag + profile state)
- Bloomberg aesthetic with Inter font for body, monospace for numbers
- `vite.config.js` proxies `/api` to backend; `vercel.json` handles production rewrites
- `src/hooks/useApi.js` — shared Axios hook used by all pages for data fetching

### Design & Requirements

`.kiro/specs/clash-markets/` contains the original requirements, design doc, and task breakdown that shaped this project.

### Invented Statistics

| Stat | Finance Analogue | Key Idea |
|------|-----------------|----------|
| MPS | Alpha | Win rate vs usage rate regression residual (z-scored) |
| ESR | Sharpe Ratio | Win-rate edge per unit of elixir and volatility |
| MM | Smart Money Flow | GC usage growth relative to Ladder |
| Deck Beta | Market Beta | Rarity-based meta sensitivity |
| ADR | Alpha Half-life | Kaplan-Meier post-buff decay |
| CA | Jensen Alpha | Risk-adjusted overall card quality |
