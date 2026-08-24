"""
Recovery pass for Hamro Pashupatinath Mart (merchant_id=7).

pashupatinath_import.py's original self-dedup step used difflib.SequenceMatcher
alone at threshold 0.6 to decide whether two filenames were "the same product,
different photo." Manual review of the 341 files it dropped found the matcher
was rewarding shared *generic* words ("Masala", "Powder", "Rice", "Cookies",
"– 100 g") over the *distinguishing* word (brand or variant) — e.g. it merged
"Brahmins Rasam Powder" into "Brahmins Kashmiri Chilly Powder", and "BMC
Mutton Masala" into "BMC Momo Masala". An automated re-check found roughly a
third to two-thirds of the 341 "duplicates" were actually distinct products
wrongly excluded from the first run.

This script re-examines every file from the Drive folder against a STRICTER
matcher (is_true_duplicate below): it requires the leading brand token to
match (or be a prefix of the other, to tolerate "7up" vs "7 Up" spacing),
AND a high overall sequence ratio, AND high stemmed-word overlap. Only pairs
passing all three are treated as duplicate photos of the same product;
everything else is imported as a genuinely new product.

Run:
    set -a && source ./.env && set +a && python3 pashupatinath_recovery.py --dry-run
    set -a && source ./.env && set +a && python3 pashupatinath_recovery.py

Shares pashupatinath_new_processed.json (checkpoint + per-category barcode
counters) with pashupatinath_import.py, so barcodes continue the existing
sequence and it's safe to re-run — files already imported by either script
are skipped.
"""

import re
import sys
import difflib
import requests
from pathlib import Path
import boto3
from botocore.config import Config

from pashupatinath_import import (
    MERCHANT_ID, MERCHANT_CODE, DRIVE_FOLDER_ID,
    list_drive_files, download_drive_file,
    load_log, save_log, get_existing_names, next_barcode,
)
from kings_spice_new_import import (
    CATEGORY_NAMES, categorize, clean_filename, slugify, compress_image,
    filter_junk_filenames,
    API_URL, R2_ENDPOINT, R2_KEY_ID, R2_SECRET, R2_BUCKET, R2_PUBLIC_URL,
)

RECOVERY_REPORT_FILE = Path("pashupatinath_recovery_report.txt")

UNIT_RE = re.compile(
    r"[\d.]+\s?(kg|g|gm|gms|grams|ml|l|litre|litres|liter|liters|pcs|pack|oz|lb|lbs)\b"
)


def normalize(name: str, keep_parens_words: bool) -> str:
    n = re.sub(r"\.[a-zA-Z0-9]+$", "", name)
    n = n.lower()
    if keep_parens_words:
        n = re.sub(r"[()]", " ", n)  # unwrap parens (keep the words inside)
    else:
        n = re.sub(r"\(.*?\)", " ", n)  # drop parenthetical annotations entirely
    n = UNIT_RE.sub(" ", n)
    n = re.sub(r"[^a-z0-9]+", " ", n)
    return re.sub(r"\s+", " ", n).strip()


def _stem_words(norm_name: str):
    words = norm_name.split()
    return set(w[:-1] if len(w) > 3 and w.endswith("s") else w for w in words)


def _brand_key(norm_name: str) -> str:
    return "".join(norm_name.split()[:2])[:12]


def _brand_ok(na: str, nb: str) -> bool:
    ba, bb = _brand_key(na), _brand_key(nb)
    if not ba or not bb:
        return False
    if ba == bb or ba.startswith(bb) or bb.startswith(ba):
        return True
    return difflib.SequenceMatcher(None, ba, bb).ratio() >= 0.8


def is_true_duplicate(a: str, b: str, ratio_thresh: float = 0.72,
                       jaccard_thresh: float = 0.55, core_ratio_thresh: float = 0.90) -> bool:
    """Two-stage check. Stage 1: with parenthetical annotations (e.g. "(Dry
    Ginger Coffee)") dropped entirely, if the remaining core name is a
    near-exact match, it's the same product with one filename just missing
    the annotation -- duplicate. Stage 2 (only if stage 1 doesn't decide):
    unwrap parens (keep their words, since sometimes the distinguishing
    info like "(Cans and bottles)" lives there) and require the leading
    brand token to match AND high sequence ratio AND high stemmed-word
    overlap -- catches same-brand-different-product pairs ("Rasam Powder"
    vs "Turmeric Powder") that stage 1's core comparison alone would miss."""
    core_a, core_b = normalize(a, keep_parens_words=False), normalize(b, keep_parens_words=False)
    if core_a and core_b:
        core_ratio = difflib.SequenceMatcher(None, core_a, core_b).ratio()
        if core_ratio >= core_ratio_thresh and _brand_ok(core_a, core_b):
            return True

    na, nb = normalize(a, keep_parens_words=True), normalize(b, keep_parens_words=True)
    if not na or not nb:
        return False
    wa, wb = _stem_words(na), _stem_words(nb)
    jaccard = len(wa & wb) / len(wa | wb) if (wa | wb) else 0
    ratio = difflib.SequenceMatcher(None, na, nb).ratio()
    return _brand_ok(na, nb) and ratio >= ratio_thresh and jaccard >= jaccard_thresh


# ---------------------------------------------------------------------------
def gather_recoverable_files(report_lines, verbose=True):
    def log(msg):
        if verbose:
            print(msg)

    log("Fetching current Hamro Pashupatinath Mart products (post first run)...")
    existing_names = get_existing_names()

    log("Listing files in Drive folder...")
    drive_files = list_drive_files(DRIVE_FOLDER_ID)
    total_scanned = len(drive_files)
    log(f"Found {total_scanned} files in Drive.")

    drive_files, skipped_as_junk = filter_junk_filenames(drive_files, report_lines)
    log(f"{skipped_as_junk} junk filenames skipped.")

    log("Strict-matching filenames against currently-existing products...")
    genuinely_new = []
    for f in drive_files:
        cleaned = clean_filename(f["name"])
        dup_of = next((n for n in existing_names if is_true_duplicate(cleaned, n)), None)
        if dup_of:
            report_lines.append(
                f"SKIP  filename={f['name']!r}  matched_existing={dup_of!r} (strict match)"
            )
        else:
            genuinely_new.append(f)
    log(f"{len(genuinely_new)} files not strictly matched to an existing product.")

    log("Strict self-dedup among the remainder...")
    kept_files, kept_names = [], []
    for f in sorted(genuinely_new, key=lambda x: x["name"].lower()):
        cleaned = clean_filename(f["name"])
        dup_of = next((n for n in kept_names if is_true_duplicate(cleaned, n)), None)
        if dup_of:
            report_lines.append(
                f"DEDUP filename={f['name']!r}  matched_new={dup_of!r} (strict match)"
            )
        else:
            kept_files.append(f)
            kept_names.append(cleaned)
    log(f"{len(kept_files)} genuinely new files after strict self-dedup.")

    return kept_files, total_scanned, skipped_as_junk


def dry_run():
    report_lines = []
    files_to_process, total_scanned, skipped_as_junk = gather_recoverable_files(report_lines)

    log = load_log()
    already_processed = sum(1 for f in files_to_process if f["id"] in log["processed"])
    remaining = [f for f in files_to_process if f["id"] not in log["processed"]]

    counters = dict(log["counters"])
    preview = []
    for f in remaining:
        product_name = clean_filename(f["name"])
        category = categorize(f["name"])
        barcode = next_barcode(counters, category)
        preview.append((product_name, category, barcode))

    print("\n" + "=" * 60)
    print("RECOVERY DRY RUN SUMMARY (no writes performed)")
    print("=" * 60)
    print(f"Total files scanned:                {total_scanned}")
    print(f"Skipped as junk filename:           {skipped_as_junk}")
    print(f"Already processed (either run):     {already_processed}")
    print(f"Would recover as new products:      {len(remaining)}")

    sample = preview[:20]
    print(f"\nSample of {len(sample)} recovered name -> category -> code mappings:")
    for name, category, barcode in sample:
        full_name = CATEGORY_NAMES.get(category, "General")
        print(f"  {name!r:55} -> {category:4} {full_name:22} {barcode}")


def main():
    report_lines = []
    files_to_process, total_scanned, skipped_as_junk = gather_recoverable_files(report_lines)

    RECOVERY_REPORT_FILE.write_text("\n".join(report_lines) + "\n")
    print(f"Recovery report written to {RECOVERY_REPORT_FILE}")

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
    print("RECOVERY SUMMARY")
    print("=" * 60)
    print(f"Total files scanned:        {total_scanned}")
    print(f"Skipped as junk filename:   {skipped_as_junk}")
    print(f"Recovered as new:           {imported}")
    print(f"Failed:                     {failed}")
    print(f"Recovery report:            {RECOVERY_REPORT_FILE}")
    print("All recovered products are hidden (is_active=False) with price=0 —"
          " confirm pricing, then bulk-activate in the admin panel.")


if __name__ == "__main__":
    if "--dry-run" in sys.argv:
        dry_run()
    else:
        main()
