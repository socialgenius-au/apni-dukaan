import sendgrid
from sendgrid.helpers.mail import Mail
from datetime import datetime
import os

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
FROM_EMAIL = "orders@hamaridukaan.au"
FROM_NAME = "Hamari Dukaan"

def get_greeting():
    hour = datetime.utcnow().hour + 10
    if hour >= 24: hour -= 24
    if 5 <= hour < 12: return "Good morning"
    elif 12 <= hour < 17: return "Good afternoon"
    else: return "Good evening"

def get_first_name(full_name: str) -> str:
    return full_name.strip().split()[0] if full_name.strip() else "there"

def send_email(to_email: str, subject: str, html: str):
    try:
        sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)
        msg = Mail(from_email=(FROM_EMAIL, FROM_NAME), to_emails=to_email, subject=subject, html_content=html)
        sg.send(msg)
        print(f"Email sent to {to_email}", flush=True)
    except Exception as e:
        print(f"Email failed to {to_email}: {e}", flush=True)

def hd_header(title="", subtitle=""):
    t = f'<div style="background:rgba(255,255,255,0.15);border-radius:10px;padding:10px 20px;margin-top:16px;color:white;font-size:18px;font-weight:700;">{title}</div>' if title else ""
    s = f'<p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:13px;">{subtitle}</p>' if subtitle else ""
    return f"""<div style="background:#276040;padding:24px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:26px;">Hamari Dukaan</h1>
      <p style="color:#E8B84B;margin:4px 0;font-size:14px;">&#1729;&#1605;&#1575;&#1585;&#1740; &#1583;&#1705;&#1575;&#1606;</p>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:13px;">Halal - Fresh - Local</p>{t}{s}</div>"""

def hd_footer():
    return """<div style="background:#1a4a30;padding:16px;text-align:center;">
      <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0;">Hamari Dukaan - hamaridukaan.au</p>
      <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:4px 0 0;">Auburn - Pendle Hill - Lakemba - Merrylands</p></div>"""

def items_table(items):
    if not items: return ""
    rows = ""
    subtotal = 0
    for item in items:
        name = item.get("name", "")
        qty = item.get("qty", 1)
        price = item.get("price", 0)
        emoji = item.get("emoji", "")
        line = qty * price
        subtotal += line
        rows += f'<tr style="border-bottom:1px solid #eee;"><td style="padding:8px 4px;font-size:13px;">{emoji} {name}</td><td style="padding:8px 4px;font-size:13px;text-align:center;color:#555;">x{qty}</td><td style="padding:8px 4px;font-size:13px;text-align:right;font-weight:600;">${line:.2f}</td></tr>'
    rows += f'<tr style="border-top:2px solid #276040;"><td colspan="2" style="padding:10px 4px;font-size:14px;font-weight:700;color:#276040;">Total</td><td style="padding:10px 4px;font-size:15px;font-weight:700;color:#276040;text-align:right;">${subtotal:.2f}</td></tr>'
    return f"""<div style="margin:16px 0;">
      <div style="font-size:13px;font-weight:700;color:#276040;margin-bottom:8px;">ORDER ITEMS</div>
      <table style="width:100%;border-collapse:collapse;background:#f9f9f6;border-radius:10px;overflow:hidden;">
        <thead><tr style="background:#276040;color:white;">
          <th style="padding:10px 4px;font-size:12px;text-align:left;">Item</th>
          <th style="padding:10px 4px;font-size:12px;text-align:center;">Qty</th>
          <th style="padding:10px 4px;font-size:12px;text-align:right;">Price</th>
        </tr></thead>
        <tbody>{rows}</tbody>
      </table></div>"""

def status_bar(current):
    stages = [("paid","Order Confirmed"),("ready","Order Ready"),("fulfilled","Order Delivered")]
    idx = {"paid":0,"ready":1,"fulfilled":2}
    ci = idx.get(current, 0)
    parts = ""
    for i,(key,label) in enumerate(stages):
        done = i <= ci
        color = "#276040" if done else "#ccc"
        tc = "#276040" if done else "#999"
        fw = "700" if done else "400"
        mark = "checkmark" if done else str(i+1)
        parts += f'<div style="display:inline-block;text-align:center;width:28%;"><div style="width:32px;height:32px;border-radius:50%;background:{color};color:white;font-size:13px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;">{i+1 if not done else "ok"}</div><div style="font-size:11px;color:{tc};font-weight:{fw};margin-top:4px;">{label}</div></div>'
        if i < 2:
            lc = "#276040" if i < ci else "#ccc"
            parts += f'<div style="display:inline-block;width:5%;height:2px;background:{lc};vertical-align:middle;margin-bottom:16px;"></div>'
    return f'<div style="background:#f9f9f6;border-radius:12px;padding:20px;margin:16px 0;text-align:center;"><div style="font-size:12px;font-weight:700;color:#276040;margin-bottom:12px;">ORDER STATUS</div>{parts}</div>'

def send_order_confirmed_customer(buyer_email, buyer_name, order_id, total, merchant_name, merchant_phone, items):
    greeting = get_greeting()
    first = get_first_name(buyer_name)
    html = f"""<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      {hd_header("Order Confirmed", f"Order #{order_id}")}
      <div style="padding:24px;">
        <p style="color:#555;">{greeting}, {first}! Your order is confirmed and payment received.</p>
        <p style="color:#555;line-height:1.6;"><strong>{merchant_name}</strong> is now preparing your items.</p>
        {status_bar("paid")}
        {items_table(items)}
        <div style="background:#f9f9f6;border-radius:12px;padding:16px;margin:16px 0;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-size:13px;color:#555;">Merchant</span><span style="font-size:13px;font-weight:700;">{merchant_name}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-size:13px;color:#555;">Contact</span><span style="font-size:13px;font-weight:700;">{merchant_phone}</span></div>
          <div style="display:flex;justify-content:space-between;border-top:1px solid #ddd;padding-top:8px;margin-top:6px;"><span style="font-size:14px;font-weight:700;">Amount Paid</span><span style="font-size:15px;font-weight:700;color:#276040;">${total:.2f} AUD</span></div>
        </div>
        <div style="background:#276040;border-radius:12px;padding:16px;color:white;">
          <div style="font-weight:700;margin-bottom:6px;">Collection Instructions</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.85);line-height:1.6;">Show this email to the merchant when collecting. You will receive another email when your order is ready.</div>
        </div>
      </div>
      {hd_footer()}</div>"""
    send_email(buyer_email, f"Order Confirmed #{order_id} - Hamari Dukaan", html)

def send_order_confirmed_merchant(merchant_email, merchant_name, order_id, buyer_name, buyer_phone, buyer_email, total, payout, items):
    greeting = get_greeting()
    first = get_first_name(merchant_name)
    html = f"""<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      {hd_header("New Order!", f"Order #{order_id} - Payment Confirmed")}
      <div style="padding:24px;">
        <p style="color:#555;">{greeting}, {first}! A new order has been placed and payment confirmed.</p>
        <div style="background:#f9f9f6;border-radius:12px;padding:16px;margin:16px 0;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-size:13px;color:#555;">Customer</span><span style="font-size:13px;font-weight:700;">{buyer_name}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-size:13px;color:#555;">Phone</span><span style="font-size:13px;font-weight:700;">{buyer_phone or "Not provided"}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-size:13px;color:#555;">Email</span><span style="font-size:13px;font-weight:700;">{buyer_email}</span></div>
        </div>
        {items_table(items)}
        <div style="background:#276040;border-radius:12px;padding:16px;color:white;text-align:center;margin:16px 0;">
          <div style="font-size:13px;color:rgba(255,255,255,0.7);">Your Payout</div>
          <div style="font-size:28px;font-weight:700;color:#E8B84B;">${payout:.2f} AUD</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.6);">after 10% platform commission</div>
        </div>
        <div style="background:#f9f9f6;border-radius:12px;padding:16px;margin:16px 0;">
          <div style="font-weight:700;color:#276040;margin-bottom:8px;">Next Steps</div>
          <div style="font-size:13px;color:#555;line-height:1.8;">1. Prepare the customer order<br>2. Log into dashboard and mark as Ready<br>3. Customer shows confirmation email on collection<br>4. Mark as Collected once customer picks up</div>
        </div>
        <div style="text-align:center;margin:20px 0;">
          <a href="https://hamaridukaan.au/dashboard" style="display:inline-block;background:#E8B84B;color:#1a4a30;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">View Order in Dashboard</a>
        </div>
      </div>
      {hd_footer()}</div>"""
    send_email(merchant_email, f"New Order #{order_id} from {buyer_name} - Hamari Dukaan", html)

def send_order_ready_customer(buyer_email, buyer_name, order_id, merchant_name, merchant_phone, items):
    greeting = get_greeting()
    first = get_first_name(buyer_name)
    html = f"""<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      {hd_header("Your Order is Ready!", f"Order #{order_id}")}
      <div style="padding:24px;">
        <p style="color:#555;">{greeting}, {first}! Your order is ready for collection at <strong>{merchant_name}</strong>.</p>
        {status_bar("ready")}
        {items_table(items)}
        <div style="background:#276040;border-radius:12px;padding:16px;color:white;">
          <div style="font-weight:700;margin-bottom:8px;">Collection Details</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.85);line-height:1.8;"><strong>Store:</strong> {merchant_name}<br><strong>Phone:</strong> {merchant_phone}<br><br>Please show this email when collecting your order.</div>
        </div>
      </div>
      {hd_footer()}</div>"""
    send_email(buyer_email, f"Your Order #{order_id} is Ready for Collection - Hamari Dukaan", html)

def send_order_delivered_customer(buyer_email, buyer_name, order_id, merchant_name, total, items):
    greeting = get_greeting()
    first = get_first_name(buyer_name)
    html = f"""<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      {hd_header("Order Collected!", f"Order #{order_id} - Complete")}
      <div style="padding:24px;">
        <p style="color:#555;">{greeting}, {first}! Thank you for shopping at <strong>{merchant_name}</strong> via Hamari Dukaan.</p>
        {status_bar("fulfilled")}
        {items_table(items)}
        <div style="background:#f9f9f6;border-radius:12px;padding:16px;margin:16px 0;text-align:center;">
          <div style="font-size:13px;color:#555;">Amount Paid</div>
          <div style="font-size:24px;font-weight:700;color:#276040;">${total:.2f} AUD</div>
        </div>
        <p style="color:#555;font-size:13px;line-height:1.6;text-align:center;">We hope to see you again! Browse more local stores at <a href="https://hamaridukaan.au" style="color:#276040;font-weight:700;">hamaridukaan.au</a></p>
      </div>
      {hd_footer()}</div>"""
    send_email(buyer_email, f"Order #{order_id} Collected - Thank You! - Hamari Dukaan", html)

def send_order_delivered_merchant(merchant_email, merchant_name, order_id, buyer_name, total, payout, items, daily_count, daily_total):
    greeting = get_greeting()
    first = get_first_name(merchant_name)
    html = f"""<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      {hd_header("Order Collected", f"Order #{order_id} - {buyer_name}")}
      <div style="padding:24px;">
        <p style="color:#555;">{greeting}, {first}! Order #{order_id} has been collected by <strong>{buyer_name}</strong>.</p>
        {items_table(items)}
        <div style="background:#276040;border-radius:12px;padding:16px;color:white;margin:16px 0;">
          <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-bottom:4px;">This Order Payout</div>
          <div style="font-size:26px;font-weight:700;color:#E8B84B;">${payout:.2f} AUD</div>
        </div>
        <div style="background:#f9f9f6;border-radius:12px;padding:16px;margin:16px 0;">
          <div style="font-weight:700;color:#276040;margin-bottom:10px;">Today's Summary</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="font-size:13px;color:#555;">Orders completed today</span><span style="font-size:13px;font-weight:700;">{daily_count}</span></div>
          <div style="display:flex;justify-content:space-between;border-top:1px solid #ddd;padding-top:8px;"><span style="font-size:14px;font-weight:700;">Today's total payout</span><span style="font-size:15px;font-weight:700;color:#276040;">${daily_total:.2f} AUD</span></div>
        </div>
        <div style="text-align:center;margin:20px 0;">
          <a href="https://hamaridukaan.au/dashboard" style="display:inline-block;background:#E8B84B;color:#1a4a30;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">View Dashboard</a>
        </div>
      </div>
      {hd_footer()}</div>"""
    send_email(merchant_email, f"Order #{order_id} Collected - Today: {daily_count} orders ${daily_total:.2f} - Hamari Dukaan", html)

def send_buyer_confirmation(buyer_email, buyer_name, order_id, total, merchant_name, merchant_phone):
    send_order_confirmed_customer(buyer_email, buyer_name, order_id, total, merchant_name, merchant_phone, [])

def send_merchant_notification(merchant_email, merchant_name, order_id, buyer_name, buyer_phone, total, payout):
    send_order_confirmed_merchant(merchant_email, merchant_name, order_id, buyer_name, buyer_phone, "", total, payout, [])
