"""
Backtest engine for Clash Markets.
Simulates three quantitative strategies against historical patch data.
"""
import logging
import math
import os
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def _load_patch_history() -> pd.DataFrame:
    path = os.path.join(DATA_DIR, "patch_history.csv")
    df = pd.read_csv(path)
    df["date"] = pd.to_datetime(df["date"])
    df["magnitude"] = df["magnitude"].astype(str).str.replace("+", "", regex=False).astype(float)
    return df.sort_values("date").reset_index(drop=True)


def _compute_equity_metrics(equity_curve: list) -> dict:
    """Compute Sharpe, max drawdown, total excess win rate, CA trajectory."""
    wrs = [p["cumulative_win_rate"] for p in equity_curve]
    if not wrs:
        return {"sharpe": 0.0, "max_drawdown": 0.0, "total_excess_win_rate": 0.0, "ca_trajectory": []}

    excess = [w - 0.5 for w in wrs]
    mean_excess = float(np.mean(excess))
    std_excess = float(np.std(excess))
    sharpe = mean_excess / std_excess if std_excess > 0 else 0.0

    # Max drawdown: largest peak-to-trough decline in cumulative win rate
    peak = wrs[0]
    max_dd = 0.0
    for w in wrs:
        if w > peak:
            peak = w
        dd = (peak - w) / peak if peak > 0 else 0.0
        if dd > max_dd:
            max_dd = dd

    total_excess = float(sum(excess))
    # CA trajectory: simple proxy — mps_z proxy from win_rate excess
    ca_trajectory = [round(e * 2, 4) for e in excess]

    return {
        "sharpe": round(sharpe, 4),
        "max_drawdown": round(max_dd, 4),
        "total_excess_win_rate": round(total_excess, 4),
        "ca_trajectory": ca_trajectory,
    }


def _get_ladder_cards(df: pd.DataFrame) -> pd.DataFrame:
    """Return ladder market cards with required columns."""
    ladder = df[df["market"] == "ladder"].copy()
    for col in ["mps_z", "deck_beta", "win_rate", "elixir"]:
        if col not in ladder.columns:
            ladder[col] = 0.0
    return ladder


def _patch_momentum_strategy(df: pd.DataFrame, patch_df: pd.DataFrame) -> dict:
    """
    After each patch event, select 3 cards with largest positive magnitude
    then fill remaining 5 slots with highest-MPS cards.
    Track cumulative win rate over 14 days post-patch.
    """
    ladder = _get_ladder_cards(df)
    card_wr = dict(zip(ladder["card_name"], ladder["win_rate"]))
    card_mps = dict(zip(ladder["card_name"], ladder["mps_z"]))

    buffs = patch_df[patch_df["magnitude"] > 0].copy()
    equity_curve = []
    cumulative_wr = 0.5

    for event_date in sorted(patch_df["date"].unique()):
        # Cards buffed in this patch
        patch_buffs = buffs[buffs["date"] == event_date].nlargest(3, "magnitude")
        buffed_cards = patch_buffs["card_name"].tolist()

        # Filter to cards actually in ladder data
        buffed_cards = [c for c in buffed_cards if c in card_wr]

        # Fill remaining 5 slots with highest MPS cards not already selected
        remaining = sorted(
            [(name, mps) for name, mps in card_mps.items() if name not in buffed_cards],
            key=lambda x: x[1],
            reverse=True,
        )
        fill_cards = [name for name, _ in remaining[: (8 - len(buffed_cards))]]
        deck = buffed_cards + fill_cards

        if not deck:
            continue

        # Deck win rate = mean of selected cards' win rates
        deck_wr = float(np.mean([card_wr.get(c, 0.5) for c in deck]))

        # Simulate 14-day window
        for day in range(14):
            point_date = event_date + timedelta(days=day)
            cumulative_wr = round(cumulative_wr * 0.95 + deck_wr * 0.05, 4)
            equity_curve.append({
                "date": point_date.strftime("%Y-%m-%d"),
                "cumulative_win_rate": round(cumulative_wr, 4),
            })

    return {"equity_curve": equity_curve, **_compute_equity_metrics(equity_curve)}


def _ucb_optimal_strategy(df: pd.DataFrame, patch_df: pd.DataFrame) -> dict:
    """
    Simulate UCB convergence over seasons.
    Season 1: alpha=0 (global only). Each season, alpha increases.
    """
    ladder = _get_ladder_cards(df)
    card_wr = dict(zip(ladder["card_name"], ladder["win_rate"]))
    card_mps = dict(zip(ladder["card_name"], ladder["mps_z"]))
    all_cards = ladder["card_name"].tolist()

    seasons = sorted(patch_df["date"].dt.to_period("M").unique())
    n_seasons = max(len(seasons), 1)
    equity_curve = []
    cumulative_wr = 0.5

    # Simulated personal games accumulate over seasons
    sim_games = {c: 0 for c in all_cards}
    sim_wins = {c: 0 for c in all_cards}

    for i, season in enumerate(seasons):
        alpha_base = min(1.0, i / n_seasons)
        T = max(1, i * 25)  # total simulated battles this season

        ucb_scores = {}
        for card in all_cards:
            n_i = sim_games[card]
            global_wr = card_wr.get(card, 0.5)
            personal_wr = (sim_wins[card] / n_i) if n_i > 0 else 0.5
            alpha = min(1.0, n_i / 30)
            exploration = 1.4 * math.sqrt(math.log(T + 1) / (n_i + 1))
            ucb_scores[card] = alpha_base * personal_wr + (1 - alpha_base) * global_wr + exploration

        top8 = sorted(ucb_scores, key=ucb_scores.get, reverse=True)[:8]
        deck_wr = float(np.mean([card_wr.get(c, 0.5) for c in top8]))

        # Update simulated personal data based on deck performance
        for card in top8:
            games_this_season = 3
            wins_this_season = round(games_this_season * deck_wr)
            sim_games[card] += games_this_season
            sim_wins[card] += wins_this_season

        # One point per month
        season_date = season.to_timestamp()
        cumulative_wr = round(cumulative_wr * 0.9 + deck_wr * 0.1, 4)
        equity_curve.append({
            "date": season_date.strftime("%Y-%m-%d"),
            "cumulative_win_rate": round(cumulative_wr, 4),
        })

    return {"equity_curve": equity_curve, **_compute_equity_metrics(equity_curve)}


def _contrarian_strategy(df: pd.DataFrame, patch_df: pd.DataFrame) -> dict:
    """
    After each nerf event, identify cards recovering from trough.
    Select top 8 by recovery magnitude; track win rate.
    """
    ladder = _get_ladder_cards(df)
    card_wr = dict(zip(ladder["card_name"], ladder["win_rate"]))

    nerfs = patch_df[patch_df["magnitude"] < 0].copy()
    nerfs["recovery"] = nerfs["magnitude"].abs()  # bigger nerf = more recovery potential

    equity_curve = []
    cumulative_wr = 0.5

    for event_date in sorted(patch_df["date"].unique()):
        # Cards that were nerfed (recovery candidates)
        patch_nerfs = nerfs[nerfs["date"] == event_date]
        if patch_nerfs.empty:
            continue

        # Sort by recovery magnitude
        recovery_cards = patch_nerfs.nlargest(8, "recovery")["card_name"].tolist()
        recovery_cards = [c for c in recovery_cards if c in card_wr]

        # Fill to 8 if needed
        if len(recovery_cards) < 8:
            remaining = [c for c in card_wr if c not in recovery_cards]
            recovery_cards += remaining[: (8 - len(recovery_cards))]

        deck = recovery_cards[:8]
        if not deck:
            continue

        # Contrarian assumption: nerfed cards recover slightly — apply small uplift
        deck_wr = float(np.mean([card_wr.get(c, 0.5) * 1.02 for c in deck]))
        deck_wr = min(deck_wr, 0.65)  # cap at realistic ceiling

        for day in range(14):
            point_date = event_date + timedelta(days=day)
            cumulative_wr = round(cumulative_wr * 0.95 + deck_wr * 0.05, 4)
            equity_curve.append({
                "date": point_date.strftime("%Y-%m-%d"),
                "cumulative_win_rate": round(cumulative_wr, 4),
            })

    return {"equity_curve": equity_curve, **_compute_equity_metrics(equity_curve)}


def _benchmark_curve(df: pd.DataFrame, patch_df: pd.DataFrame) -> list:
    """Average win rate of all ladder cards across the backtest period."""
    ladder = _get_ladder_cards(df)
    avg_wr = float(ladder["win_rate"].mean()) if not ladder.empty else 0.5

    dates = pd.date_range(
        start=patch_df["date"].min(),
        end=patch_df["date"].max(),
        freq="14D",
    )

    cumulative = 0.5
    curve = []
    for dt in dates:
        cumulative = round(cumulative * 0.9 + avg_wr * 0.1, 4)
        curve.append({
            "date": dt.strftime("%Y-%m-%d"),
            "cumulative_win_rate": round(cumulative, 4),
        })
    return curve


def run_all_strategies(df: pd.DataFrame) -> dict:
    """
    Execute all three backtest strategies and return results.

    Args:
        df: Merged metrics DataFrame from compute_all_metrics()

    Returns:
        {
            strategies: {
                patch_momentum: {equity_curve, sharpe, max_drawdown, total_excess_win_rate, ca_trajectory},
                ucb_optimal: {...},
                contrarian: {...},
            },
            benchmark: [{date, cumulative_win_rate}],
            warning: str | None
        }
    """
    try:
        patch_df = _load_patch_history()
    except FileNotFoundError:
        return {"warning": "patch_history.csv not found", "strategies": {}, "benchmark": []}

    if len(patch_df) < 5:
        logger.warning("Insufficient patch history for reliable backtesting")
        return {
            "warning": "Insufficient patch history for reliable backtesting",
            "strategies": {},
            "benchmark": [],
        }

    if len(patch_df) < 15:
        logger.warning("patch_history.csv has fewer than 15 rows; results may be unreliable")

    patch_momentum = _patch_momentum_strategy(df, patch_df)
    ucb_optimal = _ucb_optimal_strategy(df, patch_df)
    contrarian = _contrarian_strategy(df, patch_df)
    benchmark = _benchmark_curve(df, patch_df)

    return {
        "strategies": {
            "patch_momentum": patch_momentum,
            "ucb_optimal": ucb_optimal,
            "contrarian": contrarian,
        },
        "benchmark": benchmark,
        "warning": None,
    }
