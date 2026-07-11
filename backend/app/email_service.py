import sendgrid
from sendgrid.helpers.mail import Mail
from datetime import datetime
import os

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
FROM_EMAIL = "orders@hamaridukaan.au"
FROM_NAME = "Hamari Dukaan"

def get_greeting():
    hour = datetime.utcnow().hour + 10  # AEST offset
    if hour >= 24:
        hour -= 24
    if 5 <= hour < 12:
        return "Good morning"
    elif 12 <= hour < 17:
        return "Good afternoon"
    else:
        return "Good evening"

def get_first_name(full_name: str) -> str:
    return full_name.strip().split()[0] if full_name.strip() else "there"

def send_buyer_confirmation(buyer_email: str, buyer_name: str, order_id: int, total: float, merchant_name: str, merchant_phone: str):
    try:
        greeting = get_greeting()
        first_name = get_first_name(buyer_name)
        sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)
        message = Mail(
            from_email=(FROM_EMAIL, FROM_NAME),
            to_emails=buyer_email,
            subject=f"Order Confirmed #{order_id} — Hamari Dukaan",
            html_content=f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #276040; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">Hamari Dukaan</h1>
                    <p style="color: #E8B84B; margin: 4px 0; font-size: 16px;">ہماری دکان</p>
                    <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 13px;">Halal · Fresh · Local</p>
                </div>
                <div style="padding: 28px 24px;">
                    <h2 style="color: #276040; margin-bottom: 4px;">Order Confirmed ✅</h2>
                    <p style="color: #5a5a4a; margin-bottom: 20px;">{greeting}, Dear {first_name},</p>
                    <p style="color: #5a5a4a; line-height: 1.6;">Thank you for your order. Your payment has been received and confirmed. The merchant is preparing your items for collection.</p>

                    <div style="background: #F5F0E8; border-radius: 12px; padding: 20px; margin: 20px 0;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 6px 0; color: #5a5a4a; font-size: 14px;">Order Number</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">#{order_id}</td></tr>
                            <tr><td style="padding: 6px 0; color: #5a5a4a; font-size: 14px;">Amount Paid</td><td style="padding: 6px 0; font-weight: bold; text-align: right; color: #c62828;">${total:.2f} AUD</td></tr>
                            <tr><td style="padding: 6px 0; color: #5a5a4a; font-size: 14px;">Merchant</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{merchant_name}</td></tr>
                            <tr><td style="padding: 6px 0; color: #5a5a4a; font-size: 14px;">Merchant Phone</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{merchant_phone}</td></tr>
                        </table>
                    </div>

                    <div style="background: #276040; border-radius: 12px; padding: 20px; margin: 20px 0; color: white;">
                        <h3 style="margin: 0 0 10px; font-size: 16px;">📦 Collection Instructions</h3>
                        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.85);">Please show this email to the merchant when collecting your order. Your items will be ready shortly — the merchant will contact you if needed.</p>
                    </div>

                    <p style="color: #9a9a8a; font-size: 13px; line-height: 1.6;">If you have any questions about your order, please contact the merchant directly on {merchant_phone} or reply to this email.</p>
                </div>
                <div style="background: #1a4a30; padding: 16px; text-align: center;">
                    <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0;">Hamari Dukaan · hamaridukaan.au</p>
                    <p style="color: rgba(255,255,255,0.4); font-size: 11px; margin: 4px 0 0;">Auburn · Pendle Hill · Lakemba · Merrylands</p>
                </div>
            </div>
            """
        )
        sg.send(message)
        print(f"Buyer confirmation email sent to {buyer_email}", flush=True)
    except Exception as e:
        print(f"Failed to send buyer email: {e}", flush=True)

def send_merchant_notification(merchant_email: str, merchant_name: str, order_id: int, buyer_name: str, buyer_phone: str, total: float, payout: float):
    try:
        greeting = get_greeting()
        merchant_first = get_first_name(merchant_name)
        sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)
        message = Mail(
            from_email=(FROM_EMAIL, FROM_NAME),
            to_emails=merchant_email,
            subject=f"New Order #{order_id} from {buyer_name} — Hamari Dukaan",
            html_content=f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #276040; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">New Order! 🎉</h1>
                    <p style="color: #E8B84B; margin: 8px 0 0; font-size: 14px;">Hamari Dukaan — Merchant Notification</p>
                </div>
                <div style="padding: 28px 24px;">
                    <h2 style="color: #276040; margin-bottom: 4px;">You have a new order</h2>
                    <p style="color: #5a5a4a; margin-bottom: 20px;">{greeting}, Dear {merchant_first},</p>
                    <p style="color: #5a5a4a; line-height: 1.6;">A new order has been placed and payment has been confirmed. Please prepare the items for customer collection.</p>

                    <div style="background: #F5F0E8; border-radius: 12px; padding: 20px; margin: 20px 0;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 6px 0; color: #5a5a4a; font-size: 14px;">Order Number</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">#{order_id}</td></tr>
                            <tr><td style="padding: 6px 0; color: #5a5a4a; font-size: 14px;">Customer Name</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{buyer_name}</td></tr>
                            <tr><td style="padding: 6px 0; color: #5a5a4a; font-size: 14px;">Customer Phone</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">{buyer_phone or 'Not provided'}</td></tr>
                            <tr><td style="padding: 6px 0; color: #5a5a4a; font-size: 14px;">Order Total</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">${total:.2f} AUD</td></tr>
                            <tr style="border-top: 2px solid #276040;"><td style="padding: 10px 0 6px; color: #276040; font-size: 15px; font-weight: bold;">Your Payout</td><td style="padding: 10px 0 6px; font-weight: bold; text-align: right; color: #276040; font-size: 18px;">${payout:.2f} AUD</td></tr>
                        </table>
                    </div>

                    <div style="background: #276040; border-radius: 12px; padding: 20px; margin: 20px 0; color: white;">
                        <h3 style="margin: 0 0 10px; font-size: 16px;">📋 Next Steps</h3>
                        <p style="margin: 0; font-size: 14px; line-height: 1.8; color: rgba(255,255,255,0.85);">
                            1. Prepare the customer's order<br>
                            2. Log into your dashboard to mark as Ready<br>
                            3. Customer will show their confirmation email on collection
                        </p>
                    </div>

                    <div style="text-align: center; margin: 24px 0;">
                        <a href="https://hamaridukaan.au/dashboard" style="display: inline-block; background: #E8B84B; color: #1a4a30; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 15px;">View Order in Dashboard →</a>
                    </div>

                    <p style="color: #9a9a8a; font-size: 13px; line-height: 1.6;">Your payout will be processed to your registered bank account. If you have any questions, contact Hamari Dukaan support.</p>
                </div>
                <div style="background: #1a4a30; padding: 16px; text-align: center;">
                    <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0;">Hamari Dukaan · hamaridukaan.au</p>
                    <p style="color: rgba(255,255,255,0.4); font-size: 11px; margin: 4px 0 0;">Auburn · Pendle Hill · Lakemba · Merrylands</p>
                </div>
            </div>
            """
        )
        sg.send(message)
        print(f"Merchant notification email sent to {merchant_email}", flush=True)
    except Exception as e:
        print(f"Failed to send merchant email: {e}", flush=True)
