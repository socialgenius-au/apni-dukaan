from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Order, Merchant, Product
from app.routers.promo import PromoCode
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import stripe
import os

router = APIRouter(prefix="/payments", tags=["payments"])

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
CARD_SURCHARGE_PERCENT = 0.015
CARD_SURCHARGE_FIXED = 0.00
AFTERPAY_SURCHARGE_PERCENT = 0.06
AFTERPAY_SURCHARGE_FIXED = 0.30
AFTERPAY_MIN_ORDER = 50.00
GST_RATE = 0.10

def get_commission_rate(merchant_id: int, db: Session) -> float:
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    orders_this_month = db.query(Order).filter(
        Order.merchant_id == merchant_id,
        Order.created_at >= month_start,
        Order.status == "paid"
    ).all()
    monthly_gmv = sum(o.total for o in orders_this_month)
    return 0.08 if monthly_gmv > 4000 else 0.10

def apply_promo(code: str, subtotal: float, db: Session):
    if not code:
        return 0.0, None
    promo = db.query(PromoCode).filter(
        PromoCode.code == code.upper().strip(),
        PromoCode.is_active == True
    ).first()
    if not promo:
        return 0.0, None
    if promo.expiry_date and promo.expiry_date < datetime.utcnow():
        return 0.0, None
    if promo.usage_limit and promo.times_used >= promo.usage_limit:
        return 0.0, None
    discount = round(subtotal * promo.discount_percent / 100, 2)
    return discount, promo

class CheckoutItem(BaseModel):
    product_id: int
    name: str
    price: float
    qty: int
    emoji: Optional[str] = "📦"
    gst_applicable: Optional[bool] = False
    gst_absorbed: Optional[bool] = True

class CheckoutRequest(BaseModel):
    merchant_id: int
    buyer_name: str
    buyer_email: str
    buyer_phone: Optional[str] = None
    items: List[CheckoutItem]
    payment_method: Optional[str] = "card"
    promo_code: Optional[str] = None
    ref_code: Optional[str] = None

class OrderSummaryRequest(BaseModel):
    merchant_id: int
    items: List[CheckoutItem]
    payment_method: Optional[str] = "card"
    promo_code: Optional[str] = None

def send_order_emails(order, db):
    try:
        from app.email_service import send_buyer_confirmation, send_merchant_notification
        merchant = db.query(Merchant).filter(Merchant.id == order.merchant_id).first()
        if order.buyer_email:
            send_buyer_confirmation(
                buyer_email=order.buyer_email,
                buyer_name=order.buyer_name,
                order_id=order.id,
                total=order.total,
                merchant_name=merchant.name if merchant else "Merchant",
                merchant_phone=merchant.phone if merchant else ""
            )
        if merchant and merchant.email:
            send_merchant_notification(
                merchant_email=merchant.email,
                merchant_name=merchant.name,
                order_id=order.id,
                buyer_name=order.buyer_name,
                buyer_phone=order.buyer_phone or "",
                total=order.total,
                payout=order.merchant_payout
            )
    except Exception as e:
        import traceback
        import sys
        print(f"Email error: {e}", flush=True)
        traceback.print_exc(file=sys.stdout)

@router.post("/summary")
def get_order_summary(req: OrderSummaryRequest, db: Session = Depends(get_db)):
    merchant = db.query(Merchant).filter(Merchant.id == req.merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    subtotal = round(sum(item.price * item.qty for item in req.items), 2)
    gst_amount = 0.0
    for item in req.items:
        if item.gst_applicable and not item.gst_absorbed:
            gst_amount += round(item.price * item.qty * GST_RATE / (1 + GST_RATE), 2)
    gst_amount = round(gst_amount, 2)

    promo_discount, promo = apply_promo(req.promo_code or "", subtotal, db)
    discounted_subtotal = round(subtotal - promo_discount, 2)

    if req.payment_method == "afterpay" and discounted_subtotal >= AFTERPAY_MIN_ORDER:
        surcharge = round(discounted_subtotal * AFTERPAY_SURCHARGE_PERCENT + AFTERPAY_SURCHARGE_FIXED, 2)
        surcharge_label = "Afterpay fee (6% + $0.30)"
        payment_label = "Pay in 4 fortnightly instalments"
        instalment = round((discounted_subtotal + surcharge) / 4, 2)
    else:
        surcharge = round(discounted_subtotal * CARD_SURCHARGE_PERCENT, 2)
        surcharge_label = "Card processing fee (1.5%)"
        payment_label = "Pay by card"
        instalment = None
        req.payment_method = "card"

    total = round(discounted_subtotal + surcharge, 2)
    commission_rate = get_commission_rate(req.merchant_id, db)
    commission = round(discounted_subtotal * commission_rate, 2)
    merchant_payout = round(discounted_subtotal - commission, 2)

    return {
        "merchant_name": merchant.name,
        "merchant_suburb": merchant.suburb,
        "items": [{"name": i.name, "emoji": i.emoji, "qty": i.qty, "unit_price": i.price, "total": round(i.price * i.qty, 2), "gst": 0.0} for i in req.items],
        "subtotal": subtotal,
        "promo_code": promo.code if promo else None,
        "promo_discount": promo_discount,
        "gst_amount": gst_amount,
        "gst_note": "GST included in marked prices" if gst_amount > 0 else "All items GST-free",
        "surcharge": surcharge,
        "surcharge_label": surcharge_label,
        "total": total,
        "payment_method": req.payment_method,
        "payment_label": payment_label,
        "instalment": instalment,
        "commission_rate": commission_rate,
        "commission": commission,
        "merchant_payout": merchant_payout,
        "afterpay_available": discounted_subtotal >= AFTERPAY_MIN_ORDER,
    }

@router.post("/create-checkout")
def create_checkout(req: CheckoutRequest, db: Session = Depends(get_db)):
    merchant = db.query(Merchant).filter(Merchant.id == req.merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    subtotal = round(sum(item.price * item.qty for item in req.items), 2)
    gst_amount = 0.0
    for item in req.items:
        if item.gst_applicable and not item.gst_absorbed:
            gst_amount += round(item.price * item.qty * GST_RATE / (1 + GST_RATE), 2)
    gst_amount = round(gst_amount, 2)

    promo_discount, promo = apply_promo(req.promo_code or "", subtotal, db)
    discounted_subtotal = round(subtotal - promo_discount, 2)

    commission_rate = get_commission_rate(req.merchant_id, db)

    if req.payment_method == "afterpay" and discounted_subtotal >= AFTERPAY_MIN_ORDER:
        surcharge = round(discounted_subtotal * AFTERPAY_SURCHARGE_PERCENT + AFTERPAY_SURCHARGE_FIXED, 2)
        payment_methods = ["afterpay_clearpay"]
        surcharge_label = "Afterpay fee (6% + $0.30)"
        req.payment_method = "afterpay"
    else:
        surcharge = round(discounted_subtotal * CARD_SURCHARGE_PERCENT, 2)
        payment_methods = ["card"]
        surcharge_label = "Card processing fee (1.5%)"
        req.payment_method = "card"

    total = round(discounted_subtotal + surcharge, 2)
    commission = round(discounted_subtotal * commission_rate, 2)
    merchant_payout = round(discounted_subtotal - commission, 2)

    line_items = []
    for item in req.items:
        line_items.append({
            "price_data": {
                "currency": "aud",
                "product_data": {
                    "name": f"{item.emoji} {item.name}",
                    "description": f"From {merchant.name} — {merchant.suburb}",
                },
                "unit_amount": int(item.price * 100),
            },
            "quantity": item.qty,
        })

    if promo_discount > 0:
        line_items.append({
            "price_data": {
                "currency": "aud",
                "product_data": {
                    "name": f"Promo discount ({promo.code})",
                    "description": f"{int(promo.discount_percent)}% off — {promo.code}",
                },
                "unit_amount": -int(promo_discount * 100),
            },
            "quantity": 1,
        })

    line_items.append({
        "price_data": {
            "currency": "aud",
            "product_data": {
                "name": surcharge_label,
                "description": "Payment processing cost",
            },
            "unit_amount": int(surcharge * 100),
        },
        "quantity": 1,
    })

    session = stripe.checkout.Session.create(
        payment_method_types=payment_methods,
        line_items=line_items,
        mode="payment",
        success_url=f"{FRONTEND_URL}/order-success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{FRONTEND_URL}/?cancelled=true",
        customer_email=req.buyer_email,
        metadata={
            "merchant_id": str(req.merchant_id),
            "buyer_name": req.buyer_name,
            "buyer_phone": req.buyer_phone or "",
            "subtotal": str(subtotal),
            "promo_code": req.promo_code or "",
            "promo_discount": str(promo_discount),
            "gst_amount": str(gst_amount),
            "surcharge": str(surcharge),
            "commission_rate": str(commission_rate),
            "commission": str(commission),
            "merchant_payout": str(merchant_payout),
            "payment_method": req.payment_method,
            "ref_code": req.ref_code or "",
        }
    )

    if promo and promo_discount > 0:
        promo.times_used += 1
        db.commit()

    return {
        "checkout_url": session.url,
        "session_id": session.id,
        "subtotal": subtotal,
        "promo_discount": promo_discount,
        "gst_amount": gst_amount,
        "surcharge": surcharge,
        "total": total,
        "commission_rate": commission_rate,
        "commission": commission,
        "merchant_payout": merchant_payout
    }

@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        else:
            import json
            event = json.loads(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata", {})
        merchant_id = int(metadata.get("merchant_id", 0))
        buyer_name = metadata.get("buyer_name", "")
        buyer_phone = metadata.get("buyer_phone", "")
        buyer_email = session.get("customer_email", "")
        total = session.get("amount_total", 0) / 100
        subtotal = float(metadata.get("subtotal", total))
        promo_code = metadata.get("promo_code", "") or None
        promo_discount = float(metadata.get("promo_discount", 0))
        gst_amount = float(metadata.get("gst_amount", 0))
        surcharge = float(metadata.get("surcharge", 0))
        commission_rate = float(metadata.get("commission_rate", 0.10))
        commission = float(metadata.get("commission", 0))
        merchant_payout = float(metadata.get("merchant_payout", 0))
        payment_method = metadata.get("payment_method", "card")
        ref_code = metadata.get("ref_code", "") or None

        order = Order(
            merchant_id=merchant_id,
            buyer_name=buyer_name,
            buyer_email=buyer_email,
            buyer_phone=buyer_phone,
            items=[],
            subtotal=subtotal,
            gst_amount=gst_amount,
            surcharge=surcharge,
            total=total,
            commission_rate=commission_rate,
            commission=commission,
            merchant_payout=merchant_payout,
            payment_method=payment_method,
            promo_code=promo_code,
            promo_discount=promo_discount,
            ref_code=ref_code,
            status="paid",
            stripe_session_id=session.get("id")
        )
        db.add(order)
        db.commit()
        db.refresh(order)
        send_order_emails(order, db)

    return {"status": "ok"}

@router.get("/session/{session_id}")
def get_session(session_id: str):
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        return {
            "status": session.payment_status,
            "customer_email": session.customer_email,
            "amount_total": session.amount_total / 100,
            "currency": session.currency.upper()
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
