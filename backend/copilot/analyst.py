"""
AI Analyst module for Clash Markets.
Generates natural-language research reports via the Anthropic Claude API.
"""
import json
import logging
import os

import pandas as pd

logger = logging.getLogger(__name__)

FALLBACK = "Analyst unavailable. Check ANTHROPIC_API_KEY configuration."


async def generate_analyst_report(
    query: str,
    context: dict,
    df: pd.DataFrame,
) -> dict:
    """
    Generate an AI-powered research report for a natural-language query.

    Args:
        query: User's question about the meta
        context: Optional additional context dict from frontend
        df: Merged metrics DataFrame from compute_all_metrics()

    Returns:
        {"report": str}
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return {"report": FALLBACK}

    try:
        import anthropic

        # Build top-10 cards context from Ladder market
        ladder = df[df["market"] == "ladder"].copy() if not df.empty else df
        top10 = (
            ladder.nlargest(10, "mps_z")[
                ["card_name", "win_rate", "usage_rate", "mps_z", "esr", "deck_beta", "clash_alpha"]
            ]
            .round(4)
            .to_dict(orient="records")
        )

        system_prompt = (
            "You are a quantitative analyst for Clash Royale at Clash Markets, "
            "a Bloomberg Terminal-style analytics platform. You interpret six custom statistics:\n"
            "- MPS (Mispricing Score): how much a card over/underperforms vs its popularity\n"
            "- ESR (Elixir Sharpe Ratio): win-rate efficiency per elixir spent\n"
            "- Meta Momentum (MM): over-indexing by high-skill players vs general population\n"
            "- Deck Beta: meta-sensitivity based on rarity tier\n"
            "- Alpha Decay Rate (ADR): how fast a card's post-buff edge erodes\n"
            "- Clash Alpha (CA): composite risk-adjusted excess performance score\n\n"
            "Current top-10 cards by MPS z-score (Ladder market):\n"
            f"{json.dumps(top10, indent=2)}\n\n"
            "Respond concisely and use finance analogies where appropriate. "
            "Do not include any API keys, player IDs, or personal information."
        )

        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": query}],
        )

        report_text = response.content[0].text
        return {"report": report_text}

    except Exception as exc:
        logger.error(f"Analyst API call failed: {exc}")
        return {"report": FALLBACK}
