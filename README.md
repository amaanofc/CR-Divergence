# Clash Markets

A Bloomberg Terminal-style quantitative analytics platform for Clash Royale, built for Quantihack '26.

Applies real quant-finance methodologies — Markowitz optimisation, UCB multi-armed bandits, Kaplan-Meier survival analysis, and six invented statistics — to live Clash Royale card data.

## Setup

### 1. Clone & configure environment

```bash
git clone https://github.com/amaanofc/CR-Divergence.git
cd CR-Divergence
cp .env.example .env
# Edit .env and fill in your CR_API_TOKEN and ANTHROPIC_API_KEY
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt

# Optional: re-scrape fresh card stats from RoyaleAPI
python -m data.scraper

# Start API server
uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
```

### 4. Run tests

```bash
cd backend
pytest
```

## Architecture

```
backend/
├── engine/
│   ├── metrics.py      # Six statistics: MPS, ESR, MM, Deck Beta, ADR, Clash Alpha
│   ├── optimizer.py    # Markowitz efficient frontier (2000-sample Monte Carlo)
│   ├── ucb.py          # UCB multi-armed bandit recommendations
│   ├── survival.py     # Kaplan-Meier alpha decay analysis
│   └── backtest.py     # Three strategy backtests
├── data/
│   ├── scraper.py      # RoyaleAPI scraper
│   ├── cr_api.py       # Official Clash Royale API client
│   └── *.csv / *.json  # Card data
├── copilot/
│   └── analyst.py      # Claude AI analyst (Anthropic API)
└── main.py             # FastAPI server — 9 endpoints

frontend/src/
├── components/         # 10 React components
├── hooks/useApi.js     # Generic data-fetching hook
└── context/            # MetricContext for hover highlighting
```

## Statistics

| Stat | Finance Analogue | Formula |
|------|-----------------|---------|
| MPS | Alpha | OLS residual of win_rate ~ usage_rate, z-scored |
| ESR | Sharpe Ratio | (win_rate − 0.5) / vol × 1/elixir |
| MM | Smart money flow | (usage_GC − usage_Ladder) / usage_Ladder |
| Deck Beta | Market beta | Rarity heuristic (Legendary 1.2 → Common 0.75) |
| ADR | Alpha half-life | Kaplan-Meier post-buff decay |
| CA | Risk-adj return | mean(MPS_z × 0.125) − beta × penalty |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cards?market=` | Card screener data |
| GET | `/api/cards/{name}/history` | 180-day win-rate history |
| GET | `/api/frontier?budget=` | Efficient frontier points |
| GET | `/api/optimize?budget=` | Max-Sharpe deck |
| GET | `/api/ucb?player_tag=` | Personalised UCB recommendations |
| GET | `/api/survival` | Kaplan-Meier curves |
| GET | `/api/backtest` | Strategy equity curves |
| GET | `/api/cross-market` | Cross-market MPS analysis |
| POST | `/api/analyst` | AI research report |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CR_API_TOKEN` | Clash Royale official API token |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key (for AI analyst) |
