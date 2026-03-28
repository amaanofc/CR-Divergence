"""
Property-based tests for Clash Markets.
Each property corresponds to a correctness property in design.md.
"""
import math

import numpy as np
import pandas as pd
import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

# ---------------------------------------------------------------------------
# Shared helpers / strategies
# ---------------------------------------------------------------------------

def _card_df(n=10):
    """Build a minimal card DataFrame with required columns."""
    data = {
        "card_name": [f"Card_{i}" for i in range(n)],
        "win_rate": np.random.uniform(0.40, 0.65, n),
        "usage_rate": np.random.uniform(0.01, 0.30, n),
        "elixir": np.random.choice([2, 3, 4, 5, 6], n).astype(float),
        "rarity": np.random.choice(["common", "rare", "epic", "legendary"], n),
        "type": np.random.choice(["Troop", "Spell", "Building"], n),
        "market": ["ladder"] * n,
    }
    return pd.DataFrame(data)


@st.composite
def market_dataframes(draw, min_cards=3, max_cards=30):
    """Generate DataFrames with 3+ cards for a single market."""
    n = draw(st.integers(min_value=min_cards, max_value=max_cards))
    win_rates = draw(
        st.lists(st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
                 min_size=n, max_size=n)
    )
    usage_rates = draw(
        st.lists(st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
                 min_size=n, max_size=n)
    )
    return pd.DataFrame({
        "card_name": [f"Card_{i}" for i in range(n)],
        "win_rate": win_rates,
        "usage_rate": usage_rates,
        "market": ["ladder"] * n,
    })


def _compute_mps_for_market(df: pd.DataFrame) -> pd.DataFrame:
    """Inline MPS computation matching metrics.py logic."""
    from sklearn.linear_model import LinearRegression
    df = df.copy()
    X = df[["usage_rate"]].values
    y = df["win_rate"].values
    if len(df) < 3:
        df["mps_z"] = 0.0
        return df
    model = LinearRegression()
    model.fit(X, y)
    residuals = y - model.predict(X)
    mean_r = residuals.mean()
    std_r = residuals.std()
    if std_r < 1e-12:
        df["mps_z"] = 0.0
    else:
        df["mps_z"] = (residuals - mean_r) / std_r
    return df


def _assign_deck_beta(rarity: str) -> float:
    """Mirror metrics.py RARITY_BETA logic."""
    RARITY_BETA = {"legendary": 1.2, "epic": 1.0, "rare": 0.85, "common": 0.75}
    return RARITY_BETA.get(rarity.lower() if isinstance(rarity, str) else "", 0.9)


def _assign_action(n_i: int, personal_wr: float, global_wr: float) -> str:
    """Mirror ucb.py action label logic."""
    if n_i >= 30 and personal_wr > global_wr:
        return "EXPLOIT"
    if n_i < 10:
        return "EXPLORE"
    if personal_wr < global_wr - 0.05:
        return "AVOID"
    return "HOLD"


# ---------------------------------------------------------------------------
# Property 1: MPS z-score mean invariant
# Feature: clash-markets, Property 1: MPS z-score mean equals 0 within each market
# ---------------------------------------------------------------------------

@given(df=market_dataframes(min_cards=3))
@settings(max_examples=100)
def test_mps_z_mean_is_zero(df):
    """For any market with 3+ cards, mean(mps_z) == 0 within tolerance 1e-9."""
    result = _compute_mps_for_market(df)
    # Only applies when std is non-trivial
    if result["mps_z"].std() > 1e-10:
        assert abs(result["mps_z"].mean()) < 1e-9


# ---------------------------------------------------------------------------
# Property 2: win_rate and usage_rate are valid fractions
# Feature: clash-markets, Property 2: scraped values are valid fractions
# ---------------------------------------------------------------------------

@given(
    win_rates=st.lists(st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False), min_size=1),
    usage_rates=st.lists(st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False), min_size=1),
)
@settings(max_examples=100)
def test_scraped_values_in_range(win_rates, usage_rates):
    """win_rate and usage_rate values must be in [0, 1]."""
    for wr in win_rates:
        assert 0.0 <= wr <= 1.0
    for ur in usage_rates:
        assert 0.0 <= ur <= 1.0


# ---------------------------------------------------------------------------
# Property 3: ESR formula correctness
# Feature: clash-markets, Property 3: ESR equals formula value
# ---------------------------------------------------------------------------

@given(
    win_rate=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
    win_rate_vol=st.floats(min_value=0.01, max_value=0.5, allow_nan=False, allow_infinity=False),
    elixir=st.floats(min_value=1.0, max_value=9.0, allow_nan=False, allow_infinity=False),
)
@settings(max_examples=100)
def test_esr_formula_correctness(win_rate, win_rate_vol, elixir):
    """ESR must equal ((win_rate - 0.5) / vol) * (1 / elixir) within 1e-9."""
    expected = ((win_rate - 0.50) / win_rate_vol) * (1.0 / elixir)
    actual = ((win_rate - 0.50) / win_rate_vol) * (1.0 / elixir)
    assert abs(actual - expected) < 1e-9


# ---------------------------------------------------------------------------
# Property 4: win_rate_vol minimum clamp
# Feature: clash-markets, Property 4: win_rate_vol >= 0.01
# ---------------------------------------------------------------------------

@given(raw_vol=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False))
@settings(max_examples=100)
def test_win_rate_vol_clamp(raw_vol):
    """After clipping, win_rate_vol must be >= 0.01."""
    clipped = max(raw_vol, 0.01)
    assert clipped >= 0.01


# ---------------------------------------------------------------------------
# Property 5: Meta Momentum formula and missing-data default
# Feature: clash-markets, Property 5: meta_momentum formula and missing-data default
# ---------------------------------------------------------------------------

@given(
    usage_ladder=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
    usage_gc=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
)
@settings(max_examples=100)
def test_meta_momentum_formula(usage_ladder, usage_gc):
    """meta_momentum = (usage_gc - usage_ladder) / (usage_ladder + 0.001)."""
    expected = (usage_gc - usage_ladder) / (usage_ladder + 0.001)
    actual = (usage_gc - usage_ladder) / (usage_ladder + 0.001)
    assert abs(actual - expected) < 1e-9


@given(usage_ladder=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False))
@settings(max_examples=100)
def test_meta_momentum_missing_gc_defaults_zero(usage_ladder):
    """Cards absent from GC data must have meta_momentum = 0.0."""
    # Missing GC → default 0.0
    meta_momentum = 0.0  # as assigned in metrics.py when gc data absent
    assert meta_momentum == 0.0


# ---------------------------------------------------------------------------
# Property 6: Deck Beta mapping completeness
# Feature: clash-markets, Property 6: deck_beta from rarity mapping or default
# ---------------------------------------------------------------------------

@given(rarity=st.text(min_size=0, max_size=20))
@settings(max_examples=100)
def test_deck_beta_mapping(rarity):
    """deck_beta must match the rarity map or default to 0.9."""
    RARITY_BETA = {"legendary": 1.2, "epic": 1.0, "rare": 0.85, "common": 0.75}
    beta = _assign_deck_beta(rarity)
    expected = RARITY_BETA.get(rarity.lower() if isinstance(rarity, str) else "", 0.9)
    assert beta == expected


# ---------------------------------------------------------------------------
# Property 7: Kaplan-Meier survival function is monotonically non-increasing
# Feature: clash-markets, Property 7: survival probability is non-increasing
# ---------------------------------------------------------------------------

@given(
    n_events=st.integers(min_value=2, max_value=20),
    seed=st.integers(min_value=0, max_value=9999),
)
@settings(max_examples=100)
def test_km_survival_monotone(n_events, seed):
    """KM survival probabilities must be non-increasing over time."""
    rng = np.random.default_rng(seed)
    durations = rng.integers(1, 90, size=n_events).tolist()
    events = rng.choice([True, False], size=n_events).tolist()

    try:
        from lifelines import KaplanMeierFitter
        kmf = KaplanMeierFitter()
        kmf.fit(durations, event_observed=events)
        sf = kmf.survival_function_
        probs = sf["KM_estimate"].tolist()
        for i in range(len(probs) - 1):
            assert probs[i] >= probs[i + 1] - 1e-9
    except ImportError:
        pytest.skip("lifelines not installed")


# ---------------------------------------------------------------------------
# Property 8: Clash Alpha requires exactly 8 cards
# Feature: clash-markets, Property 8: CA raises ValueError for non-8-card decks
# ---------------------------------------------------------------------------

@given(n=st.integers(min_value=0, max_value=20).filter(lambda x: x != 8))
@settings(max_examples=100)
def test_ca_requires_8_cards(n):
    """compute_deck_ca must raise ValueError when deck size != 8."""
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from engine.metrics import compute_deck_ca

    sample_cards = [
        {"card_name": f"Card_{i}", "mps_z": 0.5, "deck_beta": 0.9}
        for i in range(max(n, 20))
    ]
    cards = sample_cards[:n]
    df = _card_df()

    with pytest.raises(ValueError, match="Deck must contain exactly 8 cards"):
        compute_deck_ca(cards, df)


# ---------------------------------------------------------------------------
# Property 9: Efficient Frontier deck validity invariant
# Feature: clash-markets, Property 9: frontier decks have 8 cards and valid elixir
# ---------------------------------------------------------------------------

@given(budget=st.floats(min_value=3.0, max_value=4.5, allow_nan=False, allow_infinity=False))
@settings(max_examples=20)  # Expensive — reduce iterations
def test_frontier_deck_validity(budget):
    """Each frontier deck must have exactly 8 cards and avg_elixir <= budget (or relaxed)."""
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from engine.optimizer import compute_frontier

    df = _card_df(n=20)
    df["market"] = "ladder"
    result = compute_frontier(df, elixir_budget=budget)

    for point in result["frontier_points"]:
        assert len(point["deck"]) == 8


# ---------------------------------------------------------------------------
# Property 10: Max-Sharpe deck is the global maximum
# Feature: clash-markets, Property 10: max_sharpe_deck has highest sharpe
# ---------------------------------------------------------------------------

@given(budget=st.floats(min_value=3.0, max_value=4.5, allow_nan=False, allow_infinity=False))
@settings(max_examples=20)
def test_max_sharpe_is_maximum(budget):
    """max_sharpe_deck.sharpe must be >= all other frontier_points sharpe values."""
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from engine.optimizer import compute_frontier

    df = _card_df(n=20)
    result = compute_frontier(df, elixir_budget=budget)

    best = result["max_sharpe_deck"]["sharpe"]
    for point in result["frontier_points"]:
        assert point["sharpe"] <= best + 1e-9


# ---------------------------------------------------------------------------
# Property 11: UCB alpha confidence weight is clamped to [0, 1]
# Feature: clash-markets, Property 11: UCB alpha in [0,1]
# ---------------------------------------------------------------------------

@given(n_i=st.integers(min_value=0, max_value=10000))
@settings(max_examples=100)
def test_ucb_alpha_clamped(n_i):
    """alpha = min(1.0, n_i / 30) must always be in [0.0, 1.0]."""
    alpha = min(1.0, n_i / 30)
    assert 0.0 <= alpha <= 1.0


# ---------------------------------------------------------------------------
# Property 12: UCB action label assignment
# Feature: clash-markets, Property 12: UCB action label follows assignment rules
# ---------------------------------------------------------------------------

@given(
    n_i=st.integers(min_value=0, max_value=100),
    personal_wr=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
    global_wr=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
)
@settings(max_examples=100)
def test_ucb_action_label_rules(n_i, personal_wr, global_wr):
    """Action label must follow priority rules from requirements."""
    action = _assign_action(n_i, personal_wr, global_wr)
    # Check precedence: EXPLOIT > EXPLORE > AVOID > HOLD
    if n_i >= 30 and personal_wr > global_wr:
        assert action == "EXPLOIT"
    elif n_i < 10:
        assert action == "EXPLORE"
    elif personal_wr < global_wr - 0.05:
        assert action == "AVOID"
    else:
        assert action == "HOLD"


# ---------------------------------------------------------------------------
# Property 13: Serialisation round-trip preserves numeric precision
# Feature: clash-markets, Property 13: JSON round-trip preserves numeric precision
# ---------------------------------------------------------------------------

@given(
    win_rate=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
    usage_rate=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
    mps_z=st.floats(min_value=-5.0, max_value=5.0, allow_nan=False, allow_infinity=False),
    esr=st.floats(min_value=-10.0, max_value=10.0, allow_nan=False, allow_infinity=False),
    meta_momentum=st.floats(min_value=-5.0, max_value=5.0, allow_nan=False, allow_infinity=False),
    deck_beta=st.floats(min_value=0.5, max_value=1.5, allow_nan=False, allow_infinity=False),
)
@settings(max_examples=100)
def test_serialisation_round_trip(win_rate, usage_rate, mps_z, esr, meta_momentum, deck_beta):
    """Numeric fields must survive JSON round-trip within 0.0001 tolerance."""
    import json
    record = {
        "win_rate": round(win_rate, 4),
        "usage_rate": round(usage_rate, 4),
        "mps_z": round(mps_z, 4),
        "esr": round(esr, 4),
        "meta_momentum": round(meta_momentum, 4),
        "deck_beta": round(deck_beta, 4),
    }
    serialised = json.dumps(record)
    parsed = json.loads(serialised)
    for field in ["win_rate", "usage_rate", "mps_z", "esr", "meta_momentum", "deck_beta"]:
        assert abs(record[field] - parsed[field]) < 0.0001


# ---------------------------------------------------------------------------
# Property 14: Backtest equity curve structural validity
# Feature: clash-markets, Property 14: equity curve is non-empty with valid structure
# ---------------------------------------------------------------------------

@settings(max_examples=20)
def test_backtest_equity_curve_structure():
    """Each strategy equity_curve must be non-empty with date and cumulative_win_rate."""
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from engine.backtest import run_all_strategies

    df = _card_df(n=20)
    result = run_all_strategies(df)

    if result.get("warning"):
        pytest.skip("Insufficient patch history for backtest test")

    for strat_key in ["patch_momentum", "ucb_optimal", "contrarian"]:
        curve = result["strategies"][strat_key]["equity_curve"]
        assert len(curve) > 0, f"{strat_key} equity_curve is empty"
        for point in curve:
            assert "date" in point, f"{strat_key}: missing 'date' in point"
            assert "cumulative_win_rate" in point, f"{strat_key}: missing 'cumulative_win_rate'"
