"""
Survival analysis engine for Clash Markets.
Implements Kaplan-Meier and Cox Proportional Hazards analysis for alpha decay.
"""
import json
import logging
import os

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def compute_survival_curves() -> dict:
    """
    Compute Kaplan-Meier survival curves and Cox PH model for alpha decay.

    Returns:
        {
            km_curves: [{rarity, curve: [{time, survival_probability}]}],
            cox_results: {coefficients: {...}, p_values: {...}},
            warning: str | None
        }
    """
    patch_path = os.path.join(DATA_DIR, "patch_history.csv")

    try:
        patches = pd.read_csv(patch_path, parse_dates=["date"])
    except FileNotFoundError:
        return {
            "km_curves": [],
            "cox_results": {"coefficients": {}, "p_values": {}},
            "warning": "patch_history.csv not found",
        }

    if len(patches) < 15:
        logger.warning(
            f"patch_history.csv has only {len(patches)} rows. "
            "Survival analysis results may be unreliable."
        )

    buffs = patches[patches["change_type"] == "buff"].copy()

    if len(buffs) < 5:
        return {
            "km_curves": [],
            "cox_results": {"coefficients": {}, "p_values": {}},
            "warning": "Insufficient buff events for survival analysis",
        }

    # Load card metadata for rarity/elixir/type
    meta_path = os.path.join(DATA_DIR, "cards_meta.json")
    try:
        with open(meta_path, "r") as f:
            meta_list = json.load(f)
        meta_df = pd.DataFrame(meta_list).rename(columns={"name": "card_name"})
        meta_df["rarity"] = meta_df["rarity"].str.lower()
        meta_df["type"] = meta_df["type"].str.lower()
        meta_df = meta_df[["card_name", "elixir", "rarity", "type"]].drop_duplicates("card_name")
    except (FileNotFoundError, KeyError):
        meta_df = pd.DataFrame(columns=["card_name", "elixir", "rarity", "type"])

    # Merge metadata onto buff events
    buffs = buffs.merge(meta_df, on="card_name", how="left")
    buffs["elixir"] = buffs["elixir"].fillna(4.0)
    buffs["rarity"] = buffs["rarity"].fillna("common")
    buffs["type"] = buffs["type"].fillna("troop")

    # Synthesise survival data from patch history
    # Duration = days until next nerf for the same card (or censored at 90 days)
    # Event = 1 if nerfed within 90 days, 0 if censored
    nerfs = patches[patches["change_type"] == "nerf"].copy()

    survival_records = []
    for _, buff_row in buffs.iterrows():
        card = buff_row["card_name"]
        buff_date = buff_row["date"]
        magnitude = float(str(buff_row.get("magnitude", 0.1)).replace("+", "")) if pd.notna(buff_row.get("magnitude")) else 0.1

        # Find next nerf for this card after this buff
        card_nerfs = nerfs[
            (nerfs["card_name"] == card) & (nerfs["date"] > buff_date)
        ].sort_values("date")

        if not card_nerfs.empty:
            next_nerf = card_nerfs.iloc[0]
            duration = (next_nerf["date"] - buff_date).days
            event = 1
        else:
            # Censored at 90 days
            duration = 90
            event = 0

        duration = max(1, duration)  # ensure positive duration

        survival_records.append({
            "card_name": card,
            "duration": duration,
            "event": event,
            "rarity": buff_row.get("rarity", "common"),
            "elixir": float(buff_row.get("elixir", 4.0)),
            "card_type": buff_row.get("type", "troop"),
            "magnitude": magnitude,
        })

    surv_df = pd.DataFrame(survival_records)

    if len(surv_df) < 5:
        return {
            "km_curves": [],
            "cox_results": {"coefficients": {}, "p_values": {}},
            "warning": "Insufficient buff events for survival analysis",
        }

    # Fit overall KM curve
    try:
        from lifelines import KaplanMeierFitter, CoxPHFitter

        kmf = KaplanMeierFitter()
        kmf.fit(surv_df["duration"], event_observed=surv_df["event"])
        overall_curve = _extract_km_curve(kmf)

        # Fit KM curves grouped by rarity
        km_curves = []
        for rarity in surv_df["rarity"].unique():
            rarity_df = surv_df[surv_df["rarity"] == rarity]
            if len(rarity_df) < 2:
                continue
            kmf_r = KaplanMeierFitter()
            kmf_r.fit(rarity_df["duration"], event_observed=rarity_df["event"])
            km_curves.append({
                "rarity": rarity,
                "curve": _extract_km_curve(kmf_r),
            })

        # Fit Cox PH model
        cox_results = {"coefficients": {}, "p_values": {}}
        try:
            cox_df = surv_df[["duration", "event", "elixir"]].copy()
            # Encode rarity as numeric
            rarity_map = {"common": 0, "rare": 1, "epic": 2, "legendary": 3, "champion": 4}
            cox_df["rarity_num"] = surv_df["rarity"].map(rarity_map).fillna(1)
            type_map = {"troop": 0, "spell": 1, "building": 2}
            cox_df["card_type_num"] = surv_df["card_type"].map(type_map).fillna(0)

            cph = CoxPHFitter()
            cph.fit(cox_df, duration_col="duration", event_col="event")

            summary = cph.summary
            cox_results = {
                "coefficients": {
                    "rarity": float(summary.loc["rarity_num", "coef"]) if "rarity_num" in summary.index else 0.0,
                    "elixir": float(summary.loc["elixir", "coef"]) if "elixir" in summary.index else 0.0,
                    "card_type": float(summary.loc["card_type_num", "coef"]) if "card_type_num" in summary.index else 0.0,
                },
                "p_values": {
                    "rarity": float(summary.loc["rarity_num", "p"]) if "rarity_num" in summary.index else 1.0,
                    "elixir": float(summary.loc["elixir", "p"]) if "elixir" in summary.index else 1.0,
                    "card_type": float(summary.loc["card_type_num", "p"]) if "card_type_num" in summary.index else 1.0,
                },
            }
        except Exception as e:
            logger.warning(f"Cox PH model failed: {e}. Returning empty cox_results.")

        return {
            "km_curves": km_curves,
            "cox_results": cox_results,
            "warning": None,
        }

    except ImportError:
        return {
            "km_curves": [],
            "cox_results": {"coefficients": {}, "p_values": {}},
            "warning": "lifelines library not installed",
        }
    except Exception as e:
        logger.error(f"Survival analysis failed: {e}")
        return {
            "km_curves": [],
            "cox_results": {"coefficients": {}, "p_values": {}},
            "warning": f"Survival analysis error: {str(e)}",
        }


def _extract_km_curve(kmf) -> list[dict]:
    """Extract survival function as list of {time, survival_probability} dicts."""
    sf = kmf.survival_function_
    return [
        {"time": int(t), "survival_probability": round(float(p), 4)}
        for t, p in zip(sf.index, sf.iloc[:, 0])
    ]
