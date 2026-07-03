from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Product
from pydantic import BaseModel
from typing import Optional, List
import csv
import io
import requests

router = APIRouter(prefix="/products", tags=["products"])


class ProductCreate(BaseModel):
    merchant_id: int
    name: str
    description: Optional[str] = None
    price: float
    cost_price: Optional[float] = None        # NEW
    threshold: Optional[int] = None           # NEW – low-stock alert level
    tax_type: Optional[str] = None            # NEW – "GST Free" / "Included GST" / "Excluded GST"
    category: Optional[str] = None
    emoji: Optional[str] = "📦"
    image_url: Optional[str] = None
    barcode: Optional[str] = None
    stock_qty: Optional[int] = 0


class ProductOut(BaseModel):
    id: int
    merchant_id: int
    name: str
    description: Optional[str]
    price: float
    cost_price: Optional[float]               # NEW
    threshold: Optional[int]                  # NEW
    tax_type: Optional[str]                   # NEW
    category: Optional[str]
    emoji: str
    image_url: Optional[str]
    barcode: Optional[str]
    stock_qty: int
    is_active: bool

    class Config:
        from_attributes = True


@router.get("/", response_model=List[ProductOut])
def get_products(category: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Product).filter(Product.is_active == True)
    if category:
        query = query.filter(Product.category == category)
    return query.all()


@router.post("/", response_model=ProductOut)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    data = product.dict()
    data['is_active'] = False  # Always hidden until merchant confirms price
    db_product = Product(**data)
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@router.post("/import-csv")
async def import_csv(merchant_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Accepts the Sathy ko Pasal CSV format:
        Product Name, Cost Price, Selling Price, Stock, Threshold, Tax, Category

    Also remains backward-compatible with the old template format:
        name, description, price, category, emoji, image_url, barcode, stock_qty
    """
    content = await file.read()
    decoded = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(decoded))
    imported = []
    errors = []

    for i, row in enumerate(reader, start=2):
        try:
            # ── Detect which CSV format we received ──────────────────────────
            is_new_format = "Product Name" in row and "Selling Price" in row

            if is_new_format:
                name = (row.get("Product Name") or "").strip()
                selling_price = row.get("Selling Price", "").strip()
                cost_price_raw = row.get("Cost Price", "").strip()
                stock_raw = row.get("Stock", "").strip()
                threshold_raw = row.get("Threshold", "").strip()
                tax_type = (row.get("Tax") or "").strip()
                category = (row.get("Category") or "").strip()
                description = ""
                emoji = "📦"
                image_url = None
                barcode = None
            else:
                # Legacy template format
                name = (row.get("name") or "").strip()
                selling_price = row.get("price", "").strip()
                cost_price_raw = ""
                stock_raw = row.get("stock_qty", "0").strip()
                threshold_raw = ""
                tax_type = ""
                category = (row.get("category") or "").strip()
                description = (row.get("description") or "").strip()
                emoji = (row.get("emoji") or "📦").strip()
                image_url = row.get("image_url", "").strip() or None
                barcode = row.get("barcode", "").strip() or None

            # ── Validation ────────────────────────────────────────────────────
            if not name or not selling_price:
                errors.append({"row": i, "reason": "Missing name or selling price"})
                continue

            # ── Safe type conversions ─────────────────────────────────────────
            def to_float(val, default=None):
                try:
                    return float(val) if val not in ("", None) else default
                except ValueError:
                    return default

            def to_int(val, default=None):
                try:
                    # Stock values are negative in source data (sold qty); store abs value
                    return abs(int(float(val))) if val not in ("", None) else default
                except ValueError:
                    return default

            product = Product(
                merchant_id=merchant_id,
                name=name,
                description=description or None,
                price=to_float(selling_price),
                cost_price=to_float(cost_price_raw),
                stock_qty=to_int(stock_raw, 0),
                threshold=to_int(threshold_raw),
                tax_type=tax_type or None,
                category=category or None,
                emoji=emoji,
                image_url=image_url,
                barcode=barcode,
            )
            db.add(product)
            imported.append(name)

        except Exception as e:
            errors.append({"row": i, "reason": str(e)})

    db.commit()
    return {
        "imported_count": len(imported),
        "imported": imported,
        "error_count": len(errors),
        "errors": errors,
    }


@router.post("/import-barcodes")
async def import_barcodes(merchant_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    decoded = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(decoded))
    imported = []
    errors = []
    for i, row in enumerate(reader, start=2):
        try:
            barcode = row.get("barcode", "").strip()
            price = row.get("price", "").strip()
            if not barcode or not price:
                errors.append({"row": i, "reason": "Missing barcode or price"})
                continue
            response = requests.get(
                f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json",
                timeout=5
            )
            data = response.json()
            if data.get("status") != 1:
                errors.append({"row": i, "reason": f"Barcode {barcode} not found"})
                continue
            p = data["product"]
            product = Product(
                merchant_id=merchant_id,
                name=p.get("product_name", barcode),
                description=p.get("ingredients_text", "")[:300] if p.get("ingredients_text") else None,
                price=float(price),
                cost_price=None,
                threshold=None,
                tax_type=None,
                category=p.get("categories", "").split(",")[0].strip() if p.get("categories") else None,
                image_url=p.get("image_url"),
                barcode=barcode,
                stock_qty=0,
                emoji="📦"
            )
            db.add(product)
            imported.append(p.get("product_name", barcode))
        except Exception as e:
            errors.append({"row": i, "reason": str(e)})
    db.commit()
    return {
        "imported_count": len(imported),
        "imported": imported,
        "error_count": len(errors),
        "errors": errors
    }


@router.get("/template/csv")
def download_template():
    from fastapi.responses import Response
    csv_content = (
        "Product Name,Cost Price,Selling Price,Stock,Threshold,Tax,Category\n"
        "Basmati Rice 5kg,11.00,18.99,50,10,GST Free,Rice & Grains\n"
        "Biryani Masala,1.50,4.99,100,20,GST Free,Spices & Masala\n"
    )
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=apnidukaan_product_template.csv"}
    )


@router.get("/merchant/{merchant_id}/all", response_model=List[ProductOut])
def get_all_merchant_products(merchant_id: int, db: Session = Depends(get_db)):
    """Admin endpoint - returns ALL products including hidden ones."""
    return db.query(Product).filter(Product.merchant_id == merchant_id).order_by(Product.id.desc()).all()

@router.get("/merchant/{merchant_id}", response_model=List[ProductOut])
def get_merchant_products(merchant_id: int, db: Session = Depends(get_db)):
    return db.query(Product).filter(
        Product.merchant_id == merchant_id,
        Product.is_active == True,
        Product.image_url != None,
        Product.description != None,
        Product.price != None,
        Product.category != None,
        Product.stock_qty > 0
    ).all()

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    cost_price: Optional[float] = None        # NEW
    threshold: Optional[int] = None           # NEW
    tax_type: Optional[str] = None            # NEW
    category: Optional[str] = None
    emoji: Optional[str] = None
    stock_qty: Optional[int] = None
    is_active: Optional[bool] = None
    barcode: Optional[str] = None

@router.patch("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, updates: ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in updates.dict(exclude_none=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"deleted": product_id}
