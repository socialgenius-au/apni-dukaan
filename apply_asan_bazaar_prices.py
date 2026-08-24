"""
One-off: apply confirmed Asan Bazaar (merchant_id=5) prices from
"Product List of Hamro Asan Bazaar With Barcodes price list.xlsx" to the
matching live products, per the dry-run match report
(asan_bazaar_price_match_report.txt, threshold=0.75).

Excludes 4 flagged matches that review found were likely wrong despite a
decent similarity ratio (different specific products sharing generic
words): Aachar Masala/Chaat Masala, Gits/GRB Pure Ghee (brand mismatch),
Butter Chicken Paste/Masala (different product form), Cumin Coriander
Powder/Roasted Coriander Powder (missing ingredient).

Run:
    set -a && source ./.env && set +a && python3 apply_asan_bazaar_prices.py
"""

import os
import time
import json
import requests

API_URL = os.environ.get("API_URL", "https://hamari-dukaan-production.up.railway.app")

FLAGGED_EXCLUDE_IDS = {6242, 6438, 6225, 6180}

RETRY_ATTEMPTS = 2
RETRY_BACKOFF_SECONDS = [3, 10]


def patch_price(product_id: int, price: float):
    attempt = 0
    while True:
        try:
            res = requests.patch(f"{API_URL}/products/{product_id}",
                                  json={"price": price}, timeout=15)
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
    confident = json.load(open("/tmp/claude-1000/-workspaces-hamari-dukaan/517d386e-cd31-4d8a-bced-5255f2938822/scratchpad/confident_075_full.json"))

    to_apply = [m for m in confident if m["matched_id"] not in FLAGGED_EXCLUDE_IDS]
    print(f"Applying {len(to_apply)} price updates ({len(confident) - len(to_apply)} flagged rows excluded)...\n")

    updated, failed = 0, 0
    for m in sorted(to_apply, key=lambda x: -x["ratio"]):
        pid, price, name = m["matched_id"], m["price"], m["matched_live_name"]
        print(f"#{pid} {name!r}: -> ${price} (ratio={m['ratio']})...", end=" ", flush=True)
        try:
            patch_price(pid, price)
            print("OK")
            updated += 1
        except Exception as e:
            print(f"FAILED ({e})")
            failed += 1

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Updated:  {updated}")
    print(f"Excluded (flagged):  {len(confident) - len(to_apply)}")
    print(f"Failed:   {failed}")


if __name__ == "__main__":
    main()
