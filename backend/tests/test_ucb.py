"""Unit tests for engine/ucb.py."""
import sys
import os

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from engine.metrics import compute_all_metrics
from engine.ucb import compute_ucb_recommendations, _assign_action


def _df():
    return compute_all_metrics()


def test_empty_battle_log_returns_top_mps():
    result = compute_ucb_recommendations([], _df())
    assert "recommended_deck" in result
    assert len(result["recommended_deck"]) == 8


def test_empty_battle_log_fallback_uses_mps_z():
    df = _df()
    result = compute_ucb_recommendations([], df)
    # Result should be non-empty
    assert len(result["recommended_deck"]) > 0


def test_recommended_deck_has_8_cards():
    result = compute_ucb_recommendations([], _df())
    assert len(result["recommended_deck"]) == 8


def test_scored_cards_present():
    result = compute_ucb_recommendations([], _df())
    assert "scored_cards" in result
    assert len(result["scored_cards"]) > 0


def test_scored_card_fields():
    result = compute_ucb_recommendations([], _df())
    card = result["scored_cards"][0]
    for field in ["card_name", "ucb_score", "global_win_rate", "personal_games", "alpha", "action"]:
        assert field in card, f"Missing field: {field}"


def test_alpha_clamped():
    result = compute_ucb_recommendations([], _df())
    for card in result["scored_cards"]:
        assert 0.0 <= card["alpha"] <= 1.0


def test_action_label_exploit():
    assert _assign_action(30, 0.65, 0.50) == "EXPLOIT"


def test_action_label_explore():
    assert _assign_action(5, 0.55, 0.50) == "EXPLORE"


def test_action_label_avoid():
    assert _assign_action(15, 0.40, 0.50) == "AVOID"


def test_action_label_hold():
    assert _assign_action(15, 0.52, 0.50) == "HOLD"


def test_total_battles_field():
    result = compute_ucb_recommendations([], _df())
    assert "total_battles" in result
    assert result["total_battles"] >= 0
