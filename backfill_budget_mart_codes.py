"""
One-off: assign proper HD-BM-[CATEGORY]-[NUM] codes to Budget Mart's
existing products (merchant_id=4), replacing their old slug-based
barcode values (which were only ever a dedup key from the original
import, not a real product code).

Run from Claude Code in the Codespace:
    python3 backfill_budget_mart_codes.py
"""

import os
import re
import requests

API_URL = os.environ.get("API_URL", "https://hamari-dukaan-production.up.railway.app")
MERCHANT_ID = 4
MERCHANT_CODE = "BM"

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


def categorize(name: str) -> str:
    name_lower = name.lower()
    for code, keywords in CATEGORY_RULES:
        if any(kw in name_lower for kw in keywords):
            return code
    return "GN"


def main():
    res = requests.get(f"{API_URL}/products/", params={"merchant_id": MERCHANT_ID}, timeout=30)
    res.raise_for_status()
    products = res.json()
    print(f"Found {len(products)} products for merchant_id={MERCHANT_ID}")

    counters = {}
    updated, failed = 0, 0

    for p in products:
        name = p.get("name", "")
        code = categorize(name)
        counters.setdefault(code, 0)
        counters[code] += 1
        seq = counters[code]
        new_barcode = f"HD-{MERCHANT_CODE}-{code}-{seq:03d}"
        new_category = CATEGORY_NAMES.get(code, "General")

        pid = p["id"]
        patch_res = requests.patch(
            f"{API_URL}/products/{pid}",
            json={"barcode": new_barcode, "category": new_category},
            timeout=10,
        )
        if patch_res.status_code in (200, 204):
            updated += 1
            if updated % 100 == 0:
                print(f"  ...{updated}/{len(products)}")
        else:
            print(f"FAILED #{pid} ({name}): {patch_res.status_code} {patch_res.text[:100]}")
            failed += 1

    print(f"\nDone. Updated: {updated}  Failed: {failed}")
    print("Category breakdown:")
    for code, count in sorted(counters.items(), key=lambda x: -x[1]):
        print(f"  {code} ({CATEGORY_NAMES.get(code, 'General')}): {count}")


if __name__ == "__main__":
    main()