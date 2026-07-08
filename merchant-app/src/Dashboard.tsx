import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000' // v4

type Order = {
  id: number; buyer_name: string; buyer_email: string; buyer_phone: string
  items: any[]; subtotal: number; surcharge: number; total: number
  commission: number; merchant_payout: number; payment_method: string
  status: string; created_at: string
}

type ProductTask = {
  id: number; name: string; image_url: string | null; description: string | null
  price: number | null; category: string | null; stock: number | null
  barcode: string | null; staff_note: string | null; note_updated_by: string | null
  note_updated_at: string | null; has_image: boolean; has_description: boolean
  has_price: boolean; has_category: boolean; has_stock: boolean
  completed: number; total: number; is_live: boolean
}

type TaskSummary = {
  total: number; live: number; needs_image: number; needs_description: number
  needs_price: number; needs_category: number; needs_stock: number
}

type Message = {
  id: number; sender_type: 'staff' | 'merchant'; sender_name: string
  body: string; is_read: boolean; created_at: string
}

type TabType = 'orders' | 'stats' | 'tasks' | 'messages'
type MobileEditorTab = 'list' | 'edit' | 'preview'

const isStaff = () => !!localStorage.getItem('staff_name')
const staffName = () => localStorage.getItem('staff_name') || 'Staff'

function Badge({ count, color = '#e65100' }: { count: number; color?: string }) {
  if (!count) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: color, color: 'white', borderRadius: 99, fontSize: 10,
      fontWeight: 700, minWidth: 16, height: 16, padding: '0 4px', marginLeft: 4
    }}>{count}</span>
  )
}

function CriteriaPill({ done, label }: { done: boolean; label: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
      background: done ? '#e8f5e9' : '#fce4ec',
      color: done ? '#2e7d32' : '#c62828',
      border: `1px solid ${done ? '#a5d6a7' : '#ef9a9a'}`,
      display: 'inline-block', marginRight: 4, marginBottom: 4
    }}>{done ? '✓' : '✗'} {label}</span>
  )
}

// ── Standalone ProductPreview (outside Dashboard) ─────────────────────────────
function ProductPreview({ product, editState }: { product: ProductTask | null; editState: any }) {
  if (!product) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-3)', fontSize: 13 }}>
      ← Select a product to preview
    </div>
  )
  const name = editState.name || product.name || 'Product Name'
  const price = editState.price || product.price || 0
  const description = editState.description || product.description || ''
  const category = editState.category || product.category || ''
  const imageUrl = editState.previewImageUrl || product.image_url
  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', marginBottom: 12 }}>Customer Preview</div>
      <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', maxWidth: 280 }}>
        <div style={{ width: '100%', height: 180, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {imageUrl ? <img src={imageUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ fontSize: 40 }}>📦</div>}
        </div>
        <div style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 4 }}>{name}</div>
          {category && <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6 }}>{category}</div>}
          {description && <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.4, marginBottom: 8 }}>{description}</div>}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>${Number(price).toFixed(2)}</div>
            <button style={{ background: 'var(--green)', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700 }}>Add to cart</button>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>Criteria status</div>
        <CriteriaPill done={!!(editState.previewImageUrl || product.image_url)} label="Image" />
        <CriteriaPill done={!!(editState.description || product.description)} label="Description" />
        <CriteriaPill done={!!(editState.price || product.price)} label="Price" />
        <CriteriaPill done={!!(editState.category || product.category)} label="Category" />
        <CriteriaPill done={!!(editState.stock || product.stock)} label="Stock" />
      </div>
    </div>
  )
}

// ── Standalone EditPanel (outside Dashboard) ──────────────────────────────────
function EditPanel({
  selectedProduct, editState, setEditState, saving, uploadingImage,
  saveProduct, uploadImage, saveNote, savingNote, editingNote, setEditingNote,
  noteText, setNoteText, isMobile, setMobileTab
}: {
  selectedProduct: ProductTask | null; editState: any; setEditState: (fn: any) => void
  saving: boolean; uploadingImage: boolean; saveProduct: () => void
  uploadImage: (f: File) => void; saveNote: (id: number) => void
  savingNote: boolean; editingNote: number | null; setEditingNote: (id: number | null) => void
  noteText: string; setNoteText: (t: string) => void
  isMobile: boolean; setMobileTab: (t: MobileEditorTab) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!selectedProduct) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-3)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>👈</div>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Select a product</div>
      <div style={{ fontSize: 12 }}>Click any product from the list to edit it here</div>
    </div>
  )

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', marginBottom: 12 }}>
        Editing: {selectedProduct.name}
      </div>

      {/* Image upload */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>📷 Product Image</div>
        <div style={{
          width: '100%', height: 140, background: '#f5f5f5', borderRadius: 12,
          border: '2px dashed var(--border)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'default', overflow: 'hidden', marginBottom: 8
        }}>
          {editState.previewImageUrl
            ? <img src={editState.previewImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
                <div style={{ fontSize: 28, marginBottom: 4 }}>📷</div>
                <div style={{ fontSize: 11 }}>{uploadingImage ? 'Uploading...' : 'Use button below to upload'}</div>
              </div>
          }
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.[0]) uploadImage(e.target.files[0]) }} />
        <button onClick={() => fileInputRef.current?.click()}
          style={{ fontSize: 11, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--cream-dark)', cursor: 'pointer', color: 'var(--green-dark)', fontWeight: 600 }}>
          {editState.previewImageUrl ? '🔄 Change image' : '📷 Upload image'}
        </button>
      </div>

      {/* Form fields */}
      {[
        { key: 'name', label: '🏷️ Product Name', type: 'text', placeholder: 'e.g. Shan Biryani Masala 100g' },
        { key: 'barcode', label: '📦 Barcode / Product Code', type: 'text', placeholder: 'e.g. 8901234567890' },
        { key: 'price', label: '💰 Price (AUD)', type: 'number', placeholder: 'e.g. 4.99' },
        { key: 'stock', label: '📊 Stock Quantity', type: 'number', placeholder: 'e.g. 50' },
        { key: 'category', label: '🗂️ Category', type: 'text', placeholder: 'e.g. Spices & Masalas' },
      ].map(({ key, label, type, placeholder }) => (
        <div key={key} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>{label}</div>
          <input
            type={type}
            value={editState[key] || ''}
            onChange={e => setEditState((prev: any) => ({ ...prev, [key]: e.target.value }))}
            placeholder={placeholder}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 8,
              border: '1px solid var(--border)', fontSize: 13,
              boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none'
            }}
          />
        </div>
      ))}

      {/* Description */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>📝 Description</div>
        <textarea
          value={editState.description || ''}
          onChange={e => setEditState((prev: any) => ({ ...prev, description: e.target.value }))}
          placeholder="Short product description visible to customers..."
          style={{
            width: '100%', padding: '8px 10px', borderRadius: 8,
            border: '1px solid var(--border)', fontSize: 13, resize: 'vertical',
            minHeight: 80, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none'
          }}
        />
      </div>

      {/* Staff note */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>📌 Handover Note (internal)</div>
        <textarea
          value={editingNote === selectedProduct.id ? noteText : (selectedProduct.staff_note || '')}
          onFocus={() => { setEditingNote(selectedProduct.id); setNoteText(selectedProduct.staff_note || '') }}
          onChange={e => setNoteText(e.target.value)}
          placeholder="e.g. Waiting on photo from merchant, price confirmed $4.50"
          style={{
            width: '100%', padding: '8px 10px', borderRadius: 8,
            border: '1px solid #fff176', background: '#fffde7', fontSize: 12, resize: 'vertical',
            minHeight: 60, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none'
          }}
        />
        {editingNote === selectedProduct.id && (
          <button onClick={() => saveNote(selectedProduct.id)} disabled={savingNote}
            style={{ marginTop: 6, fontSize: 11, padding: '5px 12px', borderRadius: 8, border: 'none', background: '#f57f17', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
            {savingNote ? '⏳' : '💾 Save note'}
          </button>
        )}
      </div>

      <button onClick={saveProduct} disabled={saving}
        style={{ width: '100%', padding: '12px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
        {saving ? '⏳ Saving...' : '💾 Save Product'}
      </button>

      {isMobile && (
        <button onClick={() => setMobileTab('preview')}
          style={{ width: '100%', padding: '10px', background: 'var(--cream-dark)', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginTop: 8, color: 'var(--green-dark)' }}>
          👁️ Preview
        </button>
      )}
    </div>
  )
}

// ── Standalone TaskListPanel (outside Dashboard) ──────────────────────────────
function TaskListPanel({
  taskSummary, tasksLoading, filteredTasks, taskFilter, setTaskFilter,
  fetchTasks, selectedProduct, selectProduct
}: {
  taskSummary: TaskSummary | null; tasksLoading: boolean; filteredTasks: ProductTask[]
  taskFilter: 'all' | 'incomplete' | 'live'; setTaskFilter: (f: 'all' | 'incomplete' | 'live') => void
  fetchTasks: () => void; selectedProduct: ProductTask | null; selectProduct: (p: ProductTask) => void
}) {
  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%' }}>
      {taskSummary && (
        <div style={{ background: 'white', borderRadius: 12, padding: '12px', marginBottom: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-dark)' }}>Catalogue Progress</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{taskSummary.live}/{taskSummary.total} live</div>
          </div>
          <div style={{ background: '#e8f0e8', borderRadius: 99, height: 8, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99, background: 'var(--green)',
              width: `${taskSummary.total ? (taskSummary.live / taskSummary.total) * 100 : 0}%`,
              transition: 'width 0.5s ease'
            }} />
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {(['incomplete', 'live', 'all'] as const).map(f => (
          <button key={f} onClick={() => setTaskFilter(f)}
            style={{
              padding: '5px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: taskFilter === f ? 'var(--green)' : 'white',
              color: taskFilter === f ? 'white' : 'var(--text-2)',
              border: `1px solid ${taskFilter === f ? 'var(--green)' : 'var(--border)'}`
            }}>
            {f === 'incomplete' ? '⚠️ Todo' : f === 'live' ? '✅ Live' : '📋 All'}
          </button>
        ))}
        <button onClick={fetchTasks} style={{ marginLeft: 'auto', padding: '5px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'var(--cream-dark)', border: '1px solid var(--border)', color: 'var(--green-dark)' }}>🔄</button>
      </div>
      {tasksLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)' }}>⏳ Loading...</div>
      ) : filteredTasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 36 }}>{taskFilter === 'live' ? '✅' : '🎉'}</div>
          <div style={{ fontWeight: 700, marginTop: 8 }}>{taskFilter === 'live' ? 'No live products' : 'All done!'}</div>
        </div>
      ) : (
        filteredTasks.map(product => (
          <div key={product.id} onClick={() => selectProduct(product)}
            style={{
              background: selectedProduct?.id === product.id ? '#e8f5e9' : 'white',
              borderRadius: 12, padding: '10px 12px', marginBottom: 8,
              border: `1px solid ${selectedProduct?.id === product.id ? 'var(--green)' : 'var(--border)'}`,
              borderLeft: `3px solid ${product.is_live ? '#2e7d32' : product.completed >= 3 ? '#fb8c00' : '#e53935'}`,
              cursor: 'pointer'
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-dark)', flex: 1, paddingRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {product.name}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99, whiteSpace: 'nowrap', background: product.is_live ? '#e8f5e9' : '#fce4ec', color: product.is_live ? '#2e7d32' : '#c62828' }}>
                {product.is_live ? '✅' : `${product.completed}/5`}
              </div>
            </div>
            <div style={{ background: '#f0f0f0', borderRadius: 99, height: 3 }}>
              <div style={{ height: '100%', borderRadius: 99, background: product.is_live ? '#2e7d32' : product.completed >= 3 ? '#fb8c00' : '#e53935', width: `${(product.completed / 5) * 100}%` }} />
            </div>
            {product.staff_note && <div style={{ fontSize: 10, color: '#f57f17', marginTop: 4 }}>📌 {product.staff_note.substring(0, 40)}...</div>}
          </div>
        ))
      )}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('orders')
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [tasks, setTasks] = useState<ProductTask[]>([])
  const [taskSummary, setTaskSummary] = useState<TaskSummary | null>(null)
  const [tasksLoading, setTasksLoading] = useState(false)
  const [taskFilter, setTaskFilter] = useState<'all' | 'incomplete' | 'live'>('incomplete')
  const [selectedProduct, setSelectedProduct] = useState<ProductTask | null>(null)
  const [editState, setEditState] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [mobileTab, setMobileTab] = useState<MobileEditorTab>('list')
  const [editingNote, setEditingNote] = useState<number | null>(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [msgText, setMsgText] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [msgsLoading, setMsgsLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const token = localStorage.getItem('merchant_token')
  const merchantId = localStorage.getItem('merchant_id')
  const merchantName = localStorage.getItem('merchant_name')
  const staff = isStaff()

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    if (!token || !merchantId) { window.location.href = '/merchant'; return }
    fetchOrders()
    axios.get(`${API_URL}/auth/merchant-profile?token=${token}`).then(res => setProfile(res.data)).catch(() => {})
    const interval = setInterval(fetchOrders, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (activeTab === 'tasks') fetchTasks()
    if (activeTab === 'messages') fetchMessages()
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'messages') messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeTab])

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API_URL}/orders/merchant/${merchantId}`)
      setOrders(res.data)
    } catch { window.location.href = '/merchant' }
    setLoading(false)
  }

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true)
    try {
      const res = await axios.get(`${API_URL}/tasks/merchant/${merchantId}/product-tasks`)
      setTasks(res.data.products)
      setTaskSummary(res.data.summary)
    } catch { }
    setTasksLoading(false)
  }, [merchantId])

  const fetchMessages = async () => {
    setMsgsLoading(true)
    try {
      const res = await axios.get(`${API_URL}/tasks/merchant/${merchantId}/messages`)
      setMessages(res.data)
      if (staff) axios.patch(`${API_URL}/tasks/merchant/${merchantId}/messages/read`).catch(() => {})
    } catch { }
    setMsgsLoading(false)
  }

  const selectProduct = (product: ProductTask) => {
    setSelectedProduct(product)
    setEditState({
      name: product.name || '',
      description: product.description || '',
      price: product.price || '',
      category: product.category || '',
      stock: product.stock || '',
      barcode: product.barcode || '',
      previewImageUrl: product.image_url || null
    })
    if (isMobile) setMobileTab('edit')
  }

  const saveProduct = async () => {
    if (!selectedProduct) return
    setSaving(true)
    try {
      await axios.patch(`${API_URL}/products/${selectedProduct.id}`, {
        name: editState.name,
        description: editState.description,
        price: parseFloat(editState.price),
        category: editState.category,
        stock_qty: parseInt(editState.stock),
        barcode: editState.barcode
      })
      setSelectedProduct(prev => prev ? { ...prev, ...editState } : null)
      alert('✅ Product saved!')
      fetchTasks()
    } catch { alert('Save failed — try again') }
    setSaving(false)
  }

  const uploadImage = async (file: File) => {
    if (!selectedProduct) return
    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await axios.post(`${API_URL}/upload/product-image/${selectedProduct.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setEditState((prev: any) => ({ ...prev, previewImageUrl: res.data.image_url }))
      setTasks(prev => prev.map(p => p.id === selectedProduct.id ? { ...p, image_url: res.data.image_url, has_image: true } : p))
    } catch { alert('Image upload failed — try again') }
    setUploadingImage(false)
  }

  const updateStatus = async (orderId: number, status: string) => {
    setUpdatingId(orderId)
    try {
      await axios.patch(`${API_URL}/orders/${orderId}/status?status=${status}`)
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
    } catch { }
    setUpdatingId(null)
  }

  const saveNote = async (productId: number) => {
    setSavingNote(true)
    try {
      await axios.patch(`${API_URL}/tasks/product/${productId}/staff-note`, { note: noteText, updated_by: staffName() })
      setTasks(prev => prev.map(p => p.id === productId ? { ...p, staff_note: noteText, note_updated_by: staffName(), note_updated_at: new Date().toISOString() } : p))
      setEditingNote(null)
    } catch { }
    setSavingNote(false)
  }

  const sendMessage = async () => {
    if (!msgText.trim()) return
    setSendingMsg(true)
    const body = msgText.trim()
    setMsgText('')
    try {
      const res = await axios.post(`${API_URL}/tasks/merchant/${merchantId}/messages`, {
        merchant_id: Number(merchantId),
        sender_type: staff ? 'staff' : 'merchant',
        sender_name: staff ? staffName() : (merchantName || 'Merchant'),
        body
      })
      setMessages(prev => [...prev, {
        id: res.data.id,
        sender_type: staff ? 'staff' : 'merchant',
        sender_name: staff ? staffName() : (merchantName || 'Merchant'),
        body, is_read: false, created_at: res.data.created_at
      }])
    } catch { }
    setSendingMsg(false)
  }

  const resetOrders = async () => {
    if (!window.confirm("Reset all demo orders?")) return
    try {
      await axios.delete(`${API_URL}/orders/merchant/${merchantId}/reset`)
      setOrders([])
    } catch { alert("Reset failed") }
  }

  const logout = () => {
    ['merchant_token','merchant_id','merchant_name','staff_name'].forEach(k => localStorage.removeItem(k))
    window.location.href = '/merchant'
  }

  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString())
  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.merchant_payout, 0)
  const totalRevenue = orders.reduce((sum, o) => sum + o.merchant_payout, 0)
  const pendingOrders = orders.filter(o => o.status === 'paid').length
  const unreadMessages = messages.filter(m => !m.is_read && m.sender_type !== (staff ? 'merchant' : 'staff')).length

  const filteredTasks = tasks.filter(p => {
    if (taskFilter === 'live') return p.is_live
    if (taskFilter === 'incomplete') return !p.is_live
    return true
  })

  const statusColor = (status: string) => {
    if (status === 'paid') return { bg: '#fff3e0', color: '#e65100', label: 'New Order' }
    if (status === 'ready') return { bg: '#e3f2fd', color: '#1565c0', label: 'Ready' }
    if (status === 'fulfilled') return { bg: '#e8f5e9', color: '#2e7d32', label: 'Collected' }
    return { bg: 'var(--cream-dark)', color: 'var(--text-3)', label: status }
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return 'Today'
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: 'var(--green-dark)', padding: '14px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{merchantName}</div>
            {staff && <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>Staff: {staffName()}</div>}
          </div>
          <button onClick={logout} style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Logout</button>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{staff ? 'Staff Portal' : 'Merchant Dashboard'} · Hamari Dukaan</div>
      </div>

      {/* Stats bar */}
      <div style={{ background: 'var(--green)', padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, flexShrink: 0 }}>
        {[
          { val: `$${todayRevenue.toFixed(0)}`, label: "Today's payout" },
          { val: pendingOrders, label: "New orders" },
          { val: `$${totalRevenue.toFixed(0)}`, label: "Total payout" },
        ].map(({ val, label }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>{val}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }}>
        {(['orders', 'stats', 'tasks', 'messages'] as TabType[]).map(tab => {
          const labels: Record<TabType, string> = { orders: '📦 Orders', stats: '📊 Stats', tasks: '🗂️ Tasks', messages: '💬 Chat' }
          const badges: Record<TabType, number> = { orders: pendingOrders, stats: 0, tasks: taskSummary ? taskSummary.total - taskSummary.live : 0, messages: unreadMessages }
          if (!staff && tab === 'tasks') return null
          return (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '11px 4px', border: 'none', fontWeight: 700, fontSize: 12,
                cursor: 'pointer', background: 'transparent',
                color: activeTab === tab ? 'var(--green)' : 'var(--text-3)',
                borderBottom: activeTab === tab ? '3px solid var(--green)' : '3px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2
              }}>
              {labels[tab]}<Badge count={badges[tab]} color={tab === 'messages' ? '#276040' : '#e65100'} />
            </button>
          )
        })}
      </div>

      {/* TASKS TAB */}
      {activeTab === 'tasks' && staff && (
        isMobile ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid var(--border)' }}>
              {(['list', 'edit', 'preview'] as MobileEditorTab[]).map(t => (
                <button key={t} onClick={() => setMobileTab(t)}
                  style={{ flex: 1, padding: '10px', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', background: 'transparent', color: mobileTab === t ? 'var(--green)' : 'var(--text-3)', borderBottom: mobileTab === t ? '2px solid var(--green)' : '2px solid transparent' }}>
                  {t === 'list' ? '📋 List' : t === 'edit' ? '✏️ Edit' : '👁️ Preview'}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {mobileTab === 'list' && <TaskListPanel taskSummary={taskSummary} tasksLoading={tasksLoading} filteredTasks={filteredTasks} taskFilter={taskFilter} setTaskFilter={setTaskFilter} fetchTasks={fetchTasks} selectedProduct={selectedProduct} selectProduct={selectProduct} />}
              {mobileTab === 'edit' && <EditPanel selectedProduct={selectedProduct} editState={editState} setEditState={setEditState} saving={saving} uploadingImage={uploadingImage} saveProduct={saveProduct} uploadImage={uploadImage} saveNote={saveNote} savingNote={savingNote} editingNote={editingNote} setEditingNote={setEditingNote} noteText={noteText} setNoteText={setNoteText} isMobile={isMobile} setMobileTab={setMobileTab} />}
              {mobileTab === 'preview' && <ProductPreview product={selectedProduct} editState={editState} />}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr 280px', overflow: 'hidden', height: 'calc(100vh - 180px)' }}>
            <div style={{ borderRight: '1px solid var(--border)', overflowY: 'auto', background: 'var(--cream)' }}>
              <TaskListPanel taskSummary={taskSummary} tasksLoading={tasksLoading} filteredTasks={filteredTasks} taskFilter={taskFilter} setTaskFilter={setTaskFilter} fetchTasks={fetchTasks} selectedProduct={selectedProduct} selectProduct={selectProduct} />
            </div>
            <div style={{ borderRight: '1px solid var(--border)', overflowY: 'auto', background: 'white' }}>
              <EditPanel selectedProduct={selectedProduct} editState={editState} setEditState={setEditState} saving={saving} uploadingImage={uploadingImage} saveProduct={saveProduct} uploadImage={uploadImage} saveNote={saveNote} savingNote={savingNote} editingNote={editingNote} setEditingNote={setEditingNote} noteText={noteText} setNoteText={setNoteText} isMobile={isMobile} setMobileTab={setMobileTab} />
            </div>
            <div style={{ overflowY: 'auto', background: 'var(--cream)' }}>
              <ProductPreview product={selectedProduct} editState={editState} />
            </div>
          </div>
        )
      )}

      {/* OTHER TABS */}
      {activeTab !== 'tasks' && (
        <div style={{ padding: '16px', paddingBottom: 80, overflowY: 'auto', flex: 1 }}>

          {/* ORDERS */}
          {activeTab === 'orders' && (
            <div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)' }}><div style={{ fontSize: 32 }}>⏳</div><div>Loading...</div></div>
              ) : orders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>No orders yet</div>
                  <div style={{ fontSize: 13 }}>Orders appear here as buyers purchase from your store</div>
                </div>
              ) : orders.map(order => {
                const s = statusColor(order.status)
                return (
                  <div key={order.id} style={{ background: 'white', borderRadius: 16, padding: '14px', marginBottom: 12, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green-dark)' }}>#{order.id} · {order.buyer_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{order.buyer_email} · {timeAgo(order.created_at)}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, background: s.bg, color: s.color, padding: '3px 8px', borderRadius: 6 }}>{s.label}</span>
                    </div>
                    <div style={{ background: 'var(--cream-dark)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Order total</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>${order.total?.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Commission</span>
                        <span style={{ fontSize: 12, color: 'var(--red)' }}>-${order.commission?.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>Your payout</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#2e7d32' }}>${order.merchant_payout?.toFixed(2)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {order.status === 'paid' && <button onClick={() => updateStatus(order.id, 'ready')} disabled={updatingId === order.id} style={{ flex: 1, padding: '10px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{updatingId === order.id ? '⏳' : '✓ Mark Ready'}</button>}
                      {order.status === 'ready' && <button onClick={() => updateStatus(order.id, 'fulfilled')} disabled={updatingId === order.id} style={{ flex: 1, padding: '10px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{updatingId === order.id ? '⏳' : '✓ Mark Collected'}</button>}
                      {order.buyer_phone && <a href={`tel:${order.buyer_phone}`} style={{ padding: '10px 14px', background: 'var(--cream-dark)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--green-dark)', fontWeight: 600, textDecoration: 'none' }}>📞</a>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* STATS */}
          {activeTab === 'stats' && (
            <div>
              <div style={{ background: 'white', borderRadius: 16, padding: '16px', marginBottom: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 12, textTransform: 'uppercase' }}>Revenue Summary</div>
                {[
                  { label: "Today's orders", value: String(todayOrders.length) },
                  { label: "Today's payout", value: `$${todayRevenue.toFixed(2)}`, color: '#2e7d32' },
                  { label: "Total orders", value: String(orders.length) },
                  { label: "Total payout", value: `$${totalRevenue.toFixed(2)}`, color: '#2e7d32' },
                  { label: "Commission paid", value: `$${orders.reduce((sum, o) => sum + (o.commission || 0), 0).toFixed(2)}`, color: 'var(--red)' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: color || 'inherit' }}>{value}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: 'white', borderRadius: 16, padding: '16px', marginBottom: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 12, textTransform: 'uppercase' }}>Quick Actions</div>
                {staff && <button onClick={resetOrders} style={{ width: "100%", padding: "12px", background: "#fce4ec", border: "1px solid #ef9a9a", borderRadius: 10, fontWeight: 700, fontSize: 13, color: "#c62828", cursor: "pointer", marginBottom: 10, textAlign: "left" }}>🔄 Reset Demo Orders</button>}
                <button onClick={() => window.location.href = "/settings"} style={{ width: "100%", padding: "12px", background: "var(--cream-dark)", border: "1px solid var(--border)", borderRadius: 10, fontWeight: 700, fontSize: 13, color: "var(--green-dark)", cursor: "pointer", marginBottom: 10, textAlign: "left" }}>⚙️ Store Settings & ABN</button>
                {staff && <button onClick={() => window.location.href = "/import"} style={{ width: '100%', padding: '12px', background: 'var(--cream-dark)', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 700, fontSize: 13, color: 'var(--green-dark)', cursor: 'pointer', marginBottom: 10, textAlign: 'left' }}>📦 Import Products</button>}
                <button onClick={() => window.location.href = '/'} style={{ width: '100%', padding: '12px', background: 'var(--cream-dark)', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 700, fontSize: 13, color: 'var(--green-dark)', cursor: 'pointer', textAlign: 'left' }}>🛍️ View Store</button>
              </div>
              {profile?.bank_account && (
                <div style={{ background: 'white', borderRadius: 16, padding: '16px', marginBottom: 12, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 12, textTransform: 'uppercase' }}>Payout Details</div>
                  {[
                    { label: 'Account name', value: profile.bank_account_name },
                    { label: 'BSB', value: profile.bank_bsb },
                    { label: 'Account number', value: profile.bank_account },
                    { label: 'Payout method', value: profile.payment_preference === 'direct' ? '🏦 Direct Stripe' : '📋 Weekly transfer' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{value || '-'}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ background: 'var(--green-dark)', borderRadius: 16, padding: '16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 8 }}>Commission Tier</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                  Current: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>10%</span> (up to $4,000/month){'\n'}Above $4,000: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>8%</span>
                </div>
              </div>
            </div>
          )}

          {/* MESSAGES */}
          {activeTab === 'messages' && (
            <div>
              <div style={{ background: 'white', borderRadius: 12, padding: '10px 14px', marginBottom: 12, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 28 }}>💬</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-dark)' }}>{staff ? `Chat with ${merchantName}` : 'Chat with Hamari Dukaan team'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{staff ? 'Request photos, confirm prices, get approvals' : 'Ask questions, send photos, get updates'}</div>
                </div>
              </div>
              <div style={{ background: 'white', borderRadius: 16, padding: '14px', border: '1px solid var(--border)', minHeight: 300, marginBottom: 80 }}>
                {msgsLoading ? <div style={{ textAlign: 'center', padding: '40px' }}>⏳ Loading...</div>
                  : messages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)' }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>👋</div>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>No messages yet</div>
                      <div style={{ fontSize: 12 }}>{staff ? 'Start by messaging the merchant' : 'Our team will message you soon'}</div>
                    </div>
                  ) : (
                    <div>
                      {messages.map((msg, idx) => {
                        const isMe = staff ? msg.sender_type === 'staff' : msg.sender_type === 'merchant'
                        const prevMsg = messages[idx - 1]
                        const showDate = !prevMsg || new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString()
                        return (
                          <div key={msg.id}>
                            {showDate && <div style={{ textAlign: 'center', margin: '10px 0', fontSize: 11, color: 'var(--text-3)' }}>— {formatDate(msg.created_at)} —</div>}
                            <div style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 99, flexShrink: 0, background: msg.sender_type === 'staff' ? 'var(--green)' : 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'white', fontWeight: 700 }}>
                                {msg.sender_name.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ maxWidth: '75%' }}>
                                {!isMe && <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 3, fontWeight: 600 }}>{msg.sender_name}</div>}
                                <div style={{ padding: '9px 13px', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: isMe ? 'var(--green)' : '#f0f0f0', color: isMe ? 'white' : 'var(--text-1)', fontSize: 13, lineHeight: 1.5 }}>{msg.body}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3, textAlign: isMe ? 'right' : 'left' }}>{formatTime(msg.created_at)}</div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
              </div>
              <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', borderTop: '1px solid var(--border)', padding: '10px 16px', display: 'flex', gap: 8 }}>
                <input value={msgText} onChange={e => setMsgText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={staff ? `Message ${merchantName}...` : 'Message the Hamari Dukaan team...'}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 24, border: '1px solid var(--border)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={sendMessage} disabled={sendingMsg || !msgText.trim()}
                  style={{ width: 42, height: 42, borderRadius: 99, background: msgText.trim() ? 'var(--green)' : '#e0e0e0', border: 'none', cursor: msgText.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {sendingMsg ? '⏳' : '➤'}
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

