"""
CLEANUP — deletes duplicate Budget Mart products created by today's
re-import. For every duplicate group, keeps the OLDEST record (the
original import, barcode=None) and deletes the newer HD-BM-* duplicate
created today.

Safety: requires typing CONFIRM at the prompt. Prints every deletion
as it happens. Only deletes products where the "remove" side has an
HD-BM- barcode (today's import) — never touches an original record.

Run from Claude Code in the Codespace:
    set -a && source ./.env && set +a && python3 cleanup_duplicate_products.py
"""

import os
import re
import requests
from collections import defaultdict

API_URL = os.environ.get("API_URL", "https://hamari-dukaan-production.up.railway.app")
MERCHANT_ID = 4


def normalize_strict(name: str) -> str:
    n = name.lower()
    n = re.sub(r"[^a-z0-9]+", " ", n)
    return re.sub(r"\s+", " ", n).strip()


def main():
    res = requests.get(f"{API_URL}/products/merchant/{MERCHANT_ID}/all", timeout=30)
    res.raise_for_status()
    products = res.json()
    print(f"Total Budget Mart products: {len(products)}")

    groups = defaultdict(list)
    for p in products:
        norm = normalize_strict(p.get("name", ""))
        groups[norm].append(p)

    dupe_groups = {k: v for k, v in groups.items() if len(v) > 1}

    to_delete = []
    skipped_ambiguous = []

    for norm, items in dupe_groups.items():
        items_sorted = sorted(items, key=lambda x: x["id"])
        keep = items_sorted[0]
        remove = items_sorted[1:]
        for r in remove:
            barcode = r.get("barcode") or ""
            if barcode.startswith("HD-BM-"):
                to_delete.append(r)
            else:
                skipped_ambiguous.append((norm, keep, r))

    print(f"\nConfirmed safe to delete (HD-BM- duplicates from today's import): {len(to_delete)}")
    print(f"Skipped as ambiguous (didn't match expected pattern, needs manual review): {len(skipped_ambiguous)}")

    if skipped_ambiguous:
        print("\n" + "=" * 70)
        print("AMBIGUOUS — NOT deleted, review manually:")
        print("=" * 70)
        for norm, keep, r in skipped_ambiguous[:20]:
            print(f"\n[{norm}]")
            print(f"  kept:      #{keep['id']}: {keep['name']} (barcode={keep.get('barcode')})")
            print(f"  ambiguous: #{r['id']}: {r['name']} (barcode={r.get('barcode')})")

    print(f"\nExpected count after deleting {len(to_delete)}: {len(products) - len(to_delete)}")

    print("\n" + "=" * 70)
    confirm = input(f"Type CONFIRM to delete these {len(to_delete)} duplicate products: ")
    if confirm.strip() != "CONFIRM":
        print("Aborted. Nothing was deleted.")
        return

    deleted, failed = 0, 0
    for p in to_delete:
        pid = p["id"]
        res = requests.delete(f"{API_URL}/products/{pid}", timeout=10)
        if res.status_code in (200, 204):
            print(f"Deleted #{pid}: {p['name']}")
            deleted += 1
        else:
            print(f"FAILED to delete #{pid}: {res.status_code} {res.text[:100]}")
            failed += 1

    print(f"\nDone. Deleted: {deleted}  Failed: {failed}")


if __name__ == "__main__":
    main()
