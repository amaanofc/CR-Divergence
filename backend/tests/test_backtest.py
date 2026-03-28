"""Unit tests for engine/backtest.py."""
import sys
import os

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from engine.metrics import compute_all_metrics
from engine.backtest import run_all_strategies


def _df():
    return compute_all_metrics()


def test_run_all_strategies_returns_dict():
    result = run_all_strategies(_df())
    assert isinstance(result, dict)


def test_all_strategies_present():
    result = run_all_strategies(_df())
    if result.get("warning"):
        pytest.skip("Insufficient patch data")
    assert "strategies" in result
    for key in ["patch_momentum", "ucb_optimal", "contrarian"]:
        assert key in result["strategies"], f"Missing strategy: {key}"


def test_benchmark_present():
    result = run_all_strategies(_df())
    if result.get("warning"):
        pytest.skip("Insufficient patch data")
    assert "benchmark" in result
    assert len(result["benchmark"]) > 0


def test_equity_curves_non_empty():
    result = run_all_strategies(_df())
    if result.get("warning"):
        pytest.skip("Insufficient patch data")
    for key, strat in result["strategies"].items():
        assert len(strat["equity_curve"]) > 0, f"{key} equity_curve is empty"


def test_equity_curve_structure():
    result = run_all_strategies(_df())
    if result.get("warning"):
        pytest.skip("Insufficient patch data")
    for key, strat in result["strategies"].items():
        for point in strat["equity_curve"]:
            assert "date" in point
            assert "cumulative_win_rate" in point


def test_strategy_metrics_present():
    result = run_all_strategies(_df())
    if result.get("warning"):
        pytest.skip("Insufficient patch data")
    for key, strat in result["strategies"].items():
        assert "sharpe" in strat
        assert "max_drawdown" in strat
        assert "total_excess_win_rate" in strat
        assert "ca_trajectory" in strat


def test_warning_when_insufficient_patch_history(tmp_path, monkeypatch):
    """Return warning when < 5 patch events."""
    import pandas as pd
    from engine import backtest as bt_module

    tiny_csv = tmp_path / "patch_history.csv"
    tiny_csv.write_text(
        "date,card_name,change_type,stat_changed,magnitude\n"
        "2024-01-01,Hog Rider,buff,damage,+0.05\n"
        "2024-02-01,Goblin Barrel,nerf,damage,-0.05\n"
    )
    monkeypatch.setattr(bt_module, "DATA_DIR", str(tmp_path))
    result = bt_module.run_all_strategies(_df())
    assert result.get("warning") is not None
