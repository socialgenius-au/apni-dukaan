import { useState, useEffect } from 'react'
import './index.css'
import { getMerchants, getMerchantProducts, getHappyHours } from './api'
import Checkout from './Checkout'

const blogs = [
  { id: 1, cat: 'Recipe', title: 'How to make authentic biryani at home', emoji: '🍚', bg: '#e8f5e9' },
  { id: 2, cat: 'Guide', title: 'Best halal butchers in Western Sydney', emoji: '🥩', bg: '#fff3e0' },
  { id: 3, cat: 'Tips', title: 'Pakistani spices guide — what to buy first', emoji: '🌶️', bg: '#fce4ec' },
  { id: 4, cat: 'Seasonal', title: 'Ramadan grocery checklist Sydney 2026', emoji: '🌙', bg: '#e3f2fd' },
]
const reels = [
  { id: 1, title: 'Perfect Karahi in 30 mins', chef: 'Chef Rashid', views: '12K', emoji: '👨‍🍳' },
  { id: 2, title: 'Authentic Daal Makhani', chef: 'Fatima Cooks', views: '8.4K', emoji: '👩‍🍳' },
  { id: 3, title: 'Ramadan Special Kheer', chef: "Ammi's Kitchen", views: '21K', emoji: '🍚' },
]
const categories = ['All', 'Halal Butcher', 'Spice Shop', 'Grocery', 'Bakery']

function formatTime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const IconHome = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
const IconClock = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
const IconTag = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
const IconPlay = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
const IconBook = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>
const IconCart = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" /></svg>

type CartItem = { id: number; name: string; price: number; emoji: string; qty: number }
type Merchant = { id: number; name: string; suburb: string; category: string; emoji: string; description?: string; phone?: string; stripe_connected: boolean }
type Product = { id: number; merchant_id: number; name: string; price: number; emoji: string; category?: string; stock_qty: number; image_url?: string | null; description?: string | null }
type HappyHour = { id: number; merchant_id: number; title: string; description?: string; discount_percent: number; max_orders: number; orders_taken: number; start_time: string; end_time: string }

export default function App() {
  const [tab, setTab] = useState('discover')
  const [cat, setCat] = useState('All')
  const [search, setSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [toastShow, setToastShow] = useState(false)
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null)
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [merchantProducts, setMerchantProducts] = useState<Product[]>([])
  const [happyHours, setHappyHours] = useState<HappyHour[]>([])
  const [loading, setLoading] = useState(true)
  const [timers, setTimers] = useState<{ [key: number]: number }>({})
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const urlParams = new URLSearchParams(window.location.search)
  const urlPromo = urlParams.get("promo") || ""
  const urlRef = urlParams.get("ref") || ""
  const [promoCode] = useState(urlPromo)
  const [refCode] = useState(urlRef)

  useEffect(() => {
    setLoading(true)
    getMerchants(cat !== 'All' ? cat : undefined, search || undefined)
      .then(data => { setMerchants(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [cat, search])

  useEffect(() => {
    if (tab === 'happyhour') {
      getHappyHours().then(data => {
        setHappyHours(data)
        const t: { [key: number]: number } = {}
        data.forEach((h: HappyHour) => {
          t[h.id] = Math.max(0, Math.floor((new Date(h.end_time).getTime() - Date.now()) / 1000))
        })
        setTimers(t)
      })
    }
  }, [tab])

  useEffect(() => {
    if (selectedMerchant) {
      getMerchantProducts(selectedMerchant.id).then(setMerchantProducts)
    }
  }, [selectedMerchant])

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(t => {
        const updated = { ...t }
        Object.keys(updated).forEach(k => { if (updated[+k] > 0) updated[+k]-- })
        return updated
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const showToast = (msg: string) => {
    setToast(msg); setToastShow(true)
    setTimeout(() => setToastShow(false), 2800)
  }

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      if (existing) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { id: product.id, name: product.name, price: product.price, emoji: product.emoji, qty: 1 }]
    })
    showToast(`${product.name} added to cart`)
  }

  const updateQty = (id: number, qty: number) => {
    if (qty < 1) setCart(prev => prev.filter(i => i.id !== id))
    else setCart(prev => prev.map(i => i.id === id ? { ...i, qty } : i))
  }

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0)
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0)

  // ── MERCHANT PRODUCTS VIEW ──────────────────────────────
  if (selectedMerchant) {
    const grouped: Record<string, Product[]> = {}
    merchantProducts.forEach(p => {
      const cat = (p.category && p.category.trim()) || 'Other'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(p)
    })
    const baseSortedCategories = Object.keys(grouped).sort((a, b) => {
      if (a === 'Other') return 1
      if (b === 'Other') return -1
      return a.localeCompare(b)
    })
    const filteredGrouped: Record<string, Product[]> = {}
    const categoryHasNameMatch: Record<string, boolean> = {}
    baseSortedCategories.forEach(c => {
      let list = grouped[c]
      let hasNameMatch = true
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase()
        const nameMatches = grouped[c].filter(p => p.name.toLowerCase().includes(q))
        const descOnlyMatches = grouped[c].filter(p =>
          !p.name.toLowerCase().includes(q) &&
          (p.description || '').toLowerCase().includes(q)
        )
        list = [...nameMatches, ...descOnlyMatches]
        hasNameMatch = nameMatches.length > 0
      }
      if (list.length > 0) {
        filteredGrouped[c] = list
        categoryHasNameMatch[c] = hasNameMatch
      }
    })
    const sortedCategories = Object.keys(filteredGrouped).sort((a, b) => {
      const aHas = categoryHasNameMatch[a] ? 0 : 1
      const bHas = categoryHasNameMatch[b] ? 0 : 1
      if (aHas !== bHas) return aHas - bHas
      if (a === 'Other') return 1
      if (b === 'Other') return -1
      return a.localeCompare(b)
    })
    const visibleCategories = sortedCategories
    const totalVisible = visibleCategories.reduce((sum, c) => sum + filteredGrouped[c].length, 0)

    return (
      <div>
        <div className="top-bar" style={{ gap: 12 }}>
          <button onClick={() => { setSelectedMerchant(null); setMerchantProducts([]); setProductSearch('') }} style={{ background: 'none', color: 'white', fontSize: 22, padding: '0 4px', border: 'none', cursor: 'pointer' }}>←</button>
          <div className="top-bar-logo" style={{ fontSize: 15 }}>{selectedMerchant.name}</div>
          <button style={{ background: 'none', color: 'white', position: 'relative', flexShrink: 0, marginLeft: 'auto', border: 'none', cursor: 'pointer' }} onClick={() => setCartOpen(true)}>
            <IconCart />
            {cartCount > 0 && <span className="nav-badge">{cartCount}</span>}
          </button>
        </div>
        <div className="page">
          <div style={{ background: 'var(--green-dark)', padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>{selectedMerchant.emoji}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 4 }}>{selectedMerchant.name}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>📍 {selectedMerchant.suburb} · {selectedMerchant.category}</div>
            {selectedMerchant.phone && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>📞 {selectedMerchant.phone}</div>}
          </div>

          <div style={{ padding: '12px 16px', background: 'var(--cream)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
              <span style={{ fontSize: 16, color: 'var(--text-3)' }}>🔍</span>
              <input
                type="text"
                placeholder={`Search ${selectedMerchant.name} products...`}
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent', color: 'var(--green-dark)' }}
              />
              {productSearch && (
                <button onClick={() => setProductSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-3)', padding: 0 }}>✕</button>
              )}
            </div>
            {productSearch && (
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6, paddingLeft: 4 }}>
                {totalVisible === 0 ? 'No products found' : `${totalVisible} product${totalVisible !== 1 ? 's' : ''} found`}
              </div>
            )}
          </div>

          {merchantProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-3)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
              <div>No products yet</div>
            </div>
          ) : visibleCategories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-3)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>No products match "{productSearch}"</div>
              <button onClick={() => setProductSearch('')} style={{ marginTop: 12, background: 'var(--green)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Clear search</button>
            </div>
          ) : (
            visibleCategories.map((c, idx) => (
              <div key={c}>
                {idx > 0 && <div style={{ height: 8, background: 'var(--cream-dark)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} />}
                <div style={{ padding: '14px 16px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '2px solid var(--green)', marginBottom: 12 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--green-dark)' }}>{c}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>{filteredGrouped[c].length} item{filteredGrouped[c].length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="product-grid" style={{ padding: '0 16px 16px' }}>
                  {filteredGrouped[c].map(p => (
                    <div key={p.id} className="product-card">
                      <div className="product-img">{p.image_url ? <img src={p.image_url} alt={p.name} onClick={() => setLightboxUrl(p.image_url || null)} style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"8px",cursor:'zoom-in'}} /> : <div style={{fontSize:40}}>{p.emoji || "📦"}</div>}</div>
                      <div className="product-info">
                        <div className="product-name">{p.name}</div>
                        <div className="product-price">${p.price.toFixed(2)}</div>
                        <button className="btn-add" onClick={() => addToCart(p)}>+ Add</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        <div className={`overlay ${cartOpen ? 'show' : ''}`} onClick={() => setCartOpen(false)} />
        <div className={`bottom-sheet ${cartOpen ? 'show' : ''}`}>
          <div className="sheet-handle" />
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: 'var(--green-dark)' }}>Your Cart</div>
          {cart.length === 0 ? <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0' }}>Cart is empty</div> : (
            <>
              {cart.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <span style={{ fontSize: 28 }}>{item.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-dark)' }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--red)' }}>${(item.price * item.qty).toFixed(2)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => updateQty(item.id, item.qty - 1)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--cream-dark)', fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer' }}>-</button>
                    <span style={{ fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{item.qty}</span>
                    <button onClick={() => updateQty(item.id, item.qty + 1)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--green)', color: 'white', fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer' }}>+</button>
                  </div>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
                  <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--red)' }}>${cartTotal.toFixed(2)}</span>
                </div>
                <button className="btn-primary" onClick={() => setCheckoutOpen(true)}>Proceed to Checkout</button>
              </div>
            </>
          )}
        </div>
        {checkoutOpen && selectedMerchant && (
          <>
            <div className="overlay show" onClick={() => setCheckoutOpen(false)} />
            <div className="bottom-sheet show">
              <Checkout cart={cart} merchantId={selectedMerchant.id} onClose={() => setCheckoutOpen(false)} promoCode={promoCode} refCode={refCode} />
            </div>
          </>
        )}
        <div className={`toast ${toastShow ? 'show' : ''}`}>{toast}</div>
        {lightboxUrl && (
          <div onClick={() => setLightboxUrl(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
            <img src={lightboxUrl} alt="Product" style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()} />
            <button onClick={() => setLightboxUrl(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: '50%', width: 40, height: 40, fontSize: 20, cursor: 'pointer', fontWeight: 700 }}>✕</button>
          </div>
        )}
      </div>
    )
  }

  // ── MAIN APP ────────────────────────────────────────────
  return (
    <div>
      <div className="desktop-nav">
        <button className={`desktop-nav-item ${tab==='discover'?'active':''}`} onClick={() => setTab('discover')}>Discover</button>
        <button className={`desktop-nav-item ${tab==='happyhour'?'active':''}`} onClick={() => setTab('happyhour')}>Happy Hour</button>
        <button className={`desktop-nav-item ${tab==='offers'?'active':''}`} onClick={() => setTab('offers')}>Best Offers</button>
        <button className={`desktop-nav-item ${tab==='reels'?'active':''}`} onClick={() => setTab('reels')}>Chef Reels</button>
        <button className={`desktop-nav-item ${tab==='blog'?'active':''}`} onClick={() => setTab('blog')}>Recipes</button>
        <button className="desktop-nav-item" onClick={() => window.location.href='/merchant'}>Merchant Portal</button>
      </div>
      <div className="top-bar">
        <div className="top-bar-logo">Hamari Dukaan <span>ہماری دکان </span></div>
        <input className="search-bar" placeholder="Search products, merchants..." value={search} onChange={e => setSearch(e.target.value)} />
        <button style={{ background: 'none', color: 'white', position: 'relative', flexShrink: 0, border: 'none', cursor: 'pointer' }} onClick={() => setCartOpen(true)}>
          <IconCart />
          {cartCount > 0 && <span className="nav-badge">{cartCount}</span>}
        </button>
      </div>
      <div className="page">
        {tab === 'discover' && (
          <div>
            <div className="hero">
              <div className="hero-label">Community Marketplace</div>
              <div className="hero-title">Halal · Fresh · Local</div>
              <div className="hero-sub">Auburn · Pendle Hill · Lakemba · Merrylands</div>
            </div>
            {urlPromo && (
              <div style={{ background: "linear-gradient(135deg, #276040, #1a4a30)", margin: "0 0 0", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 28 }}>🎉</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--gold)" }}>Limited Offer — 10% off your first order!</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>Code {urlPromo} applied automatically at checkout</div>
                </div>
              </div>
            )}
            <div className="cat-tabs">
              {categories.map(c => (
                <button key={c} className={`cat-tab ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>
            <div className="section-header">
              <span className="section-title">{loading ? 'Loading...' : `Merchants (${merchants.length})`}</span>
            </div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-3)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
                <div>Loading merchants...</div>
              </div>
            ) : merchants.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-3)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🏪</div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>No merchants yet</div>
                <div style={{ fontSize: 13 }}>Be the first to join Hamari Dukaan</div>
                <button onClick={() => window.location.href = '/merchant'}
                  style={{ marginTop: 16, background: 'var(--green)', color: 'white', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Register Your Store →
                </button>
              </div>
            ) : (
              <div className="merchant-grid">
                {merchants.map(m => (
                  <div key={m.id} className="merchant-card" onClick={() => setSelectedMerchant(m)}>
                    <div className="merchant-emoji">{m.emoji}</div>
                    <div className="merchant-info">
                      <div className="merchant-name">{m.name}</div>
                      <div className="merchant-suburb">📍 {m.suburb}</div>
                      <span className="merchant-badge">{m.category}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {tab === 'happyhour' && (
          <div>
            <div className="hero">
              <div className="hero-label">⚡ Live Now</div>
              <div className="hero-title">Happy Hour Deals</div>
              <div className="hero-sub">Limited time · Limited orders</div>
            </div>
            {happyHours.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-3)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⏰</div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>No active deals right now</div>
                <div style={{ fontSize: 13 }}>Check back soon</div>
              </div>
            ) : happyHours.map(h => {
              const merchant = merchants.find(m => m.id === h.merchant_id)
              return (
                <div key={h.id} className="hh-card">
                  <div className="hh-header">
                    <span style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>⚡ {merchant?.name || `Merchant #${h.merchant_id}`}</span>
                    <span className="hh-timer">⏱ {formatTime(timers[h.id] || 0)}</span>
                  </div>
                  <div className="hh-body">
                    <div className="hh-title">{h.title}</div>
                    <div className="hh-desc">{h.description}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--red)' }}>{h.discount_percent}% OFF</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{h.orders_taken}/{h.max_orders} taken</div>
                      <button className="btn-gold" style={{ padding: '8px 16px', fontSize: 12 }} onClick={() => showToast('Added to cart!')}>Grab Deal</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {tab === 'offers' && (
          <div>
            <div className="hero">
              <div className="hero-label">🏷️ Best Prices</div>
              <div className="hero-title">Flash Offers</div>
              <div className="hero-sub">Handpicked deals from top merchants</div>
            </div>
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-3)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏷️</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Offers coming soon</div>
              <div style={{ fontSize: 13 }}>Merchants will post flash offers here</div>
            </div>
          </div>
        )}
        {tab === 'reels' && (
          <div>
            <div className="hero">
              <div className="hero-label">🎬 Chef Reels</div>
              <div className="hero-title">Cook Like a Pro</div>
              <div className="hero-sub">Recipes from your community</div>
            </div>
            <div style={{ padding: '0 16px' }}>
              {reels.map(r => (
                <div key={r.id} className="card" style={{ marginBottom: 12, cursor: 'pointer' }} onClick={() => showToast('Opening reel...')}>
                  <div style={{ height: 160, background: 'var(--green-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <span style={{ fontSize: 64 }}>{r.emoji}</span>
                    <div style={{ position: 'absolute', width: 48, height: 48, background: 'rgba(255,255,255,0.9)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconPlay />
                    </div>
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', marginBottom: 3 }}>{r.chef}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 6 }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>👁 {r.views} views</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === 'blog' && (
          <div>
            <div className="hero">
              <div className="hero-label">📖 Recipes & Guides</div>
              <div className="hero-title">Community Kitchen</div>
              <div className="hero-sub">Tips, recipes and halal food guides</div>
            </div>
            <div className="section-header"><span className="section-title">Latest Articles</span></div>
            <div className="blog-grid">
              {blogs.map(b => (
                <div key={b.id} className="blog-card" onClick={() => showToast(`Opening: ${b.title}`)}>
                  <div className="blog-img" style={{ background: b.bg }}>{b.emoji}</div>
                  <div className="blog-info">
                    <div className="blog-cat">{b.cat}</div>
                    <div className="blog-title">{b.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <nav className="bottom-nav">
        <button className={`nav-item ${tab === 'discover' ? 'active' : ''}`} onClick={() => setTab('discover')}><IconHome /><span>Discover</span></button>
        <button className={`nav-item ${tab === 'happyhour' ? 'active' : ''}`} onClick={() => setTab('happyhour')}><IconClock /><span>Happy Hour</span></button>
        <button className={`nav-item ${tab === 'offers' ? 'active' : ''}`} onClick={() => setTab('offers')}><IconTag /><span>Offers</span></button>
        <button className={`nav-item ${tab === 'reels' ? 'active' : ''}`} onClick={() => setTab('reels')}><IconPlay /><span>Reels</span></button>
        <button className={`nav-item ${tab === 'blog' ? 'active' : ''}`} onClick={() => setTab('blog')}><IconBook /><span>Recipes</span></button>
      </nav>
      <div className={`overlay ${cartOpen ? 'show' : ''}`} onClick={() => setCartOpen(false)} />
      <div className={`bottom-sheet ${cartOpen ? 'show' : ''}`}>
        <div className="sheet-handle" />
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: 'var(--green-dark)' }}>Your Cart {cartCount > 0 && `(${cartCount})`}</div>
        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '30px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
            <div>Your cart is empty</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Browse merchants and add items</div>
          </div>
        ) : (
          <>
            {cart.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <span style={{ fontSize: 28 }}>{item.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-dark)' }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--red)' }}>${(item.price * item.qty).toFixed(2)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => updateQty(item.id, item.qty - 1)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--cream-dark)', fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer' }}>-</button>
                  <span style={{ fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{item.qty}</span>
                  <button onClick={() => updateQty(item.id, item.qty + 1)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--green)', color: 'white', fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer' }}>+</button>
                </div>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
                <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--red)' }}>${cartTotal.toFixed(2)}</span>
              </div>
              <button className="btn-primary" onClick={() => setCheckoutOpen(true)}>Proceed to Checkout</button>
            </div>
          </>
        )}
      </div>
      {checkoutOpen && selectedMerchant !== null && (
        <>
          <div className="overlay show" onClick={() => setCheckoutOpen(false)} />
          <div className="bottom-sheet show">
            <Checkout cart={cart} merchantId={(selectedMerchant as any).id} onClose={() => setCheckoutOpen(false)} promoCode={promoCode} refCode={refCode} />
          </div>
        </>
      )}
      <div className={`toast ${toastShow ? 'show' : ''}`}>{toast}</div>
    </div>
  )
}
