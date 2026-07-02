from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.database import engine, Base
from app.routers import merchants, products, happyhours, orders, payments, auth, promo, admin, tasks, image_upload, staff_bulk, staff_access, categories
import app.models.models as models
import os
load_dotenv()
models.Base.metadata.create_all(bind=engine)
app = FastAPI(title="Hamari Dukaan API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
app.include_router(merchants.router)
app.include_router(products.router)
app.include_router(happyhours.router)
app.include_router(orders.router)
app.include_router(payments.router)
app.include_router(auth.router)
app.include_router(promo.router)
app.include_router(admin.router)
app.include_router(tasks.router, prefix="/tasks")
app.include_router(image_upload.router)
app.include_router(staff_bulk.router)
app.include_router(staff_access.router)
app.include_router(categories.router)
@app.get("/")
def root():
    return {"status": "ok", "message": "Hamari Dukaan API is running"}
@app.get("/health")
def health():
    return {"status": "healthy"}
@app.post("/seed")
def seed_data(db=__import__('fastapi').Depends(__import__('app.database', fromlist=['get_db']).get_db)):
    from app.models.models import Merchant, Product
    if db.query(Merchant).count() > 0:
        return {"message": "Already seeded"}
    merchants_data = [
        Merchant(name="King Spice & Mini Mart", suburb="Pendle Hill", category="Spice Shop", emoji="🌶️", description="Premium spices and groceries from the subcontinent", phone="02 9123 4567"),
        Merchant(name="Al Madina Halal Meats", suburb="Auburn", category="Halal Butcher", emoji="🥩", description="Fresh halal meats delivered daily", phone="02 9234 5678"),
        Merchant(name="Lahori Sweets & Bakers", suburb="Lakemba", category="Bakery", emoji="🍮", description="Authentic Pakistani sweets and freshly baked goods", phone="02 9345 6789"),
        Merchant(name="Spice Route Grocers", suburb="Merrylands", category="Grocery", emoji="🛒", description="Your one-stop South Asian grocery store", phone="02 9456 7890"),
    ]
    for m in merchants_data:
        db.add(m)
    db.flush()
    products_data = [
        Product(merchant_id=merchants_data[0].id, name="Shan Biryani Masala", price=4.99, emoji="🌶️", category="Spices", stock_qty=100),
        Product(merchant_id=merchants_data[0].id, name="National Chilli Powder 500g", price=6.50, emoji="🌶️", category="Spices", stock_qty=80),
        Product(merchant_id=merchants_data[0].id, name="Basmati Rice 5kg", price=18.99, emoji="🍚", category="Rice", stock_qty=50),
        Product(merchant_id=merchants_data[0].id, name="Rooh Afza 800ml", price=12.99, emoji="🍹", category="Drinks", stock_qty=40),
        Product(merchant_id=merchants_data[1].id, name="Halal Lamb Chops 1kg", price=22.99, emoji="🥩", category="Meat", stock_qty=30),
        Product(merchant_id=merchants_data[1].id, name="Whole Chicken Halal", price=14.99, emoji="🍗", category="Meat", stock_qty=25),
        Product(merchant_id=merchants_data[2].id, name="Gulab Jamun 1kg", price=16.99, emoji="🍮", category="Sweets", stock_qty=20),
        Product(merchant_id=merchants_data[2].id, name="Samosa Dozen", price=9.99, emoji="🥟", category="Snacks", stock_qty=15),
        Product(merchant_id=merchants_data[3].id, name="Toor Daal 2kg", price=11.99, emoji="🫘", category="Lentils", stock_qty=60),
        Product(merchant_id=merchants_data[3].id, name="Mustard Oil 1L", price=8.99, emoji="🫙", category="Oils", stock_qty=45),
    ]
    for p in products_data:
        db.add(p)
    db.commit()
    return {"message": "Seeded successfully", "merchants": len(merchants_data), "products": len(products_data)}
