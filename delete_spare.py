import requests

API = "https://hamari-dukaan-production.up.railway.app"

print("Fetching all Sathy Ko products...")
res = requests.get(f"{API}/products/merchant/2/all", timeout=30)
products = res.json()

spare = [p for p in products if p.get('category') == 'Spare']
print(f"Found {len(spare)} Spare products to delete...")

done = 0
failed = 0
for p in spare:
    try:
        r = requests.delete(f"{API}/products/{p['id']}", timeout=8)
        if r.status_code in (200, 204):
            done += 1
        else:
            failed += 1
        if done % 100 == 0:
            print(f"  {done}/{len(spare)} deleted...")
    except:
        failed += 1

print(f"Done! Deleted: {done}, Failed: {failed}")
