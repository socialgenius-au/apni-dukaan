"""
Export a blank, fillable price template for Hamro Pashupatinath Mart
(merchant_id=7) -- Product Name, Barcode, Category, and an empty Price
column for the merchant to fill in and hand back. Unlike
export_pashupatinath_products.py (which dumps the full current catalog
state), this is meant to go out to the merchant, not for internal review.

Run this INSIDE the Hamari Dukaan Codespace (it needs the live API + your .env).

Usage:
    set -a && source ./.env && set +a && python3 export_pashupatinath_price_template.py
"""

import os
import requests
import pandas as pd

API_URL = os.environ.get("API_URL", "https://hamari-dukaan-production.up.railway.app")
MERCHANT_ID = 7
MERCHANT_NAME = "Hamro Pashupatinath Mart"


def main():
    url = f"{API_URL}/products/merchant/{MERCHANT_ID}/all"
    print(f"Fetching from {url} ...")
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    products = resp.json()
    print(f"Fetched {len(products)} products for {MERCHANT_NAME}")

    rows = []
    for p in products:
        rows.append({
            "ID": p.get("id"),
            "Product Name": p.get("name"),
            "Category": p.get("category"),
            "Barcode": p.get("barcode"),
            "Price": None,  # blank for the merchant to fill in
        })

    df = pd.DataFrame(rows)
    df = df.sort_values(by=["Category", "Product Name"], ascending=[True, True], na_position="last")

    out_path = "/workspaces/hamari-dukaan/pashupatinath_price_template.xlsx"
    with pd.ExcelWriter(out_path, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Price Template")

    print(f"Saved: {out_path}")
    print(f"Total rows: {len(df)}")


if __name__ == "__main__":
    main()
