from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from pydantic import BaseModel
from typing import List

router = APIRouter()

class CategoryCreate(BaseModel):
    name: str

@router.get("/categories", response_model=List[str])
def get_categories(db: Session = Depends(get_db)):
    """Get all product categories."""
    # Auto-create table if not exists
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS product_categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """))
    db.commit()
    
    # Seed defaults if empty
    defaults = [
        'Biscuits & Snacks','Noodles & Instant Food','Rice & Grains',
        'Spices & Condiments','Sauces & Condiments','Tea & Drinks',
        'Fresh Produce','Oils & Ghee','Meat & Protein','Frozen & Dairy',
        'Sweets & Desserts','Bread & Bakery','General'
    ]
    count = db.execute(text("SELECT COUNT(*) FROM product_categories")).scalar()
    if count == 0:
        for d in defaults:
            try:
                db.execute(text("INSERT INTO product_categories (name) VALUES (:name) ON CONFLICT DO NOTHING"), {"name": d})
            except:
                pass
        db.commit()
    
    rows = db.execute(text("SELECT name FROM product_categories ORDER BY name")).fetchall()
    return [r[0] for r in rows]

@router.post("/categories", response_model=str)
def create_category(body: CategoryCreate, db: Session = Depends(get_db)):
    """Add a new product category."""
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Category name required")
    try:
        db.execute(text("INSERT INTO product_categories (name) VALUES (:name) ON CONFLICT DO NOTHING"), {"name": name})
        db.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return name
