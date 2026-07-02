from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON
from datetime import datetime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Merchant(Base):
    __tablename__ = "merchants"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    suburb = Column(String, nullable=False)
    category = Column(String, nullable=False)
    emoji = Column(String, default="🏪")
    logo_url = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True, unique=True)
    password_hash = Column(String, nullable=True)
    abn = Column(String, nullable=True)
    gst_registered = Column(Boolean, default=False)
    stripe_account_id = Column(String, nullable=True)
    stripe_connected = Column(Boolean, default=False)
    payment_preference = Column(String, default="platform")
    bank_bsb = Column(String, nullable=True)
    bank_account = Column(String, nullable=True)
    bank_account_name = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    products = relationship("Product", back_populates="merchant")
    happy_hours = relationship("HappyHour", back_populates="merchant")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(Integer, ForeignKey("merchants.id"))
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    cost_price = Column(Float, nullable=True)          # NEW — purchase/cost price
    threshold = Column(Integer, nullable=True)         # NEW — low-stock alert level
    tax_type = Column(String, nullable=True)           # NEW — "GST Free" / "Included GST" / "Excluded GST"
    category = Column(String, nullable=True)
    emoji = Column(String, default="📦")
    image_url = Column(String, nullable=True)
    barcode = Column(String, nullable=True)
    stock_qty = Column(Integer, default=0)
    gst_applicable = Column(Boolean, default=False)
    gst_absorbed = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    merchant = relationship("Merchant", back_populates="products")

class HappyHour(Base):
    __tablename__ = "happy_hours"
    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(Integer, ForeignKey("merchants.id"))
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    discount_percent = Column(Float, nullable=False)
    max_orders = Column(Integer, default=25)
    orders_taken = Column(Integer, default=0)
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    merchant = relationship("Merchant", back_populates="happy_hours")

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(Integer, ForeignKey("merchants.id"))
    buyer_name = Column(String, nullable=False)
    buyer_email = Column(String, nullable=False)
    buyer_phone = Column(String, nullable=True)
    items = Column(JSON, nullable=False)
    subtotal = Column(Float, nullable=False, default=0)
    gst_amount = Column(Float, nullable=False, default=0)
    surcharge = Column(Float, nullable=False, default=0)
    total = Column(Float, nullable=False)
    commission_rate = Column(Float, nullable=False, default=0.10)
    commission = Column(Float, nullable=False)
    merchant_payout = Column(Float, nullable=False)
    payment_method = Column(String, default="card")
    status = Column(String, default="paid")
    promo_code = Column(String, nullable=True)
    promo_discount = Column(Float, default=0)
    ref_code = Column(String, nullable=True)
    stripe_session_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Article(Base):
    __tablename__ = "articles"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    body = Column(Text, nullable=True)
    category = Column(String, nullable=True)
    emoji = Column(String, default="📖")
    meta_description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ProductCategory(Base):
    __tablename__ = "product_categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)
