"""API endpoint tests using FastAPI TestClient."""
import sys
import os

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Set a dummy env var so cr_api doesn't fail at import
os.environ.setdefault("CR_API_TOKEN", "test-token")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")

from fastapi.testclient import TestClient
from main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def test_cards_endpoint_returns_200(client):
    resp = client.get("/api/cards")
    assert resp.status_code == 200


def test_cards_returns_list(client):
    resp = client.get("/api/cards")
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0


def test_cards_ladder_filter(client):
    resp = client.get("/api/cards?market=ladder")
    data = resp.json()
    assert all(c["market"] == "ladder" for c in data)


def test_cards_gc_filter(client):
    resp = client.get("/api/cards?market=gc")
    data = resp.json()
    assert all(c["market"] == "gc" for c in data)


def test_card_history_endpoint(client):
    cards = client.get("/api/cards?market=ladder").json()
    if not cards:
        pytest.skip("No cards available")
    card_name = cards[0]["card_name"]
    resp = client.get(f"/api/cards/{card_name}/history")
    assert resp.status_code == 200
    data = resp.json()
    assert "card_name" in data
    assert "time_series" in data
    assert "patch_events" in data


def test_frontier_endpoint(client):
    resp = client.get("/api/frontier")
    assert resp.status_code == 200
    data = resp.json()
    assert "frontier_points" in data
    assert "max_sharpe_deck" in data


def test_frontier_with_budget(client):
    resp = client.get("/api/frontier?budget=4.0")
    assert resp.status_code == 200


def test_optimize_endpoint(client):
    resp = client.get("/api/optimize")
    assert resp.status_code == 200
    data = resp.json()
    assert "deck" in data
    assert len(data["deck"]) == 8


def test_ucb_endpoint_no_tag(client):
    resp = client.get("/api/ucb")
    assert resp.status_code == 200
    data = resp.json()
    assert "recommendations" in data or "recommended_deck" in data


def test_survival_endpoint(client):
    resp = client.get("/api/survival")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)


def test_backtest_endpoint(client):
    resp = client.get("/api/backtest")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)


def test_cross_market_endpoint(client):
    resp = client.get("/api/cross-market")
    assert resp.status_code == 200
    data = resp.json()
    assert "markets" in data
    assert "arbitrage_cards" in data


def test_analyst_endpoint_fallback(client):
    """Without real API key, analyst should return fallback message."""
    resp = client.post("/api/analyst", json={"query": "test"})
    assert resp.status_code == 200
    data = resp.json()
    assert "report" in data


def test_cards_records_have_required_fields(client):
    resp = client.get("/api/cards?market=ladder")
    data = resp.json()
    if data:
        card = data[0]
        for field in ["card_name", "win_rate", "usage_rate", "mps_z"]:
            assert field in card, f"Missing field: {field}"


def test_numeric_values_rounded_to_4dp(client):
    resp = client.get("/api/cards?market=ladder")
    data = resp.json()
    for card in data[:5]:
        for field in ["win_rate", "usage_rate", "mps_z", "esr"]:
            if field in card and card[field] is not None:
                val = card[field]
                assert abs(val - round(val, 4)) < 1e-9, f"{field} not rounded to 4dp: {val}"


# --- New endpoint tests ---

def test_market_summary_endpoint(client):
    resp = client.get("/api/market-summary")
    assert resp.status_code == 200
    data = resp.json()
    assert "meta_regime" in data
    assert "top_alpha_card" in data
    assert "total_cards" in data
    assert data["total_cards"] == 120


def test_profile_demo_endpoint(client):
    resp = client.get("/api/profile/demo")
    assert resp.status_code == 200
    data = resp.json()
    assert "clash_alpha" in data
    assert "current_deck" in data
    assert len(data["current_deck"]) == 8


def test_rebalance_demo_endpoint(client):
    resp = client.get("/api/rebalance/demo")
    assert resp.status_code == 200
    data = resp.json()
    assert "suggestions" in data
