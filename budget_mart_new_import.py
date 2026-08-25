"""
Budget Mart (merchant_id=4) — import NEW product images from
budget_mart_new_images/.

Run from Claude Code in the Codespace:
    pip install pillow boto3 requests --break-system-packages
    python3 budget_mart_new_import.py

Env vars needed (.env): R2_ENDPOINT, R2_ACCESS_KEY_ID,
R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL

What it does:
  1. Reads existing Budget Mart products' barcodes (HD-BM-[CAT]-[NUM]) to
     find the current max sequence number per category, so new codes
     continue the sequence rather than colliding with the 253 already
     backfilled.
  2. Reads every image already in budget_mart_new_images/.
  3. Dedups BEFORE anything touches the database or R2:
       - exact duplicates: same file content hash -> keep first
       - near-duplicates: same normalized product name -> keep the
         largest file
  4. Categorizes using the EXACT SAME rules as backfill_budget_mart_codes.py
     (copied verbatim, so new and old products classify identically).
  5. Compresses + uploads to R2, creates product (stock=5, price=0),
     immediately hides it (is_active=False).

Safe to re-run: logs progress in budget_mart_new_processed.json.
"""

import os
import re
import json
import hashlib
import requests
from pathlib import Path
from io import BytesIO
from PIL import Image, ImageOps
import boto3
from botocore.config import Config

# ---------------------------------------------------------------------------
MERCHANT_ID = 4
MERCHANT_CODE = "BM"
DOWNLOAD_DIR = Path("budget_mart_new_images")
LOG_FILE = Path("budget_mart_new_processed.json")

API_URL = os.environ.get("API_URL", "https://hamari-dukaan-production.up.railway.app")

R2_ENDPOINT = os.environ["R2_ENDPOINT"]
R2_KEY_ID = os.environ["R2_ACCESS_KEY_ID"]
R2_SECRET = os.environ["R2_SECRET_ACCESS_KEY"]
R2_BUCKET = os.environ["R2_BUCKET"]
R2_PUBLIC_URL = os.environ["R2_PUBLIC_URL"]

# ---------------------------------------------------------------------------
# EXACT SAME rules as backfill_budget_mart_codes.py — keep these two files
# in sync if either is edited later.
CATEGORY_RULES = [
    ("MT", ["goat skin", "beef intestine", "goat khutti", "khasi ko masu", "chicken curry",
            "local chicken", "peri peri chicken"]),
    ("FZ", ["naan", "paratha", "momo", "roti", "frozen", "kulfi", "ice cream", "cornetto", "magnum", "streets",
            "mixed vegetables"]),
    ("DY", ["paneer", "ghee", "butter", "mawa", "khoa", "milk", "cheese", "curd", "yogurt", "cream", "milkshake"]),
    ("RD", ["ready to eat", "minute khana", "heat & eat", "heat and eat", "dal makhani", "biryani mix", "curry mix",
            "sarson ka saag"]),
    ("PK", ["achar", "pickle", "chutney", "mango pulp", "tamarind paste", "tamarind"]),
    ("SW", ["ladoo", "laddu", "barfi", "kalakand", "rasgulla", "gulab jamun", "mithai", "kaju katli", "sweet",
            "khapse", "gudpak", "dry cake", "rusk", "pheni", "soan papdi", "rasmalai", "jelly crystal"]),
    ("BK", ["biscuit", "cookie", "cake", "pie", "bakery", "osmania"]),
    ("SN", ["namkeen", "bhujia", "chanachur", "chips", "nut cracker", "sticks", "snack", "chowmein",
            "kurkure", "cheetos", "pringles", "puffed rice", "muri", "crispy rolls", "crusty nuts", "tana-tan",
            "furandana", "roasted corn", "fryums", "daal moth", "hot peas", "chiur", "chiwra", "nepali mixture",
            "khajurico", "kerala mixture", "puffy puff", "prawn crackers", "weilong", "bhutan mix", "chatpate"]),
    ("ND", ["noodle", "vermicelli", "pasta", "spaghetti", "spaghettini", "ramyun", "ramen", "kochylaki"]),
    ("BV", ["syrup", "sharbet", "squash", "cordial", "nectar", "juice", "drink", "sprite", "soda",
            "rooh afza", "tea", "coffee", "tang", "chiya"]),
    ("OL", ["oil", "vanaspati"]),
    ("SG", ["sugar", "jaggery"]),
    ("AT", ["atta", "flour", "maida", "besan", "semolina", "corn grits", "saboodana", "sattu"]),
    ("RC", ["rice", "basmati", "poha", "sella", "idli rice"]),
    ("PL", ["dal", "lentil", "chana", "gram", "chickpea", "beans", "pulse", "soya chunk", "urad", "moong",
            "soya", "peas", "urid", "masaura"]),
    ("SP", ["masala", "spice", "powder", "chilli", "chili", "chilly", "cumin", "coriander", "cardamom",
            "cinnamon", "salt", "pepper", "seasoning", "fennel", "mustard", "ajwain", "alum", "fitkiri",
            "hemp seed", "clove", "turmeric", "kasuri methi", "garlic paste", "ginger paste", "ajino moto",
            "sesame"]),
    ("SC", ["candy", "chocolate", "gummy", "gummi", "mars bar", "kitkat", "milky way", "mentos",
            "chupa chups", "lollipop", "bite", "chocolate bar"]),
    ("NT", ["cashew", "almond", "raisin", "pumpkin seed", "melon seed", "dry fruit", "pistachio", "sultana",
            "dates", "khenaizi", "khudri", "peanut", "coconut"]),
    ("FV", ["tomato", "banana", "avocado", "fresh", "onion", "capsicum", "lettuce", "cauliflower", "potato"]),
    ("HB", ["toothpaste", "toothbrush", "shampoo", "soap", "hair colour", "hair color", "henna", "cosmetic"]),
    ("HH", ["detergent", "washing", "toilet paper", "mothball", "cleaning", "charcoal"]),
    ("MD", ["ayurvedic", "tablet", "laxative", "gripe water", "aloe vera", "churna"]),
]

CATEGORY_NAMES = {
    "MT": "Meat & Poultry", "FZ": "Frozen", "DY": "Dairy", "RD": "Ready to Eat", "PK": "Pickles",
    "SW": "Sweets", "BK": "Bakery", "SN": "Namkeen & Snacks", "ND": "Noodles & Pasta",
    "BV": "Beverages", "OL": "Oils & Ghee", "SG": "Sugar & Sweeteners", "AT": "Flour & Grains", "RC": "Rice",
    "PL": "Lentils & Pulses", "SP": "Spices", "SC": "Sweets & Confectionery",
    "NT": "Dry Fruits & Nuts", "FV": "Fresh Produce", "HB": "Health & Beauty",
    "HH": "Household", "MD": "Medicine", "GN": "General",
}

BARCODE_RE = re.compile(r"^HD-BM-([A-Z]+)-(\d+)$")


def categorize(text: str) -> str:
    t = text.lower()
    for code, keywords in CATEGORY_RULES:
        if any(kw in t for kw in keywords):
            return code
    return "GN"


def get_existing_counters():
    """Find the current max sequence number per category from existing
    Budget Mart products, so new codes continue without colliding."""
    res = requests.get(f"{API_URL}/products/", params={"merchant_id": MERCHANT_ID}, timeout=30)
    res.raise_for_status()
    products = res.json()
    counters = {}
    for p in products:
        m = BARCODE_RE.match(p.get("barcode") or "")
        if m:
            code, num = m.group(1), int(m.group(2))
            counters[code] = max(counters.get(code, 0), num)
    return counters


def clean_product_name(filename_stem: str) -> str:
    name = re.sub(r"\s*[–-]\s*", " – ", filename_stem.strip())
    return re.sub(r"\s+", " ", name)


def normalize_for_dedup(name: str) -> str:
    n = name.lower()
    n = re.sub(r"\(.*?\)", "", n)
    n = re.sub(r"\d+\s?(kg|g|gm|ml|l|litre|liter|pcs|pack|oz|lb)\b", "", n)
    n = re.sub(r"[^a-z0-9]+", " ", n)
    return re.sub(r"\s+", " ", n).strip()


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
    return {"processed": {}}


def save_log(log):
    LOG_FILE.write_text(json.dumps(log, indent=2))


def dedup(local_files):
    seen_hashes = {}
    seen_names = {}
    keep = []
    dropped_exact, dropped_near = 0, 0
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
    print("Checking existing Budget Mart barcodes to continue numbering...")
    counters = get_existing_counters()
    print(f"Current max per category: {counters}")

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
        counters[category] = counters.get(category, 0) + 1
        seq = counters[category]
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
                "price": 0.0, "category": CATEGORY_NAMES.get(category, "General"), "emoji": "\U0001F4E6",
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
    print("All hidden — check pricing with Budget Mart, then bulk-activate in the admin panel.")


if __name__ == "__main__":
    main()
