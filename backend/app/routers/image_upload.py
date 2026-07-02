# backend/app/routers/image_upload.py

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
import boto3
from botocore.config import Config
import os
import re
import uuid
from PIL import Image
import io

router = APIRouter()

# ── R2 client ────────────────────────────────────────────────────────────────

def get_r2_client():
    return boto3.client(
        's3',
        endpoint_url=os.getenv('R2_ENDPOINT_URL'),
        aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
        config=Config(signature_version='s3v4'),
        region_name='auto'
    )

BUCKET = os.getenv('R2_BUCKET_NAME', 'hamari-dukaan-images')
PUBLIC_URL = os.getenv('R2_PUBLIC_URL', '')

def slugify(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')

# ── Image compression helper ──────────────────────────────────────────────────

def compress_image(file_bytes: bytes, max_size: int = 800) -> bytes:
    """Resize image to max 800px wide and compress to JPEG."""
    try:
        img = Image.open(io.BytesIO(file_bytes))
        if img.mode in ('RGBA', 'P', 'LA'):
            img = img.convert('RGB')
        if img.width > max_size or img.height > max_size:
            img.thumbnail((max_size, max_size), Image.LANCZOS)
        output = io.BytesIO()
        img.save(output, format='JPEG', quality=85, optimize=True)
        return output.getvalue()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image processing failed: {str(e)}")

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/upload/product-image/{product_id}")
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload product image to Cloudflare R2, update product record,
    AND save a copy to the shared library by product-name slug so future
    merchants with the same product can reuse it automatically."""

    allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG and WebP images allowed")

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB.")

    compressed = compress_image(file_bytes)

    # Look up product name for the library slug
    row = db.execute(text("SELECT name FROM products WHERE id = :pid"), {"pid": product_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Product not found")
    slug = slugify(row[0])

    filename = f"products/{product_id}/{uuid.uuid4().hex}.jpg"
    library_key = f"library/{slug}.jpg"

    try:
        r2 = get_r2_client()
        # Existing behaviour — per-product save (unchanged)
        r2.put_object(
            Bucket=BUCKET, Key=filename, Body=compressed,
            ContentType='image/jpeg', CacheControl='public, max-age=31536000'
        )
        # NEW — also save to shared library by product name
        r2.put_object(
            Bucket=BUCKET, Key=library_key, Body=compressed,
            ContentType='image/jpeg', CacheControl='public, max-age=31536000'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

    image_url = f"{PUBLIC_URL}/{filename}"

    db.execute(
        text("UPDATE products SET image_url = :url WHERE id = :pid"),
        {"url": image_url, "pid": product_id}
    )
    db.commit()

    return {"ok": True, "image_url": image_url}


@router.delete("/upload/product-image/{product_id}")
async def delete_product_image(product_id: int, db: Session = Depends(get_db)):
    """Remove product image from R2 and clear from DB. (Library copy is kept
    deliberately — other merchants may already be using it.)"""

    row = db.execute(
        text("SELECT image_url FROM products WHERE id = :pid"),
        {"pid": product_id}
    ).fetchone()

    if not row or not row[0]:
        raise HTTPException(status_code=404, detail="No image found")

    image_url = row[0]
    key = image_url.replace(f"{PUBLIC_URL}/", "")

    try:
        r2 = get_r2_client()
        r2.delete_object(Bucket=BUCKET, Key=key)
    except Exception:
        pass

    db.execute(
        text("UPDATE products SET image_url = NULL WHERE id = :pid"),
        {"pid": product_id}
    )
    db.commit()

    return {"ok": True}


@router.get("/library-check")
def check_library(name: str):
    """Check if a verified image already exists in the shared library
    for a given product name. Used when onboarding new merchants —
    if found, auto-assign instead of requiring staff upload."""
    slug = slugify(name)
    key = f"library/{slug}.jpg"
    try:
        r2 = get_r2_client()
        r2.head_object(Bucket=BUCKET, Key=key)
        return {"slug": slug, "exists": True, "url": f"{PUBLIC_URL}/{key}"}
    except Exception:
        return {"slug": slug, "exists": False, "url": None}

import httpx

@router.get("/proxy-image")
async def proxy_image(url: str):
    """Proxy R2 images to frontend for canvas editing without CORS issues."""
    from fastapi.responses import Response
    async with httpx.AsyncClient() as client:
        r = await client.get(url, timeout=15)
    return Response(content=r.content, media_type=r.headers.get('content-type', 'image/jpeg'),
                    headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache"})
