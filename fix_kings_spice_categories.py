"""
One-off cleanup: correct Kings Spice (merchant_id=1) product categories that
were mis-assigned by the old categorize() substring-matching bug (e.g. "pie"
matching inside "Pieces", "butter" matching inside "Butterfly", "oil"
matching inside "Toilet"). See kings_spice_new_import.py's categorize() for
the fixed (word-boundary) logic.

Only the `category` field is updated — barcodes are left as-is since they're
already-assigned identifiers.

Run:
    set -a && source ./.env && set +a && python3 fix_kings_spice_categories.py
"""

import json
import requests
from kings_spice_new_import import API_URL, categorize, CATEGORY_NAMES

LOG_FILE = "kings_spice_new_processed.json"


def main():
    d = json.load(open(LOG_FILE))
    processed = d["processed"]

    to_fix = []
    for file_id, info in processed.items():
        name = info.get("name")
        barcode = info.get("barcode", "")
        pid = info.get("product_id")
        if not name or not barcode or not pid:
            continue
        parts = barcode.split("-")
        if len(parts) != 4:
            continue
        stored_code = parts[2]
        new_code = categorize(name)
        if stored_code != new_code:
            to_fix.append((pid, barcode, name, stored_code, new_code))

    print(f"{len(to_fix)} products to correct\n")

    fixed, failed = 0, 0
    for pid, barcode, name, old_code, new_code in to_fix:
        new_category = CATEGORY_NAMES.get(new_code, "General")
        try:
            res = requests.patch(
                f"{API_URL}/products/{pid}",
                json={"category": new_category},
                timeout=15,
            )
            if res.status_code in (200, 201):
                print(f"OK   #{pid} {barcode} {name!r:55} "
                      f"{CATEGORY_NAMES.get(old_code)} -> {new_category}")
                fixed += 1
            else:
                print(f"FAIL #{pid} {barcode} {name!r:55} "
                      f"HTTP {res.status_code}: {res.text[:150]}")
                failed += 1
        except Exception as e:
            print(f"FAIL #{pid} {barcode} {name!r:55} error: {e}")
            failed += 1

    print(f"\nDone. Fixed {fixed}/{len(to_fix)}, failed {failed}.")


if __name__ == "__main__":
    main()
