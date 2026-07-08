import requests

API = "https://hamari-dukaan-production.up.railway.app"

print("Fetching Kings Spice products...")
res = requests.get(f"{API}/merchants/1/products", timeout=30)
products = res.json()

print(f"Found {len(products)} active products - hiding all until merchant approves...")

done = 0
failed = 0
for p in products:
    try:
        r = requests.patch(f"{API}/products/{p['id']}", 
            json={"is_active": False, "stock_qty": 10}, timeout=8)
        if r.status_code == 200:
            done += 1
        else:
            failed += 1
        if done % 100 == 0:
            print(f"  {done}/{len(products)} done...")
    except Exception as e:
        failed += 1

print(f"Done! Hidden: {done}, Failed: {failed}")
print("Kings Spice products all hidden — ready for merchant approval.")
