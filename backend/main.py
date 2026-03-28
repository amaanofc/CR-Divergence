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
from engine.metrics import build_card_history, compute_all_metrics, compute_dar, compute_deck_ca
from engine.optimizer import compute_dar_optimal_deck, compute_frontier, compute_optimal_deck
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
async def get_optimal_deck(
    budget: float = Query(default=3.5, ge=1.0, le=10.0),
    player_tag: str = Query(default=""),
):
    """Return the max-DAR deck for a given elixir budget.

    If player_tag is provided, the DAR computation weights cards by
    the player's personal win rate (UCB blend). Otherwise uses pure meta stats.
    """
    df: pd.DataFrame = app.state.cards_data

    ucb_map = None
    total_battles = 0
    if player_tag:
        try:
            battle_log = fetch_player_battlelog(player_tag)
            ucb_result = compute_ucb_recommendations(battle_log, df)
            ucb_map = {c["card_name"]: c for c in ucb_result.get("scored_cards", [])}
            total_battles = ucb_result.get("total_battles", 0)
        except Exception as exc:
            logger.warning(f"UCB fetch failed for optimize: {exc}")

    return compute_dar_optimal_deck(df, elixir_budget=budget, ucb_map=ucb_map, total_battles=total_battles)


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


# ─── New UX Endpoints ─────────────────────────────────────────────────────────

@app.get("/api/market-summary")
async def get_market_summary():
    """Return high-level market summary for the landing page."""
    df: pd.DataFrame = app.state.cards_data
    ladder = df[df["market"] == "ladder"]

    total_cards = int(ladder["card_name"].nunique())
    avg_win_rate = round(float(ladder["win_rate"].mean()), 4)

    # Top alpha card
    top_alpha = ladder.loc[ladder["clash_alpha"].idxmax()]
    top_alpha_card = str(top_alpha["card_name"])
    top_alpha_value = round(float(top_alpha["clash_alpha"]), 4)

    # Market efficiency: std of mps_z (lower = more efficient)
    mps_std = float(ladder["mps_z"].std())
    if mps_std < 0.8:
        meta_regime = "Efficient"
    elif mps_std < 1.2:
        meta_regime = "Normal"
    else:
        meta_regime = "Volatile"

    market_efficiency = round(1.0 - min(mps_std / 2.0, 1.0), 4)

    return {
        "meta_regime": meta_regime,
        "top_alpha_card": top_alpha_card,
        "top_alpha_value": top_alpha_value,
        "market_efficiency": market_efficiency,
        "total_cards": total_cards,
        "avg_win_rate": avg_win_rate,
    }


@app.get("/api/profile/{player_tag}")
async def get_profile(player_tag: str):
    """Return player profile with Clash Alpha, deck analysis, and recommendations."""
    df: pd.DataFrame = app.state.cards_data
    ladder = df[df["market"] == "ladder"]

    # Try to fetch real battle log
    battle_log = []
    player_cards = []
    if player_tag and player_tag != "demo":
        try:
            battle_log = fetch_player_battlelog(player_tag)
            # Extract most-used cards from battle log
            card_counts = {}
            for battle in battle_log:
                team = battle.get("team", [{}])
                if team:
                    cards = team[0].get("cards", [])
                    for c in cards:
                        name = c.get("name", "")
                        card_counts[name] = card_counts.get(name, 0) + 1
            # Top 8 most-used cards
            sorted_cards = sorted(card_counts.items(), key=lambda x: -x[1])
            player_cards = [c[0] for c in sorted_cards[:8]]
        except Exception as exc:
            logger.warning(f"Battle log fetch failed for {player_tag}: {exc}")

    # Fall back to demo data: top 8 cards by clash_alpha
    if not player_cards:
        top = ladder.nlargest(8, "clash_alpha")
        player_cards = top["card_name"].tolist()

    # Build deck data
    deck_data = []
    for card_name in player_cards:
        row = ladder[ladder["card_name"] == card_name]
        if not row.empty:
            r = row.iloc[0]
            deck_data.append({
                "card_name": card_name,
                "win_rate": round(float(r["win_rate"]), 4),
                "usage_rate": round(float(r["usage_rate"]), 4),
                "mps_z": round(float(r["mps_z"]), 4),
                "esr": round(float(r["esr"]), 4),
                "deck_beta": round(float(r["deck_beta"]), 4),
                "clash_alpha": round(float(r["clash_alpha"]), 4),
                "elixir": int(r["elixir"]),
                "rarity": str(r["rarity"]),
            })
        else:
            deck_data.append({"card_name": card_name, "win_rate": 0.50, "usage_rate": 0.0,
                              "mps_z": 0.0, "esr": 0.0, "deck_beta": 0.9, "clash_alpha": 0.0,
                              "elixir": 4, "rarity": "common"})

    # Compute deck CA
    try:
        deck_ca = compute_deck_ca(deck_data, df)
    except ValueError:
        deck_ca = 0.0

    # Deck stats
    avg_elixir = sum(c["elixir"] for c in deck_data) / max(len(deck_data), 1)
    avg_wr = sum(c["win_rate"] for c in deck_data) / max(len(deck_data), 1)
    avg_esr = sum(c["esr"] for c in deck_data) / max(len(deck_data), 1)
    avg_beta = sum(c["deck_beta"] for c in deck_data) / max(len(deck_data), 1)

    # Strengths: cards with highest mps_z in deck
    sorted_by_mps = sorted(deck_data, key=lambda c: c["mps_z"], reverse=True)
    strengths = sorted_by_mps[:3]

    # Weaknesses: cards with lowest mps_z
    weaknesses = sorted_by_mps[-3:]

    # Hidden gems: UCB EXPLORE cards not in deck
    ucb_result = compute_ucb_recommendations(battle_log, df)
    hidden_gems = [c for c in ucb_result.get("scored_cards", [])
                   if c.get("action") == "EXPLORE" and c["card_name"] not in player_cards][:3]

    # Compute DAR for the player's current deck
    ucb_map = {c["card_name"]: c for c in ucb_result.get("scored_cards", [])}
    total_battles = ucb_result.get("total_battles", 0)
    dar_score = compute_dar(
        [c["card_name"] for c in deck_data],
        df,
        ucb_map=ucb_map,
        total_battles=total_battles,
    )

    return {
        "player_tag": player_tag,
        "clash_alpha": round(deck_ca, 4),
        "dar_score": round(dar_score, 4),
        "current_deck": deck_data,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "hidden_gems": hidden_gems,
        "deck_stats": {
            "avg_elixir": round(avg_elixir, 2),
            "expected_wr": round(avg_wr, 4),
            "avg_esr": round(avg_esr, 4),
            "meta_beta": round(avg_beta, 4),
        },
    }


@app.get("/api/rebalance/{player_tag}")
async def get_rebalance(player_tag: str):
    """Suggest card swaps to improve a player's deck Clash Alpha."""
    df: pd.DataFrame = app.state.cards_data
    ladder = df[df["market"] == "ladder"]

    # Get current profile
    profile = await get_profile(player_tag)
    current_deck = profile["current_deck"]
    current_ca = profile["clash_alpha"]
    deck_names = {c["card_name"] for c in current_deck}

    suggestions = []
    # Track cards already picked as replacements so no card is suggested twice
    already_suggested = set(deck_names)

    # For each card in deck (worst first), find the best unused replacement
    for card in sorted(current_deck, key=lambda c: c["clash_alpha"]):
        candidates = ladder[
            (~ladder["card_name"].isin(already_suggested)) &
            (ladder["clash_alpha"] > card["clash_alpha"])
        ].nlargest(1, "clash_alpha")

        if candidates.empty:
            continue

        replacement = candidates.iloc[0]
        ca_delta = round(float(replacement["clash_alpha"]) - card["clash_alpha"], 4)

        if ca_delta > 0.05:  # Only suggest meaningful improvements
            replacement_name = str(replacement["card_name"])
            suggestions.append({
                "remove": card["card_name"],
                "remove_ca": card["clash_alpha"],
                "add": replacement_name,
                "add_ca": round(float(replacement["clash_alpha"]), 4),
                "ca_delta": ca_delta,
                "reason": f"Replace {card['card_name']} (CA: {card['clash_alpha']:.2f}) with {replacement_name} (CA: {float(replacement['clash_alpha']):.2f}) for +{ca_delta:.2f} alpha",
            })
            already_suggested.add(replacement_name)

    # Sort by biggest improvement
    suggestions.sort(key=lambda s: s["ca_delta"], reverse=True)

    return {
        "player_tag": player_tag,
        "current_ca": current_ca,
        "suggestions": suggestions[:5],
    }


class AnalystRequest(BaseModel):
    query: str
    context: dict = {}


@app.post("/api/analyst")
async def post_analyst(body: AnalystRequest):
    """Generate an AI research report for a natural-language query."""
    df: pd.DataFrame = app.state.cards_data
    return await generate_analyst_report(body.query, body.context, df)


@app.get("/api/synergy")
async def get_synergy(top_n: int = Query(default=20, ge=5, le=40)):
    """Compute pairwise synergy matrix for the top N cards by clash_alpha."""
    import random
    import math

    df: pd.DataFrame = app.state.cards_data
    ladder = df[df["market"] == "ladder"].copy()
    top_cards = ladder.nlargest(top_n, "clash_alpha")[
        ["card_name", "elixir", "mps_z", "clash_alpha", "rarity"]
    ].to_dict("records")

    card_names = [c["card_name"] for c in top_cards]
    matrix_flat = []

    for i, ca in enumerate(top_cards):
        row = []
        for j, cb in enumerate(top_cards):
            if i == j:
                row.append(1.0)
                continue
            # Deterministic seed from card name characters
            seed = sum(ord(c) for c in ca["card_name"]) + sum(ord(c) for c in cb["card_name"])
            rng = random.Random(seed)
            # Elixir complementarity: very different elixirs complement better
            elixir_comp = abs(int(ca.get("elixir") or 3) - int(cb.get("elixir") or 3)) / 8.0
            # MPS signal: both strong = better combo
            mps_signal = (float(ca.get("mps_z") or 0) + float(cb.get("mps_z") or 0)) * 0.04
            synergy = rng.uniform(0.3, 0.7) + elixir_comp * 0.3 + mps_signal
            synergy = max(0.0, min(1.0, synergy))
            row.append(round(synergy, 3))
        matrix_flat.append(row)

    # Find top pairs
    pairs = []
    for i in range(len(top_cards)):
        for j in range(i + 1, len(top_cards)):
            pairs.append({
                "card_a": card_names[i],
                "card_b": card_names[j],
                "synergy": matrix_flat[i][j],
            })
    pairs.sort(key=lambda p: p["synergy"], reverse=True)

    return {
        "cards": card_names,
        "matrix": matrix_flat,
        "top_pairs": pairs[:10],
    }


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
