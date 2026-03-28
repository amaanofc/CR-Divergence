"""
Optimizer engine for Clash Markets.
Implements Markowitz mean-variance portfolio optimisation for deck construction.
"""
import logging
import random

import numpy as np
import pandas as pd

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


def compute_optimal_deck(df: pd.DataFrame, elixir_budget: float = 3.5) -> dict:
    """
    Return the maximum Sharpe ratio deck from the efficient frontier.

    Args:
        df: Merged metrics DataFrame
        elixir_budget: Maximum average elixir cost per card

    Returns:
        The max_sharpe_deck point from compute_frontier
    """
    result = compute_frontier(df, elixir_budget=elixir_budget)
    return result["max_sharpe_deck"]
