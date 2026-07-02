import { useState, useRef, useEffect, useCallback } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

type Product = { id: number; name: string; image_url: string | null; price: number; category?: string }

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
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 100, h: 100 })
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<number | null>(null)
  const [msg, setMsg] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [cropCorner, setCropCorner] = useState<string | null>(null)

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
    setImgLoaded(false)
  }

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !imgLoaded) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = 500
    canvas.height = 500
    ctx.clearRect(0, 0, 500, 500)
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, 500, 500)
    ctx.save()
    ctx.translate(250, 250)
    ctx.rotate((rotation * Math.PI) / 180)
    const isRotated90 = rotation === 90 || rotation === 270
    const srcW = img.naturalWidth
    const srcH = img.naturalHeight
    const displayW = isRotated90 ? srcH : srcW
    const displayH = isRotated90 ? srcW : srcH
    const scale = Math.min(460 / displayW, 460 / displayH)
    const dw = displayW * scale
    const dh = displayH * scale
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
    ctx.restore()
    const cx = (crop.x / 100) * 500
    const cy = (crop.y / 100) * 500
    const cw = (crop.w / 100) * 500
    const ch = (crop.h / 100) * 500
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, 0, 500, cy)
    ctx.fillRect(0, cy + ch, 500, 500 - cy - ch)
    ctx.fillRect(0, cy, cx, ch)
    ctx.fillRect(cx + cw, cy, 500 - cx - cw, ch)
    ctx.strokeStyle = '#c9a84c'
    ctx.lineWidth = 2
    ctx.strokeRect(cx, cy, cw, ch)
    const hs = 10
    ctx.fillStyle = '#c9a84c'
    ;[[cx, cy], [cx + cw, cy], [cx, cy + ch], [cx + cw, cy + ch]].forEach(([hx, hy]) => {
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs)
    })
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.lineWidth = 1
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(cx + (cw * i) / 3, cy); ctx.lineTo(cx + (cw * i) / 3, cy + ch); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx, cy + (ch * i) / 3); ctx.lineTo(cx + cw, cy + (ch * i) / 3); ctx.stroke()
    }
  }, [rotation, crop, imgLoaded])

  useEffect(() => { drawCanvas() }, [drawCanvas])

  useEffect(() => {
    if (!editingProduct?.image_url) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = editingProduct.image_url + '?t=' + Date.now()
    img.onload = () => { imgRef.current = img; setImgLoaded(true) }
  }, [editingProduct])

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100
    }
  }

  const getCorner = (px: number, py: number) => {
    const tol = 4
    if (Math.abs(px - crop.x) < tol && Math.abs(py - crop.y) < tol) return 'tl'
    if (Math.abs(px - (crop.x + crop.w)) < tol && Math.abs(py - crop.y) < tol) return 'tr'
    if (Math.abs(px - crop.x) < tol && Math.abs(py - (crop.y + crop.h)) < tol) return 'bl'
    if (Math.abs(px - (crop.x + crop.w)) < tol && Math.abs(py - (crop.y + crop.h)) < tol) return 'br'
    return null
  }

  const isInsideCrop = (px: number, py: number) =>
    px >= crop.x && px <= crop.x + crop.w && py >= crop.y && py <= crop.y + crop.h

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasPos(e)
    const corner = getCorner(x, y)
    if (corner) { setCropCorner(corner); setIsDragging(true); setDragStart({ x, y }); return }
    if (isInsideCrop(x, y)) { setCropCorner(null); setIsDragging(true); setDragStart({ x, y }) }
  }

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return
    const { x, y } = getCanvasPos(e)
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
        return { x: Math.max(0, Math.min(cx, 95)), y: Math.max(0, Math.min(cy, 95)), w: Math.max(5, Math.min(cw, 100 - cx)), h: Math.max(5, Math.min(ch, 100 - cy)) }
      })
    } else {
      setCrop(prev => ({ ...prev, x: Math.max(0, Math.min(prev.x + dx, 100 - prev.w)), y: Math.max(0, Math.min(prev.y + dy, 100 - prev.h)) }))
    }
  }

  const onMouseUp = () => { setIsDragging(false); setCropCorner(null) }

  const rotate = (deg: number) => setRotation(r => (r + deg + 360) % 360)

  const saveImage = async () => {
    if (!editingProduct || !canvasRef.current || !imgRef.current) return
    setSaving(true); setMsg('')
    try {
      const img = imgRef.current
      const offscreen = document.createElement('canvas')
      const isRotated90 = rotation === 90 || rotation === 270
      const srcW = img.naturalWidth; const srcH = img.naturalHeight
      const displayW = isRotated90 ? srcH : srcW; const displayH = isRotated90 ? srcW : srcH
      const scale = Math.min(460 / displayW, 460 / displayH)
      offscreen.width = Math.round((crop.w / 100) * 500)
      offscreen.height = Math.round((crop.h / 100) * 500)
      const ctx = offscreen.getContext('2d')!
      ctx.save()
      ctx.translate(250 - (crop.x / 100) * 500, 250 - (crop.y / 100) * 500)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.drawImage(img, -(displayW * scale) / 2, -(displayH * scale) / 2, displayW * scale, displayH * scale)
      ctx.restore()
      offscreen.toBlob(async (blob) => {
        if (!blob) { setSaving(false); return }
        const form = new FormData()
        form.append('file', blob, 'image.jpg')
        const res = await axios.post(`${API_URL}/upload/product-image/${editingProduct.id}`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
        const newUrl = res.data.image_url
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, image_url: newUrl } : p))
        setEditingProduct(prev => prev ? { ...prev, image_url: newUrl } : prev)
        setSavedId(editingProduct.id)
        setMsg('✅ Saved!')
        setTimeout(() => { setSavedId(null); setMsg('') }, 3000)
        setSaving(false)
      }, 'image/jpeg', 0.9)
    } catch { setMsg('❌ Save failed'); setSaving(false) }
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

  return (
    <div style={{ minHeight: '100vh', background: '#111', color: 'white' }}>
      <div style={{ background: '#1a1a1a', borderBottom: '1px solid #2a2a2a', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#c9a84c', flexShrink: 0 }}>📷 Image Editor</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {merchants.map(m => (
            <button key={m.id} onClick={() => loadProducts(m)}
              style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${selectedMerchant?.id === m.id ? '#c9a84c' : '#333'}`, background: selectedMerchant?.id === m.id ? '#c9a84c22' : 'transparent', color: selectedMerchant?.id === m.id ? '#c9a84c' : '#888', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {m.emoji} {m.name}
            </button>
          ))}
        </div>
        {msg && <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: msg.includes('✅') ? '#4caf50' : '#ff6b6b' }}>{msg}</div>}
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 53px)' }}>
        <div style={{ width: 320, borderRight: '1px solid #1e1e1e', overflowY: 'auto', padding: 12 }}>
          {loading ? <div style={{ color: '#555', padding: 40, textAlign: 'center' }}>Loading...</div>
            : products.length === 0 ? <div style={{ color: '#444', padding: 40, textAlign: 'center' }}>Select a merchant above</div>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {products.map(p => (
                  <div key={p.id} onClick={() => openEditor(p)}
                    style={{ borderRadius: 8, overflow: 'hidden', border: `2px solid ${editingProduct?.id === p.id ? '#c9a84c' : savedId === p.id ? '#4caf50' : '#222'}`, cursor: 'pointer', background: '#1a1a1a', position: 'relative' }}>
                    <img src={p.image_url!} alt={p.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                    {savedId === p.id && <div style={{ position: 'absolute', top: 3, right: 3, background: '#4caf50', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>✓</div>}
                    <div style={{ padding: '4px 6px', fontSize: 9, color: '#666', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  </div>
                ))}
              </div>
            )}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 14 }}>
          {!editingProduct ? (
            <div style={{ textAlign: 'center', color: '#333' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
              <div>Click any product thumbnail to edit</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#c9a84c' }}>{editingProduct.name}</div>
              <canvas ref={canvasRef} width={500} height={500}
                style={{ borderRadius: 10, cursor: isDragging ? 'grabbing' : 'crosshair', maxWidth: 'min(500px, calc(100vw - 380px))', maxHeight: 'calc(100vh - 240px)', border: '1px solid #2a2a2a' }}
                onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={() => rotate(-90)} title="Rotate left" style={{ padding: '9px 18px', background: '#1e1e1e', border: '1px solid #333', borderRadius: 8, color: 'white', fontSize: 20, cursor: 'pointer' }}>↺</button>
                <button onClick={() => rotate(90)} title="Rotate right" style={{ padding: '9px 18px', background: '#1e1e1e', border: '1px solid #333', borderRadius: 8, color: 'white', fontSize: 20, cursor: 'pointer' }}>↻</button>
                <button onClick={() => rotate(180)} title="Flip 180°" style={{ padding: '9px 14px', background: '#1e1e1e', border: '1px solid #333', borderRadius: 8, color: '#aaa', fontSize: 12, cursor: 'pointer' }}>180°</button>
                <button onClick={() => setCrop({ x: 0, y: 0, w: 100, h: 100 })} style={{ padding: '9px 14px', background: '#1e1e1e', border: '1px solid #333', borderRadius: 8, color: '#aaa', fontSize: 12, cursor: 'pointer' }}>Reset Crop</button>
                <div style={{ fontSize: 11, color: '#444', paddingLeft: 4 }}>{rotation}°</div>
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
