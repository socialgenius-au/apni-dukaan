import boto3
from botocore.config import Config
import requests
import re
import io
from PIL import Image

R2_ENDPOINT   = "https://81da884c5d0b7159937f72866643606b.r2.cloudflarestorage.com"
R2_BUCKET     = "hamari-dukaan-images"
R2_PUBLIC_URL = "https://pub-8eb11934703d45c890c798b7a3445f22.r2.dev"
R2_KEY_ID     = "6efe05ba34bf980e497a38a7b56f0ac9"
R2_SECRET     = "64b30c7d73c88e788feef41a456b85ed6048f03e0be35f1bdb5322f7f06a95b7"
API_URL       = "https://hamari-dukaan-production.up.railway.app"
MERCHANT_ID   = 2

PRODUCTS = [
    ("Century Sabji Masala","1xQlB7NSsK30ZpguNGxekpHutRmQVpzme"),
    ("Muri Puffed Rice 500g","1jHV_iwy8PFUdFl5D9TyxCQJ1fYBbtMc5"),
    ("KTM Nepali Mixture","1viXBlFkagiINLg6QPEjla2BMAZ5Sfotr"),
    ("Ruchi Chanachur 300g","1az0IIa7rp_IiAVHqoVEEvRXwSJJ_X6ke"),
    ("Chilly Crushed 200g","1W7ZdyDAof2Ke1fcMJxght7Xl8Rp3dC9A"),
    ("Drukcan Chatpate Sauce","1yAaurvjvt_rayX3fXbwhhAtKt9YbPt3T"),
    ("NAU Dalla Pickle 350g","1KWnk9ZXHgkwtcwegd_7cnL-kDQ7a2F57"),
    ("Kwiks Potato Chips","1LmJJ_BVnDPruez4OulebiTNHQjkNtXpV"),
    ("Neps Foods Chatpate Sauce 230g","1EyEJT2UNNCiJjz1rlotX6nWJAbh2vrs3"),
    ("Hama White Taichin Chiur","1KfWrrMjJVXFFAG--wv484mCZUoAg-QZY"),
    ("Century Chicken Masala","1OwgMM8q_wbQacqoNx1q0q7G1IXVxaPsI"),
    ("Springin Prawn Crackers 200g","1FHT0hFvdlJQ1w31GI7PSABLUWIj_Wdz1"),
    ("Saco Tamarind Chutney 500g","1eDyzXeoULuea_kVqE7tm-YKgFvTJl3Uy"),
    ("Masala Chai","19WE4WO1XbE5fzEfkDi_NQUOBvQYV_l2z"),
    ("Ching's Noodles","1vE-62n9W9PccW-2MQekPOVT1-voX2BU1"),
    ("Radhuni Mustard Oil 200ml","1HL7nLbCg7IX-XA6Fj_kWTo7KzUQ1I6dD"),
    ("Balducci Spaghettini","1zHH8HHpBovFc689hWKR6zCeUJb4qSoc4"),
    ("PRAN Mustard Oil","1p4mbJKd1xMdSQJ48OXcfQP1PsSN5J36K"),
    ("Saraswoti Alum 200g","1PmG93XajYLBvqug0Mr_EV3xz-XIPOhAE"),
    ("Premium Mustard Whole 250g","1_LqMnzROHejgRz1sW_jtQhW8s8rPlCAw"),
    ("4 Corner Bazaar Sesame Powder","1ainM7ybVcZcP7fjpnao8e7TOZxMhEUGT"),
    ("Century Sekuwa Masala","1Fr58iFQ3rx33SGpbWLOlQmHKe0W8WS7J"),
    ("Golden Geain Mills Besan 1Kg","1nQqswO81yM-uPCQuZnn8U1pu669nvpjw"),
    ("Cook Pure Ghee","1cCPv248H8M3LPKcads7kkU4U5fJHlfT6"),
    ("Laxmi Ghee","15tTdDoGa90UJtMZ-McROUG_Uxe3kBfDx"),
    ("Selco Khatta Meetha Mix","1kPLxDaslaDNJpzNBhzc0hjHyINUCJuWy"),
    ("Bikaji Tana-Tan","1sMnsFQza4ZF3P_jEP_KJwI8OF2mN3HMz"),
    ("4 Corner Bettar Potato Chips 180g","1OX2g1OVHi3zF5LCy8C77X7-MOXtsQDbY"),
    ("Century Panipuri Masala","1H6XAXf8Yj1uQ_Mc5LfZySOrCzWY4NJxo"),
    ("Mother's Sarson Ka Saag 850g","1wm9MnqEv791v-N2fI7lR4tY7b1Sdn0u-"),
    ("NAU Mutton Masala Mix 20g","1RVN9qUXGQsAnodyT4tCzKxR7MjjsHK4W"),
    ("BMC Meat Masala","1nMTmV1t2Qi7Qropq0Gxl8_P5DvLLX2vQ"),
    ("Century Chatpata Masala","1QVkLpUVF3TPkUsrKOsTB4_FRbYaj9bga"),
    ("Saraswoti Hemp Seeds 20g","1WGguVVIdkYgzJuonnAbS5ez1n3AkA27M"),
    ("Hama Timmur Powder","1Lh8LODa_I75dYY1IqQzP8mPKb3jGqHCW"),
    ("Tang Orange","140qixHFQjhrGKRQ8DuKU0_hGeuxAXFVP"),
    ("Griva's Kitchen Daal Moth","1stP4N2jG3Ewq3IvKrFOI3wtaJISP4S-9"),
    ("Radhuni Chilly Powder","1VCC9HyZHQGr3U3R7iOzFj9o96XBeGtPA"),
    ("Golden Farm Pure Ghee 400g","17nMK6lNwK-II1UmAuhNAqlPJ_PaHoHUq"),
    ("Century Biryani Masala","14zESgRhFwUGo39Zo5gJXJIeSuISOiX7F"),
    ("NAU Jwano Masala Mix 20g","12IGspJKGdHWcnZw1YOWeGkC2tOazsZb_"),
    ("NAU Thukpa Masala 20g","1_QZsqf2YddvSrUulYPTVKl0d3z-d04BI"),
    ("Tamicon Tamarind Concentrate","1SJWU94I73x7QVU3jXIyvUyLaIKPjfnQ3"),
    ("Century Garam Masala","1H4xMnaLeLXG-LI7yaQU64GM9F0q5Xj-L"),
    ("Century Chowmin Masala","1LHQngjtxIOazjmlfzU18fnMWZW6ZmZNQ"),
    ("Drukcan Furandana","1Z4fkDl9cv6e0w-eBG9UI_AvGpk1sHefp"),
    ("Sesame Powder","1-9TMMy5y9QyvzR4eFFK35L1BhbTanz_K"),
    ("Ahmed Mango Pickle 1Kg","12-x4boMd4rjM89pO0zFG8M5ypUyiQhXL"),
    ("Lays Chips","1EYVfJDZpieu7EJt4NA1UxD39SGuNKf5g"),
    ("Kozhi Koden Kerala Mixture","1iQlOg0oQq1HJxS6wqzsAbTJNWACdAxj2"),
    ("Selco Pesi Jaggery","1iHDU8W7R17w0XhGwGLaUOj_Xwc-r-nhX"),
    ("Bindabasini Furandana","1vHVxGCIiFDdJhO95Pi2919YOlG1bBGRH"),
    ("Sagoon Fitkiri","16BkcGP8QUbljhdptOL1GiF3hsdkbtih4"),
    ("Century Biryani Masala 100g","1Wn8IFLtHGEX1UYyRBUnCG2YE0XcytBKE"),
    ("BMC Momo Masala 50g","1lPn4C6uHcPcjDOIesz4hMeqwl8cznm_S"),
    ("ACI Pure Flattened Rice","1Nv_9x3v65_TBh06xNFfkedMy0MevKHCu"),
    ("Butter Bite Cashew Cookies Pack","1Y0TyC8BEWlsO91toMADrvfwEzjAepI6o"),
    ("Sel Roti Maker","1ywpwJM0wM-d3Tksl-zvmelW_sMV0C9ra"),
    ("Century Fish Masala","1i5Bq_4eUlfEIZnN5FCrBLaboWgmHlw49"),
    ("MAKVEL Kochylaki Pasta 500g","1Tpv5qf8KUSQfJ8iT6TzKVEXs2HPmqRET"),
    ("Teer Mustard Oil 1L","1-rqcvBDB1sO01t-CQL-hpyzlfmuqhCsh"),
    ("Freshco Mango Pulp 850g","1BzkXOH3gtGvK2DW_Jha1y2MSRTHPpdux"),
    ("Katoomba Red Chilly 250g","1Gp9rVqQ9rcs5aYbNo9_LwvgaxozZ3rM5"),
    ("Selco Cumin Whole 1Kg","1MrpZnqGogVOsmo1tfqqLsVGXDLYwMomJ"),
    ("Selco Cumin Whole 500g","1czXJ4spIiV1BvXb0vG9zw0b2p4kpCykl"),
    ("MAKVEL Pasta 500g","10XUHdIl3vV8HSzUDNLxh1xZ5xuuyi012"),
    ("Mother's Recipe Biryani Masala","1LqE5WCFtSNbfzTEqmCJVide74-ijbT6S"),
    ("Khasi Ko Masu","1zBSaG2n17DqYmtXIt_aOEv6CqXOt-DcA"),
    ("Selco Coriander Whole 500g","1QJRjX9jp3RadnJhR6he-9T_6i3Jwn_qa"),
    ("Katoomba Red Chilly Powder 1Kg","197Sh6VMGdxK5L34SbhlmF5b5vEugZFxU"),
    ("Nawabi Chilly","1swzLyhAa5HyrxC971nxxVeyzKwt9kI7R"),
    ("GRB Ghee","1MopJZFUSsdTq-6QSThD-0uN5qiGlovp1"),
    ("NAU JWANO Masala Mix 20g","1uCNCpctR6g0MIR3h9VBCZbp78tKm1meu"),
    ("NAU Chicken Masala Mix","15qaHyoUHLBiEh0xNI9RVcYiTu6Gb8plo"),
    ("Katoomba Paprika Powder","14KSbOm4YWuRsTt9XyfoXXtJUL7drOb-n"),
    ("Mother's Kasuri Methi","1bVXOqYGi10NqxorD1tKRNTVAajsKoe0l"),
    ("Swadilo Corn Flour","1QpbfaaOvRevBFh7MkEykMAX4E8GD9nNV"),
    ("Urid Dal Chilka 1Kg","1rs6h8tDQheYm7NJ3Rzi90WoVNSfdAUuT"),
    ("Mixed Dal 1Kg","13GhjnKlBQl6oaqIE1vxxOm6V5nkuHeWI"),
    ("Selco Blue Peas 1Kg","1B0D-kyAC5Iict1sU40oJb3NsSpkboKgr"),
    ("Corn Grits","1fqPO8-MeKU_1mgIHGG83Qm9-2Y6EmADC"),
    ("Selco Garam Masala 100g","1uu7_54Y_IApOBdhKShHbdB78qreYD51P"),
    ("Toor Dal 1Kg","1WJy6HV72xM-reM_egLxNCzYu51ldQ6f6"),
    ("Brown Chana 1Kg","1ue7mkiX8Vmp7uScgti9H9ZJCeArx3Lpr"),
    ("Gajanand Kidney Beans 1Kg","1KYMM481uy79sjLzX1fMn7AcolmlEIMHQ"),
    ("Nature Products Barley Flour","1Tqlm_vL-aZgetRs8uHbISOG1q1Xhm0f8"),
    ("Gajanand Dry Coconut Whole","18vQ1cU-m8ZE2zfHA4YhQZBndgKq7Mppg"),
    ("Soya Chunks","1mHVi1AQyxqnAcPXhyt_uTWI5MfBiMzkl"),
    ("Kidney Beans 1Kg","1cmhGFikbTA3D_H7sQlB-cBW31HiRSc5U"),
    ("Selco Red Lentil 1Kg","10F2xrnER-pbDF0us2gWcRGvJPKBOjsyN"),
    ("Gajanand Red Kidney Beans 1Kg","1penxLs4vTR_gJ-SbBdMyd5YcD9ePdYmW"),
    ("Uttam Besan 900g","1gdQoZA3R4BdenSY87MqD7MKtFxrbzPnU"),
    ("Sagoon Mix Sattu","1mcrn3Q_UnE25r-_eK0pEDZzsVFxN2vot"),
    ("Nepali Rice Flour","1YxITMwCCfnRndG6RUdaXEj3enemeO1je"),
    ("Selco Wheat Flour","1FmEVpYx1K8LBDbB9Ht7Y2skt4yu41B1Q"),
    ("Vatana White Peas 1Kg","1KqQdF2eMeA7O5pa5u3vfp3ijcRNAK6lJ"),
    ("Cumin Coriander Powder 200g","19Yp9kMdSP8YXS8X2orskegXvEGeJ5IJj"),
    ("Roasted Horse Gram 500g","1JWWjInrNUPEl4Qme8DU72UP9aUB-pUcl"),
    ("Mixed Dal 1Kg 2","1yONCeHlumtnrPS4Z7CGr7crs_nVzFGIw"),
    ("Selco White Peas 1Kg","1-qW4LXUXWc67GopkPVjkROpbahWPq1HO"),
    ("Selco Plain Flour","1tpNtEw4qUgXWSicZf7rfRnmWdChnDkAn"),
    ("Uttam Soya Wadi","1QiGHPnA6p9ZwKhel8PBQ9vjwhs6UGchU"),
    ("Black Pepper 200g","1hyUVehJ_n0-EuGjwUN1flU6nbHNx7_bZ"),
    ("Selco Sugar 1Kg","1duEZCyJBedN62MLtsF7cso7euSNUfAMc"),
    ("Selco Cumin Coriander Powder","1m8Idz2nHDTrcBcAs8kZJiKIvz7Yqg2sk"),
    ("Selco Sesame White","1BIGlw7WHGU8vCfiInz03rzF5O5y_YB19"),
    ("Swadil Chiwra","19l_vvFiDdCxhndnIzq5XbB8WrkrcPzXc"),
    ("Turmeric 200g","1zh-SRlDKWBql93UqcmTr_q7dELmfNQ7r"),
    ("Selco Cassia Thin Sticks","16UAFmphAFSKXjxmr3aLSYH4sqOgDjxS_"),
    ("Gajanand Soyabean","1AuBNIRDAuncmrMUHtPWkJLxCI46rluJD"),
    ("Pattu Moong Dhal","1Ajg1TukiMWRe901v34fpf3oJyPyLkPkH"),
    ("Selco Cloves 200g","1VTXc2_53cGJN8Lw8i1EhZBve3AvLFsHk"),
    ("Katoomba Fennel Seeds","17xCJjsWfFqHK3CycyOr7wEb__RgCSKZx"),
    ("Gajanand Saboodana","1iAGaxTkKwTYIk9ThKaAEUUAmPZy_jnyK"),
    ("Selco Soya Bean","1OoPBsHhT1M61JoQqvS5Oc6HAcR9UUS1Z"),
    ("Almond Raw 200g","1QhXQbkADExoseGwKhOSXXT9Jd-sVP25-"),
    ("Rice Flour Fine 1Kg","1udwCcKzeXJ2h9PIvWisB1HJ6JoXtbkKE"),
    ("Pattu Moong Dhal 2","1Pzi_mK8d7_38KGCvR3ZzToMrCxi9BZvr"),
    ("Selco Peanut Raw 1Kg","1mAncvi_wR9NBFdgsrBORQWCfpeWZHZK3"),
    ("Semolina Coarse 1Kg","1audE4O23OL37IfnwmrONE5T2dFliKPGS"),
    ("Urid Chilka 1Kg","1CDX0enxNMAiYl9Kp5MhydGPdZRrduF2C"),
    ("Dabur Red Toothpaste","1aA9GMwDe_64VlrfGZcwkM1-hr7QwwObb"),
    ("Selco Raw Sugar","1VAWcD-JBf7eXYmPwnU4zudX_b8rQ5XmB"),
    ("Saraswoti Ajwain","1jeARYwR3QFla3_tBiUkAyx667a-IVBZ-"),
    ("Selco White Sugar","126ny9l8jFK7uVbjdDd1CeHTTKnkpDvhq"),
    ("Bhutan Mix","1n6GEufiTjG-YptYr7w4rIayc2cwBAc7n"),
    ("Gajanand Black Pepper","1S-9YEnedhNCvQVT06Zo6yJOit8z-0wZe"),
    ("Goat Khutti","1I58kElR43g_-EHLS8htLWVtHuuBtgvRV"),
    ("Masaura Dried","1swEYhA0RoObRtmzXCtaA1mLY8eBrWq1b"),
    ("Goat Skin Off","1tbxeVFwlgY64o8CfePbh1aaZVe3L0Bxh"),
    ("Selco Cloves","1dCC_IoHeoM-Fx59NtEinj_xa-XlhWo3s"),
    ("Wagh Bakri Masala Chai","1cNQgusnaSNOiBhxp0hpprJE2sJB3Wq8O"),
    ("Rice Balls","15vJYNjeF8hdj-xYwqupp1h7f03h17XN6"),
    ("Springin Choco Pie","1Gg9689mt5C_Iq2tBuQPLFFXzGxT26RcP"),
    ("Morning Fresh Lime Dishwashing","1jL6jA2sMwC8ao-_QxNR1bNcovLJypEF5"),
    ("Uttam Black Salt","1z6LrPRWYGPavViujmQRqIXtvKyzRg3Kk"),
    ("Green Cardamom 200g","1kJFqML1APAdE2ysuqo5Fg6HeGVPUGTPH"),
    ("Selco Premium Basmati Rice","1Hmcrq_VzFg44ntOypmH7JpBE8yvbzYAb"),
    ("Morning Fresh Lime Dishwashing 400ml","1ETOvaY0E1n3rpVB8LkI8rjE0zrWj7fdl"),
    ("Boer Goat Skin On","1wL6HKhK0SSn6CpPgzZzXaGHpE91orRws"),
    ("Selco Ajino Moto MSG 1Kg","19lzVngCbbJz5uHy1BYOKWf7Pdc7NquY3"),
    ("Naga Chilly","1YxZ84-gnIpoj5q5TpD-sIvxepx0hqpOx"),
    ("Selco Ajino Moto 500g","1UgPkvosV6M_0qKshkXQGtvorwIJIwLZp"),
    ("Fatty Runner Beef Intestine","1AsQA3AzrcWKXw_yVqOIKKHROcXOL67nb"),
    ("Black Salt","1AH9mpdzSx8ervpqG1WbXAv_BH5JztFsO"),
    ("BAPS Chicken Momo","1XLTcR_DDNHlWcx4iMdb0iZ20ratTwVgl"),
    ("Clove Cinnamon","1b6xbafcytMP7UXkXIe3rJSOQvAD3NG0t"),
    ("Freshco Black Cardamom","1svsTvoXG4STygjiomMkW1dIcJdSAYayt"),
    ("Nawabi Pure Sunflower Oil","1HrhbhCaeFDLvhQe_D4Y5rFo4Ne8GEXnh"),
    ("Local Chicken","1UYgiTEEIUTmUeyWTwsC-SIXbubu23q4K"),
    ("Chicken Curry","1ux-kL-LTN-gnB4HuxjcB-bZejpFKDETk"),
    ("Premium Onions","1JDGUiyuWqsfe2I7aoJrWrC6s7PdGlG_R"),
]

def slugify(name):
    s = name.lower().strip()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')

def compress_image(data):
    img = Image.open(io.BytesIO(data))
    try:
        from PIL import ImageOps
        img = ImageOps.exif_transpose(img)
    except:
        pass
    if img.mode in ('RGBA', 'P', 'LA'):
        img = img.convert('RGB')
    if img.width > 800 or img.height > 800:
        img.thumbnail((800, 800), Image.LANCZOS)
    out = io.BytesIO()
    img.save(out, format='JPEG', quality=85, optimize=True)
    return out.getvalue()

def download_drive_image(file_id):
    url = f"https://drive.google.com/uc?export=download&id={file_id}"
    session = requests.Session()
    r = session.get(url, stream=True, timeout=30)
    for key, value in r.cookies.items():
        if 'download_warning' in key:
            url = f"https://drive.google.com/uc?export=download&confirm={value}&id={file_id}"
            r = session.get(url, stream=True, timeout=30)
            break
    if r.status_code != 200:
        return None
    content = b''
    for chunk in r.iter_content(chunk_size=32768):
        content += chunk
    return content if len(content) > 1000 else None

r2 = boto3.client('s3', endpoint_url=R2_ENDPOINT, aws_access_key_id=R2_KEY_ID,
    aws_secret_access_key=R2_SECRET, config=Config(signature_version='s3v4'), region_name='auto')

print(f"Creating {len(PRODUCTS)} new products (hidden for Priya/Sameena review)...")
created = 0
failed = 0

for i, (name, drive_id) in enumerate(PRODUCTS):
    print(f"[{i+1}/{len(PRODUCTS)}] {name}...", end=" ", flush=True)
    img_data = download_drive_image(drive_id)
    if not img_data:
        print("❌ download")
        failed += 1
        continue
    try:
        compressed = compress_image(img_data)
    except:
        print("❌ compress")
        failed += 1
        continue
    slug = slugify(name)
    r2_key = f"products-live/{slug}.jpg"
    try:
        r2.put_object(Bucket=R2_BUCKET, Key=r2_key, Body=compressed,
            ContentType='image/jpeg', CacheControl='public, max-age=31536000')
        image_url = f"{R2_PUBLIC_URL}/{r2_key}"
    except:
        print("❌ R2")
        failed += 1
        continue
    try:
        res = requests.post(f"{API_URL}/products/", json={
            "merchant_id": MERCHANT_ID,
            "name": name,
            "description": "",
            "price": 0.0,
            "category": "General",
            "emoji": "📦",
            "stock_qty": 5,
            "image_url": image_url,
        }, timeout=15)
        if res.status_code in (200, 201):
            pid = res.json().get('id')
            requests.patch(f"{API_URL}/products/{pid}", json={"is_active": False}, timeout=10)
            print(f"✅ #{pid} (hidden)")
            created += 1
        else:
            print(f"❌ DB {res.status_code}")
            failed += 1
    except:
        print("❌ DB error")
        failed += 1

print(f"\n✅ Created: {created}  ❌ Failed: {failed}")
print("All hidden — Priya/Sameena to review in admin → activate when ready.")
