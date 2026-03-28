"""Unit tests for engine/metrics.py."""
import sys
import os

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from engine.metrics import compute_all_metrics, build_card_history, compute_deck_ca


def test_compute_all_metrics_returns_dataframe():
    df = compute_all_metrics()
    assert isinstance(df, pd.DataFrame)
    assert len(df) > 0


def test_compute_all_metrics_required_columns():
    df = compute_all_metrics()
    required = ["card_name", "win_rate", "usage_rate", "market", "mps_z", "esr",
                "meta_momentum", "deck_beta", "clash_alpha"]
    for col in required:
        assert col in df.columns, f"Missing column: {col}"


def test_mps_z_mean_near_zero_per_market():
    df = compute_all_metrics()
    for market, group in df.groupby("market"):
        if len(group) >= 3 and group["mps_z"].std() > 1e-10:
            assert abs(group["mps_z"].mean()) < 1e-6, f"Market {market}: mean mps_z not ~0"


def test_win_rate_values_in_valid_range():
    df = compute_all_metrics()
    assert df["win_rate"].between(0, 1).all()
    assert df["usage_rate"].between(0, 1).all()


def test_win_rate_vol_never_below_minimum():
    df = compute_all_metrics()
    assert (df["win_rate_vol"] >= 0.01).all()


def test_deck_beta_valid_values():
    df = compute_all_metrics()
    valid = {0.75, 0.85, 0.9, 1.0, 1.2}
    for val in df["deck_beta"].unique():
        assert round(val, 4) in {round(v, 4) for v in valid}, f"Unexpected deck_beta: {val}"


def test_mps_z_few_cards_market_sets_zero():
    """If a market has < 3 cards, mps_z should be 0.0."""
    # Build a tiny market with 2 cards
    df = pd.DataFrame({
        "card_name": ["A", "B"],
        "win_rate": [0.5, 0.55],
        "usage_rate": [0.1, 0.2],
        "market": ["tiny"] * 2,
        "elixir": [3.0, 4.0],
        "rarity": ["rare", "common"],
        "type": ["Troop", "Troop"],
    })
    from engine.metrics import _compute_mps
    result = _compute_mps(df)
    assert (result[result["market"] == "tiny"]["mps_z"] == 0.0).all()


def test_compute_deck_ca_raises_for_wrong_size():
    df = compute_all_metrics()
    cards = [{"card_name": "X", "mps_z": 0.5, "deck_beta": 0.9}] * 5
    with pytest.raises(ValueError, match="Deck must contain exactly 8 cards"):
        compute_deck_ca(cards, df)


def test_compute_deck_ca_valid_deck():
    df = compute_all_metrics()
    ladder = df[df["market"] == "ladder"].head(8)
    cards = ladder[["card_name", "mps_z", "deck_beta"]].to_dict(orient="records")
    ca = compute_deck_ca(cards, df)
    assert isinstance(ca, float)


def test_build_card_history_structure():
    df = compute_all_metrics()
    card_name = df["card_name"].iloc[0]
    result = build_card_history(card_name, df)
    assert "card_name" in result
    assert "time_series" in result
    assert "patch_events" in result
    assert len(result["time_series"]) > 0
    for point in result["time_series"]:
        assert "date" in point
        assert "win_rate" in point
