import { useState, useRef, useEffect } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

type Product = {
  id: number
  merchant_id: number
  merchant_name: string
  name: string
  emoji: string
  category: string | null
  price: number
  stock_qty: number
  is_active: boolean
  image_url: string | null
  description: string | null
}

type Edit = { price?: number; stock_qty?: number; is_active?: boolean; image_url?: string | null }

export default function BulkEditor() {
  const [password, setPassword] = useState(() => localStorage.getItem('bulk_editor_pwd') || '')
  const [authed, setAuthed] = useState(false)
  const [authErr, setAuthErr] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [edits, setEdits] = useState<Record<number, Edit>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<Record<number, boolean>>({})
  const [savingAll, setSavingAll] = useState(false)
  const [rowMsg, setRowMsg] = useState<Record<number, string>>({})
  const [msg, setMsg] = useState('')
  const [merchantFilter, setMerchantFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeUploadId = useRef<number | null>(null)

  const headers = { 'x-admin-password': password }

  useEffect(() => {
    const saved = localStorage.getItem('bulk_editor_pwd')
    if (saved) load(saved)
  }, [])

  const load = async (pwd: string) => {
    setLoading(true)
    try {
      const res = await axios.get(`${API_URL}/staff/bulk/products`, { headers: { 'x-admin-password': pwd } })
      setProducts(res.data)
      setEdits({})
      setAuthed(true)
      setAuthErr('')
      localStorage.setItem('bulk_editor_pwd', pwd)
    } catch (e: any) {
      if (e?.response?.status === 401) { setAuthErr('Invalid password'); localStorage.removeItem('bulk_editor_pwd') }
      else setAuthErr('Failed to connect')
    }
    setLoading(false)
  }

  const merchants = ['All', ...Array.from(new Set(products.map(p => p.merchant_name))).sort()]

  const visible = products.filter(p => {
    if (merchantFilter !== 'All' && p.merchant_name !== merchantFilter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const setEdit = (id: number, field: keyof Edit, value: any) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const get = (p: Product, field: keyof Edit) => {
    const e = edits[p.id]
    if (e && field in e) return e[field as keyof typeof e]
    return p[field as keyof Product]
  }

  const dirtyCount = Object.keys(edits).length

  const saveRow = async (p: Product) => {
    const edit = edits[p.id]
    if (!edit) return
    setSaving(prev => ({ ...prev, [p.id]: true }))
    setRowMsg(prev => ({ ...prev, [p.id]: '' }))
    try {
      await axios.patch(`${API_URL}/staff/bulk/products`, { updates: [{ id: p.id, ...edit }] }, { headers })
      setProducts(prev => prev.map(pr => pr.id === p.id ? { ...pr, ...edit } : pr))
      setEdits(prev => { const n = { ...prev }; delete n[p.id]; return n })
      setRowMsg(prev => ({ ...prev, [p.id]: 'Saved' }))
      setTimeout(() => setRowMsg(prev => ({ ...prev, [p.id]: '' })), 2000)
    } catch {
      setRowMsg(prev => ({ ...prev, [p.id]: 'Failed' }))
    }
    setSaving(prev => ({ ...prev, [p.id]: false }))
  }

  const saveAll = async () => {
    if (!dirtyCount) return
    setSavingAll(true)
    setMsg('')
    try {
      const updates = Object.entries(edits).map(([id, e]) => ({ id: Number(id), ...e }))
      await axios.patch(`${API_URL}/staff/bulk/products`, { updates }, { headers })
      await load(password)
      setMsg('Saved ' + updates.length + ' products')
    } catch {
      setMsg('Save failed')
    }
    setSavingAll(false)
  }

  const handleImageClick = (productId: number) => {
    activeUploadId.current = productId
    fileInputRef.current?.click()
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const productId = activeUploadId.current
    if (!file || !productId) return
    setUploadingId(productId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await axios.post(`${API_URL}/upload/product-image/${productId}`, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' }
      })
      const newUrl = res.data.image_url
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, image_url: newUrl } : p))
      setRowMsg(prev => ({ ...prev, [productId]: 'Image saved' }))
      setTimeout(() => setRowMsg(prev => ({ ...prev, [productId]: '' })), 2000)
    } catch {
      setRowMsg(prev => ({ ...prev, [productId]: 'Upload failed' }))
    }
    setUploadingId(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const toggleActive = (p: Product) => {
    const current = get(p, 'is_active') as boolean
    setEdit(p.id, 'is_active', !current)
  }

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'white', borderRadius: 16, padding: '40px 32px', width: 320, boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
          <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>lightning</div>
          <div style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', marginBottom: 4, color: '#1a4a30' }}>Staff Bulk Editor</div>
          <div style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 24 }}>Enter admin password to continue</div>
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(password)}
            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #ddd', borderRadius: 10, fontSize: 15, boxSizing: 'border-box', marginBottom: 12 }}
          />
          {authErr && <div style={{ color: '#d32f2f', fontSize: 13, marginBottom: 10 }}>{authErr}</div>}
          <button
            onClick={() => load(password)}
            disabled={loading}
            style={{ width: '100%', background: '#276040', color: 'white', border: 'none', borderRadius: 10, padding: '12px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
          >
            {loading ? 'Connecting' : 'Login'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f0' }}>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />

      <div style={{ background: '#1a4a30', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ color: 'white', fontWeight: 700, fontSize: 16, flex: 1 }}>Staff Bulk Editor</div>
        {dirtyCount > 0 && (
          <span style={{ background: '#e8a020', color: 'white', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
            {dirtyCount} unsaved
          </span>
        )}
        <button
          onClick={saveAll}
          disabled={savingAll || dirtyCount === 0}
          style={{ background: dirtyCount > 0 ? '#e8a020' : '#3a6a50', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: dirtyCount > 0 ? 'pointer' : 'default' }}
        >
          {savingAll ? 'Saving' : 'Save All' + (dirtyCount > 0 ? ' (' + dirtyCount + ')' : '')}
        </button>
        <button
          onClick={() => { localStorage.removeItem('bulk_editor_pwd'); setAuthed(false); setPassword('') }}
          style={{ background: 'none', color: '#aaa', border: '1px solid #aaa', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
        >
          Logout
        </button>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', background: 'white', borderBottom: '1px solid #eee' }}>
        <input
          placeholder="Search products"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 14px', border: '1.5px solid #ddd', borderRadius: 10, fontSize: 14, minWidth: 200 }}
        />
        <select
          value={merchantFilter}
          onChange={e => setMerchantFilter(e.target.value)}
          style={{ padding: '8px 14px', border: '1.5px solid #ddd', borderRadius: 10, fontSize: 14, background: 'white' }}
        >
          {merchants.map(m => <option key={m}>{m}</option>)}
        </select>
        <span style={{ fontSize: 13, color: '#666' }}>{visible.length} products</span>
        {msg && <span style={{ fontSize: 13, color: msg.includes('failed') ? '#d32f2f' : '#276040', fontWeight: 600 }}>{msg}</span>}
      </div>

      <div style={{ overflowX: 'auto', padding: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
          <thead>
            <tr style={{ background: '#1a4a30', color: 'white' }}>
              <th style={th}>Image</th>
              <th style={th}>Product</th>
              <th style={th}>Category</th>
              <th style={{ ...th, textAlign: 'right' }}>Price ($)</th>
              <th style={{ ...th, textAlign: 'right' }}>Stock</th>
              <th style={{ ...th, textAlign: 'center' }}>Active</th>
              <th style={{ ...th, textAlign: 'center' }}>Save Row</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p, i) => {
              const dirty = !!edits[p.id]
              const active = get(p, 'is_active') as boolean
              const isUploadingThis = uploadingId === p.id
              const isSavingThis = saving[p.id]
              return (
                <tr key={p.id} style={{ background: dirty ? '#fffde7' : i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #eee' }}>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <div
                      onClick={() => !isUploadingThis && handleImageClick(p.id)}
                      style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #ccc', margin: '0 auto' }}
                      title="Click to upload image"
                    >
                      {isUploadingThis ? (
                        <span style={{ fontSize: 20 }}>...</span>
                      ) : p.image_url ? (
                        <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 24 }}>+</span>
                      )}
                    </div>
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{p.merchant_name} ID:{p.id}</div>
                  </td>
                  <td style={td}>
                    <span style={{ fontSize: 12, color: '#777' }}>{p.category || '-'}</span>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <input
                      type="number" min="0" step="0.01"
                      value={get(p, 'price') as number}
                      onChange={e => setEdit(p.id, 'price', parseFloat(e.target.value) || 0)}
                      style={{ width: 80, padding: '4px 8px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: 14, textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <input
                      type="number" min="0" step="1"
                      value={get(p, 'stock_qty') as number}
                      onChange={e => setEdit(p.id, 'stock_qty', parseInt(e.target.value) || 0)}
                      style={{ width: 70, padding: '4px 8px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: 14, textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <button
                      onClick={() => toggleActive(p)}
                      style={{ background: active ? '#276040' : '#ccc', color: 'white', border: 'none', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', minWidth: 60 }}
                    >
                      {active ? 'On' : 'Off'}
                    </button>
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {rowMsg[p.id] ? (
                      <span style={{ fontSize: 13, color: rowMsg[p.id].includes('fail') || rowMsg[p.id].includes('Failed') ? '#d32f2f' : '#276040', fontWeight: 600 }}>{rowMsg[p.id]}</span>
                    ) : (
                      <button
                        onClick={() => saveRow(p)}
                        disabled={!dirty || isSavingThis}
                        style={{ background: dirty ? '#276040' : '#e0e0e0', color: dirty ? 'white' : '#aaa', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: dirty ? 'pointer' : 'default', minWidth: 60 }}
                      >
                        {isSavingThis ? '...' : 'Save'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {visible.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: '#aaa' }}>No products found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '12px 16px', fontWeight: 700, fontSize: 13, textAlign: 'left' }
const td: React.CSSProperties = { padding: '10px 16px', fontSize: 14, verticalAlign: 'middle' }
