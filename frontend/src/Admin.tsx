import { useState } from "react"
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const EMOJIS = ['📦','🍚','🫘','🌶️','🧅','🧄','🫚','🍅','🥩','🐟','🍗','🥛','🧀','🥚','🍞','🫓','🧈','🍯','🫖','☕','🧃','🥤','🍵','🌿','🫙','🥫','🍋','🍊','🍌','🍎','🥦','🥕','🌽','🫑','🍆','🥔','🧆','🍢','🍡','🍮','🍰','🎂','🍩','🍪','🍫','🍬','🍭']
const STORE_EMOJIS = ['🏪','🛒','🏬','🥘','🍱','🛍️','🌏','🍛','🥗','🫕']
const CATEGORIES = ['Grocery','Restaurant','Butcher','Bakery','Sweets','Pharmacy','General']
const PRODUCT_CATEGORIES = ['Biscuits & Snacks','Noodles & Instant Food','Rice & Grains','Spices & Condiments','Sauces & Condiments','Tea & Drinks','Fresh Produce','Oils & Ghee','Meat & Protein','Frozen & Dairy','Sweets & Desserts','Bread & Bakery','General']

export default function Admin() {
  const [password, setPassword] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'merchants' | 'orders' | 'products'>('overview')
  const [selectedMerchant, setSelectedMerchant] = useState<any>(null)
  const [editData, setEditData] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Add Merchant state
  const [showAddMerchant, setShowAddMerchant] = useState(false)
  const [newMerchant, setNewMerchant] = useState({
    name: '', description: '', suburb: '', category: 'Grocery', emoji: '🏪',
    phone: '', email: '', password: '', abn: '', gst_registered: false
  })
  const [merchantSaving, setMerchantSaving] = useState(false)
  const [merchantMsg, setMerchantMsg] = useState('')

  // Products state
  const [products, setProducts] = useState<any[]>([])
  const [productMerchant, setProductMerchant] = useState<any>(null)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: '', category: '', emoji: '📦', stock_qty: '0' })
  const [productSaving, setProductSaving] = useState(false)
  const [productMsg, setProductMsg] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [sortByCategory, setSortByCategory] = useState(false)

  const headers = { 'x-admin-password': password }

  const fetchData = async (pwd: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await axios.get(`${API_URL}/admin/dashboard`, { headers: { 'x-admin-password': pwd } })
      setData(res.data)
      setLoggedIn(true)
    } catch {
      setError('Invalid password')
    }
    setLoading(false)
  }

  const handleLogin = () => fetchData(password)

  const handleAddMerchant = async () => {
    if (!newMerchant.name || !newMerchant.suburb || !newMerchant.email) {
      setMerchantMsg('❌ Name, suburb and email are required')
      return
    }
    setMerchantSaving(true)
    setMerchantMsg('')
    try {
      await axios.post(`${API_URL}/admin/merchants`, {
        name: newMerchant.name,
        description: newMerchant.description || null,
        suburb: newMerchant.suburb,
        category: newMerchant.category,
        emoji: newMerchant.emoji,
        phone: newMerchant.phone || null,
        email: newMerchant.email,
        password: newMerchant.password || null,
        abn: newMerchant.abn || null,
        gst_registered: newMerchant.gst_registered,
      }, { headers })
      setMerchantMsg('✅ Merchant created!')
      setNewMerchant({ name: '', description: '', suburb: '', category: 'Grocery', emoji: '🏪', phone: '', email: '', password: '', abn: '', gst_registered: false })
      setShowAddMerchant(false)
      await fetchData(password)
      setTimeout(() => setMerchantMsg(''), 4000)
    } catch (e: any) {
      setMerchantMsg(`❌ ${e?.response?.data?.detail || 'Failed to create merchant'}`)
    }
    setMerchantSaving(false)
  }

  const handleSaveMerchant = async () => {
    setSaving(true)
    try {
      await axios.patch(`${API_URL}/admin/merchants/${selectedMerchant.id}`, editData, { headers })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      fetchData(password)
    } catch {
      alert('Failed to save')
    }
    setSaving(false)
  }

  const fetchProducts = async (merchant: any) => {
    setProductMerchant(merchant)
    setLoadingProducts(true)
    setProducts([])
    setEditingProduct(null)
    setShowAddProduct(false)
    setImportResult(null)
    try {
      const res = await axios.get(`${API_URL}/products/merchant/${merchant.id}`)
      setProducts(res.data)
    } catch {
      setProductMsg('Failed to load products')
    }
    setLoadingProducts(false)
  }

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.price) return setProductMsg('Name and price are required')
    setProductSaving(true)
    try {
      const res = await axios.post(`${API_URL}/products/`, {
        merchant_id: productMerchant.id,
        name: newProduct.name,
        description: newProduct.description || null,
        price: parseFloat(newProduct.price),
        category: newProduct.category || null,
        emoji: newProduct.emoji,
        stock_qty: parseInt(newProduct.stock_qty) || 0,
      })
      setProducts(prev => [...prev, res.data])
      setNewProduct({ name: '', description: '', price: '', category: '', emoji: '📦', stock_qty: '0' })
      setShowAddProduct(false)
      setProductMsg('✅ Product added!')
      setTimeout(() => setProductMsg(''), 3000)
    } catch {
      setProductMsg('❌ Failed to add product')
    }
    setProductSaving(false)
  }

  const handleUpdateProduct = async () => {
    setProductSaving(true)
    try {
      const res = await axios.patch(`${API_URL}/products/${editingProduct.id}`, {
        name: editingProduct.name,
        description: editingProduct.description,
        price: parseFloat(editingProduct.price),
        category: editingProduct.category,
        emoji: editingProduct.emoji,
        stock_qty: parseInt(editingProduct.stock_qty),
        image_url: editingProduct.image_url || null,
        is_active: editingProduct.is_active,
      })
      setProducts(prev => prev.map(p => p.id === res.data.id ? res.data : p))
      setEditingProduct(null)
      setProductMsg('✅ Product updated!')
      setTimeout(() => setProductMsg(''), 3000)
    } catch {
      setProductMsg('❌ Failed to update')
    }
    setProductSaving(false)
  }

  const handleDeleteProduct = async (productId: number, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    try {
      await axios.delete(`${API_URL}/products/${productId}`)
      setProducts(prev => prev.filter(p => p.id !== productId))
      setProductMsg('✅ Product deleted')
      setTimeout(() => setProductMsg(''), 3000)
    } catch {
      setProductMsg('❌ Failed to delete')
    }
  }

  const handleImportCSV = async () => {
    if (!importFile) return
    setImporting(true)
    setImportResult(null)
    const formData = new FormData()
    formData.append('file', importFile)
    try {
      const res = await axios.post(`${API_URL}/products/import-csv?merchant_id=${productMerchant.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setImportResult(res.data)
      await fetchProducts(productMerchant)
    } catch {
      setProductMsg('❌ Import failed')
    }
    setImporting(false)
    setImportFile(null)
  }

  const downloadTemplate = () => {
    window.open(`${API_URL}/products/template/csv`, '_blank')
  }

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }

  if (lightboxUrl) {
    return (
      <div onClick={() => setLightboxUrl(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
        <img src={lightboxUrl} alt="Preview" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()} />
        <button onClick={() => setLightboxUrl(null)} style={{ position: 'absolute', top: 20, right: 24, background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: '50%', width: 40, height: 40, fontSize: 20, cursor: 'pointer', fontWeight: 700 }}>✕</button>
      </div>
    )
  }

  if (!loggedIn) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ background: 'var(--green-dark)', borderRadius: 16, padding: '24px', textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>Apni Dukaan</div>
            <div style={{ fontSize: 14, color: 'var(--gold)', marginTop: 4 }}>Admin Panel</div>
          </div>
          <div style={{ background: 'white', borderRadius: 16, padding: 20, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>Admin Password</div>
            <input type="password" placeholder="Enter admin password" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ ...inputStyle, marginBottom: 12 }} />
            {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <button className="btn-primary" onClick={handleLogin} disabled={loading}>
              {loading ? '⏳ Logging in...' : 'Login →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* Header */}
      <div style={{ background: 'var(--green-dark)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>Apni Dukaan — Admin</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Platform command centre</div>
        </div>
        <button onClick={() => setLoggedIn(false)}
          style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
          Logout
        </button>
      </div>

      {/* Stats bar */}
      {data && (
        <div style={{ background: 'var(--green)', padding: '16px 24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Total Merchants', value: data.total_merchants },
            { label: 'Total Orders', value: data.total_orders },
            { label: 'Total Revenue', value: `$${data.total_revenue?.toFixed(2)}` },
            { label: 'Your Commission', value: `$${data.total_commission?.toFixed(2)}` },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', display: 'flex', padding: '0 24px' }}>
        {[['overview', '📊 Overview'], ['merchants', '🏪 Merchants'], ['products', '📦 Products'], ['orders', '🛒 Orders']].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab as any)}
            style={{ padding: '14px 20px', border: 'none', background: 'transparent', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              color: activeTab === tab ? 'var(--green)' : 'var(--text-3)',
              borderBottom: activeTab === tab ? '3px solid var(--green)' : '3px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>

        {/* OVERVIEW */}
        {activeTab === 'overview' && data && (
          <div>
            <h2 style={{ color: 'var(--green-dark)', marginBottom: 16 }}>Recent Orders</h2>
            <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--green)', color: 'white' }}>
                    {['#', 'Buyer', 'Merchant', 'Total', 'Commission', 'Payout', 'Method', 'Promo', 'Status', 'Time'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recent_orders.map((o: any, i: number) => {
                    const merchant = data.merchants.find((m: any) => m.id === o.merchant_id)
                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700 }}>#{o.id}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13 }}>{o.buyer_name}<br /><span style={{ fontSize: 11, color: 'var(--text-3)' }}>{o.buyer_email}</span></td>
                        <td style={{ padding: '10px 12px', fontSize: 13 }}>{merchant?.name || `#${o.merchant_id}`}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700 }}>${o.total?.toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--green)' }}>${o.commission?.toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13 }}>${o.merchant_payout?.toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12 }}>{o.payment_method}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>{o.promo_code || '-'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                            background: o.status === 'paid' ? '#fff3e0' : o.status === 'fulfilled' ? '#e8f5e9' : '#e3f2fd',
                            color: o.status === 'paid' ? '#e65100' : o.status === 'fulfilled' ? '#2e7d32' : '#1565c0' }}>
                            {o.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-3)' }}>{new Date(o.created_at).toLocaleDateString('en-AU')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MERCHANTS */}
        {activeTab === 'merchants' && data && (
          <div>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ color: 'var(--green-dark)', margin: 0 }}>All Merchants ({data.merchants.length})</h2>
              <button onClick={() => { setShowAddMerchant(true); setSelectedMerchant(null) }}
                style={{ background: 'var(--green)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                + Add New Merchant
              </button>
            </div>

            {merchantMsg && (
              <div style={{ background: merchantMsg.includes('✅') ? '#e8f5e9' : '#fce4ec', color: merchantMsg.includes('✅') ? '#2e7d32' : 'var(--red)', padding: '10px 16px', borderRadius: 10, marginBottom: 16, fontWeight: 700, fontSize: 13 }}>
                {merchantMsg}
              </div>
            )}

            {/* Add Merchant Form */}
            {showAddMerchant && (
              <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '2px solid var(--green)', marginBottom: 24 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 20 }}>➕ Add New Merchant</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={labelStyle}>Store Name *</label>
                    <input value={newMerchant.name} onChange={e => setNewMerchant({ ...newMerchant, name: e.target.value })} placeholder="e.g. Sathy Ko Pasal" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Suburb *</label>
                    <input value={newMerchant.suburb} onChange={e => setNewMerchant({ ...newMerchant, suburb: e.target.value })} placeholder="e.g. Auburn" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Email *</label>
                    <input type="email" value={newMerchant.email} onChange={e => setNewMerchant({ ...newMerchant, email: e.target.value })} placeholder="merchant@email.com" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone</label>
                    <input value={newMerchant.phone} onChange={e => setNewMerchant({ ...newMerchant, phone: e.target.value })} placeholder="04xx xxx xxx" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Category</label>
                    <select value={newMerchant.category} onChange={e => setNewMerchant({ ...newMerchant, category: e.target.value })} style={inputStyle}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>ABN</label>
                    <input value={newMerchant.abn} onChange={e => setNewMerchant({ ...newMerchant, abn: e.target.value })} placeholder="12 345 678 901" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Login Password (for merchant)</label>
                    <input type="password" value={newMerchant.password} onChange={e => setNewMerchant({ ...newMerchant, password: e.target.value })} placeholder="Set a login password" style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 20 }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>GST Registered</label>
                    <button onClick={() => setNewMerchant({ ...newMerchant, gst_registered: !newMerchant.gst_registered })}
                      style={{ width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', background: newMerchant.gst_registered ? 'var(--green)' : '#ccc', position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: newMerchant.gst_registered ? 23 : 3, transition: 'left 0.2s' }} />
                    </button>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{newMerchant.gst_registered ? 'Yes' : 'No'}</span>
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Description</label>
                  <input value={newMerchant.description} onChange={e => setNewMerchant({ ...newMerchant, description: e.target.value })} placeholder="Short description of the store" style={inputStyle} />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Store Emoji</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 10, background: 'var(--cream-dark)', borderRadius: 10 }}>
                    {STORE_EMOJIS.map(e => (
                      <button key={e} onClick={() => setNewMerchant({ ...newMerchant, emoji: e })}
                        style={{ fontSize: 24, background: newMerchant.emoji === e ? 'var(--green)' : 'white', border: `2px solid ${newMerchant.emoji === e ? 'var(--green)' : 'var(--border)'}`, borderRadius: 8, width: 44, height: 44, cursor: 'pointer' }}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-primary" onClick={handleAddMerchant} disabled={merchantSaving}>
                    {merchantSaving ? '⏳ Creating...' : 'Create Merchant'}
                  </button>
                  <button onClick={() => { setShowAddMerchant(false); setMerchantMsg('') }}
                    style={{ background: 'var(--cream-dark)', color: 'var(--text-2)', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: selectedMerchant ? '1fr 1fr' : '1fr', gap: 24 }}>
              <div>
                {data.merchants.map((m: any) => (
                  <div key={m.id} onClick={() => { setSelectedMerchant(m); setShowAddMerchant(false); setEditData({ payment_preference: m.payment_preference || 'platform', bank_bsb: m.bank_bsb || '', bank_account: m.bank_account || '', bank_account_name: m.bank_account_name || '', notes: m.notes || '', is_active: m.is_active }) }}
                    style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, border: `2px solid ${selectedMerchant?.id === m.id ? 'var(--green)' : 'var(--border)'}`, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--green-dark)' }}>{m.emoji} {m.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{m.suburb} · {m.category} · ID: {m.id}</div>
                      </div>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 700, background: m.is_active ? '#e8f5e9' : '#fce4ec', color: m.is_active ? '#2e7d32' : 'var(--red)' }}>
                        {m.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {[['Orders', m.total_orders], ['Revenue', `$${m.total_revenue?.toFixed(0)}`], ['Payout', `$${m.total_payout?.toFixed(0)}`]].map(([label, value]) => (
                        <div key={label} style={{ background: 'var(--cream-dark)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>{value}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {selectedMerchant && (
                <div>
                  <h2 style={{ color: 'var(--green-dark)', marginBottom: 16 }}>Edit — {selectedMerchant.name}</h2>
                  <div style={{ background: 'white', borderRadius: 16, padding: 20, border: '1px solid var(--border)', marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 16, textTransform: 'uppercase' }}>Payment Settings</div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={labelStyle}>Payment Preference</label>
                      <select value={editData.payment_preference} onChange={e => setEditData({ ...editData, payment_preference: e.target.value })} style={inputStyle}>
                        <option value="platform">📋 Platform Managed (weekly bank transfer)</option>
                        <option value="direct">🏦 Direct Stripe Payout</option>
                      </select>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={labelStyle}>Account Name</label>
                      <input value={editData.bank_account_name} onChange={e => setEditData({ ...editData, bank_account_name: e.target.value })} placeholder="e.g. King Spice Pty Ltd" style={inputStyle} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <div>
                        <label style={labelStyle}>BSB</label>
                        <input value={editData.bank_bsb} onChange={e => setEditData({ ...editData, bank_bsb: e.target.value })} placeholder="062-000" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Account Number</label>
                        <input value={editData.bank_account} onChange={e => setEditData({ ...editData, bank_account: e.target.value })} placeholder="12345678" style={inputStyle} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={labelStyle}>Internal Notes</label>
                      <textarea value={editData.notes} onChange={e => setEditData({ ...editData, notes: e.target.value })} placeholder="Notes about this merchant..." rows={2} style={{ ...inputStyle, resize: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--cream-dark)', borderRadius: 10, marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Account Active</div>
                      <button onClick={() => setEditData({ ...editData, is_active: !editData.is_active })}
                        style={{ width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', background: editData.is_active ? 'var(--green)' : '#ccc', position: 'relative' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: editData.is_active ? 23 : 3 }} />
                      </button>
                    </div>
                    {saved && <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12, fontWeight: 700 }}>✅ Saved!</div>}
                    <button className="btn-primary" onClick={handleSaveMerchant} disabled={saving}>{saving ? '⏳ Saving...' : 'Save Changes'}</button>
                  </div>
                  <div style={{ background: 'white', borderRadius: 16, padding: 20, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 12, textTransform: 'uppercase' }}>Merchant Details</div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Email</label>
                      <input value={editData.email || selectedMerchant.email || ''} onChange={e => setEditData({ ...editData, email: e.target.value })}
                        placeholder="merchant@email.com" style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' as const }} />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>Phone</label>
                      <input value={editData.phone || selectedMerchant.phone || ''} onChange={e => setEditData({ ...editData, phone: e.target.value })}
                        placeholder="04xx xxx xxx" style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' as const }} />
                    </div>
                    {[['ABN', selectedMerchant.abn || 'Not provided'], ['GST', selectedMerchant.gst_registered ? 'Registered' : 'Not registered']].map(([label, value]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{value || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PRODUCTS */}
        {activeTab === 'products' && data && (
          <div>
            <h2 style={{ color: 'var(--green-dark)', marginBottom: 16 }}>Product Management</h2>
            <div style={{ background: 'white', borderRadius: 16, padding: 16, border: '1px solid var(--border)', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 10, textTransform: 'uppercase' }}>Select Merchant</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {data.merchants.map((m: any) => (
                  <button key={m.id} onClick={() => fetchProducts(m)}
                    style={{ padding: '8px 16px', borderRadius: 10, border: `2px solid ${productMerchant?.id === m.id ? 'var(--green)' : 'var(--border)'}`,
                      background: productMerchant?.id === m.id ? 'var(--green)' : 'white',
                      color: productMerchant?.id === m.id ? 'white' : 'var(--green-dark)',
                      fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    {m.emoji} {m.name}
                  </button>
                ))}
              </div>
            </div>

            {productMerchant && (
              <div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--green-dark)', flex: 1 }}>
                    {productMerchant.emoji} {productMerchant.name} — {products.length} products
                  </div>
                  <button onClick={() => { setShowAddProduct(true); setEditingProduct(null) }}
                    style={{ background: 'var(--green)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    + Add Product
                  </button>
                  <button onClick={downloadTemplate}
                    style={{ background: 'var(--cream-dark)', color: 'var(--green-dark)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    📥 Download CSV Template
                  </button>
                </div>

                {productMsg && (
                  <div style={{ background: productMsg.includes('✅') ? '#e8f5e9' : '#fce4ec', color: productMsg.includes('✅') ? '#2e7d32' : 'var(--red)', padding: '10px 16px', borderRadius: 10, marginBottom: 16, fontWeight: 700, fontSize: 13 }}>
                    {productMsg}
                  </div>
                )}

                {showAddProduct && (
                  <div style={{ background: 'white', borderRadius: 16, padding: 20, border: '2px solid var(--green)', marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 16 }}>➕ Add New Product</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={labelStyle}>Product Name *</label>
                        <input value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="e.g. Basmati Rice 5kg" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Price (AUD) *</label>
                        <input type="number" step="0.01" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} placeholder="18.99" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Category</label>
                        <input value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value })} placeholder="e.g. Rice & Grains" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Stock Qty</label>
                        <input type="number" value={newProduct.stock_qty} onChange={e => setNewProduct({ ...newProduct, stock_qty: e.target.value })} placeholder="0" style={inputStyle} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={labelStyle}>Description</label>
                      <input value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} placeholder="Short description (optional)" style={inputStyle} />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={labelStyle}>Emoji</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 10, background: 'var(--cream-dark)', borderRadius: 10 }}>
                        {EMOJIS.map(e => (
                          <button key={e} onClick={() => setNewProduct({ ...newProduct, emoji: e })}
                            style={{ fontSize: 22, background: newProduct.emoji === e ? 'var(--green)' : 'white', border: `2px solid ${newProduct.emoji === e ? 'var(--green)' : 'var(--border)'}`, borderRadius: 8, width: 40, height: 40, cursor: 'pointer' }}>
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="btn-primary" onClick={handleAddProduct} disabled={productSaving}>{productSaving ? '⏳ Saving...' : 'Add Product'}</button>
                      <button onClick={() => setShowAddProduct(false)} style={{ background: 'var(--cream-dark)', color: 'var(--text-2)', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                )}

                <div style={{ background: 'white', borderRadius: 16, padding: 16, border: '1px solid var(--border)', marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 10 }}>📤 Import Products via CSV</div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="file" accept=".csv" onChange={e => setImportFile(e.target.files?.[0] || null)} style={{ fontSize: 13, flex: 1 }} />
                    <button onClick={handleImportCSV} disabled={!importFile || importing}
                      style={{ background: importFile ? 'var(--green)' : '#ccc', color: 'white', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: importFile ? 'pointer' : 'not-allowed' }}>
                      {importing ? '⏳ Importing...' : 'Import CSV'}
                    </button>
                  </div>
                  {importResult && (
                    <div style={{ marginTop: 12, padding: 12, background: '#e8f5e9', borderRadius: 10, fontSize: 13 }}>
                      ✅ Imported {importResult.imported_count} products
                      {importResult.error_count > 0 && <span style={{ color: 'var(--red)', marginLeft: 8 }}>· {importResult.error_count} errors</span>}
                    </div>
                  )}
                </div>

                {editingProduct && (
                  <div style={{ background: 'white', borderRadius: 16, padding: 20, border: '2px solid var(--gold)', marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 16 }}>✏️ Edit — {editingProduct.name}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={labelStyle}>Product Name</label>
                        <input value={editingProduct.name} onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Price (AUD)</label>
                        <input type="number" step="0.01" value={editingProduct.price} onChange={e => setEditingProduct({ ...editingProduct, price: e.target.value })} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Category</label>
                        <input value={editingProduct.category || ''} onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value })} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Stock Qty</label>
                        <input type="number" value={editingProduct.stock_qty} onChange={e => setEditingProduct({ ...editingProduct, stock_qty: e.target.value })} style={inputStyle} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={labelStyle}>Product Image</label>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                        {editingProduct.image_url ? (
                          <img src={editingProduct.image_url} alt="Product" onClick={() => setLightboxUrl(editingProduct.image_url)} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, border: '2px solid var(--border)', flexShrink: 0, cursor: 'zoom-in' }} onError={e => (e.currentTarget.style.display = 'none')} />
                        ) : (
                          <div style={{ width: 80, height: 80, borderRadius: 10, border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>📷</div>
                        )}
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'inline-block', background: 'var(--green)', color: 'white', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: imageUploading ? 'not-allowed' : 'pointer', opacity: imageUploading ? 0.7 : 1, marginBottom: 8 }}>
                            {imageUploading ? '⏳ Uploading...' : '📷 Upload New Image'}
                            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} disabled={imageUploading}
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                setImageUploading(true)
                                setProductMsg('')
                                try {
                                  const formData = new FormData()
                                  formData.append('file', file)
                                  const res = await axios.post(`${API_URL}/upload/product-image/${editingProduct.id}`, formData, {
                                    headers: { 'Content-Type': 'multipart/form-data' }
                                  })
                                  const newUrl = res.data.image_url || res.data.url || res.data
                                  setEditingProduct((prev: any) => ({ ...prev, image_url: typeof newUrl === 'string' ? newUrl : prev.image_url }))
                                  setProducts(prev => prev.map((p: any) => p.id === editingProduct.id ? { ...p, image_url: typeof newUrl === 'string' ? newUrl : p.image_url } : p))
                                  setProductMsg('✅ Image uploaded!')
                                  setTimeout(() => setProductMsg(''), 3000)
                                } catch {
                                  setProductMsg('❌ Image upload failed')
                                }
                                setImageUploading(false)
                              }} />
                          </label>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Takes photo with camera or choose from gallery</div>
                        </div>
                      </div>
                      <input value={editingProduct.image_url || ''} onChange={e => setEditingProduct({ ...editingProduct, image_url: e.target.value })} placeholder="https://... (or upload above)" style={inputStyle} />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={labelStyle}>Description</label>
                      <input value={editingProduct.description || ''} onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })} style={inputStyle} />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={labelStyle}>Emoji</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 10, background: 'var(--cream-dark)', borderRadius: 10 }}>
                        {EMOJIS.map(e => (
                          <button key={e} onClick={() => setEditingProduct({ ...editingProduct, emoji: e })}
                            style={{ fontSize: 22, background: editingProduct.emoji === e ? 'var(--green)' : 'white', border: `2px solid ${editingProduct.emoji === e ? 'var(--green)' : 'var(--border)'}`, borderRadius: 8, width: 40, height: 40, cursor: 'pointer' }}>
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>Active</label>
                      <button onClick={() => setEditingProduct({ ...editingProduct, is_active: !editingProduct.is_active })}
                        style={{ width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', background: editingProduct.is_active ? 'var(--green)' : '#ccc', position: 'relative' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: editingProduct.is_active ? 23 : 3 }} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="btn-primary" onClick={handleUpdateProduct} disabled={productSaving}>{productSaving ? '⏳ Saving...' : 'Save Changes'}</button>
                      <button onClick={() => setEditingProduct(null)} style={{ background: 'var(--cream-dark)', color: 'var(--text-2)', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                )}

                {loadingProducts ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>⏳ Loading products...</div>
                ) : products.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)', background: 'white', borderRadius: 16 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
                    <div style={{ fontWeight: 700 }}>No products yet</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>Add products manually or import via CSV</div>
                  </div>
                ) : (
                  <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--green)', color: 'white' }}>
                          {['IMG', 'Name', 'Category', 'Price', 'Stock', 'Status', 'Actions'].map(h => (
                            <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12 }}>{h}</th>
                          ))}
                          <th style={{ padding: '10px 12px' }}>
                            <button onClick={() => setSortByCategory(s => !s)}
                              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: sortByCategory ? 'rgba(255,255,255,0.2)' : 'transparent', color: 'white', cursor: 'pointer', fontWeight: 700 }}>
                              {sortByCategory ? '↕ Sorted' : '↕ Sort by Category'}
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(sortByCategory ? [...products].sort((a: any, b: any) => (a.category || '').localeCompare(b.category || '')) : products).map((p: any, i: number) => (
                          <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                            <td style={{ padding: '6px 12px' }}>
                              {p.image_url
                                ? <img src={p.image_url} alt={p.name} onClick={() => setLightboxUrl(p.image_url)} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, cursor: 'zoom-in', border: '1px solid var(--border)' }} />
                                : <span style={{ fontSize: 24 }}>{p.emoji}</span>}
                            </td>
                            <td style={{ padding: '6px 12px' }}>
                              <input defaultValue={p.name} id={`name-${p.id}`}
                                style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, fontWeight: 700, color: 'var(--green-dark)', minWidth: 160 }}
                                onBlur={async (e) => {
                                  const val = e.target.value.trim()
                                  if (!val || val === p.name) return
                                  try {
                                    await axios.patch(`${API_URL}/products/${p.id}`, { name: val })
                                    setProducts(prev => prev.map((x: any) => x.id === p.id ? { ...x, name: val } : x))
                                    setProductMsg(`✅ Name updated`)
                                    setTimeout(() => setProductMsg(''), 2000)
                                  } catch { setProductMsg('❌ Failed') }
                                }} />
                            </td>
                            <td style={{ padding: '6px 12px' }}>
                              <select defaultValue={p.category || ''} id={`cat-${p.id}`}
                                style={{ padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--text-2)', width: '100%' }}
                                onChange={async (e) => {
                                  const val = e.target.value
                                  try {
                                    await axios.patch(`${API_URL}/products/${p.id}`, { category: val })
                                    setProducts(prev => prev.map((x: any) => x.id === p.id ? { ...x, category: val } : x))
                                    setProductMsg(`✅ Category updated`)
                                    setTimeout(() => setProductMsg(''), 2000)
                                  } catch { setProductMsg('❌ Failed') }
                                }}>
                                <option value="">-- select --</option>
                                {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 13 }}>$</span>
                                <input type="number" step="0.01" defaultValue={p.price?.toFixed(2)}
                                  id={`price-${p.id}`}
                                  style={{ width: 70, padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontWeight: 700, color: 'var(--green)' }} />
                                <button onClick={async () => {
                                  const val = parseFloat((document.getElementById(`price-${p.id}`) as HTMLInputElement).value)
                                  if (isNaN(val)) return
                                  try {
                                    await axios.patch(`${API_URL}/products/${p.id}`, { price: val })
                                    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, price: val } : x))
                                    setProductMsg(`✅ ${p.name} price updated to $${val.toFixed(2)}`)
                                    setTimeout(() => setProductMsg(''), 3000)
                                  } catch { setProductMsg('❌ Failed to update price') }
                                }} style={{ background: 'var(--green)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓</button>
                              </div>
                            </td>
                            <td style={{ padding: '6px 12px' }}>
                              <input type="number" defaultValue={p.stock_qty} id={`stock-${p.id}`}
                                style={{ width: 60, padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, textAlign: 'center' }}
                                onBlur={async (e) => {
                                  const val = parseInt(e.target.value)
                                  if (isNaN(val) || val === p.stock_qty) return
                                  try {
                                    await axios.patch(`${API_URL}/products/${p.id}`, { stock_qty: val })
                                    setProducts(prev => prev.map((x: any) => x.id === p.id ? { ...x, stock_qty: val } : x))
                                    setProductMsg(`✅ Stock updated`)
                                    setTimeout(() => setProductMsg(''), 2000)
                                  } catch { setProductMsg('❌ Failed') }
                                }} />
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: p.is_active ? '#e8f5e9' : '#fce4ec', color: p.is_active ? '#2e7d32' : 'var(--red)' }}>
                                {p.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => { setEditingProduct({ ...p }); setShowAddProduct(false) }}
                                  style={{ background: 'var(--green)', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                  Edit
                                </button>
                                <button onClick={async () => {
                                  try {
                                    await axios.patch(`${API_URL}/products/${p.id}`, { is_active: !p.is_active })
                                    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !p.is_active } : x))
                                    setProductMsg(p.is_active ? '🙈 Product hidden' : '✅ Product visible')
                                    setTimeout(() => setProductMsg(''), 2000)
                                  } catch { setProductMsg('❌ Failed') }
                                }}
                                  style={{ background: p.is_active ? '#fff3e0' : '#e8f5e9', color: p.is_active ? '#e65100' : '#2e7d32', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                  {p.is_active ? 'Hide' : 'Show'}
                                </button>
                                <button onClick={() => handleDeleteProduct(p.id, p.name)}
                                  style={{ background: '#fce4ec', color: 'var(--red)', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ORDERS */}
        {activeTab === 'orders' && data && (
          <div>
            <h2 style={{ color: 'var(--green-dark)', marginBottom: 16 }}>All Orders ({data.total_orders})</h2>
            <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--green)', color: 'white' }}>
                    {['#', 'Buyer', 'Email', 'Merchant', 'Total', 'Commission', 'Payout', 'Promo', 'Status', 'Date'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recent_orders.map((o: any, i: number) => {
                    const merchant = data.merchants.find((m: any) => m.id === o.merchant_id)
                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700 }}>#{o.id}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13 }}>{o.buyer_name}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-3)' }}>{o.buyer_email}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13 }}>{merchant?.name || `#${o.merchant_id}`}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700 }}>${o.total?.toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>${o.commission?.toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13 }}>${o.merchant_payout?.toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>{o.promo_code || '-'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                            background: o.status === 'paid' ? '#fff3e0' : o.status === 'fulfilled' ? '#e8f5e9' : '#e3f2fd',
                            color: o.status === 'paid' ? '#e65100' : o.status === 'fulfilled' ? '#2e7d32' : '#1565c0' }}>
                            {o.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-3)' }}>{new Date(o.created_at).toLocaleDateString('en-AU')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
