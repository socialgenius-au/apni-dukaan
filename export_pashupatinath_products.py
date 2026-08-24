"""
Export all products for Hamro Pashupatinath Mart (merchant_id=7) to an .xlsx.
Run this INSIDE the Hamari Dukaan Codespace (it needs the live API + your .env).

Usage:
    set -a && source ./.env && set +a && python3 export_pashupatinath_products.py
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
            "Price": p.get("price"),
            "Stock": p.get("stock_qty"),
            "Active (Live on site)": p.get("is_active"),
        })

    df = pd.DataFrame(rows)

    if "Active (Live on site)" in df.columns:
        df = df.sort_values(
            by=["Active (Live on site)", "Category", "Product Name"],
            ascending=[False, True, True],
            na_position="last",
        )

    out_path = "/workspaces/hamari-dukaan/pashupatinath_products.xlsx"
    with pd.ExcelWriter(out_path, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="All Products")

        if "Active (Live on site)" in df.columns:
            live_df = df[df["Active (Live on site)"] == True]  # noqa: E712
            live_df.to_excel(writer, index=False, sheet_name="Live Only")

    print(f"Saved: {out_path}")
    print(f"Total products: {len(df)}")
    if "Active (Live on site)" in df.columns:
        print(f"Live (active) products: {(df['Active (Live on site)'] == True).sum()}")  # noqa: E712


if __name__ == "__main__":
    main()
