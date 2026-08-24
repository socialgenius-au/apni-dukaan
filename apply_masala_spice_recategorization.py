"""
One-off: apply the confirmed Masala/Powder -> Spices recategorization across
merchant_id=1 (Kings Spice), 6 (NK Supermarket), 7 (Hamro Pashupatinath Mart).

Background: CATEGORY_RULES was letting ingredient/dish keywords ("chicken",
"momo", "pani puri") win over the fact that a product is a spice/seasoning
blend (e.g. "Everest Tandoori Chicken Masala" landed in Meat instead of
Spices). Fixed in kings_spice_new_import.py's categorize() -- see
_is_spice_blend_name(). This script re-scans every live product with
"Masala" or "Powder" in its name that isn't currently "Spices", and PATCHes
category="Spices" for every one the fixed categorize() now maps to Spices --
EXCEPT the 5 confirmed ambiguous "masala as a flavor suffix on a snack"
products (Jabsons/Mahek/Malabar/Kurkure), which are explicitly skipped and
left in their current category.

Run:
    set -a && source ./.env && set +a && python3 apply_masala_spice_recategorization.py
"""

import os
import time
import requests

from kings_spice_new_import import categorize, CATEGORY_NAMES

API_URL = os.environ.get("API_URL", "https://hamari-dukaan-production.up.railway.app")
MERCHANTS = {1: "Kings Spice", 6: "NK Supermarket", 7: "Hamro Pashupatinath Mart"}

# Confirmed ambiguous: masala is a flavor suffix on a snack product, not a
# seasoning blend itself. Leave these in their current category.
SKIP_PRODUCT_IDS = {
    9451,  # Jabsons Roasted Peanuts Spicy Masala (Pashupatinath)
    8386,  # Mahek Pani Puri Chips with Masala (Kings Spice)
    4356,  # MALABAR TREATS PEANUT MASALA 200G (Kings Spice)
    4371,  # MALABAR TREATS TAPIOCA CHIPS MASALA 150G (Kings Spice)
    8785,  # Kurkure Solid Masti Masala Twisteez (NK Supermarket)
}

RETRY_ATTEMPTS = 2
RETRY_BACKOFF_SECONDS = [3, 10]


def patch_category(product_id: int, category: str):
    attempt = 0
    while True:
        try:
            res = requests.patch(f"{API_URL}/products/{product_id}",
                                  json={"category": category}, timeout=15)
            res.raise_for_status()
            return
        except requests.exceptions.RequestException as e:
            if attempt < RETRY_ATTEMPTS:
                wait = RETRY_BACKOFF_SECONDS[attempt]
                print(f"  retrying in {wait}s ({e})...")
                time.sleep(wait)
                attempt += 1
                continue
            raise


def main():
    updated, skipped_ambiguous, unaffected, failed = 0, 0, 0, 0

    for mid, mname in MERCHANTS.items():
        res = requests.get(f"{API_URL}/products/merchant/{mid}/all", timeout=60)
        res.raise_for_status()
        products = res.json()

        for p in products:
            name = p.get("name") or ""
            low = name.lower()
            if "masala" not in low and "powder" not in low:
                continue
            current_cat = (p.get("category") or "").strip()
            if current_cat.lower() == "spices":
                continue

            pid = p.get("id")
            proposed = CATEGORY_NAMES.get(categorize(name), "General")
            if proposed != "Spices":
                unaffected += 1
                continue

            if pid in SKIP_PRODUCT_IDS:
                print(f"[{mname}] SKIP (ambiguous) #{pid} {name!r} -- stays {current_cat!r}")
                skipped_ambiguous += 1
                continue

            print(f"[{mname}] #{pid} {name!r}: {current_cat!r} -> 'Spices'...", end=" ", flush=True)
            try:
                patch_category(pid, "Spices")
                print("OK")
                updated += 1
            except Exception as e:
                print(f"FAILED ({e})")
                failed += 1

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Updated to Spices:          {updated}")
    print(f"Skipped (ambiguous, kept):  {skipped_ambiguous}")
    print(f"Unaffected (not a flip):    {unaffected}")
    print(f"Failed:                     {failed}")


if __name__ == "__main__":
    main()
