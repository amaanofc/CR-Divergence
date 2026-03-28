"""
Scraper for RoyaleAPI card statistics.
Fetches win rate and usage rate data across different trophy-range markets.
"""
import os
import logging
import requests
import pandas as pd
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

BASE_URL = "https://royaleapi.com/cards/popular"
DATA_DIR = os.path.join(os.path.dirname(__file__))

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


def scrape_market(cat: str) -> pd.DataFrame:
    """
    Scrape card statistics from RoyaleAPI for a given market category.

    Args:
        cat: Market category string. One of: Ladder, GC, TopRanked200, TopRanked, Ranked

    Returns:
        DataFrame with columns: card_name, win_rate, usage_rate
        win_rate and usage_rate are decimal fractions in [0, 1]

    Raises:
        Exception: If the HTTP request fails or returns non-200 status
    """
    url = f"{BASE_URL}?cat={cat}"
    logger.info(f"Scraping market '{cat}' from {url}")

    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
    except requests.exceptions.Timeout:
        raise Exception(
            f"Request timed out after 10 seconds for market '{cat}' at {url}"
        )
    except requests.exceptions.RequestException as e:
        raise Exception(f"Request failed for market '{cat}': {e}")

    if response.status_code != 200:
        raise Exception(
            f"RoyaleAPI returned HTTP {response.status_code} for market '{cat}' "
            f"(URL: {url})"
        )

    soup = BeautifulSoup(response.text, "lxml")

    cards = []
    # RoyaleAPI card rows are typically in a table or card grid
    # Try multiple selectors to handle page structure variations
    rows = soup.select("tr.card_row, .card-stats-row, table tbody tr")

    if not rows:
        # Fallback: look for any table rows with card data
        rows = soup.select("table tr")[1:]  # skip header row

    for row in rows:
        cells = row.find_all(["td", "th"])
        if len(cells) < 3:
            continue

        try:
            card_name = cells[0].get_text(strip=True)
            win_rate_text = cells[1].get_text(strip=True).replace("%", "").strip()
            usage_rate_text = cells[2].get_text(strip=True).replace("%", "").strip()

            if not card_name or not win_rate_text or not usage_rate_text:
                continue

            # Convert percentage strings to decimal fractions
            win_rate = float(win_rate_text) / 100.0
            usage_rate = float(usage_rate_text) / 100.0

            cards.append({
                "card_name": card_name,
                "win_rate": win_rate,
                "usage_rate": usage_rate,
            })
        except (ValueError, IndexError) as e:
            logger.debug(f"Skipping row in market '{cat}': {e}")
            continue

    if not cards:
        logger.warning(
            f"No card data extracted for market '{cat}'. "
            "The page structure may have changed."
        )

    df = pd.DataFrame(cards, columns=["card_name", "win_rate", "usage_rate"])
    logger.info(f"Scraped {len(df)} cards for market '{cat}'")

    # Save to CSV
    _save_market_csv(df, cat)

    return df


def _save_market_csv(df: pd.DataFrame, cat: str) -> None:
    """Save market DataFrame to CSV, overwriting if exists."""
    filename = f"cards_{cat.lower()}.csv"
    filepath = os.path.join(DATA_DIR, filename)
    df.to_csv(filepath, index=False)
    logger.info(f"Saved {len(df)} rows to {filepath}")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    markets = ["Ladder", "GC", "TopRanked200", "TopRanked", "Ranked"]

    for market in markets:
        try:
            df = scrape_market(market)
            print(f"✓ {market}: {len(df)} cards scraped")
        except Exception as e:
            print(f"✗ {market}: {e}")
