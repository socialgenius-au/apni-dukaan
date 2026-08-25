"""
Asan Bazaar — process local files only, no Drive download attempts.

Reuses the exact logic from asan_bazaar_pipeline.py (categorize, compress,
R2 upload, product creation, dedup, logging) but skips list_drive_files()
and download_drive_file() entirely — those ~51 remaining files already
fail with persistent 403s and just waste hours of retry backoff.

Run after manually downloading more files into asan_bazaar_images/.
"""
import asan_bazaar_pipeline as p

DOWNLOAD_DIR = p.DOWNLOAD_DIR

all_local = sorted([f for f in DOWNLOAD_DIR.iterdir() if f.is_file()])
print(f"{len(all_local)} files on disk. Running dedup...")
files_to_process = p.dedup(all_local)

log = p.load_log()
r2 = p.boto3.client(
    "s3", endpoint_url=p.R2_ENDPOINT, aws_access_key_id=p.R2_KEY_ID,
    aws_secret_access_key=p.R2_SECRET, config=p.Config(signature_version="s3v4"),
    region_name="auto",
)

created, skipped, failed = 0, 0, 0

for i, path in enumerate(files_to_process):
    key = path.name
    if key in log["processed"]:
        skipped += 1
        continue

    product_name = p.clean_product_name(path.stem)
    category = p.categorize(path.name)
    log["counters"].setdefault(category, 0)
    log["counters"][category] += 1
    seq = log["counters"][category]
    barcode = f"HD-{p.MERCHANT_CODE}-{category}-{seq:03d}"

    print(f"[{i+1}/{len(files_to_process)}] {product_name} -> {barcode}...", end=" ", flush=True)

    try:
        compressed = p.compress_image(path.read_bytes())
    except Exception as e:
        print(f"FAILED compress ({e})")
        failed += 1
        continue

    slug = p.slugify(f"{p.MERCHANT_CODE}-{product_name}")
    r2_key = f"products-live/{slug}.jpg"
    try:
        r2.put_object(Bucket=p.R2_BUCKET, Key=r2_key, Body=compressed,
                       ContentType="image/jpeg", CacheControl="public, max-age=31536000")
        image_url = f"{p.R2_PUBLIC_URL}/{r2_key}"
    except Exception as e:
        print(f"FAILED R2 upload ({e})")
        failed += 1
        continue

    try:
        res = p.requests.post(f"{p.API_URL}/products/", json={
            "merchant_id": p.MERCHANT_ID, "name": product_name, "description": "",
            "price": 0.0, "category": category, "emoji": "\U0001F4E6",
            "stock_qty": 5, "image_url": image_url, "barcode": barcode,
        }, timeout=15)
        if res.status_code in (200, 201):
            pid = res.json().get("id")
            p.requests.patch(f"{p.API_URL}/products/{pid}", json={"is_active": False}, timeout=10)
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
        p.save_log(log)

p.save_log(log)
print(f"\nDone. Created: {created}  Skipped: {skipped}  Failed: {failed}")
print("All hidden — check pricing with Asan Bazaar, then bulk-activate in the admin panel.")
