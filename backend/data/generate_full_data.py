"""
Generate full 120-card datasets for all three markets.

Reads cards_meta.json for the complete card list, preserves existing 30-card
anchor data where available, and generates realistic stats for the remaining
90 cards using rarity-based distributions with seeded RNG.

Also expands patch_history.csv to cover more of the 120 cards.
"""
import csv
import json
import os
import random

DATA_DIR = os.path.dirname(__file__)

# Rarity-based stat distributions: (win_rate_mean, win_rate_std, usage_rate_mean, usage_rate_std)
RARITY_DISTRIBUTIONS = {
    "common":    (0.500, 0.030, 0.085, 0.035),
    "rare":      (0.510, 0.040, 0.080, 0.030),
    "epic":      (0.505, 0.035, 0.070, 0.025),
    "legendary": (0.510, 0.050, 0.065, 0.025),
    "champion":  (0.515, 0.045, 0.060, 0.020),
}

# Cross-market adjustments relative to ladder
MARKET_ADJUSTMENTS = {
    "ladder":  {"wr_shift": 0.000, "ur_scale": 1.00},
    "gc":      {"wr_shift": 0.008, "ur_scale": 0.85},
    "top200":  {"wr_shift": 0.005, "ur_scale": 0.55},
}


def _load_existing_csv(filename):
    """Load existing CSV as dict keyed by card_name."""
    path = os.path.join(DATA_DIR, filename)
    existing = {}
    try:
        with open(path, "r", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                existing[row["card_name"]] = {
                    "win_rate": float(row["win_rate"]),
                    "usage_rate": float(row["usage_rate"]),
                }
    except FileNotFoundError:
        pass
    return existing


def _clamp(val, lo, hi):
    return max(lo, min(hi, val))


def generate_market_csv(cards_meta, market_name, filename, rng):
    """Generate a full 120-card CSV for one market."""
    existing = _load_existing_csv(filename)
    adj = MARKET_ADJUSTMENTS[market_name]

    rows = []
    for card in cards_meta:
        name = card["name"]
        rarity = card["rarity"].lower()

        if name in existing:
            # Keep existing anchor data
            rows.append({
                "card_name": name,
                "win_rate": existing[name]["win_rate"],
                "usage_rate": existing[name]["usage_rate"],
            })
        else:
            # Generate from rarity distribution
            wr_mean, wr_std, ur_mean, ur_std = RARITY_DISTRIBUTIONS.get(
                rarity, RARITY_DISTRIBUTIONS["common"]
            )

            wr = rng.gauss(wr_mean + adj["wr_shift"], wr_std)
            wr = _clamp(round(wr, 3), 0.350, 0.650)

            ur = rng.gauss(ur_mean * adj["ur_scale"], ur_std * adj["ur_scale"])
            ur = _clamp(round(ur, 3), 0.005, 0.250)

            rows.append({
                "card_name": name,
                "win_rate": wr,
                "usage_rate": ur,
            })

    # Write CSV
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["card_name", "win_rate", "usage_rate"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"  Wrote {len(rows)} cards to {filename}")
    return rows


def generate_patch_history(cards_meta, rng):
    """Expand patch_history.csv to ~100 rows covering more cards."""
    # Read existing patches
    path = os.path.join(DATA_DIR, "patch_history.csv")
    existing_patches = []
    existing_keys = set()
    try:
        with open(path, "r", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                existing_patches.append(row)
                existing_keys.add((row["date"], row["card_name"]))
    except FileNotFoundError:
        pass

    # Cards that already have patch history
    patched_cards = {r["card_name"] for r in existing_patches}

    # Cards that need patches
    all_names = [c["name"] for c in cards_meta]
    unpatched = [n for n in all_names if n not in patched_cards]

    # Patch dates (roughly monthly from 2023-02 to 2026-03)
    patch_dates = [
        "2023-02-06", "2023-04-03", "2023-06-05", "2023-08-07",
        "2023-10-02", "2023-12-04", "2024-01-15", "2024-02-05",
        "2024-03-04", "2024-04-01", "2024-05-06", "2024-06-03",
        "2024-07-01", "2024-08-05", "2024-09-02", "2024-10-07",
        "2024-11-04", "2024-12-02", "2025-01-06", "2025-02-03",
        "2025-03-03", "2025-04-07", "2025-05-05", "2025-06-02",
        "2025-07-07", "2025-08-04", "2025-09-01", "2025-10-06",
        "2025-11-03", "2025-12-01", "2026-01-05", "2026-02-02",
        "2026-03-02",
    ]

    stat_options = ["damage", "hitpoints", "range", "attack_speed", "spawn_rate"]
    new_patches = list(existing_patches)

    # Add recent patches (2025-2026) for previously patched cards too
    recent_dates = [d for d in patch_dates if d >= "2025-04-01"]
    for card_name in patched_cards:
        n_recent = rng.randint(1, 2)
        dates = rng.sample(recent_dates, min(n_recent, len(recent_dates)))
        for date in dates:
            if (date, card_name) in existing_keys:
                continue
            change_type = rng.choice(["buff", "nerf"])
            stat = rng.choice(stat_options)
            mag = round(rng.uniform(0.04, 0.10), 2)
            mag_str = f"+{mag}" if change_type == "buff" else f"-{mag}"
            new_patches.append({
                "date": date,
                "card_name": card_name,
                "change_type": change_type,
                "stat_changed": stat,
                "magnitude": mag_str,
            })
            existing_keys.add((date, card_name))

    # Add 1-2 patches for each unpatched card
    for card_name in unpatched:
        n_patches = rng.randint(1, 2)
        dates = rng.sample(patch_dates, min(n_patches, len(patch_dates)))
        for date in dates:
            if (date, card_name) in existing_keys:
                continue
            change_type = rng.choice(["buff", "nerf"])
            stat = rng.choice(stat_options)
            mag = round(rng.uniform(0.04, 0.12), 2)
            mag_str = f"+{mag}" if change_type == "buff" else f"-{mag}"
            new_patches.append({
                "date": date,
                "card_name": card_name,
                "change_type": change_type,
                "stat_changed": stat,
                "magnitude": mag_str,
            })
            existing_keys.add((date, card_name))

    # Sort by date
    new_patches.sort(key=lambda r: r["date"])

    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["date", "card_name", "change_type", "stat_changed", "magnitude"])
        writer.writeheader()
        writer.writerows(new_patches)

    print(f"  Wrote {len(new_patches)} patch rows (was {len(existing_patches)})")


def main():
    # Load cards_meta.json
    meta_path = os.path.join(DATA_DIR, "cards_meta.json")
    with open(meta_path, "r") as f:
        cards_meta = json.load(f)

    print(f"Loaded {len(cards_meta)} cards from cards_meta.json")

    rng = random.Random(42)

    market_files = {
        "ladder": "cards_ladder.csv",
        "gc": "cards_gc.csv",
        "top200": "cards_top200.csv",
    }

    for market_name, filename in market_files.items():
        print(f"\nGenerating {market_name}...")
        generate_market_csv(cards_meta, market_name, filename, rng)

    print("\nGenerating expanded patch history...")
    generate_patch_history(cards_meta, rng)

    print("\nDone! All 120-card datasets generated.")


if __name__ == "__main__":
    main()
