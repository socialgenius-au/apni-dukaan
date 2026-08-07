"""
Asan Bazaar (merchant_id=5) product import pipeline — v2.

Run this from Claude Code inside the /workspaces/hamari-dukaan Codespace.
Requires: pip install pillow boto3 requests --break-system-packages

Env vars needed (.env): GOOGLE_API_KEY, R2_ENDPOINT, R2_ACCESS_KEY_ID,
R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL

What it does:
  1. Lists every file in the shared Drive folder via the Drive API v3
     (files.list with an API key — no OAuth, no per-IP rate limit like
     the old gdown scraping approach hit).
  2. Downloads each one (files.get?alt=media).
  3. Dedups BEFORE anything touches the database or R2:
       - exact duplicates: same file content hash -> keep first, drop rest
       - near-duplicates: same normalized product name (size/weight/punct
         stripped) -> keep the largest file (usually the clearer photo)
  4. Derives Product Name from filename, categorizes by keyword, generates
     a sequential HD-AB-[CATEGORY]-[###] code into the `barcode` field.
  5. Compresses + uploads to R2 under products-live/.
  6. Creates the product via POST /products/ (stock=5, price=0), then
     immediately PATCHes is_active=False — nothing customer-visible until
     pricing is confirmed with the merchant.

Safe to re-run: logs progress in asan_bazaar_processed.json and skips
files already imported.
"""

import os
import re
import json
import time
import hashlib
import requests
from pathlib import Path
from io import BytesIO
from PIL import Image, ImageOps
import boto3
from botocore.config import Config

# ---------------------------------------------------------------------------
MERCHANT_ID = 5
MERCHANT_CODE = "AB"
DRIVE_FOLDER_ID = "1rRf1qrqm9fOGlfxuxDhXaFsb7T76RNQW"
DOWNLOAD_DIR = Path("asan_bazaar_images")
LOG_FILE = Path("asan_bazaar_processed.json")

API_URL = os.environ.get("API_URL", "https://hamari-dukaan-production.up.railway.app")
GOOGLE_API_KEY = os.environ["GOOGLE_API_KEY"]

R2_ENDPOINT = os.environ["R2_ENDPOINT"]
R2_KEY_ID = os.environ["R2_ACCESS_KEY_ID"]
R2_SECRET = os.environ["R2_SECRET_ACCESS_KEY"]
R2_BUCKET = os.environ["R2_BUCKET"]
R2_PUBLIC_URL = os.environ["R2_PUBLIC_URL"]

DRIVE_LIST_URL = "https://www.googleapis.com/drive/v3/files"

# ---------------------------------------------------------------------------
CATEGORY_RULES = [
    ("FZ", ["naan", "paratha", "momo", "roti", "frozen", "keep frozen", "kulfi", "ice cream", "cornetto", "magnum", "streets"]),
    ("DY", ["paneer", "ghee", "butter", "mawa", "khoa", "milk", "cheese", "curd", "yogurt", "cream"]),
    ("RD", ["ready to eat", "minute khana", "heat & eat", "heat and eat", "dal makhani", "biryani mix", "curry mix", "complete mix"]),
    ("PK", ["achar", "pickle", "chutney", "mango pulp", "tamarind paste"]),
    ("SW", ["ladoo", "laddu", "barfi", "kalakand", "rasgulla", "gulab jamun", "mithai", "kaju katli", "sweet", "khapse", "gudpak", "dry cake", "rusk"]),
    ("BK", ["biscuit", "cookie", "cake", "pie", "bakery"]),
    ("SN", ["namkeen", "bhujia", "chanachur", "chips", "nut cracker", "sticks", "snack", "chowmein", "kurkure", "cheetos", "pringles", "puffed rice", "muri", "furandana", "chana", "dalmoth", "khatta meetha"]),
    ("ND", ["noodle", "chowmein", "pasta", "vermicelli"]),
    ("BV", ["tea", "chiya", "coffee", "juice", "drink", "sprite", "energy drink", "soda", "candy"]),
    ("OL", ["oil", "vanaspati", "ghee"]),
    ("AT", ["atta", "flour", "maida"]),
    ("RC", ["rice", "basmati", "poha", "rice flour"]),
    ("PL", ["dal", "lentil", "chana", "gram", "chickpea", "beans", "pulse", "soya chunk", "urad", "moong"]),
    ("SP", ["masala", "spice", "powder", "chilli", "chili", "cumin", "coriander", "cardamom", "cinnamon", "salt", "pepper", "ajinomoto", "kasuri methi", "bay leaf", "seasoning"]),
    ("HB", ["toothpaste", "toothbrush", "shampoo", "soap", "hair colour", "hair color", "henna", "mehandi", "balm", "face wash", "pads", "gel", "cosmetic"]),
    ("HH", ["detergent", "washing", "toilet paper", "mothball", "cleaning"]),
    ("MD", ["ayurvedic", "tablet", "laxative", "gripe water", "aloe vera", "churna"]),
]


def categorize(filename: str) -> str:
    name_lower = filename.lower()
    for code, keywords in CATEGORY_RULES:
        if any(kw in name_lower for kw in keywords):
            return code
    return "GN"


def clean_product_name(filename_stem: str) -> str:
    return re.sub(r"\s+", " ", filename_stem.strip())


def normalize_for_dedup(name: str) -> str:
    """Strip size/weight/punctuation so near-duplicate filenames match."""
    n = name.lower()
    n = re.sub(r"\(.*?\)", "", n)  # drop parenthetical notes
    n = re.sub(r"\d+\s?(kg|g|gm|ml|l|litre|liter|pcs|pack|oz|lb)\b", "", n)
    n = re.sub(r"[^a-z0-9]+", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:80]


def compress_image(img_bytes: bytes) -> bytes:
    img = Image.open(BytesIO(img_bytes))
    img = ImageOps.exif_transpose(img)
    if img.mode != "RGB":
        img = img.convert("RGB")
    out = BytesIO()
    img.save(out, format="JPEG", quality=85, optimize=True)
    return out.getvalue()


def load_log():
    if LOG_FILE.exists():
        return json.loads(LOG_FILE.read_text())
    return {"processed": {}, "counters": {}}


def save_log(log):
    LOG_FILE.write_text(json.dumps(log, indent=2))


def list_drive_files():
    """List every file in the folder via Drive API v3, paginating."""
    files = []
    page_token = None
    while True:
        params = {
            "q": f"'{DRIVE_FOLDER_ID}' in parents and trashed = false",
            "key": GOOGLE_API_KEY,
            "fields": "nextPageToken, files(id, name, mimeType, size)",
            "pageSize": 1000,
        }
        if page_token:
            params["pageToken"] = page_token
        resp = requests.get(DRIVE_LIST_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        files.extend(data.get("files", []))
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return files


DOWNLOAD_DELAY_SECONDS = 2.0
DOWNLOAD_MAX_RETRIES = 5


def download_drive_file(file_id: str) -> bytes:
    url = f"{DRIVE_LIST_URL}/{file_id}"
    for attempt in range(DOWNLOAD_MAX_RETRIES):
        resp = requests.get(url, params={"alt": "media", "key": GOOGLE_API_KEY}, timeout=60)
        if resp.status_code == 403 and attempt < DOWNLOAD_MAX_RETRIES - 1:
            # Google's per-IP abuse block ("automated queries") — back off and retry.
            time.sleep(20 * (attempt + 1))
            continue
        resp.raise_for_status()
        return resp.content


def dedup(local_files):
    """Returns the subset of files to keep, dropping exact + near dupes."""
    seen_hashes = {}
    seen_names = {}
    keep = []
    dropped_exact, dropped_near = 0, 0

    # Sort by file size descending so the "keep" copy is the best quality one
    local_files_sorted = sorted(local_files, key=lambda p: p.stat().st_size, reverse=True)

    for path in local_files_sorted:
        content = path.read_bytes()
        h = hashlib.sha256(content).hexdigest()
        if h in seen_hashes:
            dropped_exact += 1
            continue

        norm = normalize_for_dedup(path.stem)
        if norm in seen_names:
            dropped_near += 1
            continue

        seen_hashes[h] = path
        seen_names[norm] = path
        keep.append(path)

    print(f"Dedup: kept {len(keep)} / dropped {dropped_exact} exact dupes, {dropped_near} near-dupes")
    return keep


def main():
    DOWNLOAD_DIR.mkdir(exist_ok=True)

    print("Listing files in Drive folder...")
    drive_files = list_drive_files()
    print(f"Found {len(drive_files)} files in Drive.")

    print("Downloading any not already on disk...")
    for i, f in enumerate(drive_files):
        local_path = DOWNLOAD_DIR / f["name"]
        if local_path.exists():
            continue
        try:
            content = download_drive_file(f["id"])
            local_path.write_bytes(content)
        except Exception as e:
            print(f"  FAILED download {f['name']}: {e}")
        time.sleep(DOWNLOAD_DELAY_SECONDS)
        if (i + 1) % 50 == 0:
            print(f"  ...{i+1}/{len(drive_files)}")

    all_local = sorted([p for p in DOWNLOAD_DIR.iterdir() if p.is_file()])
    print(f"{len(all_local)} files on disk. Running dedup...")
    files_to_process = dedup(all_local)

    log = load_log()
    r2 = boto3.client(
        "s3", endpoint_url=R2_ENDPOINT, aws_access_key_id=R2_KEY_ID,
        aws_secret_access_key=R2_SECRET, config=Config(signature_version="s3v4"),
        region_name="auto",
    )

    created, skipped, failed = 0, 0, 0

    for i, path in enumerate(files_to_process):
        key = path.name
        if key in log["processed"]:
            skipped += 1
            continue

        product_name = clean_product_name(path.stem)
        category = categorize(path.name)
        log["counters"].setdefault(category, 0)
        log["counters"][category] += 1
        seq = log["counters"][category]
        barcode = f"HD-{MERCHANT_CODE}-{category}-{seq:03d}"

        print(f"[{i+1}/{len(files_to_process)}] {product_name} -> {barcode}...", end=" ", flush=True)

        try:
            compressed = compress_image(path.read_bytes())
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
                "price": 0.0, "category": category, "emoji": "\U0001F4E6",
                "stock_qty": 5, "image_url": image_url, "barcode": barcode,
            }, timeout=15)
            if res.status_code in (200, 201):
                pid = res.json().get("id")
                requests.patch(f"{API_URL}/products/{pid}", json={"is_active": False}, timeout=10)
                print(f"OK #{pid} (hidden)")
                created += 1
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
    print(f"\nDone. Created: {created}  Skipped: {skipped}  Failed: {failed}")
    print("All hidden — check pricing with Asan Bazaar, then bulk-activate in the admin panel.")


if __name__ == "__main__":
    main()