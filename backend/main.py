"""
Clash Markets API — FastAPI backend.
"""
import os

from dotenv import load_dotenv

# Load .env before any module that reads env vars
load_dotenv()

import logging
from typing import Optional

import pandas as pd
import uvicorn
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from engine.backtest import run_all_strategies
from engine.metrics import build_card_history, compute_all_metrics
from engine.optimizer import compute_frontier, compute_optimal_deck
from engine.survival import compute_survival_curves
from engine.ucb import compute_ucb_recommendations
from data.cr_api import fetch_player_battlelog
from copilot.analyst import generate_analyst_report

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Clash Markets API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    logger.info("Computing metrics on startup...")
    app.state.cards_data = compute_all_metrics()
    logger.info(f"Loaded {len(app.state.cards_data)} card-market rows")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": str(exc)})


def _round_df(df: pd.DataFrame) -> list:
    """Serialise DataFrame to records with numeric values rounded to 4dp."""
    numeric_cols = df.select_dtypes(include="number").columns
    df = df.copy()
    df[numeric_cols] = df[numeric_cols].round(4)
    return df.to_dict(orient="records")


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/api/cards")
async def get_cards(market: Optional[str] = Query(default="all")):
    """Return card metrics, optionally filtered by market."""
    df: pd.DataFrame = app.state.cards_data
    if market and market.lower() != "all":
        df = df[df["market"] == market.lower()]
    return _round_df(df)


@app.get("/api/cards/{card_name}/history")
async def get_card_history(card_name: str):
    """Return 180-day win-rate history with patch events for a card."""
    df: pd.DataFrame = app.state.cards_data
    return build_card_history(card_name, df)


@app.get("/api/frontier")
async def get_frontier(budget: float = Query(default=3.5, ge=1.0, le=10.0)):
    """Return efficient frontier points and max-Sharpe deck."""
    df: pd.DataFrame = app.state.cards_data
    return compute_frontier(df, elixir_budget=budget)


@app.get("/api/optimize")
async def get_optimal_deck(budget: float = Query(default=3.5, ge=1.0, le=10.0)):
    """Return the max-Sharpe deck for a given elixir budget."""
    df: pd.DataFrame = app.state.cards_data
    return compute_optimal_deck(df, elixir_budget=budget)


@app.get("/api/ucb")
async def get_ucb(player_tag: str = Query(default="")):
    """Return UCB deck recommendations for a player."""
    df: pd.DataFrame = app.state.cards_data
    battle_log = []
    if player_tag:
        try:
            battle_log = fetch_player_battlelog(player_tag)
        except Exception as exc:
            logger.warning(f"Battle log fetch failed for {player_tag}: {exc}")
    return compute_ucb_recommendations(battle_log, df)


@app.get("/api/survival")
async def get_survival():
    """Return Kaplan-Meier survival curves and Cox model results."""
    return compute_survival_curves()


@app.get("/api/backtest")
async def get_backtest():
    """Return backtest equity curves and stats for all three strategies."""
    df: pd.DataFrame = app.state.cards_data
    return run_all_strategies(df)


@app.get("/api/cross-market")
async def get_cross_market():
    """Return MPS distributions per market and cross-market arbitrage cards."""
    df: pd.DataFrame = app.state.cards_data

    markets = ["ladder", "gc", "top200"]
    market_stats = {}
    card_market_mps: dict[str, dict] = {}

    for mkt in markets:
        sub = df[df["market"] == mkt]
        if sub.empty:
            market_stats[mkt] = {"mean_mps_z": 0.0, "std_mps_z": 0.0, "cards": []}
            continue
        market_stats[mkt] = {
            "mean_mps_z": round(float(sub["mps_z"].mean()), 4),
            "std_mps_z": round(float(sub["mps_z"].std()), 4),
            "cards": _round_df(sub),
        }
        for _, row in sub.iterrows():
            if row["card_name"] not in card_market_mps:
                card_market_mps[row["card_name"]] = {}
            card_market_mps[row["card_name"]][mkt] = row["mps_z"]

    # Detect cross-market arbitrage: mps_z diff > 1.5 between any two markets
    arbitrage = []
    for card_name, mkt_scores in card_market_mps.items():
        scores = list(mkt_scores.values())
        if len(scores) >= 2:
            max_diff = max(scores) - min(scores)
            if max_diff > 1.5:
                arbitrage.append({
                    "card_name": card_name,
                    "max_mps_z_diff": round(max_diff, 4),
                    **{f"mps_z_{k}": round(v, 4) for k, v in mkt_scores.items()},
                })

    arbitrage.sort(key=lambda x: x["max_mps_z_diff"], reverse=True)

    return {
        "markets": market_stats,
        "arbitrage_cards": arbitrage,
    }


class AnalystRequest(BaseModel):
    query: str
    context: dict = {}


@app.post("/api/analyst")
async def post_analyst(body: AnalystRequest):
    """Generate an AI research report for a natural-language query."""
    df: pd.DataFrame = app.state.cards_data
    return await generate_analyst_report(body.query, body.context, df)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
