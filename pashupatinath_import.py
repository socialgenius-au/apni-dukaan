"""
Hamro Pashupatinath Mart (merchant_id=7) — import NEW products from the
shared Google Drive folder. Brand-new merchant with zero existing products,
so there's nothing to dedup against on the first run — but the script still
re-checks merchant 7's live product list at the start of every run (same
pattern as nk_supermarket_import.py) so reruns stay safe.

Run from Claude Code in the Codespace:
    pip install pillow boto3 requests --break-system-packages
    set -a && source ./.env && set +a && python3 pashupatinath_import.py --dry-run
    set -a && source ./.env && set +a && python3 pashupatinath_import.py

Env vars needed (.env): GOOGLE_API_KEY, R2_ENDPOINT, R2_ACCESS_KEY_ID,
R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL

Categorization rules (CATEGORY_RULES / CATEGORY_NAMES / categorize) and the
generic Drive-listing/dedup machinery are imported from
kings_spice_new_import.py rather than duplicated, so this merchant's import
stays on the same taxonomy as the rest. The file *download* method is
imported from nk_supermarket_import.py: Drive's public
uc?export=download URL (handling the large-file confirmation-token
interstitial) instead of the v3 media endpoint, to avoid the rate-limit
issues hit on NK Supermarket. Only file *listing* uses the Drive API v3.

What it does:
  1. Fetches Hamro Pashupatinath Mart's existing products
     (GET /products/merchant/7/all) — expected to be empty on a fresh
     merchant, but re-checked every run so reruns can't create duplicates.
  2. Recursively lists every file in the Drive folder via the Drive API v3,
     skipping any subfolder named "Work in progress" or "Testing".
  3. Filters out junk/generic filenames (no recoverable product name),
     logging every skip/keep decision to pashupatinath_skip_report.txt.
  4. Filters out files matching an existing product name (difflib, >= 0.6) —
     a no-op on a fresh merchant, but keeps reruns safe.
  5. Dedups the surviving files against each other at the same threshold,
     in case the same product has multiple photos.
  6. For each genuinely-new file: derives a product name from the filename
     (Brand + Product Description + Size/Volume, cleaned of underscores and
     extension), categorizes it into a 2-letter code, generates a
     sequential HD-PM-[CATEGORY]-[NUM] barcode (the "Product Code" field,
     NUM incrementing per category from 1), downloads from Drive's public
     direct-download URL (retrying transient errors twice with 3s/10s
     backoff), compresses + uploads to R2, and creates the product with
     stock=5, price=0, the barcode as Product Code, and the category's full
     name (e.g. "Spices", not "SP") in the category field — then
     immediately hides it (is_active=False) until pricing is confirmed.

Safe to re-run: logs progress in pashupatinath_new_processed.json and skips
files already imported.
"""

import sys
import json
import time
import requests
from pathlib import Path
import boto3
from botocore.config import Config

from kings_spice_new_import import (
    CATEGORY_NAMES, categorize,
    clean_filename, slugify, compress_image,
    filter_junk_filenames, filter_already_uploaded, dedup_new_files,
    API_URL, GOOGLE_API_KEY, R2_ENDPOINT, R2_KEY_ID, R2_SECRET, R2_BUCKET, R2_PUBLIC_URL,
    DRIVE_FILES_URL, FOLDER_MIME, EXCLUDE_FOLDER_NAMES,
)
from nk_supermarket_import import download_drive_file

# ---------------------------------------------------------------------------
MERCHANT_ID = 7
MERCHANT_CODE = "PM"
DRIVE_FOLDER_ID = "14HzG2RqC56z03kHZsoTnuU_EUisq0yjP"

LOG_FILE = Path("pashupatinath_new_processed.json")
SKIP_REPORT_FILE = Path("pashupatinath_skip_report.txt")

# Retry both listing and download calls twice, with the same 3s/10s backoff
# — direct-download and v3-listing aren't rate-limited the way the v3 media
# endpoint was, so a couple of short retries covers transient errors.
RETRY_ATTEMPTS = 2
RETRY_BACKOFF_SECONDS = [3, 10]


def list_drive_files(folder_id):
    """Recursively list every file in the folder, skipping excluded
    subfolders. Retries a transient listing error twice (3s/10s backoff)."""
    files = []
    page_token = None
    while True:
        params = {
            "q": f"'{folder_id}' in parents and trashed = false",
            "key": GOOGLE_API_KEY,
            "fields": "nextPageToken, files(id, name, mimeType, size)",
            "pageSize": 1000,
        }
        if page_token:
            params["pageToken"] = page_token
        attempt = 0
        while True:
            try:
                resp = requests.get(DRIVE_FILES_URL, params=params, timeout=60)
                resp.raise_for_status()
                break
            except requests.exceptions.RequestException:
                if attempt >= RETRY_ATTEMPTS:
                    raise
                wait = RETRY_BACKOFF_SECONDS[attempt]
                print(f"Drive listing error, retrying in {wait}s "
                      f"(attempt {attempt + 1}/{RETRY_ATTEMPTS})...")
                time.sleep(wait)
                attempt += 1
        data = resp.json()
        for f in data.get("files", []):
            if f["mimeType"] == FOLDER_MIME:
                if f["name"].strip().lower() in EXCLUDE_FOLDER_NAMES:
                    print(f"  Excluding subfolder (not descending): {f['name']}")
                    continue
                print(f"  Descending into subfolder: {f['name']}")
                files.extend(list_drive_files(f["id"]))
            else:
                files.append(f)
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return files


def load_log():
    if LOG_FILE.exists():
        return json.loads(LOG_FILE.read_text())
    return {"processed": {}, "counters": {}}


def save_log(log):
    LOG_FILE.write_text(json.dumps(log, indent=2))


# ---------------------------------------------------------------------------
def get_existing_names():
    res = requests.get(f"{API_URL}/products/merchant/{MERCHANT_ID}/all", timeout=30)
    res.raise_for_status()
    products = res.json()
    names = [p.get("name", "") for p in products if p.get("name")]
    print(f"Fetched {len(products)} existing Hamro Pashupatinath Mart products.")
    return names


def gather_files_to_process(report_lines, verbose=True):
    """Fetch existing products + Drive files and return the genuinely-new,
    self-deduped file list. Shared by main(), --dry-run, and --count-remaining."""
    def log(msg):
        if verbose:
            print(msg)

    log("Fetching existing Hamro Pashupatinath Mart products...")
    existing_names = get_existing_names()

    log("Listing files in Drive folder (excluding 'Work in progress' and 'Testing')...")
    drive_files = list_drive_files(DRIVE_FOLDER_ID)
    total_scanned = len(drive_files)
    log(f"Found {total_scanned} files in Drive.")

    log("Filtering out junk/generic filenames (no recoverable product name)...")
    drive_files, skipped_as_junk = filter_junk_filenames(drive_files, report_lines)
    log(f"{skipped_as_junk} junk filenames skipped.")

    log("Matching filenames against existing products (difflib, threshold=0.6)...")
    genuinely_new = filter_already_uploaded(drive_files, existing_names, report_lines)
    skipped_as_duplicate = len(drive_files) - len(genuinely_new)
    log(f"{len(genuinely_new)} files not matched to an existing product.")

    log("Deduping new files against each other...")
    files_to_process = dedup_new_files(genuinely_new, report_lines)
    skipped_as_duplicate += len(genuinely_new) - len(files_to_process)
    log(f"{len(files_to_process)} genuinely new files after self-dedup.")

    return files_to_process, total_scanned, skipped_as_junk, skipped_as_duplicate


def count_remaining():
    """Print REMAINING_NEW=<n> and exit, without downloading/importing anything."""
    files_to_process, *_ = gather_files_to_process([], verbose=False)
    print(f"REMAINING_NEW={len(files_to_process)}")


def print_live_count():
    """Print LIVE_COUNT=<n>, the current merchant product count from the API."""
    res = requests.get(f"{API_URL}/products/merchant/{MERCHANT_ID}/all", timeout=30)
    res.raise_for_status()
    print(f"LIVE_COUNT={len(res.json())}")


def next_barcode(counters, category):
    counters.setdefault(category, 0)
    counters[category] += 1
    return f"HD-{MERCHANT_CODE}-{category}-{counters[category]:03d}"


# ---------------------------------------------------------------------------
def dry_run():
    report_lines = []
    files_to_process, total_scanned, skipped_as_junk, skipped_as_duplicate = \
        gather_files_to_process(report_lines)

    log = load_log()
    already_processed = sum(1 for f in files_to_process if f["id"] in log["processed"])
    remaining = [f for f in files_to_process if f["id"] not in log["processed"]]

    # Simulate barcode assignment on a copy of the counters — nothing persisted.
    counters = dict(log["counters"])
    preview = []
    for f in remaining:
        product_name = clean_filename(f["name"])
        category = categorize(f["name"])
        barcode = next_barcode(counters, category)
        preview.append((product_name, category, barcode))

    print("\n" + "=" * 60)
    print("DRY RUN SUMMARY (no writes performed)")
    print("=" * 60)
    print(f"Total files scanned:            {total_scanned}")
    print(f"Skipped as junk filename:       {skipped_as_junk}")
    print(f"Skipped as duplicate/dedup:     {skipped_as_duplicate}")
    print(f"Already processed (prior run):  {already_processed}")
    print(f"Would create as new products:   {len(remaining)}")
    print(f"Skip report would be written to: {SKIP_REPORT_FILE}")

    sample = preview[:15]
    print(f"\nSample of {len(sample)} name -> category -> full-category-name -> code mappings:")
    for name, category, barcode in sample:
        full_name = CATEGORY_NAMES.get(category, "General")
        print(f"  {name!r:50} -> {category:4} {full_name:22} {barcode}")


def main():
    report_lines = []

    files_to_process, total_scanned, skipped_as_junk, skipped_as_duplicate = \
        gather_files_to_process(report_lines)

    SKIP_REPORT_FILE.write_text("\n".join(report_lines) + "\n")
    print(f"Skip report written to {SKIP_REPORT_FILE}")

    log = load_log()
    r2 = boto3.client(
        "s3", endpoint_url=R2_ENDPOINT, aws_access_key_id=R2_KEY_ID,
        aws_secret_access_key=R2_SECRET, config=Config(signature_version="s3v4"),
        region_name="auto",
    )

    imported, failed = 0, 0

    for i, f in enumerate(files_to_process):
        key = f["id"]
        if key in log["processed"]:
            continue

        product_name = clean_filename(f["name"])
        category = categorize(f["name"])
        barcode = next_barcode(log["counters"], category)
        full_category = CATEGORY_NAMES.get(category, "General")

        print(f"[{i+1}/{len(files_to_process)}] {product_name} -> {barcode}...", end=" ", flush=True)

        try:
            raw = download_drive_file(f["id"])
        except Exception as e:
            print(f"FAILED download ({e})")
            failed += 1
            continue

        try:
            compressed = compress_image(raw)
        except Exception as e:
            print(f"FAILED compress ({e})")
            failed += 1
            continue

        slug = slugify(f"{MERCHANT_CODE}-{product_name}")
        r2_key = f"products-live/{slug}.jpg"
        try:
            r2.put_object(Bucket=R2_BUCKET, Key=r2_key, Body=compressed,
                           ContentType="image/jpeg", CacheControl="public, max-age=31536000")
            image_url = f"{R2_PUBLIC_URL}/{r2_key}"
        except Exception as e:
            print(f"FAILED R2 upload ({e})")
            failed += 1
            continue

        try:
            res = requests.post(f"{API_URL}/products/", json={
                "merchant_id": MERCHANT_ID, "name": product_name, "description": "",
                "price": 0.0, "category": full_category, "emoji": "\U0001F4E6",
                "stock_qty": 5, "image_url": image_url, "barcode": barcode,
            }, timeout=15)
            if res.status_code in (200, 201):
                pid = res.json().get("id")
                requests.patch(f"{API_URL}/products/{pid}", json={"is_active": False}, timeout=10)
                print(f"OK #{pid} (hidden)")
                imported += 1
                log["processed"][key] = {"product_id": pid, "barcode": barcode, "name": product_name}
            else:
                print(f"FAILED DB {res.status_code}: {res.text[:150]}")
                failed += 1
        except Exception as e:
            print(f"FAILED DB error ({e})")
            failed += 1

        if (i + 1) % 25 == 0:
            save_log(log)

    save_log(log)

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total files scanned:        {total_scanned}")
    print(f"Skipped as junk filename:   {skipped_as_junk}")
    print(f"Skipped as duplicate:       {skipped_as_duplicate}")
    print(f"Imported as new:            {imported}")
    print(f"Failed:                     {failed}")
    print(f"Skip report:                {SKIP_REPORT_FILE}")
    print("All imported products are hidden (is_active=False) with price=0 —"
          " confirm pricing with Hamro Pashupatinath Mart, then bulk-activate in the admin panel.")


if __name__ == "__main__":
    if "--dry-run" in sys.argv:
        dry_run()
    elif "--count-remaining" in sys.argv:
        count_remaining()
    elif "--live-count" in sys.argv:
        print_live_count()
    else:
        main()
