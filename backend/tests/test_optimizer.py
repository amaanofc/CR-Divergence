"""Unit tests for engine/optimizer.py."""
import sys
import os

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from engine.metrics import compute_all_metrics
from engine.optimizer import compute_frontier, compute_optimal_deck


def _df():
    return compute_all_metrics()


def test_frontier_returns_points():
    result = compute_frontier(_df(), elixir_budget=3.5)
    assert "frontier_points" in result
    assert len(result["frontier_points"]) > 0


def test_frontier_max_sharpe_deck_has_8_cards():
    result = compute_frontier(_df(), elixir_budget=3.5)
    deck = result["max_sharpe_deck"]["deck"]
    assert len(deck) == 8


def test_frontier_all_decks_have_8_cards():
    result = compute_frontier(_df(), elixir_budget=4.5)
    for point in result["frontier_points"]:
        assert len(point["deck"]) == 8, f"Deck has {len(point['deck'])} cards"


def test_max_sharpe_is_global_max():
    result = compute_frontier(_df(), elixir_budget=4.0)
    best = result["max_sharpe_deck"]["sharpe"]
    for point in result["frontier_points"]:
        assert point["sharpe"] <= best + 1e-6


def test_frontier_result_has_n_decks_sampled():
    result = compute_frontier(_df())
    assert "n_decks_sampled" in result
    assert result["n_decks_sampled"] > 0


def test_compute_optimal_deck_returns_dict():
    result = compute_optimal_deck(_df(), elixir_budget=3.5)
    assert "deck" in result
    assert len(result["deck"]) == 8


def test_frontier_deck_fields():
    result = compute_frontier(_df())
    if result["frontier_points"]:
        p = result["frontier_points"][0]
        for field in ["return", "risk", "sharpe", "clash_alpha", "deck", "avg_elixir"]:
            assert field in p, f"Missing field: {field}"
