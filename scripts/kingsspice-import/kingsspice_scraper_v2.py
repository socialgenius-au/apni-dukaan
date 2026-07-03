#!/usr/bin/env python3
"""
Kings Spice Mini Mart -> Hamari Dukaan product/image scraper (v2, combined)
==============================================================================

Single-pass version: discovers all products, downloads images, AND pulls
name, price, category, real brand (from WooCommerce brand taxonomy link),
and description — all in one run. No separate enrichment pass needed.

USAGE:
    pip install requests beautifulsoup4 --break-system-packages
    python3 kingsspice_scraper_v2.py

Outputs:
    ./kingsspice_export/images/<slug>.jpg
    ./kingsspice_export/products.csv
    ./kingsspice_export/progress.json

Safe to re-run / resumable.

IMPORTANT: once this finishes, back up kingsspice_export/ somewhere
outside this Codespace immediately (download as zip, or push to a
private git branch) — Codespaces are disposable and can be deleted,
taking all local files with them.
"""

import csv
import json
import re
import time
import sys
from pathlib import Path
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

BASE = "https://kingsspiceminimart.com.au"
SHOP_URL = f"{BASE}/shop/"
OUT_DIR = Path("kingsspice_export")
IMG_DIR = OUT_DIR / "images"
CSV_PATH = OUT_DIR / "products.csv"
PROGRESS_PATH = OUT_DIR / "progress.json"
DELAY_SECONDS = 1.0
MAX_PAGES = 500

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-AU,en;q=0.9",
    "Referer": BASE + "/",
}

session = requests.Session()
session.headers.update(HEADERS)
session.get(BASE + "/", timeout=20)


def get_soup(url):
    resp = session.get(url, timeout=20)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def discover_product_urls():
    urls = set()
    page = 1
    while page <= MAX_PAGES:
        page_url = SHOP_URL if page == 1 else f"{BASE}/shop/page/{page}/"
        try:
            soup = get_soup(page_url)
        except requests.HTTPError as e:
            if e.response is not None and e.response.status_code == 404:
                break
            raise
        links = soup.select("a.woocommerce-LoopProduct-link, li.product a[href*='/product/']")
        if not links:
            links = [a for a in soup.select("a[href*='/product/']")]
        found_this_page = set()
        for a in links:
            href = a.get("href")
            if href and "/product/" in href:
                found_this_page.add(href.split("?")[0])
        if not found_this_page:
            break
        new = found_this_page - urls
        urls |= found_this_page
        print(f"  page {page}: {len(found_this_page)} products ({len(new)} new, {len(urls)} total)")
        if not new and page > 1:
            break
        page += 1
        time.sleep(DELAY_SECONDS)
    return sorted(urls)


def parse_product(url):
    soup = get_soup(url)

    name_el = soup.select_one("h1.product_title")
    name = name_el.get_text(strip=True) if name_el else None

    price_el = soup.select_one("p.price, span.price")
    price = price_el.get_text(" ", strip=True) if price_el else None

    img_url = None
    og = soup.select_one('meta[property="og:image"]')
    if og and og.get("content"):
        img_url = og["content"]
    else:
        img_el = soup.select_one("div.woocommerce-product-gallery__image img, img.wp-post-image")
        if img_el:
            img_url = img_el.get("data-large_image") or img_el.get("src")

    cat_el = soup.select_one("span.posted_in")
    categories = cat_el.get_text(" ", strip=True).replace("Categories:", "").replace("Category:", "").strip() if cat_el else None

    brand = None
    brand_link = soup.select_one('a[href*="/brand/"]')
    if brand_link:
        brand = brand_link.get_text(strip=True)

    description = None
    desc_el = soup.select_one("#tab-description, div.woocommerce-product-details__short-description")
    if desc_el:
        text = desc_el.get_text(" ", strip=True)
        if text and text.lower() not in ("description", ""):
            description = text

    sku_el = soup.select_one("span.sku")
    sku = sku_el.get_text(strip=True) if sku_el else None

    slug = urlparse(url).path.strip("/").split("/")[-1]

    return {
        "slug": slug,
        "name": name,
        "price": price,
        "categories": categories,
        "brand": brand,
        "description": description,
        "sku": sku,
        "image_url": img_url,
        "product_url": url,
    }


def download_image(img_url, slug):
    if not img_url:
        return None
    ext = Path(urlparse(img_url).path).suffix or ".jpg"
    dest = IMG_DIR / f"{slug}{ext}"
    if dest.exists():
        return str(dest)
    try:
        r = session.get(img_url, timeout=20)
        r.raise_for_status()
        dest.write_bytes(r.content)
        return str(dest)
    except Exception as e:
        print(f"    ! image download failed for {slug}: {e}")
        return None


def load_progress():
    if PROGRESS_PATH.exists():
        return json.loads(PROGRESS_PATH.read_text())
    return {"done_urls": []}


def save_progress(progress):
    PROGRESS_PATH.write_text(json.dumps(progress, indent=2))


def main():
    OUT_DIR.mkdir(exist_ok=True)
    IMG_DIR.mkdir(exist_ok=True)

    print("Step 1: discovering all product URLs via /shop/ pagination...")
    product_urls = discover_product_urls()
    print(f"Discovered {len(product_urls)} unique product URLs.\n")

    progress = load_progress()
    done = set(progress["done_urls"])

    file_exists = CSV_PATH.exists()
    fieldnames = ["slug", "name", "price", "categories", "brand", "description",
                  "sku", "image_url", "product_url", "local_image_path"]
    csv_file = open(CSV_PATH, "a", newline="", encoding="utf-8")
    writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
    if not file_exists:
        writer.writeheader()

    print("Step 2: visiting each product page + downloading images...")
    for i, url in enumerate(product_urls, 1):
        if url in done:
            continue
        try:
            data = parse_product(url)
            local_path = download_image(data["image_url"], data["slug"])
            data["local_image_path"] = local_path or ""
            writer.writerow(data)
            csv_file.flush()
            done.add(url)
            progress["done_urls"] = list(done)
            save_progress(progress)
            print(f"  [{i}/{len(product_urls)}] {data['name']} -> brand={data['brand'] or '(none)'}")
        except Exception as e:
            print(f"  ! failed on {url}: {e}")
        time.sleep(DELAY_SECONDS)

    csv_file.close()
    print(f"\nDone. {len(done)} products saved to {CSV_PATH}, images in {IMG_DIR}/")
    print("\n⚠️  BACK THIS UP NOW — download kingsspice_export/ as a zip before this")
    print("   Codespace can be deleted/expire. See instructions below.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted — progress saved, just re-run the script to resume.")
        sys.exit(1)
