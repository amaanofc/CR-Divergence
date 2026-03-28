# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Clash Markets** — a Bloomberg Terminal-style quantitative analytics platform for Clash Royale, built for Quantihack '26. It applies real quant-finance methodologies (Markowitz optimization, Kaplan-Meier survival analysis, UCB multi-armed bandits) to card game data. Cards are assets, decks are portfolios, balance patches are earnings events.

## Development Commands

### Backend (Python 3.11+)
```bash
cd backend/
pip install -r requirements.txt
uvicorn main:app --reload --port 8000   # Start API server
python -m backend.data.scraper          # Re-scrape card stats from RoyaleAPI
pytest                                  # Run all tests
pytest tests/test_metrics.py            # Run single test file
```

### Frontend
```bash
cd frontend/
npm install
npm run dev       # Vite dev server on port 5173 (proxies /api → localhost:8000)
npm run build     # Production bundle
npm run lint      # ESLint (zero warnings enforced)
```

### Environment
Copy `.env.example` to `.env` and fill in:
- `CR_API_TOKEN` — Official Clash Royale API key
- `ANTHROPIC_API_KEY` — Claude API key (for `copilot/analyst.py`)

## Architecture

### Data Flow
```
CSV files (cards_*.csv, patch_history.csv) + cards_meta.json
    → loaded at startup into app.state.cards_data (pandas DataFrame, cached in-memory)
    → engine/ modules compute statistics on demand
    → FastAPI (main.py) exposes REST endpoints
    → React frontend consumes via /api proxy
```

No database — all data lives in `backend/data/` files, loaded once at startup.

### Backend Modules

**`backend/data/`** — Data layer
- `scraper.py` — BeautifulSoup scraper for RoyaleAPI.com; produces `cards_ladder.csv`, `cards_gc.csv`, `cards_top200.csv`
- `cr_api.py` — Official Clash Royale API client for player battle logs and card metadata
- CSV files contain `card_name,win_rate,usage_rate` (decimal, not %)
- `cards_meta.json` — 100+ cards with elixir cost, rarity, type
- `patch_history.csv` — 45 balance change events (2023–2025)

**`backend/engine/`** — Computation layer (all pure functions, no I/O)
- `metrics.py` — Six invented statistics (MPS, ESR, MM, Deck Beta, ADR, CA); see below
- `optimizer.py` — Markowitz efficient frontier via random sampling of 2000 valid 8-card decks
- `ucb.py` — Multi-armed bandit card recommendations with cold-start handling
- `survival.py` — Kaplan-Meier estimator for post-buff alpha decay, Cox hazards by rarity
- `backtest.py` *(not yet built)* — Three strategy equity curves

**`backend/copilot/analyst.py`** *(not yet built)* — Claude API integration for natural-language research reports

**`backend/main.py`** *(not yet built)* — FastAPI server; mounts all endpoints, loads data into `app.state`

### Invented Statistics (metrics.py)

| Stat | Finance Analogue | Formula Summary |
|------|-----------------|-----------------|
| **MPS** (Mispricing Score) | Alpha | OLS residual of `win_rate ~ usage_rate` per market |
| **ESR** (Elixir Sharpe Ratio) | Sharpe | `(win_rate - 0.5) / volatility × 1/elixir` |
| **MM** (Meta Momentum) | Smart money flow | `(usage_GC - usage_Ladder) / usage_Ladder` |
| **Deck Beta** | Market beta | Rarity heuristic: Legendary=1.2, Epic=1.0, Rare=0.85, Common=0.75 |
| **ADR** (Alpha Decay Rate) | Alpha half-life | Kaplan-Meier on post-buff win-rate erosion |
| **CA** (Clash Alpha) | Risk-adj return | `mean(MPS_z) - mean(deck_beta) × 0.3` |

All statistics are z-scored to 4 decimal places.

### Planned REST API (9 endpoints)

```
GET  /api/cards?market={ladder|gc|top200}
GET  /api/cards/{card_name}/history
GET  /api/frontier?budget={3.0-4.5}
GET  /api/optimize?budget={3.0-4.5}
GET  /api/ucb?player_tag={#XXXX}
GET  /api/survival
GET  /api/backtest
GET  /api/cross-market
POST /api/analyst   { query, context }
```

### Frontend

- React 18 + Vite 5 + Tailwind CSS + Recharts
- Bloomberg aesthetic: background `#0a0e1a`, accent orange `#ff6b00`, monospace font throughout
- `vite.config.js` proxies `/api` to `http://localhost:8000` — no CORS config needed in dev
- `tailwind.config.js` has Bloomberg colour tokens pre-configured

### Key Specifications

- **`.kiro/specs/clash-markets/`** — Formal specs:
  - `requirements.md` — 29 acceptance criteria
  - `design.md` — Architecture mermaid diagrams and data flow
  - `tasks.md` — 26 phases, 258 implementation checkboxes (tracks completion status)
- **`CLASH_MARKETS_PRD.md`** — Full product requirements (1866 lines); contains math formulas, demo script, Rosetta Stone finance↔Clash analogy mapping, and Q&A prep

## Implementation Status

**Done:** data files, scraper, cr_api client, all 6 metric computations, optimizer, UCB engine, survival analysis, frontend config (Vite/Tailwind scaffolding).

**Not yet built:** `main.py`, `backtest.py`, `analyst.py`, `App.jsx`, all React components, API hooks. See `.kiro/specs/clash-markets/tasks.md` for granular task status.
