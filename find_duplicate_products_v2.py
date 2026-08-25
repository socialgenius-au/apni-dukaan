"""
DIAGNOSTIC ONLY — finds TRUE duplicate Budget Mart products using the
correct endpoint (/products/merchant/4/all). Unlike the first version,
this keeps size/weight as part of the identity, so "Rice 5kg" and
"Rice 1kg" are correctly treated as different products, not duplicates.

Does NOT delete or modify anything.

Run from Claude Code in the Codespace:
    set -a && source ./.env && set +a && python3 find_duplicate_products_v2.py
"""

import os
import re
import requests
from collections import defaultdict

API_URL = os.environ.get("API_URL", "https://hamari-dukaan-production.up.railway.app")
MERCHANT_ID = 4


def normalize_strict(name: str) -> str:
    """Normalize for TRUE duplicate detection — keeps size/weight,
    only strips punctuation/case/whitespace differences."""
    n = name.lower()
    n = re.sub(r"[^a-z0-9]+", " ", n)
    return re.sub(r"\s+", " ", n).strip()


def main():
    res = requests.get(f"{API_URL}/products/merchant/{MERCHANT_ID}/all", timeout=30)
    res.raise_for_status()
    products = res.json()
    print(f"Total Budget Mart products: {len(products)}\n")

    groups = defaultdict(list)
    for p in products:
        norm = normalize_strict(p.get("name", ""))
        groups[norm].append(p)

    dupe_groups = {k: v for k, v in groups.items() if len(v) > 1}
    total_dupe_records = sum(len(v) for v in dupe_groups.values())
    to_remove_count = sum(len(v) - 1 for v in dupe_groups.values())

    print(f"Unique product names (size-aware): {len(groups)}")
    print(f"Names with true duplicates: {len(dupe_groups)}")
    print(f"Total records involved: {total_dupe_records}")
    print(f"Records that WOULD BE REMOVED (keeping oldest per group): {to_remove_count}")
    print(f"Expected count after cleanup: {len(products) - to_remove_count}\n")

    print("=" * 70)
    print("ALL duplicate groups:")
    print("=" * 70)
    for norm, items in sorted(dupe_groups.items()):
        items_sorted = sorted(items, key=lambda x: x["id"])
        keep = items_sorted[0]
        remove = items_sorted[1:]
        print(f"\n[{norm}]")
        print(f"  KEEP   #{keep['id']}: {keep['name']} (price={keep.get('price')}, active={keep.get('is_active')}, barcode={keep.get('barcode')})")
        for r in remove:
            print(f"  REMOVE #{r['id']}: {r['name']} (price={r.get('price')}, active={r.get('is_active')}, barcode={r.get('barcode')})")


if __name__ == "__main__":
    main()
