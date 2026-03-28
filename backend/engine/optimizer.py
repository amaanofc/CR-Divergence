"""
Optimizer engine for Clash Markets.
Implements Markowitz mean-variance portfolio optimisation for deck construction.
Also implements DAR-optimal deck construction.
"""
import logging
import random

import numpy as np
import pandas as pd

from engine.metrics import compute_dar

logger = logging.getLogger(__name__)


def compute_frontier(df: pd.DataFrame, elixir_budget: float = 3.5) -> dict:
    """
    Sample 2000 valid 8-card deck combinations and compute the efficient frontier.

    Args:
        df: Merged metrics DataFrame from compute_all_metrics()
        elixir_budget: Maximum average elixir cost per card (default 3.5)

    Returns:
        {
            frontier_points: [{return, risk, sharpe, clash_alpha, deck, avg_elixir}],
            max_sharpe_deck: {same fields},
            n_decks_sampled: int
        }
    """
    # Filter to Ladder market
    ladder = df[df["market"] == "ladder"].copy()

    # Extract required fields
    required_cols = ["card_name", "win_rate", "elixir", "mps_z", "deck_beta"]
    for col in required_cols:
        if col not in ladder.columns:
            raise ValueError(f"Missing required column: {col}")

    ladder = ladder[required_cols].drop_duplicates("card_name").reset_index(drop=True)

    # Check if we have enough cards within budget
    budget_eligible = ladder[ladder["elixir"] <= elixir_budget + 1.5]  # cards that could fit

    if len(budget_eligible) < 8:
        logger.warning(
            f"Fewer than 8 cards eligible within elixir budget {elixir_budget}. "
            "Relaxing budget constraint."
        )
        budget_eligible = ladder  # use all cards

    cards_list = budget_eligible.to_dict("records")
    n_cards = len(cards_list)

    if n_cards < 8:
        logger.warning(f"Only {n_cards} cards available. Cannot form 8-card decks.")
        return {"frontier_points": [], "max_sharpe_deck": {}, "n_decks_sampled": 0}

    frontier_points = []
    target_samples = 2000
    max_retries_per_sample = 50

    for _ in range(target_samples):
        deck = None
        for attempt in range(max_retries_per_sample):
            sample = random.sample(cards_list, 8)
            avg_elixir = np.mean([c["elixir"] for c in sample])
            if avg_elixir <= elixir_budget:
                deck = sample
                break

        if deck is None:
            # Relax: just take any 8 cards
            deck = random.sample(cards_list, 8)
            avg_elixir = np.mean([c["elixir"] for c in deck])

        win_rates = [c["win_rate"] for c in deck]
        mps_zs = [c["mps_z"] for c in deck]
        betas = [c["deck_beta"] for c in deck]
        avg_elixir = np.mean([c["elixir"] for c in deck])

        deck_return = float(np.mean(win_rates))
        deck_vol = float(np.std(win_rates)) + 0.01
        deck_sharpe = (deck_return - 0.50) / deck_vol
        deck_ca = float(np.mean(mps_zs)) - float(np.mean(betas)) * 0.3

        frontier_points.append({
            "return": round(deck_return, 4),
            "risk": round(deck_vol, 4),
            "sharpe": round(deck_sharpe, 4),
            "clash_alpha": round(deck_ca, 4),
            "deck": [c["card_name"] for c in deck],
            "avg_elixir": round(float(avg_elixir), 2),
        })

    if not frontier_points:
        return {"frontier_points": [], "max_sharpe_deck": {}, "n_decks_sampled": 0}

    max_sharpe_deck = max(frontier_points, key=lambda x: x["sharpe"])

    return {
        "frontier_points": frontier_points,
        "max_sharpe_deck": max_sharpe_deck,
        "n_decks_sampled": len(frontier_points),
    }


def compute_dar_optimal_deck(
    df: pd.DataFrame,
    elixir_budget: float = 3.5,
    ucb_map: dict | None = None,
    total_battles: int = 0,
) -> dict:
    """
    Find the 8-card deck that maximises DAR (Deck Alpha Rating) via Monte Carlo sampling.

    Samples 2000 elixir-budget-valid decks and selects the one with the highest DAR.

    Args:
        df: Merged metrics DataFrame
        elixir_budget: Maximum average elixir per card
        ucb_map: Optional {card_name: {"ucb_score": float, ...}} from UCB engine
        total_battles: Total battles from player log

    Returns:
        Dict with deck (list of card metadata), dar_score, return, risk, sharpe, avg_elixir
    """
    ladder = df[df["market"] == "ladder"].copy()
    required_cols = ["card_name", "win_rate", "elixir", "mps_z", "deck_beta", "esr", "rarity"]
    for col in required_cols:
        if col not in ladder.columns:
            ladder[col] = None
    ladder = ladder[required_cols].drop_duplicates("card_name").reset_index(drop=True)

    budget_eligible = ladder[ladder["elixir"] <= elixir_budget + 1.5]
    if len(budget_eligible) < 8:
        budget_eligible = ladder

    cards_list = budget_eligible.to_dict("records")
    if len(cards_list) < 8:
        return {}

    best_dar = -float("inf")
    best_deck = None

    for _ in range(2000):
        deck = None
        for _attempt in range(50):
            sample = random.sample(cards_list, 8)
            avg_elixir = float(np.mean([c["elixir"] for c in sample]))
            if avg_elixir <= elixir_budget:
                deck = sample
                break
        if deck is None:
            deck = random.sample(cards_list, 8)

        names = [c["card_name"] for c in deck]
        dar = compute_dar(names, df, ucb_map=ucb_map, total_battles=total_battles)
        if dar > best_dar:
            best_dar = dar
            best_deck = deck

    if not best_deck:
        return {}

    avg_elixir = float(np.mean([c["elixir"] for c in best_deck]))
    win_rates = [float(c["win_rate"]) for c in best_deck]
    deck_return = float(np.mean(win_rates))
    deck_vol = float(np.std(win_rates)) + 0.01

    enriched = []
    for c in best_deck:
        enriched.append({
            "card_name": c["card_name"],
            "win_rate": round(float(c.get("win_rate", 0.5)), 4),
            "elixir": int(c.get("elixir", 4)),
            "rarity": str(c.get("rarity", "common")),
            "mps_z": round(float(c.get("mps_z", 0)), 4),
            "esr": round(float(c.get("esr", 0)), 4),
            "deck_beta": round(float(c.get("deck_beta", 1.0)), 4),
        })

    return {
        "deck": enriched,
        "dar_score": round(best_dar, 4),
        "return": round(deck_return, 4),
        "risk": round(deck_vol, 4),
        "sharpe": round((deck_return - 0.50) / deck_vol, 4),
        "avg_elixir": round(avg_elixir, 2),
    }


def compute_optimal_deck(df: pd.DataFrame, elixir_budget: float = 3.5) -> dict:
    """
    Return the maximum Sharpe ratio deck from the efficient frontier,
    with full card metadata objects in the deck list.

    Args:
        df: Merged metrics DataFrame
        elixir_budget: Maximum average elixir cost per card

    Returns:
        The max_sharpe_deck point with deck as list of card metadata objects
    """
    result = compute_frontier(df, elixir_budget=elixir_budget)
    best = result.get("max_sharpe_deck", {})
    if not best or not best.get("deck"):
        return best

    # Enrich deck card names with full metadata from the ladder DataFrame
    ladder = df[df["market"] == "ladder"].copy()
    card_meta = ladder.drop_duplicates("card_name").set_index("card_name")

    enriched_deck = []
    for name in best["deck"]:
        if name in card_meta.index:
            row = card_meta.loc[name]
            enriched_deck.append({
                "card_name": name,
                "win_rate": round(float(row.get("win_rate", 0.5)), 4),
                "elixir": int(row.get("elixir", 4)),
                "rarity": str(row.get("rarity", "common")),
                "mps_z": round(float(row.get("mps_z", 0)), 4),
                "esr": round(float(row.get("esr", 0)), 4),
                "deck_beta": round(float(row.get("deck_beta", 1.0)), 4),
            })
        else:
            enriched_deck.append({
                "card_name": name,
                "win_rate": 0.5,
                "elixir": 4,
                "rarity": "common",
            })

    return {**best, "deck": enriched_deck}
