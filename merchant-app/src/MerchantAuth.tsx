import { useState } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const categories = ['Halal Butcher', 'Spice Shop', 'Grocery', 'Bakery', 'Sweets', 'Seafood', 'Deli', 'Other']

export default function MerchantAuth() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Login fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Register fields
  const [name, setName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [suburb, setSuburb] = useState('')
  const [category, setCategory] = useState('Grocery')
  const [abn, setAbn] = useState('')
  const [description, setDescription] = useState('')

  const handleLogin = async () => {
    if (!email || !password) { setError('Please enter email and password'); return }
    setLoading(true)
    setError('')
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { email, password })
      localStorage.setItem('merchant_token', res.data.access_token)
      localStorage.setItem('merchant_id', res.data.merchant_id.toString())
      localStorage.setItem('merchant_name', res.data.merchant_name)
      window.location.href = '/dashboard'
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Login failed. Check your email and password.')
    }
    setLoading(false)
  }

  const handleRegister = async () => {
    if (!name || !regEmail || !regPassword || !suburb || !category) {
      setError('Please fill in all required fields')
      return
    }
    if (regPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (regPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await axios.post(`${API_URL}/auth/register`, {
        name, email: regEmail, password: regPassword,
        phone, suburb, category, abn, description,
        emoji: categories.indexOf(category) >= 0 ? ['🥩','🌶️','🛒','🍞','🍮','🐟','🥗','🏪'][categories.indexOf(category)] : '🏪'
      })
      localStorage.setItem('merchant_token', res.data.access_token)
      localStorage.setItem('merchant_id', res.data.merchant_id.toString())
      localStorage.setItem('merchant_name', res.data.merchant_name)
      window.location.href = '/dashboard'
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Registration failed. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      {/* Header */}
      <div style={{ background: 'var(--green-dark)', padding: '24px 16px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 4 }}>Hamari Dukaan</div>
        <div style={{ fontSize: 14, color: 'var(--gold)' }}>اپنی دکان</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>Merchant Portal</div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', background: 'white', margin: '16px', borderRadius: 12, padding: 4, border: '1px solid var(--border)' }}>
        <button onClick={() => { setMode('login'); setError('') }}
          style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13,
            background: mode === 'login' ? 'var(--green)' : 'transparent',
            color: mode === 'login' ? 'white' : 'var(--text-3)' }}>
          Login
        </button>
        <button onClick={() => { setMode('register'); setError('') }}
          style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13,
            background: mode === 'register' ? 'var(--green)' : 'transparent',
            color: mode === 'register' ? 'white' : 'var(--text-3)' }}>
          Register Store
        </button>
      </div>

      <div style={{ padding: '0 16px 40px' }}>

        {/* LOGIN */}
        {mode === 'login' && (
          <div style={{ background: 'white', borderRadius: 16, padding: '20px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 16 }}>
              Welcome back 👋
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Email Address</label>
              <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16 }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Password</label>
              <input type="password" placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16 }} />
            </div>
            {error && <div style={{ background: '#fce4ec', color: 'var(--red)', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <button className="btn-primary" onClick={handleLogin} disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
              {loading ? '⏳ Logging in...' : 'Login to Dashboard'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-3)' }}>
              Don't have an account? <span style={{ color: 'var(--green)', fontWeight: 700, cursor: 'pointer' }} onClick={() => setMode('register')}>Register your store</span>
            </div>
          </div>
        )}

        {/* REGISTER */}
        {mode === 'register' && (
          <div style={{ background: 'white', borderRadius: 16, padding: '20px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 4 }}>Register your store</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>Join the Hamari Dukaan community marketplace</div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Store Name *</label>
              <input type="text" placeholder="e.g. King Spice & Mini Mart" value={name} onChange={e => setName(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16 }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Suburb *</label>
              <input type="text" placeholder="e.g. Auburn, Pendle Hill, Lakemba" value={suburb} onChange={e => setSuburb(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16 }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Store Category *</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16, background: 'white' }}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Phone Number</label>
              <input type="tel" placeholder="02 XXXX XXXX" value={phone} onChange={e => setPhone(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16 }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>ABN (Australian Business Number)</label>
              <input type="text" placeholder="XX XXX XXX XXX" value={abn} onChange={e => setAbn(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16 }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Store Description</label>
              <textarea placeholder="Tell customers about your store..." value={description} onChange={e => setDescription(e.target.value)} rows={2}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16, resize: 'none' }} />
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Email Address *</label>
              <input type="email" placeholder="your@email.com" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16 }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Password *</label>
              <input type="password" placeholder="Minimum 8 characters" value={regPassword} onChange={e => setRegPassword(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16 }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Confirm Password *</label>
              <input type="password" placeholder="Repeat your password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16 }} />
            </div>

            <div style={{ background: 'var(--cream-dark)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
              By registering you agree to Hamari Dukaan's merchant terms — 10% commission on sales up to $4,000/month, 8% above. 1.5% card surcharge passed to customers.
            </div>

            {error && <div style={{ background: '#fce4ec', color: 'var(--red)', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>{error}</div>}

            <button className="btn-primary" onClick={handleRegister} disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
              {loading ? '⏳ Creating your store...' : 'Register Store →'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-3)' }}>
              Already registered? <span style={{ color: 'var(--green)', fontWeight: 700, cursor: 'pointer' }} onClick={() => setMode('login')}>Login here</span>
            </div>
          </div>
        )}

        <button onClick={() => window.location.href = '/'}
          style={{ width: '100%', marginTop: 16, padding: 12, background: 'none', color: 'var(--text-3)', fontSize: 13, border: 'none', cursor: 'pointer' }}>
          ← Back to Hamari Dukaan
        </button>
      </div>
    </div>
  )
}
