import { useState } from 'react'
import { createCheckout, validatePromo } from './api'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

type CartItem = { id: number; name: string; price: number; emoji: string; qty: number }

interface CheckoutProps {
  cart: CartItem[]
  merchantId: number
  onClose: () => void
  promoCode?: string
  refCode?: string
}

type Summary = {
  merchant_name: string
  merchant_suburb: string
  items: any[]
  subtotal: number
  promo_code: string | null
  promo_discount: number
  gst_amount: number
  gst_note: string
  surcharge: number
  surcharge_label: string
  total: number
  payment_method: string
  payment_label: string
  instalment: number | null
  afterpay_available: boolean
}

export default function Checkout({ cart, merchantId, onClose, promoCode = '', refCode = '' }: CheckoutProps) {
  const [step, setStep] = useState<'details' | 'summary' | 'paying'>('details')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'afterpay'>('card')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [manualPromo, setManualPromo] = useState('')
  const [promoValidating, setPromoValidating] = useState(false)
  const [promoError, setPromoError] = useState('')
  const [appliedPromo, setAppliedPromo] = useState(promoCode)
  const [promoSuccess, setPromoSuccess] = useState(!!promoCode)

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0)

  const handleValidateManualPromo = async () => {
    if (!manualPromo.trim()) return
    setPromoValidating(true)
    setPromoError('')
    try {
      const result = await validatePromo(manualPromo.trim())
      setAppliedPromo(result.code)
      setPromoSuccess(true)
      setPromoError('')
    } catch (e: any) {
      setPromoError(e.response?.data?.detail || 'Invalid promo code')
      setAppliedPromo('')
      setPromoSuccess(false)
    }
    setPromoValidating(false)
  }

  const handleGetSummary = async () => {
    if (!name || !email) { setError('Please enter your name and email'); return }
    if (!email.includes('@')) { setError('Please enter a valid email'); return }
    setLoading(true)
    setError('')
    try {
      const res = await axios.post(`${API_URL}/payments/summary`, {
        merchant_id: merchantId,
        items: cart.map(i => ({ product_id: i.id, name: i.name, price: i.price, qty: i.qty, emoji: i.emoji })),
        payment_method: paymentMethod,
        promo_code: appliedPromo || null
      })
      setSummary(res.data)
      setStep('summary')
    } catch {
      setError('Could not load summary. Please try again.')
    }
    setLoading(false)
  }

  const handlePay = async () => {
    setStep('paying')
    setError('')
    try {
      const result = await createCheckout({
        merchant_id: merchantId,
        buyer_name: name,
        buyer_email: email,
        buyer_phone: phone,
        items: cart.map(i => ({ product_id: i.id, name: i.name, price: i.price, qty: i.qty, emoji: i.emoji })),
        payment_method: paymentMethod,
        promo_code: appliedPromo || null,
        ref_code: refCode || null
      })
      window.location.href = result.checkout_url
    } catch {
      setError('Payment failed. Please try again.')
      setStep('summary')
    }
  }

  // ── STEP 1: BUYER DETAILS ─────────────────────────────
  if (step === 'details') {
    return (
      <div>
        <div className="sheet-handle" />
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: 'var(--green-dark)' }}>Complete Your Order</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>Enter your details to continue</div>

        {/* Promo banner if auto-applied */}
        {promoSuccess && appliedPromo && (
          <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🎉</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#2e7d32' }}>Promo code {appliedPromo} applied!</div>
              <div style={{ fontSize: 11, color: '#388e3c' }}>Discount will show in your order summary</div>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Your Name *</label>
          <input type="text" placeholder="Full name" value={name} onChange={e => setName(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16 }} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Email Address *</label>
          <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16 }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Phone (optional)</label>
          <input type="tel" placeholder="04XX XXX XXX" value={phone} onChange={e => setPhone(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16 }} />
        </div>

        {/* Manual promo input if no auto promo */}
        {!promoSuccess && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Promo Code (optional)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" placeholder="Enter promo code" value={manualPromo}
                onChange={e => setManualPromo(e.target.value.toUpperCase())}
                style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16 }} />
              <button onClick={handleValidateManualPromo} disabled={promoValidating}
                style={{ padding: '10px 16px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {promoValidating ? '...' : 'Apply'}
              </button>
            </div>
            {promoError && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>{promoError}</div>}
            {promoSuccess && <div style={{ fontSize: 12, color: '#2e7d32', marginTop: 4 }}>✓ {appliedPromo} applied!</div>}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>Payment Method</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setPaymentMethod('card')}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${paymentMethod === 'card' ? 'var(--green)' : 'var(--border)'}`,
                background: paymentMethod === 'card' ? 'var(--cream-dark)' : 'white', fontWeight: 700, fontSize: 13, color: 'var(--green-dark)', cursor: 'pointer' }}>
              💳 Card
            </button>
            {subtotal >= 50 && (
              <button onClick={() => setPaymentMethod('afterpay')}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${paymentMethod === 'afterpay' ? 'var(--green)' : 'var(--border)'}`,
                  background: paymentMethod === 'afterpay' ? 'var(--cream-dark)' : 'white', fontWeight: 700, fontSize: 13, color: 'var(--green-dark)', cursor: 'pointer' }}>
              🟢 Afterpay
            </button>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
            {paymentMethod === 'afterpay' ? 'Pay in 4 fortnightly instalments · 6% + $0.30 surcharge' : '1.5% card processing fee applies'}
          </div>
        </div>

        {error && <div style={{ background: '#fce4ec', color: 'var(--red)', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button className="btn-primary" onClick={handleGetSummary} disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
          {loading ? '⏳ Loading summary...' : 'Review Order →'}
        </button>

        <button onClick={onClose} style={{ width: '100%', marginTop: 10, padding: 12, background: 'none', color: 'var(--text-3)', fontSize: 13, border: 'none', cursor: 'pointer' }}>
          ← Back to cart
        </button>
      </div>
    )
  }

  // ── STEP 2: ORDER SUMMARY ─────────────────────────────
  if (step === 'summary' && summary) {
    return (
      <div>
        <div className="sheet-handle" />
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: 'var(--green-dark)' }}>Order Summary</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>{summary.merchant_name} · {summary.merchant_suburb}</div>

        {/* Items */}
        <div style={{ background: 'var(--cream-dark)', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
          {summary.items.map((item: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{item.emoji} {item.name} × {item.qty}</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>${item.total.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Breakdown */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Subtotal</span>
            <span style={{ fontSize: 13 }}>${summary.subtotal.toFixed(2)}</span>
          </div>

          {/* Promo discount — prominent green line */}
          {summary.promo_discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, background: '#e8f5e9', borderRadius: 8, padding: '8px 10px', margin: '4px -2px 8px' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#2e7d32' }}>🎉 {summary.promo_code} discount</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#2e7d32' }}>-${summary.promo_discount.toFixed(2)}</span>
            </div>
          )}

          {summary.gst_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>GST (included)</span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>${summary.gst_amount.toFixed(2)}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, color: '#e65100' }}>{summary.surcharge_label}</span>
            <span style={{ fontSize: 12, color: '#e65100' }}>+${summary.surcharge.toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)' }}>${summary.total.toFixed(2)} AUD</span>
          </div>

          {summary.instalment && (
            <div style={{ marginTop: 8, background: '#e8f5e9', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
              <span style={{ fontSize: 12, color: '#2e7d32', fontWeight: 700 }}>🟢 4 × ${summary.instalment.toFixed(2)} fortnightly</span>
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 14, textAlign: 'center' }}>
          {summary.gst_note} · Surcharge disclosed per RBA requirements
        </div>

        <div style={{ background: 'var(--cream-dark)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--text-2)' }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>Paying as</div>
          <div>{name} · {email}{phone ? ` · ${phone}` : ''}</div>
        </div>

        {error && <div style={{ background: '#fce4ec', color: 'var(--red)', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button className="btn-primary" onClick={handlePay} style={{ marginBottom: 10 }}>
          {paymentMethod === 'afterpay' ? '🟢 Pay with Afterpay' : `💳 Pay $${summary.total.toFixed(2)} AUD`}
        </button>

        <button onClick={() => setStep('details')}
          style={{ width: '100%', marginTop: 4, padding: 12, background: 'none', color: 'var(--text-3)', fontSize: 13, border: 'none', cursor: 'pointer' }}>
          ← Edit details
        </button>

        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: 'var(--text-3)' }}>
          🔒 Secured by Stripe · Card details never stored on Hamari Dukaan
        </div>
      </div>
    )
  }

  // ── STEP 3: PAYING ────────────────────────────────────
  return (
    <div style={{ textAlign: 'center', padding: '40px 16px' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
      <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--green-dark)', marginBottom: 8 }}>Redirecting to secure payment...</div>
      <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Please do not close this page</div>
    </div>
  )
}
