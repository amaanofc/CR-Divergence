"""
Official Clash Royale API client.
Fetches card metadata and player battle logs using the official CR REST API.
"""
import logging
import os
from urllib.parse import quote

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

CR_API_BASE_URL = "https://api.clashroyale.com/v1"

# Read token at module level — raises RuntimeError if absent
_token = os.getenv("CR_API_TOKEN")
if not _token:
    raise RuntimeError("CR_API_TOKEN not set in environment")

_HEADERS = {"Authorization": f"Bearer {_token}"}


def fetch_cards_metadata() -> list[dict]:
    """
    Fetch all card metadata from the official Clash Royale API.

    Returns:
        List of card dicts, each containing: id, name, elixir, rarity, type
    """
    url = f"{CR_API_BASE_URL}/cards"
    response = requests.get(url, headers=_HEADERS, timeout=10)
    response.raise_for_status()

    data = response.json()
    cards = data.get("items", [])

    return [
        {
            "id": card.get("id"),
            "name": card.get("name"),
            "elixir": card.get("elixirCost"),
            "rarity": card.get("rarity"),
            "type": card.get("cardType", card.get("type")),
        }
        for card in cards
    ]


def fetch_player_battlelog(player_tag: str) -> list[dict]:
    """
    Fetch the battle log for a given player tag.

    Args:
        player_tag: Clash Royale player tag (e.g. "#2PP")

    Returns:
        List of up to 25 battle objects, or [] if player not found
    """
    # URL-encode the tag: replace # with %23
    encoded_tag = quote(player_tag, safe="").replace("#", "%23")
    if not encoded_tag.startswith("%23") and player_tag.startswith("#"):
        encoded_tag = "%23" + encoded_tag.lstrip("#")

    url = f"{CR_API_BASE_URL}/players/{encoded_tag}/battlelog"
    logger.info(f"Fetching battle log for player tag: {player_tag}")

    response = requests.get(url, headers=_HEADERS, timeout=10)

    if response.status_code == 404:
        logger.warning(
            f"Player tag '{player_tag}' not found (404). Returning empty battle log."
        )
        return []

    response.raise_for_status()

    battles = response.json()
    # Return up to 25 battles
    return battles[:25] if isinstance(battles, list) else []
