from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Order, Merchant
from app.email_service import (
    send_order_confirmed_customer,
    send_order_confirmed_merchant,
    send_order_ready_customer,
    send_order_delivered_customer,
    send_order_delivered_merchant
)
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import os

router = APIRouter(prefix="/orders", tags=["orders"])

class OrderItem(BaseModel):
    product_id: int
    name: str
    price: float
    qty: int
    emoji: Optional[str] = ""

class OrderCreate(BaseModel):
    merchant_id: int
    buyer_name: str
    buyer_email: str
    buyer_phone: Optional[str] = None
    items: List[OrderItem]

class OrderOut(BaseModel):
    id: int
    merchant_id: int
    buyer_name: str
    buyer_email: str
    buyer_phone: Optional[str]
    items: list
    total: float
    commission: float
    merchant_payout: float
    status: str
    created_at: datetime
    class Config:
        from_attributes = True

COMMISSION_RATE = 0.10

@router.post("/", response_model=OrderOut)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    merchant = db.query(Merchant).filter(Merchant.id == order.merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    total = sum(item.price * item.qty for item in order.items)
    commission = round(total * COMMISSION_RATE, 2)
    merchant_payout = round(total - commission, 2)
    db_order = Order(
        merchant_id=order.merchant_id,
        buyer_name=order.buyer_name,
        buyer_email=order.buyer_email,
        buyer_phone=order.buyer_phone,
        items=[item.dict() for item in order.items],
        total=total,
        commission=commission,
        merchant_payout=merchant_payout,
        status="paid"
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    items_list = [item.dict() for item in order.items]
    try:
        send_order_confirmed_customer(
            buyer_email=order.buyer_email,
            buyer_name=order.buyer_name,
            order_id=db_order.id,
            total=total,
            merchant_name=merchant.name,
            merchant_phone=merchant.phone or "",
            items=items_list
        )
        send_order_confirmed_merchant(
            merchant_email=merchant.email,
            merchant_name=merchant.name,
            order_id=db_order.id,
            buyer_name=order.buyer_name,
            buyer_phone=order.buyer_phone or "",
            buyer_email=order.buyer_email,
            total=total,
            payout=merchant_payout,
            items=items_list
        )
    except Exception as e:
        print(f"Email error on create: {e}", flush=True)
    return db_order

@router.get("/merchant/{merchant_id}", response_model=List[OrderOut])
def get_merchant_orders(merchant_id: int, db: Session = Depends(get_db)):
    return db.query(Order).filter(
        Order.merchant_id == merchant_id
    ).order_by(Order.created_at.desc()).all()

@router.patch("/{order_id}/status")
def update_order_status(order_id: int, status: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if status not in ["paid", "ready", "fulfilled", "cancelled"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    order.status = status
    db.commit()
    merchant = db.query(Merchant).filter(Merchant.id == order.merchant_id).first()
    items = order.items or []
    if status == "ready":
        try:
            send_order_ready_customer(
                buyer_email=order.buyer_email,
                buyer_name=order.buyer_name,
                order_id=order.id,
                merchant_name=merchant.name if merchant else "",
                merchant_phone=merchant.phone if merchant else "",
                items=items
            )
        except Exception as e:
            print(f"Ready email error: {e}", flush=True)
    if status == "fulfilled":
        try:
            from sqlalchemy import cast, Date
            from datetime import date
            today_orders = db.query(Order).filter(
                Order.merchant_id == order.merchant_id,
                Order.status == "fulfilled",
                cast(Order.created_at, Date) == date.today()
            ).all()
            daily_count = len(today_orders)
            daily_total = sum(o.merchant_payout for o in today_orders)
            send_order_delivered_customer(
                buyer_email=order.buyer_email,
                buyer_name=order.buyer_name,
                order_id=order.id,
                merchant_name=merchant.name if merchant else "",
                total=order.total,
                items=items
            )
            send_order_delivered_merchant(
                merchant_email=merchant.email if merchant else "",
                merchant_name=merchant.name if merchant else "",
                order_id=order.id,
                buyer_name=order.buyer_name,
                total=order.total,
                payout=order.merchant_payout,
                items=items,
                daily_count=daily_count,
                daily_total=daily_total
            )
        except Exception as e:
            print(f"Delivered email error: {e}", flush=True)
    return {"status": order.status}

@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.delete("/merchant/{merchant_id}/reset")
def reset_merchant_orders(merchant_id: int, db: Session = Depends(get_db)):
    db.query(Order).filter(Order.merchant_id == merchant_id).delete()
    db.commit()
    return {"message": "All orders cleared"}
