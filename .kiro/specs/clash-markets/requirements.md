# Requirements Document

## Introduction

Clash Markets is a Bloomberg Terminal-style analytics platform for Clash Royale. It applies quantitative finance methodology — Markowitz mean-variance optimisation, UCB multi-armed bandits, Kaplan-Meier survival analysis, and six invented statistics — to real Clash Royale card data. The system consists of a FastAPI backend (Python) and a React/Vite frontend with a Bloomberg Terminal aesthetic. Users can explore card metrics, build optimised decks, run backtests, and receive AI-generated analyst reports.

## Glossary

- **System**: The Clash Markets application as a whole (backend + frontend).
- **Backend**: The FastAPI Python server responsible for data ingestion, metric computation, and API endpoints.
- **Frontend**: The React/Vite/Tailwind web application presenting the Bloomberg Terminal UI.
- **Scraper**: The BeautifulSoup-based module (`scraper.py`) that fetches card stats from RoyaleAPI.
- **CR_API_Client**: The module (`cr_api.py`) that communicates with the official Clash Royale REST API.
- **Metrics_Engine**: The module (`metrics.py`) that computes all six invented statistics.
- **Optimizer**: The module (`optimizer.py`) that runs Markowitz mean-variance portfolio optimisation.
- **UCB_Engine**: The module (`ucb.py`) that implements the Upper Confidence Bound multi-armed bandit algorithm.
- **Survival_Engine**: The module (`survival.py`) that runs Kaplan-Meier and Cox proportional hazards analysis.
- **Backtest_Engine**: The module (`backtest.py`) that simulates the three trading strategies against patch history.
- **Analyst**: The module (`analyst.py`) that generates AI research reports via the Anthropic Claude API.
- **Card**: A Clash Royale game card with attributes: name, elixir cost, rarity, type, win rate, usage rate.
- **Deck**: A set of exactly 8 Cards selected for play.
- **Market**: A trophy-range segment of the player population (Ladder, Grand Challenge, Top 200, Ultimate Champion, Ranked).
- **MPS**: Mispricing Score — the z-normalised residual of a linear regression of win_rate on usage_rate.
- **ESR**: Elixir Sharpe Ratio — excess win rate per unit of volatility, scaled by inverse elixir cost.
- **MM**: Meta Momentum — the relative over-indexing of Grand Challenge usage vs Ladder usage.
- **Deck_Beta**: A heuristic measure of how much a deck's performance co-moves with the overall meta.
- **ADR**: Alpha Decay Rate — the Kaplan-Meier-estimated rate at which a post-buff win-rate edge erodes.
- **CA**: Clash Alpha — a composite score combining MPS, centrality, synergy bonus, and meta risk penalty.
- **Efficient_Frontier**: The set of Decks that maximise expected win rate for a given level of volatility.
- **Patch_Event**: A recorded balance change (buff or nerf) from `patch_history.csv`.
- **Player_Tag**: A Clash Royale player identifier (e.g. `#2PP`) used to fetch personal battle logs.
- **Battle_Log**: The last 25 battles for a player, returned by the official Clash Royale API.
- **Tearsheet**: A hedge-fund-style performance summary showing equity curves, Sharpe ratio, max drawdown, and CA trajectory.
- **Ticker**: A horizontally scrolling bar displaying live card metric highlights.
- **Rosetta_Stone_Panel**: The right-side UI panel that translates finance jargon into Clash Royale analogies.

## Requirements

### Requirement 1: Data Ingestion — RoyaleAPI Scraper

**User Story:** As a developer, I want to scrape card statistics from RoyaleAPI across five trophy-range markets, so that the system has real win-rate and usage-rate data to power all metrics.

#### Acceptance Criteria

1. WHEN the Scraper is invoked with a market category string (`Ladder`, `GC`, `TopRanked200`, `TopRanked`, `Ranked`), THE Scraper SHALL fetch the corresponding RoyaleAPI URL and return a DataFrame with columns `card_name`, `win_rate`, and `usage_rate`.
2. WHEN a RoyaleAPI response is received, THE Scraper SHALL parse `win_rate` and `usage_rate` as decimal fractions in the range [0, 1].
3. IF the RoyaleAPI request returns a non-200 HTTP status or times out after 10 seconds, THEN THE Scraper SHALL raise a descriptive exception identifying the failed market category.
4. THE Scraper SHALL save each market's DataFrame to a corresponding CSV file (`cards_ladder.csv`, `cards_gc.csv`, `cards_top200.csv`) in `backend/data/`.
5. WHEN a CSV file already exists for a market, THE Scraper SHALL overwrite it with the freshly scraped data.

---

### Requirement 2: Data Ingestion — Official Clash Royale API

**User Story:** As a developer, I want to fetch card metadata and player battle logs from the official Clash Royale API, so that the system has authoritative elixir costs, rarities, card types, and personal win-rate data.

#### Acceptance Criteria

1. WHEN the CR_API_Client is initialised, THE CR_API_Client SHALL read the `CR_API_TOKEN` environment variable from the `.env` file and include it as a Bearer token in all request headers.
2. WHEN `fetch_cards_metadata()` is called, THE CR_API_Client SHALL request `GET /v1/cards` and return a list of card objects each containing `id`, `name`, `elixir`, `rarity`, and `type`.
3. WHEN `fetch_player_battlelog(player_tag)` is called with a valid Player_Tag, THE CR_API_Client SHALL URL-encode the tag (replacing `#` with `%23`) and request `GET /v1/players/{encoded_tag}/battlelog`, returning a list of up to 25 battle objects.
4. IF the player tag does not exist or the API returns a 404, THEN THE CR_API_Client SHALL return an empty list and log a warning.
5. IF the `CR_API_TOKEN` environment variable is absent, THEN THE CR_API_Client SHALL raise a `RuntimeError` with the message `"CR_API_TOKEN not set in environment"`.

---

### Requirement 3: Data Ingestion — Static Card Metadata

**User Story:** As a developer, I want to load static card metadata from the cr-api-data GitHub JSON, so that the system has a complete authoritative card list with elixir costs and rarities even when the live API is unavailable.

#### Acceptance Criteria

1. THE System SHALL store the cr-api-data card JSON at `backend/data/cards_meta.json`.
2. WHEN `compute_all_metrics()` is called, THE Metrics_Engine SHALL load `cards_meta.json` and merge its `name`, `elixir`, `rarity`, and `type` fields into the combined market DataFrame on the `card_name` key.
3. IF a card appears in the scraped CSV data but not in `cards_meta.json`, THEN THE Metrics_Engine SHALL assign a default elixir cost of `4.0` and log a warning for that card.

---

### Requirement 4: Data Ingestion — Patch History

**User Story:** As a developer, I want to load a manually compiled patch history CSV, so that the survival analysis and backtest engine have dated buff/nerf events to work with.

#### Acceptance Criteria

1. THE System SHALL store patch history at `backend/data/patch_history.csv` with columns: `date` (YYYY-MM-DD), `card_name`, `change_type` (`buff` or `nerf`), `stat_changed`, and `magnitude` (signed decimal).
2. WHEN the Survival_Engine or Backtest_Engine loads patch history, THE System SHALL parse the `date` column as `datetime` objects.
3. IF `patch_history.csv` contains fewer than 15 rows, THEN THE System SHALL log a warning that survival analysis results may be unreliable.

---

### Requirement 5: Mispricing Score (MPS)

**User Story:** As an analyst, I want to compute a Mispricing Score for every card in every market, so that I can identify cards whose win rates are above or below what their usage rate would predict.

#### Acceptance Criteria

1. WHEN `compute_all_metrics()` is called, THE Metrics_Engine SHALL fit a `LinearRegression` of `win_rate` on `usage_rate` separately for each Market.
2. THE Metrics_Engine SHALL compute `mps(card) = actual_win_rate - predicted_win_rate` for every card in each Market.
3. THE Metrics_Engine SHALL normalise MPS values within each Market to z-scores: `mps_z = (mps - mean(mps)) / std(mps)`, storing the result in a column named `mps_z`.
4. IF a Market contains fewer than 3 cards, THEN THE Metrics_Engine SHALL set `mps_z = 0.0` for all cards in that Market and log a warning.
5. FOR ALL cards in a given Market, the mean of `mps_z` SHALL equal 0.0 (within floating-point tolerance of 1e-9) — this is the z-score invariant.

---

### Requirement 6: Elixir Sharpe Ratio (ESR)

**User Story:** As an analyst, I want to compute an Elixir Sharpe Ratio for every card, so that I can identify cards that deliver consistent win-rate excess relative to their elixir cost.

#### Acceptance Criteria

1. WHEN `compute_all_metrics()` is called, THE Metrics_Engine SHALL compute `win_rate_vol` for each card as the standard deviation of that card's `win_rate` across all Markets.
2. THE Metrics_Engine SHALL clip `win_rate_vol` to a minimum of `0.01` to prevent division by zero.
3. THE Metrics_Engine SHALL compute `esr = ((win_rate - 0.50) / win_rate_vol) × (1 / elixir)` for every card-market row, storing the result in a column named `esr`.
4. IF a card has `elixir = 0`, THEN THE Metrics_Engine SHALL treat `elixir` as `1` for ESR computation and log a warning.

---

### Requirement 7: Meta Momentum (MM)

**User Story:** As an analyst, I want to compute Meta Momentum for every card, so that I can identify cards being over-adopted by high-skill players relative to the general population.

#### Acceptance Criteria

1. WHEN `compute_all_metrics()` is called, THE Metrics_Engine SHALL compute `meta_momentum = (usage_gc - usage_ladder) / (usage_ladder + 0.001)` for each card, storing the result in a column named `meta_momentum`.
2. IF a card is present in the Ladder data but absent from the Grand Challenge data, THEN THE Metrics_Engine SHALL assign `meta_momentum = 0.0` for that card.
3. THE Metrics_Engine SHALL merge `meta_momentum` onto all market rows for the corresponding card.

---

### Requirement 8: Deck Beta

**User Story:** As an analyst, I want to assign a Deck Beta to every card based on its rarity archetype, so that portfolio construction can account for meta-sensitivity.

#### Acceptance Criteria

1. WHEN `compute_all_metrics()` is called, THE Metrics_Engine SHALL assign `deck_beta` values using the mapping: `legendary → 1.2`, `epic → 1.0`, `rare → 0.85`, `common → 0.75`.
2. IF a card's rarity is absent or unrecognised, THEN THE Metrics_Engine SHALL assign `deck_beta = 0.9`.
3. THE Metrics_Engine SHALL store the result in a column named `deck_beta`.

---

### Requirement 9: Alpha Decay Rate (ADR) — Survival Analysis

**User Story:** As an analyst, I want to run Kaplan-Meier survival analysis on post-buff win-rate decay, so that I can quantify how quickly a card's edge erodes after a buff.

#### Acceptance Criteria

1. WHEN `compute_survival_curves()` is called, THE Survival_Engine SHALL load `patch_history.csv` and filter for rows where `change_type = "buff"`.
2. THE Survival_Engine SHALL define the "event" (death) for each buff as the point where the card's win rate drops below 50% of its peak excess win rate above 0.50.
3. THE Survival_Engine SHALL fit a Kaplan-Meier estimator (using the `lifelines` library) to the resulting durations and event indicators, returning the survival function as a list of `{time, survival_probability}` objects.
4. THE Survival_Engine SHALL fit a Cox Proportional Hazards model with covariates `rarity`, `elixir`, and `card_type`, returning coefficient estimates and p-values.
5. IF fewer than 5 buff events are available, THEN THE Survival_Engine SHALL return a warning object instead of model results, indicating insufficient data.
6. THE Survival_Engine SHALL return separate Kaplan-Meier curves grouped by `rarity` so the frontend can render overlapping survival curves per rarity tier.

---

### Requirement 10: Clash Alpha (CA)

**User Story:** As an analyst, I want to compute a Clash Alpha score for any assembled Deck, so that I can quantify its risk-adjusted expected excess performance in a single number.

#### Acceptance Criteria

1. WHEN a Deck of exactly 8 Cards is provided to the CA computation function, THE Metrics_Engine SHALL compute `CA = mean(mps_z_i × centrality_i) + synergy_bonus - meta_risk_penalty` where `centrality_i = 1/8` for equal weighting.
2. THE Metrics_Engine SHALL compute `meta_risk_penalty = mean(deck_beta) × meta_volatility`, where `meta_volatility` is the standard deviation of `win_rate` changes across the most recent 3 Patch_Events.
3. IF no patch history is available, THEN THE Metrics_Engine SHALL set `meta_volatility = 0.05` as a default.
4. THE Metrics_Engine SHALL compute `synergy_bonus` as the mean excess win rate of co-occurring card pairs in the top-performing decks, defaulting to `0.0` if co-occurrence data is unavailable.
5. IF the provided Deck contains fewer or more than 8 Cards, THEN THE Metrics_Engine SHALL raise a `ValueError` with the message `"Deck must contain exactly 8 cards"`.

---

### Requirement 11: Efficient Frontier & Portfolio Optimisation

**User Story:** As a user, I want to see an efficient frontier of possible 8-card decks, so that I can understand the risk/return trade-off and identify the mathematically optimal deck for my elixir budget.

#### Acceptance Criteria

1. WHEN `compute_frontier(elixir_budget)` is called, THE Optimizer SHALL sample at least 2000 valid 8-card Deck combinations from the Ladder market data.
2. THE Optimizer SHALL reject any sampled Deck whose average elixir cost exceeds `elixir_budget`.
3. THE Optimizer SHALL compute `deck_return = mean(win_rate)`, `deck_vol = std(win_rate) + 0.01`, and `deck_sharpe = (deck_return - 0.50) / deck_vol` for each sampled Deck.
4. THE Optimizer SHALL identify the Deck with the maximum `deck_sharpe` as the `max_sharpe_deck`.
5. THE Optimizer SHALL return all sampled Deck points as `{return, risk, sharpe, clash_alpha, deck, avg_elixir}` objects alongside the `max_sharpe_deck`.
6. WHEN `compute_optimal_deck(elixir_budget)` is called, THE Optimizer SHALL return only the `max_sharpe_deck` from `compute_frontier`.
7. IF fewer than 8 eligible cards exist within the elixir budget, THEN THE Optimizer SHALL relax the budget constraint and log a warning.

---

### Requirement 12: UCB Personal Advisor

**User Story:** As a player, I want to enter my Player_Tag and receive a personalised 8-card deck recommendation, so that the system balances my personal strengths with globally strong cards.

#### Acceptance Criteria

1. WHEN `compute_ucb_recommendations(battle_log, df, c)` is called, THE UCB_Engine SHALL parse each battle in `battle_log` to extract the player's 8 cards and the battle outcome (win/loss).
2. THE UCB_Engine SHALL compute `personal_win_rate(card) = wins_with_card / games_with_card` for each card appearing in the battle log.
3. THE UCB_Engine SHALL compute `alpha(card) = min(1.0, games_with_card / 30)` as the personal confidence weight.
4. THE UCB_Engine SHALL compute `ucb_score(card) = alpha × personal_win_rate + (1 - alpha) × global_win_rate + c × sqrt(ln(T) / n_i)` where `T` is total battles and `n_i` is games with that card.
5. IF `n_i = 0` for a card, THEN THE UCB_Engine SHALL use the exploration term `c × sqrt(ln(T + 1))` and set `personal_win_rate = 0.50`.
6. THE UCB_Engine SHALL assign an action label to each card: `"EXPLOIT"` when `n_i ≥ 30` and `personal_win_rate > global_win_rate`; `"EXPLORE"` when `n_i < 10`; `"AVOID"` when `personal_win_rate < global_win_rate - 0.05`; otherwise `"HOLD"`.
7. THE UCB_Engine SHALL return the top 8 cards by `ucb_score` as the recommended Deck, along with per-card scores, action labels, and personal vs global win rates.
8. IF the battle log is empty, THEN THE UCB_Engine SHALL fall back to returning the top 8 cards by global `mps_z` score.

---

### Requirement 13: Backtest Engine — Three Strategies

**User Story:** As an analyst, I want to backtest three quantitative strategies against historical patch data, so that I can evaluate their risk-adjusted performance as a hedge fund tearsheet.

#### Acceptance Criteria

1. WHEN `run_all_strategies(df)` is called, THE Backtest_Engine SHALL execute all three strategies (Patch Momentum, UCB-Optimal, Contrarian Mean Reversion) and return their results in a single response object.
2. THE Backtest_Engine SHALL simulate Patch Momentum by selecting the 3 cards with the largest positive `magnitude` after each Patch_Event and filling the remaining 5 slots with the highest-MPS cards available at that time.
3. THE Backtest_Engine SHALL simulate UCB-Optimal by running UCB convergence over seasons, starting with `alpha = 0` in season 1 and increasing `alpha` as simulated sample size grows.
4. THE Backtest_Engine SHALL simulate Contrarian Mean Reversion by identifying nerfed cards whose win rate has begun recovering (positive delta after a trough) and selecting the top 8 by recovery magnitude.
5. THE Backtest_Engine SHALL compute for each strategy: an equity curve as a list of `{date, cumulative_win_rate}` points, Sharpe ratio, maximum drawdown, total excess win rate, and CA trajectory.
6. THE Backtest_Engine SHALL include a benchmark equity curve representing the average meta deck win rate across the same time period.
7. IF `patch_history.csv` contains fewer than 5 Patch_Events, THEN THE Backtest_Engine SHALL return a warning indicating insufficient patch history for reliable backtesting.

---

### Requirement 14: FastAPI Backend — Endpoints

**User Story:** As a frontend developer, I want a complete set of REST API endpoints, so that the frontend can retrieve all data and trigger all computations.

#### Acceptance Criteria

1. THE Backend SHALL expose the following endpoints: `GET /api/cards`, `GET /api/cards/{card_name}/history`, `GET /api/frontier`, `GET /api/optimize`, `GET /api/ucb`, `GET /api/survival`, `GET /api/backtest`, `GET /api/cross-market`, `POST /api/analyst`.
2. WHEN the Backend starts up, THE Backend SHALL call `compute_all_metrics()` once and cache the resulting DataFrame in application state.
3. THE Backend SHALL configure CORS to allow requests from `http://localhost:5173` and any configured production domain.
4. WHEN `GET /api/cards` is called with an optional `market` query parameter, THE Backend SHALL return the cached card DataFrame filtered to that market, serialised as a JSON array of records.
5. WHEN `GET /api/ucb` is called with a `player_tag` query parameter, THE Backend SHALL fetch the player's Battle_Log via CR_API_Client and pass it to UCB_Engine, returning the recommendation object.
6. WHEN `POST /api/analyst` is called with a JSON body containing `query` (string) and optional `context` (object), THE Backend SHALL pass the query and current card data to the Analyst module and return the generated report.
7. IF any endpoint handler raises an unhandled exception, THEN THE Backend SHALL return a JSON error response with HTTP status 500 and a `detail` field describing the error.

---

### Requirement 15: Claude AI Analyst

**User Story:** As a user, I want to ask natural-language questions about the card meta and receive AI-generated research reports, so that I can understand the data without needing to interpret raw statistics.

#### Acceptance Criteria

1. WHEN `generate_analyst_report(query, context, df)` is called, THE Analyst SHALL read the `ANTHROPIC_API_KEY` environment variable and initialise the Anthropic client.
2. THE Analyst SHALL construct a system prompt that instructs Claude to act as a quantitative Clash Royale analyst and includes a summary of the top 10 cards by `mps_z` from the current DataFrame.
3. THE Analyst SHALL call the Anthropic Messages API with the user's `query` and return the response text.
4. IF `ANTHROPIC_API_KEY` is absent or the API call fails, THEN THE Analyst SHALL return a fallback message: `"Analyst unavailable. Check ANTHROPIC_API_KEY configuration."`.
5. THE Analyst SHALL not include raw API keys or PII in any response returned to the frontend.

---

### Requirement 16: Frontend — Bloomberg Terminal Layout

**User Story:** As a user, I want a Bloomberg Terminal-style three-panel layout with a dark navy theme, so that the application communicates its quantitative finance identity visually.

#### Acceptance Criteria

1. THE Frontend SHALL render a three-panel layout: a left screener panel (CardTicker), a centre tabbed content panel, and a right Rosetta Stone panel (AnalogyExplainer).
2. THE Frontend SHALL apply a dark navy background (`#0a0e1a` or equivalent), orange accent colour (`#ff6b00` or equivalent), and monospace font throughout.
3. THE Frontend SHALL render a TopBar component at the top of the page displaying a horizontally scrolling Ticker of card names with their MPS z-scores and ESR values.
4. THE Frontend SHALL be built with React, Vite, and Tailwind CSS, with chart components implemented using Recharts.
5. THE Frontend SHALL be responsive to viewport widths of at least 1280px (the minimum expected terminal display width).

---

### Requirement 17: Frontend — Card Screener (CardTicker)

**User Story:** As a user, I want a sortable, filterable card screener table, so that I can identify the highest-alpha cards across all markets at a glance.

#### Acceptance Criteria

1. THE CardTicker component SHALL fetch data from `GET /api/cards` on mount and display a table with columns: card name, win rate, usage rate, MPS z-score, ESR, Meta Momentum, and Clash Alpha.
2. WHEN a column header is clicked, THE CardTicker SHALL sort the table by that column in descending order; a second click SHALL sort in ascending order.
3. THE CardTicker SHALL colour-code MPS z-score cells: green for `mps_z > 1`, red for `mps_z < -1`, and neutral otherwise.
4. THE CardTicker SHALL provide a market selector (Ladder / GC / Top 200) that re-fetches and re-renders the table for the selected market.
5. WHEN a card row is clicked, THE CardTicker SHALL emit the selected card name to the centre panel to display that card's history chart.

---

### Requirement 18: Frontend — Patch Timeline (PatchTimeline)

**User Story:** As a user, I want to see a card's win-rate history overlaid with patch events, so that I can visually understand how buffs and nerfs affected its performance.

#### Acceptance Criteria

1. THE PatchTimeline component SHALL fetch data from `GET /api/cards/{card_name}/history` when a card is selected and render a line chart of `win_rate` over time using Recharts.
2. THE PatchTimeline SHALL overlay vertical reference lines on the chart at each Patch_Event date, labelled with the change type (buff/nerf) and magnitude.
3. THE PatchTimeline SHALL colour buff reference lines green and nerf reference lines red.
4. WHEN no card is selected, THE PatchTimeline SHALL display a placeholder message: `"Select a card to view its history"`.

---

### Requirement 19: Frontend — Portfolio Maker (PortfolioMaker)

**User Story:** As a user, I want to build a deck manually and see all six metrics update in real time, so that I can experiment with card combinations and understand their quantitative impact.

#### Acceptance Criteria

1. THE PortfolioMaker component SHALL display a card selection grid and a current deck slot area showing up to 8 selected cards.
2. WHEN a card is added to or removed from the deck, THE PortfolioMaker SHALL recompute and display: expected win rate, deck volatility, ESR, Meta Beta, and Clash Alpha without requiring a page reload.
3. THE PortfolioMaker SHALL display the deck's position as a dot on the Efficient_Frontier scatter plot, updating in real time as cards are added or removed.
4. THE PortfolioMaker SHALL prevent adding a 9th card and display an error message if the user attempts to do so.
5. WHEN exactly 8 cards are selected, THE PortfolioMaker SHALL display the Clash Alpha value in a large, colour-coded format: green for `CA > 0`, red for `CA ≤ 0`.

---

### Requirement 20: Frontend — Efficient Frontier (EfficientFrontier)

**User Story:** As a user, I want to see an interactive efficient frontier chart, so that I can visually explore the risk/return trade-off across thousands of possible decks.

#### Acceptance Criteria

1. THE EfficientFrontier component SHALL fetch data from `GET /api/frontier` and render a scatter plot with deck volatility on the x-axis and expected win rate on the y-axis using Recharts.
2. THE EfficientFrontier SHALL highlight the max-Sharpe deck point with a distinct marker and label.
3. THE EfficientFrontier SHALL provide an elixir budget slider (range 3.0–4.5, step 0.1) that triggers a new `GET /api/frontier` request and re-renders the chart when adjusted.
4. WHEN a point on the frontier is hovered, THE EfficientFrontier SHALL display a tooltip showing the deck's 8 card names, Sharpe ratio, and Clash Alpha.

---

### Requirement 21: Frontend — Alpha Decay Chart (AlphaDecay)

**User Story:** As a user, I want to see Kaplan-Meier survival curves for alpha decay grouped by card rarity, so that I can understand how quickly different card types lose their post-buff edge.

#### Acceptance Criteria

1. THE AlphaDecay component SHALL fetch data from `GET /api/survival` and render overlapping Kaplan-Meier survival curves, one per rarity tier, using Recharts.
2. THE AlphaDecay SHALL label the x-axis as "Days Since Buff" and the y-axis as "Probability of Retaining Edge".
3. THE AlphaDecay SHALL display a summary table below the chart showing the Cox model coefficients and p-values for `rarity`, `elixir`, and `card_type`.
4. IF the API returns a warning about insufficient data, THE AlphaDecay SHALL display the warning text instead of the chart.

---

### Requirement 22: Frontend — Cross-Market Analysis (CrossMarket)

**User Story:** As a user, I want to compare MPS distributions across trophy ranges, so that I can identify cards that are mispriced in one market but not another.

#### Acceptance Criteria

1. THE CrossMarket component SHALL fetch data from `GET /api/cross-market` and render a grouped bar chart comparing `mps_z` distributions across Ladder, GC, and Top 200 markets using Recharts.
2. THE CrossMarket SHALL display a table of cards whose `mps_z` differs by more than 1.5 between any two markets, highlighting cross-market arbitrage opportunities.
3. THE CrossMarket SHALL label each market's mean MPS and standard deviation in the chart legend.

---

### Requirement 23: Frontend — Backtest Report (BacktestReport)

**User Story:** As a user, I want to see a hedge fund tearsheet comparing the three backtest strategies, so that I can evaluate which quantitative approach has historically generated the most alpha.

#### Acceptance Criteria

1. THE BacktestReport component SHALL fetch data from `GET /api/backtest` and render equity curves for all three strategies and the benchmark on a single Recharts line chart.
2. THE BacktestReport SHALL display a stats panel below the chart with columns: Strategy, Sharpe Ratio, Max Drawdown, Total Excess Win Rate, and Final CA.
3. THE BacktestReport SHALL colour each strategy's equity curve distinctly and include a legend.
4. IF the API returns a warning about insufficient patch history, THE BacktestReport SHALL display the warning prominently above the chart.

---

### Requirement 24: Frontend — Analyst Chat (AnalystChat)

**User Story:** As a user, I want to ask natural-language questions about the meta and receive AI-generated research reports, so that I can get actionable insights without interpreting raw data.

#### Acceptance Criteria

1. THE AnalystChat component SHALL render a chat interface with a text input and a submit button.
2. WHEN the user submits a query, THE AnalystChat SHALL POST to `/api/analyst` with the query text and display a loading indicator while awaiting the response.
3. WHEN the API response is received, THE AnalystChat SHALL render the analyst report text in a styled message bubble.
4. IF the API returns an error or the fallback message, THE AnalystChat SHALL display the fallback message in a visually distinct error style.
5. THE AnalystChat SHALL maintain a scrollable history of all queries and responses within the current session.

---

### Requirement 25: Frontend — Rosetta Stone Panel (AnalogyExplainer)

**User Story:** As a user unfamiliar with finance, I want a side panel that translates every finance term into a Clash Royale analogy, so that I can understand the metrics without a finance background.

#### Acceptance Criteria

1. THE AnalogyExplainer component SHALL display a static or dynamically highlighted list of finance-to-Clash-Royale term mappings (e.g. "Sharpe Ratio → Win rate per elixir spent").
2. WHEN a metric name is hovered or clicked anywhere in the application, THE AnalogyExplainer SHALL scroll to and highlight the corresponding analogy entry.
3. THE AnalogyExplainer SHALL include entries for: MPS, ESR, MM, Deck Beta, ADR, CA, Efficient Frontier, Markowitz Optimisation, UCB, Kaplan-Meier, and Alpha Decay.

---

### Requirement 26: Environment Configuration

**User Story:** As a developer, I want all secrets managed via a `.env` file, so that API keys are never hardcoded in source files.

#### Acceptance Criteria

1. THE System SHALL read `CR_API_TOKEN` and `ANTHROPIC_API_KEY` exclusively from a `.env` file located at the project root, loaded via `python-dotenv`.
2. THE Backend SHALL fail to start with a descriptive error if `CR_API_TOKEN` is not set.
3. THE System SHALL include a `.env.example` file listing all required environment variable names with placeholder values and no real secrets.
4. THE System SHALL include `.env` in `.gitignore` to prevent accidental secret exposure.

---

### Requirement 27: Data Serialisation Round-Trip

**User Story:** As a developer, I want all data serialisation and deserialisation to be lossless, so that metrics computed in the backend are faithfully represented in the frontend.

#### Acceptance Criteria

1. THE Backend SHALL serialise all DataFrame responses to JSON using `orient="records"` with numeric values rounded to 4 decimal places.
2. FOR ALL card metric objects serialised to JSON and then parsed by the frontend, the numeric fields `win_rate`, `usage_rate`, `mps_z`, `esr`, `meta_momentum`, and `deck_beta` SHALL retain their values within a tolerance of 0.0001 (round-trip property).
3. THE Backend SHALL return ISO 8601 date strings for all date fields.

---

### Requirement 28: Non-Functional — Performance

**User Story:** As a user, I want the application to respond quickly, so that the demo experience is smooth during the hackathon presentation.

#### Acceptance Criteria

1. WHEN `GET /api/cards` is called after startup, THE Backend SHALL respond within 200ms (cached data, no recomputation).
2. WHEN `GET /api/frontier` is called, THE Backend SHALL respond within 3000ms for 2000 sampled decks.
3. WHEN `GET /api/backtest` is called, THE Backend SHALL respond within 5000ms.
4. THE Frontend SHALL display a loading spinner for any API call that has not resolved within 300ms.

---

### Requirement 29: Non-Functional — Deployment

**User Story:** As a developer, I want the application to run locally with a single command per service, so that the demo can be set up quickly on any machine.

#### Acceptance Criteria

1. THE Backend SHALL start with `uvicorn main:app --reload --port 8000` from the `backend/` directory.
2. THE Frontend SHALL start with `npm run dev` from the `frontend/` directory and serve on port 5173.
3. THE System SHALL include a `backend/requirements.txt` listing all Python dependencies with pinned versions.
4. THE System SHALL include a `frontend/package.json` listing all Node dependencies.
5. WHERE Railway and Vercel deployment is configured, THE Backend SHALL read a `PORT` environment variable and bind to it instead of the default 8000.
