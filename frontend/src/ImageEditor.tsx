import { useState, useRef, useEffect } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
type Product = { id: number; name: string; image_url: string | null; price: number }

export default function ImageEditor() {
  const [password, setPassword] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [error, setError] = useState('')
  const [merchants, setMerchants] = useState<any[]>([])
  const [selectedMerchant, setSelectedMerchant] = useState<any>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [rotation, setRotation] = useState(0)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<number | null>(null)
  const [msg, setMsg] = useState('')
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 100, h: 100 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [cropCorner, setCropCorner] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const login = async () => {
    setError('')
    try {
      const res = await axios.get(`${API_URL}/admin/dashboard`, { headers: { 'x-admin-password': password } })
      setMerchants(res.data.merchants)
      setLoggedIn(true)
    } catch { setError('Invalid password') }
  }

  const loadProducts = async (merchant: any) => {
    setSelectedMerchant(merchant)
    setLoading(true)
    setEditingProduct(null)
    try {
      const res = await axios.get(`${API_URL}/products/merchant/${merchant.id}`)
      setProducts(res.data.filter((p: Product) => p.image_url))
    } catch {}
    setLoading(false)
  }

  const openEditor = (product: Product) => {
    setEditingProduct(product)
    setRotation(0)
    setCrop({ x: 0, y: 0, w: 100, h: 100 })
  }

  const rotate = (deg: number) => setRotation(r => (r + deg + 360) % 360)

  const getPos = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100
    }
  }

  const getCorner = (px: number, py: number) => {
    const tol = 5
    if (Math.abs(px - crop.x) < tol && Math.abs(py - crop.y) < tol) return 'tl'
    if (Math.abs(px - (crop.x + crop.w)) < tol && Math.abs(py - crop.y) < tol) return 'tr'
    if (Math.abs(px - crop.x) < tol && Math.abs(py - (crop.y + crop.h)) < tol) return 'bl'
    if (Math.abs(px - (crop.x + crop.w)) < tol && Math.abs(py - (crop.y + crop.h)) < tol) return 'br'
    return null
  }

  const isInsideCrop = (px: number, py: number) =>
    px >= crop.x && px <= crop.x + crop.w && py >= crop.y && py <= crop.y + crop.h

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const { x, y } = getPos(e)
    const corner = getCorner(x, y)
    if (corner) { setCropCorner(corner); setIsDragging(true); setDragStart({ x, y }); return }
    if (isInsideCrop(x, y)) { setCropCorner(null); setIsDragging(true); setDragStart({ x, y }) }
  }

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return
    const { x, y } = getPos(e)
    const dx = x - dragStart.x
    const dy = y - dragStart.y
    setDragStart({ x, y })
    if (cropCorner) {
      setCrop(prev => {
        let { x: cx, y: cy, w: cw, h: ch } = prev
        if (cropCorner === 'tl') { cx += dx; cy += dy; cw -= dx; ch -= dy }
        if (cropCorner === 'tr') { cw += dx; cy += dy; ch -= dy }
        if (cropCorner === 'bl') { cx += dx; cw -= dx; ch += dy }
        if (cropCorner === 'br') { cw += dx; ch += dy }
        return { x: Math.max(0, Math.min(cx, 95)), y: Math.max(0, Math.min(cy, 95)), w: Math.max(10, Math.min(cw, 100 - cx)), h: Math.max(10, Math.min(ch, 100 - cy)) }
      })
    } else {
      setCrop(prev => ({ ...prev, x: Math.max(0, Math.min(prev.x + dx, 100 - prev.w)), y: Math.max(0, Math.min(prev.y + dy, 100 - prev.h)) }))
    }
  }

  const onMouseUp = () => { setIsDragging(false); setCropCorner(null) }

  const saveImage = async () => {
    if (!editingProduct?.image_url) return
    setSaving(true); setMsg('')
    try {
      // Download image via fetch with no-cors workaround using backend proxy
      const proxyUrl = `${API_URL}/proxy-image?url=${encodeURIComponent(editingProduct.image_url)}`
      const imgRes = await fetch(proxyUrl)
      const imgBlob = await imgRes.blob()
      const imgBitmap = await createImageBitmap(imgBlob)

      const SIZE = 800
      const offscreen = document.createElement('canvas')
      offscreen.width = SIZE; offscreen.height = SIZE
      const ctx = offscreen.getContext('2d')!

      // Draw rotated image
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, SIZE, SIZE)
      ctx.save()
      ctx.translate(SIZE / 2, SIZE / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      const isRotated90 = rotation === 90 || rotation === 270
      const srcW = isRotated90 ? imgBitmap.height : imgBitmap.width
      const srcH = isRotated90 ? imgBitmap.width : imgBitmap.height
      const scale = Math.min(SIZE / srcW, SIZE / srcH) * 0.92
      ctx.drawImage(imgBitmap, -(imgBitmap.width * scale) / 2, -(imgBitmap.height * scale) / 2, imgBitmap.width * scale, imgBitmap.height * scale)
      ctx.restore()

      // Apply crop
      const cropX = Math.round((crop.x / 100) * SIZE)
      const cropY = Math.round((crop.y / 100) * SIZE)
      const cropW = Math.round((crop.w / 100) * SIZE)
      const cropH = Math.round((crop.h / 100) * SIZE)
      const cropped = document.createElement('canvas')
      cropped.width = cropW; cropped.height = cropH
      cropped.getContext('2d')!.drawImage(offscreen, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

      cropped.toBlob(async (blob) => {
        if (!blob) { setSaving(false); return }
        const form = new FormData()
        form.append('file', blob, 'image.jpg')
        const res = await axios.post(`${API_URL}/upload/product-image/${editingProduct.id}`, form)
        const newUrl = res.data.image_url
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, image_url: newUrl } : p))
        setEditingProduct(prev => prev ? { ...prev, image_url: newUrl + '?t=' + Date.now() } : prev)
        setSavedId(editingProduct.id)
        setMsg('✅ Saved!')
        setTimeout(() => { setSavedId(null); setMsg('') }, 3000)
        setSaving(false)
      }, 'image/jpeg', 0.9)
    } catch (e) {
      console.error(e)
      setMsg('❌ Save failed')
      setSaving(false)
    }
  }

  if (!loggedIn) {
    return (
      <div style={{ minHeight: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 32, width: 320, border: '1px solid #333' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#c9a84c', marginBottom: 4 }}>Hamari Dukaan</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>Image Editor</div>
          <input type="password" placeholder="Admin password" value={password}
            onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()}
            style={{ width: '100%', padding: '10px 14px', background: '#2a2a2a', border: '1px solid #444', borderRadius: 8, color: 'white', fontSize: 14, marginBottom: 12, boxSizing: 'border-box' as const }} />
          {error && <div style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button onClick={login} style={{ width: '100%', padding: 12, background: '#276040', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Login →</button>
        </div>
      </div>
    )
  }

  const cx = crop.x; const cy = crop.y; const cw = crop.w; const ch = crop.h

  return (
    <div style={{ minHeight: '100vh', background: '#111', color: 'white' }}>
      <div style={{ background: '#1a1a1a', borderBottom: '1px solid #222', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#c9a84c' }}>📷 Image Editor</div>
        {merchants.map(m => (
          <button key={m.id} onClick={() => loadProducts(m)}
            style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${selectedMerchant?.id === m.id ? '#c9a84c' : '#333'}`, background: selectedMerchant?.id === m.id ? '#c9a84c22' : 'transparent', color: selectedMerchant?.id === m.id ? '#c9a84c' : '#777', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {m.emoji} {m.name}
          </button>
        ))}
        {msg && <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: msg.includes('✅') ? '#4caf50' : '#ff6b6b' }}>{msg}</div>}
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 53px)' }}>
        {/* Thumbnail grid */}
        <div style={{ width: 300, borderRight: '1px solid #1e1e1e', overflowY: 'auto', padding: 10 }}>
          {loading ? <div style={{ color: '#444', padding: 40, textAlign: 'center' }}>Loading...</div>
            : products.length === 0 ? <div style={{ color: '#333', padding: 40, textAlign: 'center' }}>Select a merchant</div>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {products.map(p => (
                  <div key={p.id} onClick={() => openEditor(p)}
                    style={{ borderRadius: 6, overflow: 'hidden', border: `2px solid ${editingProduct?.id === p.id ? '#c9a84c' : savedId === p.id ? '#4caf50' : '#1e1e1e'}`, cursor: 'pointer', background: '#1a1a1a', position: 'relative' }}>
                    <img src={p.image_url!} alt={p.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                    {savedId === p.id && <div style={{ position: 'absolute', top: 2, right: 2, background: '#4caf50', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700 }}>✓</div>}
                    <div style={{ padding: '3px 5px', fontSize: 8, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 14 }}>
          {!editingProduct ? (
            <div style={{ textAlign: 'center', color: '#333' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
              <div>Click any thumbnail to edit</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#c9a84c' }}>{editingProduct.name}</div>

              {/* Image with CSS rotate + crop overlay */}
              <div ref={containerRef}
                style={{ position: 'relative', width: 480, height: 480, background: '#1a1a1a', borderRadius: 10, overflow: 'hidden', border: '1px solid #2a2a2a', cursor: isDragging ? 'grabbing' : 'crosshair', userSelect: 'none' }}
                onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>

                {/* Rotated image */}
                <img src={editingProduct.image_url!} alt={editingProduct.name}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', transform: `rotate(${rotation}deg)`, transformOrigin: 'center', transition: 'transform 0.2s', pointerEvents: 'none' }} />

                {/* Dark overlays for crop */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${cy}%`, background: 'rgba(0,0,0,0.6)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${100 - cy - ch}%`, background: 'rgba(0,0,0,0.6)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: `${cy}%`, left: 0, width: `${cx}%`, height: `${ch}%`, background: 'rgba(0,0,0,0.6)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: `${cy}%`, right: 0, width: `${100 - cx - cw}%`, height: `${ch}%`, background: 'rgba(0,0,0,0.6)', pointerEvents: 'none' }} />

                {/* Crop border */}
                <div style={{ position: 'absolute', left: `${cx}%`, top: `${cy}%`, width: `${cw}%`, height: `${ch}%`, border: '2px solid #c9a84c', pointerEvents: 'none' }}>
                  {/* Rule of thirds */}
                  {[33, 66].map(p => (
                    <div key={p}>
                      <div style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.15)' }} />
                      <div style={{ position: 'absolute', top: `${p}%`, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.15)' }} />
                    </div>
                  ))}
                </div>

                {/* Corner handles */}
                {[[cx, cy, 'tl'], [cx + cw, cy, 'tr'], [cx, cy + ch, 'bl'], [cx + cw, cy + ch, 'br']].map(([hx, hy, c]) => (
                  <div key={c as string} style={{ position: 'absolute', left: `calc(${hx}% - 6px)`, top: `calc(${hy}% - 6px)`, width: 12, height: 12, background: '#c9a84c', borderRadius: 2, cursor: 'pointer' }} />
                ))}
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={() => rotate(-90)} style={{ padding: '9px 18px', background: '#1e1e1e', border: '1px solid #333', borderRadius: 8, color: 'white', fontSize: 20, cursor: 'pointer' }}>↺</button>
                <button onClick={() => rotate(90)} style={{ padding: '9px 18px', background: '#1e1e1e', border: '1px solid #333', borderRadius: 8, color: 'white', fontSize: 20, cursor: 'pointer' }}>↻</button>
                <button onClick={() => rotate(180)} style={{ padding: '9px 14px', background: '#1e1e1e', border: '1px solid #333', borderRadius: 8, color: '#888', fontSize: 12, cursor: 'pointer' }}>180°</button>
                <button onClick={() => setCrop({ x: 0, y: 0, w: 100, h: 100 })} style={{ padding: '9px 14px', background: '#1e1e1e', border: '1px solid #333', borderRadius: 8, color: '#888', fontSize: 12, cursor: 'pointer' }}>Reset Crop</button>
                <span style={{ fontSize: 11, color: '#444' }}>{rotation}°</span>
                <button onClick={saveImage} disabled={saving}
                  style={{ padding: '10px 24px', background: saving ? '#1e1e1e' : '#276040', border: 'none', borderRadius: 8, color: saving ? '#555' : 'white', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? '⏳ Saving...' : '✓ Save'}
                </button>
              </div>
              <div style={{ fontSize: 10, color: '#333' }}>Drag corners to crop · Drag inside to move · ↺↻ to rotate</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
