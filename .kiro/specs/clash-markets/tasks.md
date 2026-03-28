# Tasks — Clash Markets

## Phase 1: Project Scaffolding

- [x] 1.1 Create root directory structure: `backend/`, `backend/engine/`, `backend/data/`, `backend/copilot/`, `frontend/`
- [x] 1.2 Create `backend/__init__.py`, `backend/engine/__init__.py`, `backend/copilot/__init__.py`
- [x] 1.3 Create `backend/requirements.txt` with pinned versions: `fastapi`, `uvicorn`, `numpy`, `scipy`, `pandas`, `scikit-learn`, `lifelines`, `anthropic`, `requests`, `beautifulsoup4`, `python-dotenv`, `httpx`, `pytest`, `hypothesis`
- [x] 1.4 Create `.env.example` with placeholder values for `CR_API_TOKEN` and `ANTHROPIC_API_KEY`
- [x] 1.5 Create `.gitignore` including `.env`, `__pycache__/`, `*.pyc`, `venv/`, `node_modules/`, `dist/`
- [x] 1.6 Scaffold `frontend/` with `npm create vite@latest . -- --template react` (or equivalent `package.json`)
- [x] 1.7 Install frontend dependencies: `tailwindcss`, `postcss`, `autoprefixer`, `recharts`, `axios`
- [x] 1.8 Configure Tailwind CSS: create `tailwind.config.js` with content paths and extend theme with Bloomberg colours (`#0a0e1a` background, `#ff6b00` accent, monospace font)
- [x] 1.9 Create `frontend/src/index.css` importing Tailwind base/components/utilities
- [x] 1.10 Create `frontend/vite.config.js` with proxy config forwarding `/api` to `http://localhost:8000`

## Phase 2: Static Data Files

- [x] 2.1 Download `https://royaleapi.github.io/cr-api-data/json/cards.json` and save as `backend/data/cards_meta.json`
- [x] 2.2 Create `backend/data/patch_history.csv` with at least 20 rows of real balance changes (columns: `date`, `card_name`, `change_type`, `stat_changed`, `magnitude`)
- [x] 2.3 Create placeholder `backend/data/cards_ladder.csv`, `backend/data/cards_gc.csv`, `backend/data/cards_top200.csv` with correct headers (`card_name,win_rate,usage_rate`) — to be overwritten by scraper

## Phase 3: Data Ingestion — Scraper

- [x] 3.1 Create `backend/data/scraper.py` with function `scrape_market(cat: str) -> pd.DataFrame`
- [x] 3.2 Implement URL construction: `f"https://royaleapi.com/cards/popular?cat={cat}"` with `User-Agent` header
- [x] 3.3 Implement HTTP request with 10-second timeout; raise descriptive exception on non-200 status
- [x] 3.4 Implement BeautifulSoup HTML parsing to extract card rows with `card_name`, `win_rate`, `usage_rate`
- [x] 3.5 Implement percentage-to-decimal conversion: divide by 100 for win_rate and usage_rate
- [x] 3.6 Implement CSV save: write DataFrame to `backend/data/cards_{cat.lower()}.csv`, overwriting if exists
- [x] 3.7 Add `if __name__ == "__main__"` block to run scraper for all five markets: `Ladder`, `GC`, `TopRanked200`, `TopRanked`, `Ranked`

## Phase 4: Data Ingestion — CR API Client

- [x] 4.1 Create `backend/data/cr_api.py` with CR API base URL constant `https://api.clashroyale.com/v1`
- [x] 4.2 Implement client initialisation: read `CR_API_TOKEN` from environment via `python-dotenv`; raise `RuntimeError("CR_API_TOKEN not set in environment")` if absent
- [x] 4.3 Implement `fetch_cards_metadata() -> list[dict]`: GET `/v1/cards`, return list of `{id, name, elixir, rarity, type}` objects
- [x] 4.4 Implement `fetch_player_battlelog(player_tag: str) -> list[dict]`: URL-encode tag (replace `#` with `%23`), GET `/v1/players/{encoded_tag}/battlelog`, return up to 25 battle objects
- [x] 4.5 Handle 404 response in `fetch_player_battlelog`: return `[]` and log warning
- [x] 4.6 Add Bearer token header to all requests: `{"Authorization": f"Bearer {token}"}`

## Phase 5: Metrics Engine

- [x] 5.1 Create `backend/engine/metrics.py` with `compute_all_metrics() -> pd.DataFrame`
- [x] 5.2 Implement CSV loading: read `cards_ladder.csv`, `cards_gc.csv`, `cards_top200.csv`; add `market` column to each
- [x] 5.3 Implement `cards_meta.json` loading and merge on `card_name`; assign `elixir = 4.0` and log warning for unmatched cards
- [x] 5.4 Implement MPS computation: fit `LinearRegression(win_rate ~ usage_rate)` per market group; compute residuals; set `mps_z = 0.0` and log warning if market has < 3 cards
- [x] 5.5 Implement MPS z-score normalisation: `mps_z = (mps - mean) / std` within each market group
- [x] 5.6 Implement ESR computation: compute `win_rate_vol` as std of `win_rate` across markets per card; clip to minimum 0.01; compute `esr = ((win_rate - 0.50) / win_rate_vol) * (1 / elixir)`; treat `elixir = 0` as `elixir = 1` with warning
- [x] 5.7 Implement Meta Momentum: merge ladder and GC usage rates; compute `meta_momentum = (usage_gc - usage_ladder) / (usage_ladder + 0.001)`; fill missing with 0.0
- [x] 5.8 Implement Deck Beta: map rarity to beta values (`legendary→1.2`, `epic→1.0`, `rare→0.85`, `common→0.75`); default 0.9 for unrecognised
- [x] 5.9 Implement per-card `clash_alpha` signal: `mps_z - (deck_beta * 0.5)`
- [x] 5.10 Implement `build_card_history(card_name: str, df: pd.DataFrame) -> dict`: load `patch_history.csv`, filter for card, synthesise 180-day win-rate time series walking backwards from current win rate using patch magnitudes; return `{card_name, time_series, patch_events}`
- [x] 5.11 Implement `compute_deck_ca(cards: list[dict], df: pd.DataFrame, patch_history=None) -> float`: validate exactly 8 cards (raise `ValueError("Deck must contain exactly 8 cards")` otherwise); compute `CA = mean(mps_z_i * 0.125) + synergy_bonus - meta_risk_penalty`; compute `meta_volatility` from last 3 patch events or default 0.05; default `synergy_bonus = 0.0`

## Phase 6: Optimizer Engine

- [x] 6.1 Create `backend/engine/optimizer.py` with `compute_frontier(df: pd.DataFrame, elixir_budget: float = 3.5) -> dict`
- [x] 6.2 Filter to Ladder market; extract `{card_name, win_rate, elixir, mps_z, deck_beta}` records
- [x] 6.3 Implement random sampling loop: sample 2000 valid 8-card combinations; for each attempt, check `avg_elixir <= elixir_budget`; retry up to 50 times per sample
- [x] 6.4 If fewer than 8 eligible cards within budget, relax constraint and log warning
- [x] 6.5 Compute per-deck metrics: `deck_return = mean(win_rate)`, `deck_vol = std(win_rate) + 0.01`, `deck_sharpe = (deck_return - 0.50) / deck_vol`, `deck_ca = mean(mps_z) - mean(deck_beta) * 0.3`
- [x] 6.6 Build and return `{frontier_points: [...], max_sharpe_deck: {...}, n_decks_sampled: int}` where `max_sharpe_deck` is the point with highest `deck_sharpe`
- [x] 6.7 Implement `compute_optimal_deck(df: pd.DataFrame, elixir_budget: float = 3.5) -> dict`: call `compute_frontier` and return only `max_sharpe_deck`

## Phase 7: UCB Engine

- [x] 7.1 Create `backend/engine/ucb.py` with `compute_ucb_recommendations(battle_log: list, df: pd.DataFrame, c: float = 1.4) -> dict`
- [x] 7.2 Parse battle log: extract player's 8 cards and win/loss outcome from each battle using CR API battle log format (`battle["team"][0]["cards"]`, crown comparison)
- [x] 7.3 Compute `personal_wins` and `personal_games` dicts per card name
- [x] 7.4 Compute `personal_win_rate = wins / games` (default 0.50 if `n_i = 0`)
- [x] 7.5 Compute `alpha = min(1.0, n_i / 30)` per card
- [x] 7.6 Compute UCB score: `alpha * personal_wr + (1 - alpha) * global_wr + c * sqrt(ln(T) / n_i)` for `n_i > 0`; use `c * sqrt(ln(T + 1))` for `n_i = 0`
- [x] 7.7 Assign action labels: `EXPLOIT` if `n_i >= 30` and `personal_wr > global_wr`; `EXPLORE` if `n_i < 10`; `AVOID` if `personal_wr < global_wr - 0.05`; else `HOLD`
- [x] 7.8 Return top 8 cards by `ucb_score` as `recommended_deck`; include full `scored_cards` list with all per-card data
- [x] 7.9 Handle empty battle log: fall back to top 8 cards by global `mps_z` from Ladder market

## Phase 8: Survival Engine

- [ ] 8.1 Create `backend/engine/survival.py` with `compute_survival_curves() -> dict`
- [~] 8.2 Load `patch_history.csv`; parse `date` column as datetime; filter for `change_type == "buff"`
- [~] 8.3 Return warning object if fewer than 5 buff events: `{"warning": "Insufficient buff events for survival analysis"}`
- [~] 8.4 Log warning if `patch_history.csv` has fewer than 15 rows total
- [~] 8.5 Define survival event: win rate drops below 50% of peak excess above 0.50; compute durations and event indicators per buff
- [~] 8.6 Fit Kaplan-Meier estimator using `lifelines.KaplanMeierFitter`; extract survival function as `[{time, survival_probability}]`
- [~] 8.7 Fit separate KM curves grouped by `rarity`; return as `km_curves: [{rarity, curve: [...]}]`
- [~] 8.8 Fit Cox Proportional Hazards model using `lifelines.CoxPHFitter` with covariates `rarity`, `elixir`, `card_type`; extract coefficients and p-values
- [~] 8.9 Return `{km_curves, cox_results: {coefficients, p_values}, warning: None}`

## Phase 9: Backtest Engine

- [~] 9.1 Create `backend/engine/backtest.py` with `run_all_strategies(df: pd.DataFrame) -> dict`
- [~] 9.2 Load `patch_history.csv`; return warning if fewer than 5 patch events
- [~] 9.3 Implement Patch Momentum strategy: after each patch event, select 3 cards with largest positive `magnitude`; fill remaining 5 slots with highest-MPS cards; compute cumulative win rate for 14 days post-patch
- [~] 9.4 Implement UCB-Optimal strategy: simulate UCB convergence over seasons; start with `alpha = 0` in season 1; increase alpha as simulated sample size grows; track deck win rate per season
- [~] 9.5 Implement Contrarian Mean Reversion strategy: identify nerfed cards with positive win-rate delta after trough; select top 8 by recovery magnitude; track win rate
- [~] 9.6 Compute per-strategy metrics: equity curve as `[{date, cumulative_win_rate}]`, Sharpe ratio, max drawdown, total excess win rate, CA trajectory
- [~] 9.7 Compute benchmark equity curve: average meta deck win rate across same time period
- [~] 9.8 Return `{strategies: {patch_momentum, ucb_optimal, contrarian}, benchmark, warning}`

## Phase 10: Analyst Module

- [~] 10.1 Create `backend/copilot/analyst.py` with `async generate_analyst_report(query: str, context: dict, df: pd.DataFrame) -> dict`
- [~] 10.2 Read `ANTHROPIC_API_KEY` from environment; return fallback `{"report": "Analyst unavailable. Check ANTHROPIC_API_KEY configuration."}` if absent
- [~] 10.3 Build system prompt: instruct Claude to act as quantitative Clash Royale analyst; include top 10 cards by `mps_z` from current DataFrame as context
- [~] 10.4 Call Anthropic Messages API with model `claude-3-5-sonnet-20241022`, system prompt, and user query
- [~] 10.5 Return `{"report": response_text}` on success; return fallback message on API failure
- [~] 10.6 Ensure no API keys or PII appear in the returned report

## Phase 11: FastAPI Backend

- [~] 11.1 Create `backend/main.py` with FastAPI app instance and title `"Clash Markets API"`
- [~] 11.2 Configure CORS middleware: allow origins `["http://localhost:5173"]`, all methods, all headers
- [~] 11.3 Implement `startup` event handler: call `compute_all_metrics()` and store result in `app.state.cards_data`
- [~] 11.4 Implement `GET /api/cards`: accept optional `market` query param; filter cached DataFrame; return `df.to_dict(orient="records")` with values rounded to 4dp
- [~] 11.5 Implement `GET /api/cards/{card_name}/history`: call `build_card_history(card_name, app.state.cards_data)`; return result
- [~] 11.6 Implement `GET /api/frontier`: accept `budget: float = 3.5`; call `compute_frontier(app.state.cards_data, budget)`; return result
- [~] 11.7 Implement `GET /api/optimize`: accept `budget: float = 3.5`; call `compute_optimal_deck(app.state.cards_data, budget)`; return result
- [~] 11.8 Implement `GET /api/ucb`: accept `player_tag: str`; fetch battle log via `fetch_player_battlelog`; call `compute_ucb_recommendations`; return result
- [~] 11.9 Implement `GET /api/survival`: call `compute_survival_curves()`; return result
- [~] 11.10 Implement `GET /api/backtest`: call `run_all_strategies(app.state.cards_data)`; return result
- [~] 11.11 Implement `GET /api/cross-market`: group cached DataFrame by market; compute mean and std of `mps_z` per market; return `{ladder, gc, top200}` with per-market card lists
- [~] 11.12 Implement `POST /api/analyst`: accept `AnalystRequest(query: str, context: dict = {})`; call `generate_analyst_report`; return result
- [~] 11.13 Add global exception handler: catch all unhandled exceptions; return HTTP 500 `{"detail": str(e)}`
- [~] 11.14 Add `PORT` environment variable support: bind uvicorn to `int(os.getenv("PORT", 8000))` for Railway deployment

## Phase 12: Environment Configuration

- [~] 12.1 Create `backend/.env` (gitignored) with real `CR_API_TOKEN` and `ANTHROPIC_API_KEY` values
- [~] 12.2 Add `load_dotenv()` call at the top of `backend/main.py` before any module imports that read env vars
- [~] 12.3 Verify `backend/main.py` startup fails with descriptive error if `CR_API_TOKEN` is not set (propagated from `cr_api.py` init)
- [~] 12.4 Confirm `.env` is listed in `.gitignore`

## Phase 13: Frontend — App Shell

- [~] 13.1 Create `frontend/src/App.jsx` with three-panel layout: left `CardTicker` (w-64), centre tabbed panel (flex-1), right `AnalogyExplainer` (w-72)
- [~] 13.2 Apply global Bloomberg Terminal styles in `App.jsx`: background `#0a0e1a`, text `#e0e0e0`, accent `#ff6b00`, font `font-mono`
- [~] 13.3 Create `frontend/src/components/TopBar.jsx`: fetch `/api/cards?market=ladder` on mount; render horizontally scrolling ticker with card name, `mps_z`, and `esr` values; animate with CSS marquee or `overflow-x: scroll`
- [~] 13.4 Create `frontend/src/hooks/useApi.js`: generic hook wrapping `axios` calls with `loading`, `data`, `error` state; show loading spinner after 300ms

## Phase 14: Frontend — CardTicker Component

- [~] 14.1 Create `frontend/src/components/CardTicker.jsx`
- [~] 14.2 Fetch `/api/cards?market={selectedMarket}` on mount and on market change
- [~] 14.3 Render table with columns: Card Name, Win Rate, Usage Rate, MPS z-score, ESR, Meta Momentum, Clash Alpha
- [~] 14.4 Implement column header click sorting: toggle ascending/descending; default descending on first click
- [~] 14.5 Colour-code `mps_z` cells: green (`text-green-400`) for `> 1`, red (`text-red-400`) for `< -1`, neutral otherwise
- [~] 14.6 Render market selector dropdown: `Ladder` / `GC` / `Top 200`; re-fetch on change
- [~] 14.7 Emit selected card name to parent via `onCardSelect` prop when a row is clicked

## Phase 15: Frontend — PatchTimeline Component

- [~] 15.1 Create `frontend/src/components/PatchTimeline.jsx`
- [~] 15.2 Accept `selectedCard` prop; fetch `/api/cards/{selectedCard}/history` when prop changes
- [~] 15.3 Render Recharts `LineChart` with `win_rate` over time; x-axis as dates, y-axis as win rate
- [~] 15.4 Add `ReferenceLine` for each patch event: green for `buff`, red for `nerf`; label with change type and magnitude
- [~] 15.5 Display placeholder `"Select a card to view its history"` when `selectedCard` is null

## Phase 16: Frontend — PortfolioMaker Component

- [~] 16.1 Create `frontend/src/components/PortfolioMaker.jsx`
- [~] 16.2 Fetch all cards from `/api/cards?market=ladder` on mount; render card selection grid
- [~] 16.3 Maintain `selectedCards` state (array of up to 8 card objects)
- [~] 16.4 On card add/remove, recompute locally: expected win rate (`mean(win_rate)`), deck volatility (`std(win_rate) + 0.01`), ESR, Meta Beta (`mean(deck_beta)`), Clash Alpha (call backend or compute locally using `mps_z` values)
- [~] 16.5 Prevent adding a 9th card: show error message `"Deck is full (8 cards maximum)"`
- [~] 16.6 Display Clash Alpha in large format when exactly 8 cards selected: green for `CA > 0`, red for `CA ≤ 0`
- [~] 16.7 Render current deck position as a highlighted dot on the `EfficientFrontier` scatter plot (pass deck point as prop)

## Phase 17: Frontend — EfficientFrontier Component

- [~] 17.1 Create `frontend/src/components/EfficientFrontier.jsx`
- [~] 17.2 Fetch `/api/frontier?budget={budget}` on mount and on budget change
- [~] 17.3 Render Recharts `ScatterChart` with `risk` on x-axis and `return` on y-axis; each point is a sampled deck
- [~] 17.4 Highlight `max_sharpe_deck` with a distinct marker (star or larger dot) and label `"Max Sharpe"`
- [~] 17.5 Render elixir budget slider: range 3.0–4.5, step 0.1; trigger new API fetch on change
- [~] 17.6 Implement hover tooltip showing deck's 8 card names, Sharpe ratio, and Clash Alpha
- [~] 17.7 Accept optional `userDeckPoint` prop to render the user's current deck as a distinct dot

## Phase 18: Frontend — AlphaDecay Component

- [~] 18.1 Create `frontend/src/components/AlphaDecay.jsx`
- [~] 18.2 Fetch `/api/survival` on mount
- [~] 18.3 If API returns `warning`, display warning text instead of chart
- [~] 18.4 Render Recharts `LineChart` with overlapping KM survival curves, one per rarity; x-axis `"Days Since Buff"`, y-axis `"Probability of Retaining Edge"`
- [~] 18.5 Render summary table below chart: Cox model coefficients and p-values for `rarity`, `elixir`, `card_type`

## Phase 19: Frontend — CrossMarket Component

- [~] 19.1 Create `frontend/src/components/CrossMarket.jsx`
- [~] 19.2 Fetch `/api/cross-market` on mount
- [~] 19.3 Render Recharts `BarChart` (grouped) comparing `mps_z` distributions across Ladder, GC, Top 200
- [~] 19.4 Display chart legend with mean MPS and std for each market
- [~] 19.5 Render table of cards where `mps_z` differs by more than 1.5 between any two markets; highlight these rows

## Phase 20: Frontend — BacktestReport Component

- [~] 20.1 Create `frontend/src/components/BacktestReport.jsx`
- [~] 20.2 Fetch `/api/backtest` on mount
- [~] 20.3 If API returns `warning`, display it prominently above the chart
- [~] 20.4 Render Recharts `LineChart` with equity curves for all three strategies and benchmark; distinct colours per strategy; include legend
- [~] 20.5 Render stats panel below chart: table with columns Strategy, Sharpe Ratio, Max Drawdown, Total Excess Win Rate, Final CA

## Phase 21: Frontend — AnalystChat Component

- [~] 21.1 Create `frontend/src/components/AnalystChat.jsx`
- [~] 21.2 Render chat interface: scrollable message history, text input, submit button
- [~] 21.3 On submit, POST to `/api/analyst` with `{query: inputText}`; show loading indicator while awaiting response
- [~] 21.4 Render response in styled message bubble; render fallback/error in distinct red-bordered error style
- [~] 21.5 Maintain session history of all queries and responses in component state; auto-scroll to latest message

## Phase 22: Frontend — AnalogyExplainer Component

- [~] 22.1 Create `frontend/src/components/AnalogyExplainer.jsx`
- [~] 22.2 Define static mapping of finance terms to Clash Royale analogies for: MPS, ESR, MM, Deck Beta, ADR, CA, Efficient Frontier, Markowitz Optimisation, UCB, Kaplan-Meier, Alpha Decay
- [~] 22.3 Render scrollable list of term-analogy pairs with Bloomberg Terminal styling
- [~] 22.4 Implement global event system (React context or custom event): when a metric name is hovered/clicked anywhere in the app, emit the metric name
- [~] 22.5 Subscribe to metric hover events in `AnalogyExplainer`; scroll to and highlight the corresponding entry

## Phase 23: Frontend — Centre Panel Tabs

- [~] 23.1 Create `frontend/src/components/CentrePanel.jsx` with tab navigation: Patch Timeline, Portfolio, Frontier, Survival, Cross-Market, Backtest, Analyst
- [~] 23.2 Render active tab content; pass `selectedCard` from `CardTicker` to `PatchTimeline`
- [~] 23.3 Style tab bar with Bloomberg Terminal aesthetic: active tab highlighted in orange accent

## Phase 24: Property-Based Tests

- [~] 24.1 Create `backend/tests/test_properties.py` with Hypothesis imports and strategy definitions
- [~] 24.2 Implement Property 1 test: MPS z-score mean invariant — generate random market DataFrames with 3+ cards, verify `mean(mps_z) ≈ 0`
- [~] 24.3 Implement Property 2 test: win_rate and usage_rate in [0,1] — generate mock card data, verify range
- [~] 24.4 Implement Property 3 test: ESR formula correctness — generate cards with positive elixir and vol, verify formula
- [~] 24.5 Implement Property 4 test: win_rate_vol minimum clamp — generate DataFrames, verify `win_rate_vol >= 0.01` after compute
- [~] 24.6 Implement Property 5 test: Meta Momentum formula — generate ladder/GC pairs, verify formula and missing-data default
- [~] 24.7 Implement Property 6 test: Deck Beta mapping — generate rarity strings, verify mapping or default 0.9
- [~] 24.8 Implement Property 7 test: KM survival monotone — generate survival data, verify non-increasing probabilities
- [~] 24.9 Implement Property 8 test: CA ValueError for non-8-card decks — generate deck sizes != 8, verify ValueError
- [~] 24.10 Implement Property 9 test: Frontier deck validity — generate budgets, verify 8 cards and elixir constraint
- [~] 24.11 Implement Property 10 test: Max-Sharpe is global maximum — verify `max_sharpe_deck.sharpe >= all others`
- [~] 24.12 Implement Property 11 test: UCB alpha clamped to [0,1] — generate n_i values, verify alpha range
- [~] 24.13 Implement Property 12 test: UCB action label rules — generate card data, verify label assignment logic
- [~] 24.14 Implement Property 13 test: JSON round-trip precision — generate card metric records, verify 0.0001 tolerance
- [~] 24.15 Implement Property 14 test: Backtest equity curve structure — verify non-empty list with date and cumulative_win_rate fields

## Phase 25: Unit Tests

- [~] 25.1 Create `backend/tests/test_metrics.py`: test `compute_all_metrics()` returns DataFrame with all required columns; test MPS z-score edge case (< 3 cards sets mps_z = 0); test elixir = 0 handled in ESR
- [~] 25.2 Create `backend/tests/test_optimizer.py`: test `compute_frontier` returns at least 1 point; test `max_sharpe_deck` has exactly 8 cards; test budget relaxation warning
- [~] 25.3 Create `backend/tests/test_ucb.py`: test empty battle log returns top 8 by mps_z; test action label assignment with known inputs; test alpha = 1.0 when n_i >= 30
- [~] 25.4 Create `backend/tests/test_survival.py`: test warning returned when < 5 buff events; test KM curve has at least one point
- [~] 25.5 Create `backend/tests/test_backtest.py`: test warning returned when < 5 patch events; test all three strategies present in result
- [~] 25.6 Create `backend/tests/test_api.py`: use FastAPI `TestClient`; test all 9 endpoints return 200 with valid JSON; test `/api/cards?market=ladder` filters correctly; test `/api/analyst` POST returns `report` field
- [~] 25.7 Create `backend/tests/test_cr_api.py`: test missing `CR_API_TOKEN` raises RuntimeError; test player tag `#2PP` is encoded as `%232PP`

## Phase 26: Deployment Setup

- [~] 26.1 Create `backend/Procfile` or `railway.toml` for Railway deployment: `web: uvicorn main:app --host 0.0.0.0 --port $PORT`
- [~] 26.2 Create `frontend/vercel.json` with rewrite rule: `{"rewrites": [{"source": "/api/(.*)", "destination": "https://<backend-url>/api/$1"}]}`
- [~] 26.3 Update CORS in `backend/main.py` to include the deployed Vercel frontend URL
- [~] 26.4 Create root `README.md` with setup instructions: clone, create `.env`, install deps, run scraper, start backend, start frontend
