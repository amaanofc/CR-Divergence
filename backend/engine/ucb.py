"""
UCB (Upper Confidence Bound) engine for Clash Markets.
Implements multi-armed bandit algorithm for personalised deck recommendations.
"""
import logging
import math

import pandas as pd

logger = logging.getLogger(__name__)


def compute_ucb_recommendations(
    battle_log: list,
    df: pd.DataFrame,
    c: float = 1.4,
) -> dict:
    """
    Compute UCB-based card recommendations from a player's battle log.

    Args:
        battle_log: List of battle objects from the CR API
        df: Merged metrics DataFrame from compute_all_metrics()
        c: Exploration constant (default 1.4)

    Returns:
        {
            recommended_deck: [card_name, ...],  # top 8 by UCB score
            scored_cards: [{card_name, ucb_score, personal_win_rate,
                            global_win_rate, personal_games, alpha, action}],
            total_battles: int
        }
    """
    # Get global win rates from Ladder market
    ladder = df[df["market"] == "ladder"].copy()
    global_wr_map = dict(zip(ladder["card_name"], ladder["win_rate"]))
    global_mps_map = dict(zip(ladder["card_name"], ladder["mps_z"]))

    # Handle empty battle log
    if not battle_log:
        logger.info("Empty battle log. Falling back to top 8 by global mps_z.")
        return _fallback_top_mps(df)

    # Parse battle log
    personal_wins = {}
    personal_games = {}

    for battle in battle_log:
        try:
            team = battle.get("team", [])
            if not team:
                continue

            player_data = team[0]
            cards = player_data.get("cards", [])
            card_names = [_normalise_card_name(c.get("name", "")) for c in cards]

            # Determine win/loss via crown comparison
            player_crowns = player_data.get("crowns", 0)
            opponent_data = battle.get("opponent", [{}])[0] if battle.get("opponent") else {}
            opponent_crowns = opponent_data.get("crowns", 0)
            won = player_crowns > opponent_crowns

            for card_name in card_names:
                if not card_name:
                    continue
                personal_games[card_name] = personal_games.get(card_name, 0) + 1
                if won:
                    personal_wins[card_name] = personal_wins.get(card_name, 0) + 1

        except (KeyError, IndexError, TypeError) as e:
            logger.debug(f"Error parsing battle: {e}")
            continue

    T = len(battle_log)

    # Score all cards in the global dataset
    all_card_names = list(global_wr_map.keys())
    scored_cards = []

    for card_name in all_card_names:
        n_i = personal_games.get(card_name, 0)
        wins_i = personal_wins.get(card_name, 0)
        global_wr = global_wr_map.get(card_name, 0.50)

        # Personal win rate
        if n_i > 0:
            personal_wr = wins_i / n_i
        else:
            personal_wr = 0.50

        # Alpha (confidence weight)
        alpha = min(1.0, n_i / 30)

        # UCB score
        if n_i > 0:
            exploration = c * math.sqrt(math.log(T) / n_i) if T > 0 else 0.0
        else:
            exploration = c * math.sqrt(math.log(T + 1)) if T >= 0 else 0.0

        ucb_score = alpha * personal_wr + (1 - alpha) * global_wr + exploration

        # Action label
        action = _assign_action(n_i, personal_wr, global_wr)

        scored_cards.append({
            "card_name": card_name,
            "ucb_score": round(ucb_score, 4),
            "personal_win_rate": round(personal_wr, 4),
            "global_win_rate": round(global_wr, 4),
            "personal_games": n_i,
            "alpha": round(alpha, 4),
            "action": action,
        })

    # Sort by UCB score descending
    scored_cards.sort(key=lambda x: x["ucb_score"], reverse=True)
    recommended_deck = [c["card_name"] for c in scored_cards[:8]]

    return {
        "recommended_deck": recommended_deck,
        "scored_cards": scored_cards,
        "total_battles": T,
    }


def _assign_action(n_i: int, personal_wr: float, global_wr: float) -> str:
    """Assign UCB action label based on card statistics."""
    if n_i >= 30 and personal_wr > global_wr:
        return "EXPLOIT"
    elif n_i < 10:
        return "EXPLORE"
    elif personal_wr < global_wr - 0.05:
        return "AVOID"
    else:
        return "HOLD"


def _normalise_card_name(name: str) -> str:
    """Normalise card name for matching against the metrics DataFrame."""
    return name.strip() if name else ""


def _fallback_top_mps(df: pd.DataFrame) -> dict:
    """Fall back to top 8 cards by global mps_z from Ladder market."""
    ladder = df[df["market"] == "ladder"].copy()
    top8 = ladder.nlargest(8, "mps_z")

    scored_cards = []
    for _, row in top8.iterrows():
        scored_cards.append({
            "card_name": row["card_name"],
            "ucb_score": round(float(row["mps_z"]), 4),
            "personal_win_rate": 0.50,
            "global_win_rate": round(float(row["win_rate"]), 4),
            "personal_games": 0,
            "alpha": 0.0,
            "action": "EXPLORE",
        })

    return {
        "recommended_deck": [c["card_name"] for c in scored_cards],
        "scored_cards": scored_cards,
        "total_battles": 0,
    }
