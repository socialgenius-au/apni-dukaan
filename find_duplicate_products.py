"""
DIAGNOSTIC ONLY — finds duplicate Budget Mart products (merchant_id=4)
by normalized product name. Does NOT delete or modify anything.

Run from Claude Code in the Codespace:
    set -a && source ./.env && set +a && python3 find_duplicate_products.py
"""

import os
import re
import requests
from collections import defaultdict

API_URL = os.environ.get("API_URL", "https://hamari-dukaan-production.up.railway.app")
MERCHANT_ID = 4


def normalize_for_dedup(name: str) -> str:
    n = name.lower()
    n = re.sub(r"\(.*?\)", "", n)
    n = re.sub(r"\d+\s?(kg|g|gm|ml|l|litre|liter|pcs|pack|oz|lb)\b", "", n)
    n = re.sub(r"[^a-z0-9]+", " ", n)
    return re.sub(r"\s+", " ", n).strip()


def main():
    res = requests.get(f"{API_URL}/products/", params={"merchant_id": MERCHANT_ID}, timeout=30)
    res.raise_for_status()
    products = res.json()
    print(f"Total Budget Mart products: {len(products)}\n")

    groups = defaultdict(list)
    for p in products:
        norm = normalize_for_dedup(p.get("name", ""))
        groups[norm].append(p)

    dupe_groups = {k: v for k, v in groups.items() if len(v) > 1}
    total_dupe_records = sum(len(v) for v in dupe_groups.values())
    to_remove_count = sum(len(v) - 1 for v in dupe_groups.values())

    print(f"Unique product names: {len(groups)}")
    print(f"Names with duplicates: {len(dupe_groups)}")
    print(f"Total records involved in duplicates: {total_dupe_records}")
    print(f"Records that WOULD BE REMOVED (keeping oldest per group): {to_remove_count}")
    print(f"Expected count after cleanup: {len(products) - to_remove_count}\n")

    print("=" * 70)
    print("SAMPLE (first 20 duplicate groups):")
    print("=" * 70)
    for i, (norm, items) in enumerate(sorted(dupe_groups.items())[:20]):
        items_sorted = sorted(items, key=lambda x: x["id"])
        keep = items_sorted[0]
        remove = items_sorted[1:]
        print(f"\n[{norm}]")
        print(f"  KEEP   #{keep['id']}: {keep['name']} (price={keep.get('price')}, active={keep.get('is_active')})")
        for r in remove:
            print(f"  REMOVE #{r['id']}: {r['name']} (price={r.get('price')}, active={r.get('is_active')})")

    if len(dupe_groups) > 20:
        print(f"\n... and {len(dupe_groups) - 20} more duplicate groups not shown.")


if __name__ == "__main__":
    main()
