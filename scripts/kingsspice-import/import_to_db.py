#!/usr/bin/env python3
"""
Kings Spice Mini Mart -> Hamari Dukaan DB + R2 import
=========================================================

Run this from the repo root:
    cd /workspaces/hamari-dukaan
    python3 scripts/kingsspice-import/import_to_db.py

Requires backend's .env (DATABASE_URL, R2_* vars) to be present, and
backend's Python deps installed (sqlalchemy, psycopg2-binary, boto3,
pillow, python-dotenv) — same environment your FastAPI app already uses.

What it does:
  1. Creates (or reuses) the "Kings Spice Mini Mart" merchant row with
     is_active=False (HIDDEN from customers until you flip it live).
  2. Uploads each local product image to R2 (same key pattern as your
     existing image_upload.py: products/{id}/{uuid}.jpg + library/{slug}.jpg).
  3. Inserts each product with:
       - real name, price, category, brand (stored in description prefix)
       - stock_qty = 10 (placeholder — correct once merchant confirms real stock)
       - description = real scraped one if present, else auto-generated
       - is_active = True (product itself is fine; the merchant-level flag
         is the single "Go Live" gate for the whole store)
  4. Idempotent: skips any product name already in the DB for this merchant,
     so it's safe to re-run if interrupted.

GOING LIVE: once you're ready, flip the merchant visible with:
    UPDATE merchants SET is_active = true WHERE id = <merchant_id>;
  or via your existing admin API:
    PATCH /admin/merchants/{merchant_id}   body: {"is_active": true}
"""

import csv
import io
import os
import re
import sys
import uuid
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]  # scripts/kingsspice-import/.. -> repo root
sys.path.insert(0, str(REPO_ROOT / "backend"))

from dotenv import load_dotenv
load_dotenv(REPO_ROOT / "backend" / ".env")

import boto3
from botocore.config import Config
from PIL import Image

from app.database import SessionLocal
from app.models.models import Merchant, Product

CSV_PATH = REPO_ROOT / "scripts" / "kingsspice-import" / "kingsspice_export" / "products.csv"

MERCHANT_NAME = "Kings Spice Mini Mart"
MERCHANT_EMAIL = "kingsspiceminimart@gmail.com"
MERCHANT_PHONE = "+61 2 9688 5222"
MERCHANT_SUBURB = "Pendle Hill"
MERCHANT_CATEGORY = "Grocery"

PLACEHOLDER_STOCK = 10

BUCKET = os.getenv("R2_BUCKET_NAME", "hamari-dukaan-images")
PUBLIC_URL = os.getenv("R2_PUBLIC_URL", "")


def get_r2_client():
    return boto3.client(
        "s3",
        endpoint_url=os.getenv("R2_ENDPOINT_URL"),
        aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def slugify(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def compress_image(file_bytes: bytes, max_size: int = 800) -> bytes:
    img = Image.open(io.BytesIO(file_bytes))
    if img.mode in ("RGBA", "P", "LA"):
        img = img.convert("RGB")
    if img.width > max_size or img.height > max_size:
        img.thumbnail((max_size, max_size), Image.LANCZOS)
    output = io.BytesIO()
    img.save(output, format="JPEG", quality=85, optimize=True)
    return output.getvalue()


def parse_price(raw: str) -> float:
    cleaned = re.sub(r"[^\d.]", "", raw or "0")
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def build_description(row: dict) -> str:
    existing = (row.get("description") or "").strip()
    if existing:
        return existing
    brand = (row.get("brand") or "").strip()
    name = (row.get("name") or "").strip()
    category = (row.get("categories") or "").split(",")[0].strip()
    prefix = f"{brand} " if brand else ""
    return f"{prefix}{name} — {category}, available at {MERCHANT_NAME}.".strip()


def get_or_create_merchant(db) -> Merchant:
    merchant = db.query(Merchant).filter(Merchant.email == MERCHANT_EMAIL).first()
    if merchant:
        print(f"Reusing existing merchant: id={merchant.id}, is_active={merchant.is_active}")
        return merchant
    merchant = Merchant(
        name=MERCHANT_NAME,
        description="Indian, Sri Lankan and Nepalese groceries in Pendle Hill.",
        suburb=MERCHANT_SUBURB,
        category=MERCHANT_CATEGORY,
        emoji="🏪",
        phone=MERCHANT_PHONE,
        email=MERCHANT_EMAIL,
        is_active=False,  # HIDDEN until you go live
        stripe_connected=False,
        payment_preference="platform",
    )
    db.add(merchant)
    db.commit()
    db.refresh(merchant)
    print(f"Created new merchant: id={merchant.id} (is_active=False, HIDDEN)")
    return merchant


def upload_image(r2, local_path: Path, product_id: int, slug: str) -> str | None:
    if not local_path.exists():
        return None
    try:
        raw = local_path.read_bytes()
        compressed = compress_image(raw)
    except Exception as e:
        print(f"    ! image compress failed for {slug}: {e}")
        return None

    key = f"products/{product_id}/{uuid.uuid4().hex}.jpg"
    library_key = f"library/{slug}.jpg"

    try:
        r2.put_object(Bucket=BUCKET, Key=key, Body=compressed,
                       ContentType="image/jpeg", CacheControl="public, max-age=31536000")
        r2.put_object(Bucket=BUCKET, Key=library_key, Body=compressed,
                       ContentType="image/jpeg", CacheControl="public, max-age=31536000")
    except Exception as e:
        print(f"    ! R2 upload failed for {slug}: {e}")
        return None

    return f"{PUBLIC_URL}/{key}"


def main():
    if not CSV_PATH.exists():
        print(f"CSV not found at {CSV_PATH}")
        sys.exit(1)

    rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8")))
    print(f"Loaded {len(rows)} products from CSV.\n")

    db = SessionLocal()
    r2 = get_r2_client()

    merchant = get_or_create_merchant(db)

    existing_names = {
        p.name for p in db.query(Product).filter(Product.merchant_id == merchant.id).all()
    }
    print(f"{len(existing_names)} products already in DB for this merchant (will be skipped).\n")

    imported, skipped, failed = 0, 0, 0

    for i, row in enumerate(rows, 1):
        name = (row.get("name") or "").strip()
        if not name:
            failed += 1
            continue
        if name in existing_names:
            skipped += 1
            continue

        category = (row.get("categories") or "").split(",")[0].strip() or None
        price = parse_price(row.get("price", ""))
        description = build_description(row)
        slug = row.get("slug") or slugify(name)

        product = Product(
            merchant_id=merchant.id,
            name=name,
            description=description,
            price=price,
            category=category,
            emoji="📦",
            stock_qty=PLACEHOLDER_STOCK,
            is_active=True,
        )
        db.add(product)
        db.commit()
        db.refresh(product)

        local_path = REPO_ROOT / "scripts" / "kingsspice-import" / row.get("local_image_path", "")
        image_url = upload_image(r2, local_path, product.id, slug)
        if image_url:
            product.image_url = image_url
            db.commit()

        imported += 1
        existing_names.add(name)
        print(f"  [{i}/{len(rows)}] {name} -> product_id={product.id}, image={'OK' if image_url else 'MISSING'}")

    print(f"\nDone. Imported: {imported}, Skipped (already existed): {skipped}, Failed: {failed}")
    print(f"\nMerchant id={merchant.id} is currently is_active={merchant.is_active} (HIDDEN from customers).")
    print("To GO LIVE, run this SQL (or use the admin API):")
    print(f"    UPDATE merchants SET is_active = true WHERE id = {merchant.id};")

    db.close()


if __name__ == "__main__":
    main()
