import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export default function MerchantSettings() {
  const token = localStorage.getItem('merchant_token')
  const merchantId = localStorage.getItem('merchant_id')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [suburb, setSuburb] = useState('')
  const [category, setCategory] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [description, setDescription] = useState('')
  const [abn, setAbn] = useState('')
  const [gstRegistered, setGstRegistered] = useState(false)

  const categories = ['Halal Butcher', 'Spice Shop', 'Grocery', 'Bakery', 'Sweets', 'Seafood', 'Deli', 'Other']

  useEffect(() => {
    if (!token || !merchantId) { window.location.href = '/merchant'; return }
    axios.get(`${API_URL}/merchants/${merchantId}`)
      .then(res => {
        const m = res.data
        setName(m.name || '')
        setSuburb(m.suburb || '')
        setCategory(m.category || 'Grocery')
        setPhone(m.phone || '')
        setEmail(m.email || '')
        setDescription(m.description || '')
        setAbn(m.abn || '')
        setGstRegistered(m.gst_registered || false)
        setLoading(false)
      })
      .catch(() => { window.location.href = '/merchant' })
  }, [])

  const handleSave = async () => {
    if (!name || !suburb) { setError('Store name and suburb are required'); return }
    setSaving(true)
    setError('')
    try {
      await axios.patch(`${API_URL}/merchants/${merchantId}`, {
        name, suburb, category, phone, description, abn, gst_registered: gstRegistered
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to save. Please try again.')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          <div>Loading settings...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: 40 }}>
      <div style={{ background: 'var(--green-dark)', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => window.location.href = '/dashboard'}
            style={{ background: 'none', color: 'white', border: 'none', fontSize: 22, cursor: 'pointer' }}>←</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Store Settings</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Update your store details</div>
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 16, textTransform: 'uppercase' }}>Store Information</div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Store Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16 }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Suburb *</label>
            <input type="text" value={suburb} onChange={e => setSuburb(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16 }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16, background: 'white' }}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Phone Number</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="02 XXXX XXXX"
              style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16 }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Store Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Tell customers about your store..." rows={3}
              style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16, resize: 'none' }} />
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 16, textTransform: 'uppercase' }}>Business & Tax Details</div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>ABN (Australian Business Number)</label>
            <input type="text" value={abn} onChange={e => setAbn(e.target.value)} placeholder="XX XXX XXX XXX"
              style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16 }} />
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Required for tax compliance and payouts</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--cream-dark)', borderRadius: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-dark)' }}>GST Registered</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Registered for GST with the ATO</div>
            </div>
            <button onClick={() => setGstRegistered(!gstRegistered)}
              style={{ width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                background: gstRegistered ? 'var(--green)' : '#ccc', position: 'relative', transition: 'background 0.2s' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'white',
                position: 'absolute', top: 3, transition: 'left 0.2s', left: gstRegistered ? 23 : 3 }} />
            </button>
          </div>
        </div>

        <div style={{ background: 'var(--green-dark)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', marginBottom: 12, textTransform: 'uppercase' }}>Platform Terms</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 2 }}>
            Commission: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>10%</span> on GMV up to $4,000/month{'\n'}
            Above $4,000: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>8%</span> flat{'\n'}
            Card surcharge: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>1.5%</span> passed to buyer{'\n'}
            Payouts: processed via Stripe to your bank
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 12, textTransform: 'uppercase' }}>Login Details</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>Email address</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--green-dark)', marginBottom: 8 }}>{email}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>To change your password contact Apni Dukaan support</div>
        </div>

        {error && (
          <div style={{ background: '#fce4ec', color: 'var(--red)', padding: '12px 14px', borderRadius: 12, fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        {saved && (
          <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '12px 14px', borderRadius: 12, fontSize: 13, marginBottom: 16, fontWeight: 700 }}>
            ✅ Settings saved successfully!
          </div>
        )}

        <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? '⏳ Saving...' : 'Save Settings'}
        </button>

        <button onClick={() => window.location.href = '/dashboard'}
          style={{ width: '100%', marginTop: 12, padding: 12, background: 'none', color: 'var(--text-3)', fontSize: 13, border: 'none', cursor: 'pointer' }}>
          ← Back to Dashboard
        </button>
      </div>
    </div>
  )
}
