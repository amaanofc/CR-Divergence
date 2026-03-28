"""
Metrics engine for Clash Markets.
Computes all six invented statistics: MPS, ESR, MM, Deck Beta, ADR, Clash Alpha.
"""
import json
import logging
import os
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

RARITY_BETA = {
    "legendary": 1.2,
    "epic": 1.0,
    "rare": 0.85,
    "common": 0.75,
}


def compute_all_metrics() -> pd.DataFrame:
    """
    Load market CSVs, merge card metadata, and compute all six statistics.

    Returns:
        Merged DataFrame with columns:
        card_name, win_rate, usage_rate, market, elixir, rarity, type,
        mps, mps_z, win_rate_vol, esr, meta_momentum, deck_beta, clash_alpha
    """
    # --- Load market CSVs ---
    markets = {
        "ladder": "cards_ladder.csv",
        "gc": "cards_gc.csv",
        "top200": "cards_top200.csv",
    }

    dfs = []
    for market_name, filename in markets.items():
        filepath = os.path.join(DATA_DIR, filename)
        try:
            df = pd.read_csv(filepath)
            df["market"] = market_name
            dfs.append(df)
        except FileNotFoundError:
            logger.warning(f"Market CSV not found: {filepath}. Skipping.")

    if not dfs:
        raise RuntimeError("No market CSV files found. Run the scraper first.")

    combined = pd.concat(dfs, ignore_index=True)

    # --- Load and merge cards_meta.json ---
    meta_path = os.path.join(DATA_DIR, "cards_meta.json")
    try:
        with open(meta_path, "r") as f:
            meta_list = json.load(f)
        meta_df = pd.DataFrame(meta_list)
        # Normalise column names
        meta_df = meta_df.rename(columns={"name": "card_name"})
        meta_df["rarity"] = meta_df["rarity"].str.lower()
        meta_df["type"] = meta_df["type"].str.lower()
        meta_df = meta_df[["card_name", "elixir", "rarity", "type"]].drop_duplicates("card_name")
    except (FileNotFoundError, KeyError) as e:
        logger.warning(f"Could not load cards_meta.json: {e}. Using defaults.")
        meta_df = pd.DataFrame(columns=["card_name", "elixir", "rarity", "type"])

    combined = combined.merge(meta_df, on="card_name", how="left")

    # Fill missing metadata
    unmatched = combined["elixir"].isna()
    if unmatched.any():
        missing_cards = combined.loc[unmatched, "card_name"].unique()
        for card in missing_cards:
            logger.warning(f"Card '{card}' not found in cards_meta.json. Assigning elixir=4.0")
        combined.loc[unmatched, "elixir"] = 4.0

    combined["rarity"] = combined["rarity"].fillna("common")
    combined["type"] = combined["type"].fillna("troop")

    # --- Compute MPS (Mispricing Score) ---
    combined = _compute_mps(combined)

    # --- Compute ESR (Elixir Sharpe Ratio) ---
    combined = _compute_esr(combined)

    # --- Compute Meta Momentum ---
    combined = _compute_meta_momentum(combined)

    # --- Compute Deck Beta ---
    combined["deck_beta"] = combined["rarity"].apply(_assign_deck_beta)

    # --- Compute per-card Clash Alpha signal ---
    combined["clash_alpha"] = combined["mps_z"] - (combined["deck_beta"] * 0.5)

    return combined.reset_index(drop=True)


def _compute_mps(df: pd.DataFrame) -> pd.DataFrame:
    """Compute MPS z-scores per market group."""
    df = df.copy()
    df["mps"] = 0.0
    df["mps_z"] = 0.0

    for market, group in df.groupby("market"):
        idx = group.index
        if len(group) < 3:
            logger.warning(
                f"Market '{market}' has fewer than 3 cards. Setting mps_z=0.0."
            )
            df.loc[idx, "mps_z"] = 0.0
            continue

        X = group["usage_rate"].values.reshape(-1, 1)
        y = group["win_rate"].values

        reg = LinearRegression()
        reg.fit(X, y)
        predicted = reg.predict(X)
        residuals = y - predicted

        df.loc[idx, "mps"] = residuals

        std = residuals.std()
        if std < 1e-12:
            df.loc[idx, "mps_z"] = 0.0
        else:
            df.loc[idx, "mps_z"] = (residuals - residuals.mean()) / std

    return df


def _compute_esr(df: pd.DataFrame) -> pd.DataFrame:
    """Compute Elixir Sharpe Ratio."""
    df = df.copy()

    # win_rate_vol: std of win_rate across markets per card
    vol_series = df.groupby("card_name")["win_rate"].transform("std").fillna(0.0)
    vol_series = vol_series.clip(lower=0.01)
    df["win_rate_vol"] = vol_series

    # Handle elixir = 0
    elixir_for_esr = df["elixir"].copy()
    zero_elixir = elixir_for_esr == 0
    if zero_elixir.any():
        cards = df.loc[zero_elixir, "card_name"].unique()
        for card in cards:
            logger.warning(f"Card '{card}' has elixir=0. Treating as elixir=1 for ESR.")
        elixir_for_esr = elixir_for_esr.replace(0, 1)

    df["esr"] = ((df["win_rate"] - 0.50) / df["win_rate_vol"]) * (1.0 / elixir_for_esr)
    return df


def _compute_meta_momentum(df: pd.DataFrame) -> pd.DataFrame:
    """Compute Meta Momentum: (usage_gc - usage_ladder) / (usage_ladder + 0.001)."""
    df = df.copy()

    ladder = df[df["market"] == "ladder"][["card_name", "usage_rate"]].rename(
        columns={"usage_rate": "usage_ladder"}
    )
    gc = df[df["market"] == "gc"][["card_name", "usage_rate"]].rename(
        columns={"usage_rate": "usage_gc"}
    )

    mm_df = ladder.merge(gc, on="card_name", how="left")
    mm_df["usage_gc"] = mm_df["usage_gc"].fillna(0.0)
    mm_df["meta_momentum"] = (mm_df["usage_gc"] - mm_df["usage_ladder"]) / (
        mm_df["usage_ladder"] + 0.001
    )

    df = df.merge(mm_df[["card_name", "meta_momentum"]], on="card_name", how="left")
    df["meta_momentum"] = df["meta_momentum"].fillna(0.0)
    return df


def _assign_deck_beta(rarity: str) -> float:
    """Map rarity string to deck beta value."""
    if isinstance(rarity, str):
        return RARITY_BETA.get(rarity.lower(), 0.9)
    return 0.9


def build_card_history(card_name: str, df: pd.DataFrame) -> dict:
    """
    Build a 180-day win-rate time series for a card using patch history.

    Uses card-name-seeded RNG for deterministic daily noise and sigmoid-smoothed
    patch transitions over 7 days to produce realistic-looking time series.

    Args:
        card_name: Name of the card
        df: Merged metrics DataFrame

    Returns:
        {card_name, time_series: [{date, win_rate}], patch_events: [...]}
    """
    patch_path = os.path.join(DATA_DIR, "patch_history.csv")
    try:
        patches = pd.read_csv(patch_path, parse_dates=["date"])
    except FileNotFoundError:
        patches = pd.DataFrame(columns=["date", "card_name", "change_type", "stat_changed", "magnitude"])

    card_patches = patches[patches["card_name"] == card_name].sort_values("date")

    # Get current win rate from ladder market
    card_rows = df[(df["card_name"] == card_name) & (df["market"] == "ladder")]
    if card_rows.empty:
        card_rows = df[df["card_name"] == card_name]

    current_win_rate = float(card_rows["win_rate"].iloc[0]) if not card_rows.empty else 0.50

    # Deterministic RNG seeded by card name
    seed = sum(ord(c) for c in card_name) * 31
    rng = np.random.RandomState(seed)

    today = datetime.now().date()
    start_date = today - timedelta(days=180)

    # Collect patch events within our window
    patch_events = []
    for _, row in card_patches.iterrows():
        patch_date = row["date"].date() if hasattr(row["date"], "date") else row["date"]
        if patch_date >= start_date:
            mag_raw = row["magnitude"]
            if pd.notna(mag_raw):
                mag = float(str(mag_raw).replace("+", ""))
            else:
                mag = 0.0
            patch_events.append({
                "date": str(patch_date),
                "change_type": row["change_type"],
                "stat_changed": row["stat_changed"],
                "magnitude": mag,
            })

    # Build base win rate curve walking FORWARD from day 0
    # First, compute win rate at start by walking backwards from current
    wr_start = current_win_rate
    sorted_patches_rev = sorted(patch_events, key=lambda x: x["date"], reverse=True)
    for pe in sorted_patches_rev:
        mag = abs(pe["magnitude"])
        if pe["change_type"] == "buff":
            wr_start -= mag  # undo the buff
        else:
            wr_start += mag  # undo the nerf

    # Now walk forward, applying patches with sigmoid smoothing
    dates = []
    base_wr = []
    wr = wr_start

    # Pre-index patches by date for fast lookup
    patch_by_date = {}
    for pe in patch_events:
        patch_by_date[pe["date"]] = pe

    # Track pending transitions: list of (target_shift, days_remaining, total_days)
    active_transitions = []

    for day_offset in range(181):
        date = start_date + timedelta(days=day_offset)
        date_str = str(date)
        dates.append(date_str)

        # Check for new patch on this day
        if date_str in patch_by_date:
            pe = patch_by_date[date_str]
            mag = abs(pe["magnitude"])
            shift = mag if pe["change_type"] == "buff" else -mag
            active_transitions.append({"shift": shift, "day": 0, "total": 7})

        # Apply sigmoid-smoothed transitions
        daily_shift = 0.0
        still_active = []
        for t in active_transitions:
            t["day"] += 1
            # Sigmoid: maps day/total from 0→1 through S-curve
            progress = t["day"] / t["total"]
            if progress >= 1.0:
                daily_shift += t["shift"]  # fully applied
            else:
                # Sigmoid interpolation
                sigmoid = 1.0 / (1.0 + np.exp(-12 * (progress - 0.5)))
                daily_shift += t["shift"] * sigmoid
                still_active.append(t)
        active_transitions = still_active

        wr_today = wr + daily_shift
        base_wr.append(wr_today)

        # Once a transition is fully done, absorb it into base wr
        if not still_active and active_transitions == []:
            wr = wr_today

    # Absorb any final remaining transitions
    if base_wr:
        wr = base_wr[-1]

    # Add daily Gaussian noise for realism
    noise = rng.normal(0, 0.005, len(base_wr))

    # Also add a slow drift component (random walk) for organic feel
    drift = rng.normal(0, 0.001, len(base_wr)).cumsum()
    # Mean-revert drift so it doesn't wander too far
    drift = drift - np.linspace(drift[0], drift[-1], len(drift)) * 0.5

    time_series = []
    for i, date_str in enumerate(dates):
        wr_final = base_wr[i] + noise[i] + drift[i]
        wr_final = max(0.30, min(0.70, wr_final))
        time_series.append({"date": date_str, "win_rate": round(wr_final, 4)})

    return {
        "card_name": card_name,
        "time_series": time_series,
        "patch_events": patch_events,
    }


def compute_deck_ca(
    cards: list[dict],
    df: pd.DataFrame,
    patch_history: pd.DataFrame | None = None,
) -> float:
    """
    Compute Clash Alpha for a deck of exactly 8 cards.

    Args:
        cards: List of 8 card dicts with at least card_name or mps_z, deck_beta
        df: Merged metrics DataFrame
        patch_history: Optional patch history DataFrame

    Returns:
        Clash Alpha score (float)

    Raises:
        ValueError: If deck does not contain exactly 8 cards
    """
    if len(cards) != 8:
        raise ValueError("Deck must contain exactly 8 cards")

    # Resolve mps_z and deck_beta for each card
    mps_z_values = []
    deck_beta_values = []

    for card in cards:
        card_name = card.get("card_name", card.get("name", ""))
        card_row = df[df["card_name"] == card_name]

        if not card_row.empty:
            mps_z = float(card_row["mps_z"].iloc[0])
            deck_beta = float(card_row["deck_beta"].iloc[0])
        else:
            mps_z = float(card.get("mps_z", 0.0))
            deck_beta = float(card.get("deck_beta", 0.9))

        mps_z_values.append(mps_z)
        deck_beta_values.append(deck_beta)

    # Compute meta_volatility from last 3 patch events
    meta_volatility = 0.05  # default
    if patch_history is not None and not patch_history.empty:
        recent = patch_history.sort_values("date").tail(3)
        if len(recent) >= 2:
            magnitudes = recent["magnitude"].apply(
                lambda x: float(str(x).replace("+", "")) if pd.notna(x) else 0.0
            )
            meta_volatility = float(magnitudes.std()) if magnitudes.std() > 0 else 0.05
    else:
        # Try loading from file
        patch_path = os.path.join(DATA_DIR, "patch_history.csv")
        try:
            ph = pd.read_csv(patch_path)
            if len(ph) >= 2:
                recent = ph.tail(3)
                magnitudes = recent["magnitude"].apply(
                    lambda x: float(str(x).replace("+", "")) if pd.notna(x) else 0.0
                )
                meta_volatility = float(magnitudes.std()) if magnitudes.std() > 0 else 0.05
        except FileNotFoundError:
            pass

    synergy_bonus = 0.0
    mean_deck_beta = np.mean(deck_beta_values)
    meta_risk_penalty = mean_deck_beta * meta_volatility

    # CA = mean(mps_z_i * centrality_i) + synergy_bonus - meta_risk_penalty
    # centrality_i = 1/8 for equal weighting
    ca = float(np.mean([mz * 0.125 for mz in mps_z_values])) + synergy_bonus - meta_risk_penalty

    return ca
