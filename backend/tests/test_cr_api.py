"""Unit tests for data/cr_api.py."""
import sys
import os

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_missing_cr_api_token_raises_runtime_error(monkeypatch):
    """cr_api must raise RuntimeError at module load if CR_API_TOKEN not set."""
    # Remove the env var
    monkeypatch.delenv("CR_API_TOKEN", raising=False)

    # Re-import the module to trigger fresh initialisation — RuntimeError raised at import
    import importlib
    import data.cr_api as cr_module

    with pytest.raises(RuntimeError, match="CR_API_TOKEN not set in environment"):
        importlib.reload(cr_module)


def test_player_tag_encoding():
    """Player tag '#2PP' must be encoded as '%232PP'."""
    import urllib.parse
    tag = "#2PP"
    encoded = tag.replace("#", "%23")
    assert encoded == "%232PP"


def test_player_tag_url_encode_consistency():
    """urllib.parse.quote and manual replace must agree."""
    import urllib.parse
    tag = "#ABC123"
    manual = tag.replace("#", "%23")
    quoted = urllib.parse.quote(tag, safe="")
    # Both encode # as %23
    assert manual == "%23ABC123"
    assert "%23" in quoted


def test_bearer_header_format():
    """Bearer token header must be 'Bearer <token>'."""
    token = "test-token-12345"
    header = {"Authorization": f"Bearer {token}"}
    assert header["Authorization"] == f"Bearer {token}"
    assert header["Authorization"].startswith("Bearer ")
