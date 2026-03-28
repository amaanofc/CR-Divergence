"""Unit tests for engine/survival.py."""
import sys
import os

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from engine.survival import compute_survival_curves


def test_survival_curves_returns_dict():
    result = compute_survival_curves()
    assert isinstance(result, dict)


def test_survival_result_has_expected_keys():
    result = compute_survival_curves()
    # Either returns warning or full result
    if "warning" in result and result["warning"]:
        pytest.skip("Insufficient data for survival analysis")
    assert "km_curves" in result


def test_km_curves_is_list():
    result = compute_survival_curves()
    if result.get("warning"):
        pytest.skip("Insufficient data")
    assert isinstance(result["km_curves"], list)


def test_km_curves_have_rarity_and_curve():
    result = compute_survival_curves()
    if result.get("warning"):
        pytest.skip("Insufficient data")
    for item in result["km_curves"]:
        assert "rarity" in item
        assert "curve" in item


def test_km_curve_at_least_one_point():
    result = compute_survival_curves()
    if result.get("warning"):
        pytest.skip("Insufficient data")
    for item in result["km_curves"]:
        assert len(item["curve"]) >= 1


def test_km_curve_monotone():
    result = compute_survival_curves()
    if result.get("warning"):
        pytest.skip("Insufficient data")
    for item in result["km_curves"]:
        probs = [p["survival_probability"] for p in item["curve"]]
        for i in range(len(probs) - 1):
            assert probs[i] >= probs[i + 1] - 1e-9, f"Non-monotone in {item['rarity']}"


def test_insufficient_buff_events_returns_warning(tmp_path, monkeypatch):
    """If patch_history has < 5 buff events, return warning."""
    import pandas as pd
    from engine import survival as surv_module

    # Create a tiny patch history with only 2 buffs
    tiny_csv = tmp_path / "patch_history.csv"
    tiny_csv.write_text(
        "date,card_name,change_type,stat_changed,magnitude\n"
        "2024-01-01,Hog Rider,buff,damage,+0.05\n"
        "2024-02-01,Goblin Barrel,nerf,damage,-0.05\n"
    )
    monkeypatch.setattr(surv_module, "DATA_DIR", str(tmp_path))
    result = surv_module.compute_survival_curves()
    assert result.get("warning") is not None
