import { useEffect, useState } from 'react'
import { getSession } from './api'

export default function OrderSuccess() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    if (sessionId) {
      getSession(sessionId)
        .then(data => { setSession(data); setLoading(false) })
        .catch(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const goHome = () => {
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 16px' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
        <div style={{ fontWeight: 700, color: 'var(--green-dark)' }}>Confirming your order...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '40px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 8 }}>
          Order Confirmed!
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
          Jazakallah khair for your order. The merchant has been notified and will prepare your items.
        </div>
      </div>

      {session && (
        <div style={{ background: 'white', borderRadius: 16, padding: '20px', border: '1px solid var(--border)', marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Payment Details
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Amount paid</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--green-dark)' }}>${session.amount_total?.toFixed(2)} {session.currency}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Email</span>
            <span style={{ fontSize: 13, color: 'var(--green-dark)' }}>{session.customer_email}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Status</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#2e7d32' }}>✓ Paid</span>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--green-dark)', borderRadius: 16, padding: '16px 20px', marginBottom: 24, color: 'white' }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>📦 Collection Instructions</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
          Show this confirmation to the merchant when collecting your order. A confirmation email has been sent to you.
        </div>
      </div>

      <button className="btn-primary" onClick={goHome}>
        ← Back to Hamari Dukaan
      </button>
    </div>
  )
}
