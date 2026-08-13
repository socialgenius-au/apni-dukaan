"""
Kings Spice Mini Mart (merchant_id=1) — import NEW products from the shared
Google Drive folder, skipping anything that's already been uploaded.

Run from Claude Code in the Codespace:
    pip install pillow boto3 requests --break-system-packages
    set -a && source ./.env && set +a && python3 kings_spice_new_import.py

Env vars needed (.env): GOOGLE_API_KEY, R2_ENDPOINT, R2_ACCESS_KEY_ID,
R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL

What it does:
  1. Fetches Kings Spice's existing products (GET /products/merchant/1/all)
     and collects their names — this merchant's ~955 existing products all
     have barcode=None, so there's no barcode sequence to continue.
  2. Recursively lists every file in the Drive folder via the Drive API v3
     (files.list with an API key). Any subfolder literally named
     "Work in progress" is skipped entirely — not descended into.
  3. For each file, cleans the filename (strip extension, underscores ->
     spaces) and compares it against every existing product name with
     difflib.SequenceMatcher. Anything scoring >= 0.6 against an existing
     name is treated as already uploaded and skipped. Every skip/keep
     decision is logged to kings_spice_match_report.txt.
  4. Dedups the surviving "genuinely new" files against each other at the
     same 0.6 threshold (keeps the first alphabetically).
  5. For each genuinely-new file: categorizes it from the filename,
     generates a sequential HD-KS-[CATEGORY]-[NUM] barcode (starting at 1
     per category — there's no prior sequence to continue), downloads the
     file from Drive, compresses + uploads it to R2, and creates the
     product (stock=5, price=0), immediately hiding it (is_active=False)
     until pricing is confirmed with the merchant.

Safe to re-run: logs progress in kings_spice_new_processed.json and skips
files already imported.
"""

import os
import re
import sys
import json
import time
import random
import difflib
import requests
from pathlib import Path
from io import BytesIO
from PIL import Image, ImageOps
import boto3
from botocore.config import Config

# ---------------------------------------------------------------------------
MERCHANT_ID = 1
MERCHANT_CODE = "KS"
DRIVE_FOLDER_ID = "1I7VxYl7k5NQFCZldCgWvogXVJxS0OhFM"
EXCLUDE_FOLDER_NAMES = {"work in progress", "testing"}

# Filenames matching these patterns carry no recoverable product name
# (WhatsApp/Gemini export defaults, bare UUIDs, generic "image(s)" names).
JUNK_FILENAME_PATTERNS = [
    re.compile(r"^whatsapp image\b", re.IGNORECASE),
    re.compile(r"^images?\.", re.IGNORECASE),
    re.compile(r"^product image\b", re.IGNORECASE),
    re.compile(r"^gemini_generated_image", re.IGNORECASE),
    re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.", re.IGNORECASE),
]


def is_junk_filename(name: str) -> bool:
    return any(p.search(name) for p in JUNK_FILENAME_PATTERNS)
DOWNLOAD_DIR = Path("kings_spice_new_images")
LOG_FILE = Path("kings_spice_new_processed.json")
MATCH_REPORT_FILE = Path("kings_spice_match_report.txt")
SIMILARITY_THRESHOLD = 0.6

API_URL = os.environ.get("API_URL", "https://hamari-dukaan-production.up.railway.app")
GOOGLE_API_KEY = os.environ["GOOGLE_API_KEY"]

R2_ENDPOINT = os.environ["R2_ENDPOINT"]
R2_KEY_ID = os.environ["R2_ACCESS_KEY_ID"]
R2_SECRET = os.environ["R2_SECRET_ACCESS_KEY"]
R2_BUCKET = os.environ["R2_BUCKET"]
R2_PUBLIC_URL = os.environ["R2_PUBLIC_URL"]

DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"
FOLDER_MIME = "application/vnd.google-apps.folder"

DOWNLOAD_DELAY_SECONDS = 3.0
DOWNLOAD_MAX_RETRIES = 4
DOWNLOAD_RETRY_BACKOFF_SECONDS = [5, 15, 30, 60]
PRODUCT_DELAY_RANGE_SECONDS = (0.5, 1.5)

# ---------------------------------------------------------------------------
CATEGORY_RULES = [
    ("MT", ["chicken", "mutton", "goat", "beef", "fish", "prawn", "seafood", "meat",
            "kofta", "nihari", "murgh", "keema", "seekh"]),
    ("FZ", ["frozen", "samosa", "spring roll", "paratha", "roti", "naan", "momo", "kulfi",
            "ice cream", "cornetto", "magnum", "fish finger", "nugget", "keep frozen",
            "porotta", "parotta", "appam", "idiyappam", "chappati", "chapati", "puffs", "banana crisps",
            "pastry", "gow gee", "aloo tikki", "hara bhara kebab", "crispy fried chicken",
            "cutlet"]),
    ("DY", ["ghee", "milk", "cheese", "butter", "curd", "yogurt", "yoghurt", "paneer",
            "cream", "margarine", "dahi", "dairy whitener"]),
    ("RD", ["ready to eat", "minute khana", "heat & eat", "heat and eat", "curry mix",
            "biryani mix", "complete mix", "instant mix", "idly,chutney", "idli, chutney",
            "idli mix", "idli batter", "idly batter", "dosa mix", "dosa batter",
            "rice dosa", "upma", "uppuma", "manchurian", "shezwan", "schezwan",
            "lemon rice", "fried rice", "sambar mix", "sambar paste", "sambar", "rasam mix",
            "khichdi", "pulao", "kitchen king", "biryani essence", "bajji bonda",
            "biryani", "buriyani"]),
    ("PK", ["achar", "pickle", "chutney", "varatti", "mango pulp", "tamarind paste",
            "jack seeds in brine", "brine", "sauce", "mayonnaise", "ketchup", "harissa",
            "tomato paste"]),
    ("SW", ["halwa", "halva", "payasam", "ladoo", "laddu", "barfi", "kalakand", "rasgulla",
            "gulab jamun", "mithai", "kaju katli", "sweet", "jalebi", "rasmalai",
            "soan papdi", "kesari", "jaggery", "candy", "chikki", "brittle", "jam",
            "jelly crystal", "gajak", "dodol", "kalkandam", "palm candy", "gulkand",
            "panangkalkandu", "watalappan", "panjiri", "pudding"]),
    ("BK", ["biscuit", "buiscuit", "cookie", "cake", "bread", "bun", "cracker", "marie",
            "bakery", "pie", "bourbon"]),
    ("SN", ["murukku", "muruku", "mixture", "chips", "fryum", "namkeen", "bhujia",
            "chanachur", "nut cracker", "snack", "kurkure", "cheetos", "pringles",
            "puffed rice", "furandana", "chakli", "banana chips", "tapioca chips",
            "papad", "pappad", "appalam", "pappadam", "vadam", "cashew", "peanut",
            "raisin", "sultana", "kishmish", "munakka", "dates", "date bar", "almond",
            "walnut", "pumpkin seed", "sunflower seed", "dry fruit", "mix nuts",
            "mixed nuts", "cereal", "pani puri"]),
    ("ND", ["noodle", "chowmein", "vermicelli", "pasta", "spaghetti"]),
    ("BV", ["tea", "coffee", "juice", "drink", "sprite", "soda", "syrup", "sharbet",
            "squash", "cordial", "nectar", "energy drink", "malt", "faluda", "milo",
            "horlicks", "vinegar"]),
    ("OL", ["oil", "vanaspati"]),
    ("AT", ["atta", "flour", "maida", "besan", "semolina", "rava", "podi", "sattu",
            "almond meal", "gram flour", "gelatine", "gelatin"]),
    ("RC", ["agarbathi", "agarbatti", "incense", "camphor", "kumkum", "sindoor", "pooja",
            "puja", "dhoop", "joss stick", "rangoli", "sandalwood", "sandal wood",
            "havan", "diya"]),
    ("PL", ["dal", "dhal", "lentil", "chana", "gram", "chickpea", "beans", "pulse",
            "moong", "urad", "urid", "toor", "split peas", "soya", "soy protein",
            "soy textured"]),
    ("SP", ["masala", "spice", "powder", "chilli", "chili", "cumin", "coriander",
            "cardamom", "cinnamon", "salt", "pepper", "seasoning", "ajwain", "turmeric",
            "mustard", "fennel", "clove", "asafoetida", "hing", "goraka", "kudampuli",
            "cambodge", "gamboge", "tamarind", "star anise", "anise", "bay leaf",
            "bay leaves", "mace", "jathipathri", "rose water", "kewra water", "vanilla",
            "food colour", "food color", "flavour", "flavouring", "amchur", "anardana",
            "pomegranate seed", "garlic paste", "ginger paste"]),
    ("HB", ["soap", "shampoo", "toothpaste", "toothbrush", "hair colour", "hair color",
            "color naturals", "henna", "mehandi", "mehendi", "balm", "face wash",
            "cosmetic", "sandal", "cream & honey", "deodorant", "antiperspirant",
            "hand wash", "bleach", "wax strips", "cold wax", "face pack", "face scrub",
            "toner", "lotion", "hair dye", "hair gel", "body spray", "fragrance",
            "multani mitti"]),
    ("HH", ["detergent", "washing", "toilet paper", "mothball", "cleaning", "matches",
            "candle", "mosquito coil", "mosquito", "dengue", "spray cleaner",
            "disinfectant", "fabric conditioner", "garbage bag", "kitchen tidy",
            "bin bag", "wipes", "dishwash", "cockroach", "insect killer",
            "air freshener", "paper towel", "paper plate", "padlock"]),
    ("KW", ["kitchenware", "cookware", "utensil", "steel plate", "steel bowl", "spoon",
            "container", "frying pan", "paniyaram pan", "cake pan", "saucepan",
            "sauce pan", "roasting pan", "tawa", "vessel", "pot", "cooker", "kadai",
            "grater", "scraper", "knife", "chopper", "blender", "grinder", "mortar",
            "pestle", "idli maker", "idli stand", "jalie", "trivet", "cutlery",
            "scouring pad", "sponge", "gasket", "air fryer", "dhokla maker", "squeezer"]),
    ("MD", ["ayurvedic", "tablet", "laxative", "gripe water", "aloe vera", "churna",
            "ointment", "medicine", "diabecon", "triphala", "pain relief", "pain expert",
            "body pain", "antiseptic", "samahan", "asamodagam", "vicks", "iodex",
            "paspanguwa"]),
]

CATEGORY_NAMES = {
    "MT": "Meat", "FZ": "Frozen", "DY": "Dairy", "RD": "Ready Dishes", "PK": "Pickles",
    "SW": "Sweets", "BK": "Bakery", "SN": "Snacks", "ND": "Noodles", "BV": "Beverages",
    "OL": "Oils", "AT": "Atta/Flour", "RC": "Religious/Cultural", "PL": "Pulses",
    "SP": "Spices", "HB": "Health/Beauty", "HH": "Household", "KW": "Kitchenware",
    "MD": "Medicine", "GN": "General",
}


def categorize(text: str) -> str:
    t = text.lower().replace("_", " ").replace("-", " ")
    for code, keywords in CATEGORY_RULES:
        if any(re.search(rf"\b{re.escape(kw)}s?\b", t) for kw in keywords):
            return code
    return "GN"


def clean_filename(filename: str) -> str:
    """Strip extension and underscores for both comparison and display."""
    stem = Path(filename).stem
    stem = stem.replace("_", " ")
    return re.sub(r"\s+", " ", stem).strip()


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


# ---------------------------------------------------------------------------
def get_existing_names():
    res = requests.get(f"{API_URL}/products/merchant/{MERCHANT_ID}/all", timeout=30)
    res.raise_for_status()
    products = res.json()
    names = [p.get("name", "") for p in products if p.get("name")]
    print(f"Fetched {len(products)} existing Kings Spice products "
          f"({sum(1 for p in products if p.get('barcode') is None)} with barcode=None).")
    return names


def list_drive_files(folder_id):
    """Recursively list every file in the folder, skipping excluded subfolders."""
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
        for attempt in range(3):
            try:
                resp = requests.get(DRIVE_FILES_URL, params=params, timeout=60)
                resp.raise_for_status()
                break
            except requests.exceptions.RequestException:
                if attempt == 2:
                    raise
                time.sleep(10 * (attempt + 1))
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


def download_drive_file(file_id: str) -> bytes:
    """Download a Drive file, retrying 403s with exponential backoff before
    giving up and letting the caller log it as a genuine failure."""
    url = f"{DRIVE_FILES_URL}/{file_id}"
    attempt = 0
    while True:
        resp = requests.get(url, params={"alt": "media", "key": GOOGLE_API_KEY}, timeout=60)
        if resp.status_code == 403 and attempt < DOWNLOAD_MAX_RETRIES:
            wait = DOWNLOAD_RETRY_BACKOFF_SECONDS[attempt]
            print(f"403 from Drive, retrying in {wait}s "
                  f"(attempt {attempt + 1}/{DOWNLOAD_MAX_RETRIES})...", end=" ", flush=True)
            time.sleep(wait)
            attempt += 1
            continue
        resp.raise_for_status()
        return resp.content


def best_match(candidate: str, names):
    """Best difflib.SequenceMatcher ratio between candidate and a list of names."""
    best_ratio, best_name = 0.0, None
    sm = difflib.SequenceMatcher()
    sm.set_seq2(candidate.lower())
    for name in names:
        sm.set_seq1(name.lower())
        if sm.quick_ratio() < best_ratio:
            continue
        ratio = sm.ratio()
        if ratio > best_ratio:
            best_ratio, best_name = ratio, name
    return best_name, best_ratio


def filter_junk_filenames(files, report_lines):
    keep, junk_count = [], 0
    for f in files:
        if is_junk_filename(f["name"]):
            report_lines.append(f"SKIP  filename={f['name']!r}  reason=junk_filename (no usable product name)")
            junk_count += 1
        else:
            keep.append(f)
    return keep, junk_count


def filter_already_uploaded(files, existing_names, report_lines):
    genuinely_new = []
    for f in files:
        cleaned = clean_filename(f["name"])
        match_name, ratio = best_match(cleaned, existing_names)
        if ratio >= SIMILARITY_THRESHOLD:
            report_lines.append(
                f"SKIP  filename={f['name']!r}  matched_existing={match_name!r}  ratio={ratio:.3f}"
            )
        else:
            report_lines.append(
                f"NEW   filename={f['name']!r}  closest_existing={match_name!r}  ratio={ratio:.3f}"
            )
            genuinely_new.append(f)
    return genuinely_new


def dedup_new_files(files, report_lines):
    kept_files, kept_names = [], []
    for f in sorted(files, key=lambda x: x["name"].lower()):
        cleaned = clean_filename(f["name"])
        match_name, ratio = best_match(cleaned, kept_names)
        if ratio >= SIMILARITY_THRESHOLD:
            report_lines.append(
                f"DEDUP filename={f['name']!r}  matched_new={match_name!r}  ratio={ratio:.3f}"
            )
            continue
        kept_files.append(f)
        kept_names.append(cleaned)
    return kept_files


# ---------------------------------------------------------------------------
def gather_files_to_process(report_lines, verbose=True):
    """Fetch existing products + Drive files and return the genuinely-new,
    self-deduped file list. Shared by main() and --count-remaining."""
    def log(msg):
        if verbose:
            print(msg)

    log("Fetching existing Kings Spice products...")
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
    """Print REMAINING_NEW=<n> and exit, without downloading/importing anything.
    Used by run_kings_spice.sh once, up front, to compute the expected final
    product count (existing + genuinely-new)."""
    files_to_process, *_ = gather_files_to_process([], verbose=False)
    print(f"REMAINING_NEW={len(files_to_process)}")


def print_live_count():
    """Print LIVE_COUNT=<n>, the current merchant product count from the API.
    Cheap (no Drive calls) — used by run_kings_spice.sh after every restart
    to check progress without hammering Google's rate limiter."""
    res = requests.get(f"{API_URL}/products/merchant/{MERCHANT_ID}/all", timeout=30)
    res.raise_for_status()
    print(f"LIVE_COUNT={len(res.json())}")


def main():
    DOWNLOAD_DIR.mkdir(exist_ok=True)
    report_lines = []

    files_to_process, total_scanned, skipped_as_junk, skipped_as_duplicate = \
        gather_files_to_process(report_lines)

    MATCH_REPORT_FILE.write_text("\n".join(report_lines) + "\n")
    print(f"Match report written to {MATCH_REPORT_FILE}")

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

        time.sleep(random.uniform(*PRODUCT_DELAY_RANGE_SECONDS))

        product_name = clean_filename(f["name"])
        category = categorize(f["name"])
        log["counters"].setdefault(category, 0)
        log["counters"][category] += 1
        seq = log["counters"][category]
        barcode = f"HD-{MERCHANT_CODE}-{category}-{seq:03d}"

        print(f"[{i+1}/{len(files_to_process)}] {product_name} -> {barcode}...", end=" ", flush=True)

        try:
            raw = download_drive_file(f["id"])
        except Exception as e:
            print(f"FAILED download ({e})")
            failed += 1
            continue
        finally:
            time.sleep(DOWNLOAD_DELAY_SECONDS)

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
                "price": 0.0, "category": CATEGORY_NAMES.get(category, "General"),
                "emoji": "\U0001F4E6", "stock_qty": 5, "image_url": image_url,
                "barcode": barcode,
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
    print(f"Match report:               {MATCH_REPORT_FILE}")
    print("All imported products are hidden (is_active=False) with price=0 —"
          " confirm pricing with Kings Spice, then bulk-activate in the admin panel.")


if __name__ == "__main__":
    if "--count-remaining" in sys.argv:
        count_remaining()
    elif "--live-count" in sys.argv:
        print_live_count()
    else:
        main()
