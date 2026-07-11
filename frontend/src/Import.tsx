import { useState } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

type ImportResult = {
  imported_count: number
  imported: string[]
  error_count: number
  errors: { row: number; reason: string }[]
}

export default function Import() {
  const [merchantId, setMerchantId] = useState('')
  const [activeTab, setActiveTab] = useState<'csv' | 'barcode'>('csv')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const handleDownloadTemplate = () => {
    window.open(`${API_URL}/products/template/csv`, '_blank')
  }

  const handleDownloadBarcodeTemplate = () => {
    const csv = 'barcode,price\n9300650631065,4.99\n9310015512589,18.99\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'apnidukaan_barcode_template.csv'
    a.click()
  }

  const handleFileChange = (f: File) => {
    if (!f.name.endsWith('.csv')) {
      setError('Please upload a CSV file only')
      return
    }
    setFile(f)
    setError('')
    setResult(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFileChange(f)
  }

  const handleUpload = async () => {
    if (!merchantId) { setError('Please enter your Merchant ID'); return }
    if (!file) { setError('Please select a CSV file'); return }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const endpoint = activeTab === 'csv'
        ? `/products/import-csv?merchant_id=${merchantId}`
        : `/products/import-barcodes?merchant_id=${merchantId}`
      const res = await axios.post(`${API_URL}${endpoint}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setResult(res.data)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Upload failed. Please try again.')
    }
    setLoading(false)
  }

  const downloadErrorReport = () => {
    if (!result) return
    const csv = 'row,reason\n' + result.errors.map(e => `${e.row},"${e.reason}"`).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'import_errors.csv'
    a.click()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: 'var(--green-dark)', padding: '16px 16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <button onClick={() => window.location.href = '/'} style={{ background: 'none', color: 'white', fontSize: 22, border: 'none', cursor: 'pointer' }}>←</button>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>Import Products</div>
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', paddingLeft: 34 }}>
          Upload your product catalogue in bulk
        </div>
      </div>

      <div style={{ padding: '16px' }}>

        {/* Merchant ID */}
        <div style={{ background: 'white', borderRadius: 16, padding: '16px', marginBottom: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Your Merchant ID
          </div>
          <input
            type="number"
            placeholder="Enter your Merchant ID (e.g. 1)"
            value={merchantId}
            onChange={e => setMerchantId(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16, background: 'var(--cream-dark)' }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
            Your Merchant ID was provided when your store was set up. Contact Hamari Dukaan if you need it.
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'white', borderRadius: 12, padding: 4, marginBottom: 16, border: '1px solid var(--border)' }}>
          <button
            onClick={() => { setActiveTab('csv'); setFile(null); setResult(null); setError('') }}
            style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13,
              background: activeTab === 'csv' ? 'var(--green)' : 'transparent',
              color: activeTab === 'csv' ? 'white' : 'var(--text-3)' }}>
            📋 CSV Upload
          </button>
          <button
            onClick={() => { setActiveTab('barcode'); setFile(null); setResult(null); setError('') }}
            style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13,
              background: activeTab === 'barcode' ? 'var(--green)' : 'transparent',
              color: activeTab === 'barcode' ? 'white' : 'var(--text-3)' }}>
            📦 Barcode Import
          </button>
        </div>

        {/* CSV Tab */}
        {activeTab === 'csv' && (
          <div>
            <div style={{ background: 'white', borderRadius: 16, padding: '16px', marginBottom: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 8 }}>
                Step 1 — Download the template
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.6 }}>
                Download our CSV template, fill in your products, and upload. Columns: name, description, price, category, emoji, image_url, barcode, stock_qty, gst_applicable, gst_absorbed.
              </div>
              <button onClick={handleDownloadTemplate}
                style={{ width: '100%', padding: '12px', background: 'var(--cream-dark)', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 700, fontSize: 13, color: 'var(--green-dark)', cursor: 'pointer' }}>
                ⬇️ Download CSV Template
              </button>
            </div>

            <div style={{ background: 'white', borderRadius: 16, padding: '16px', marginBottom: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 12 }}>
                Step 2 — Upload your filled CSV
              </div>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('csv-input')?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--green)' : 'var(--border)'}`,
                  borderRadius: 12, padding: '30px 16px', textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? 'var(--cream-dark)' : 'transparent', marginBottom: 12
                }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-dark)', marginBottom: 4 }}>
                  {file ? file.name : 'Tap to select or drag CSV here'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>CSV files only</div>
                <input id="csv-input" type="file" accept=".csv" style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && handleFileChange(e.target.files[0])} />
              </div>
            </div>
          </div>
        )}

        {/* Barcode Tab */}
        {activeTab === 'barcode' && (
          <div>
            <div style={{ background: 'white', borderRadius: 16, padding: '16px', marginBottom: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 8 }}>
                How barcode import works
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 12 }}>
                Upload a CSV with just two columns — barcode and price. We automatically look up the product name, description, category, and image from the global product database. Perfect for supermarkets with thousands of SKUs.
              </div>
              <div style={{ background: 'var(--cream-dark)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 4 }}>Example CSV format:</div>
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-2)' }}>
                  barcode,price<br />
                  9300650631065,4.99<br />
                  9310015512589,18.99<br />
                  8901234567890,6.50
                </div>
              </div>
              <button onClick={handleDownloadBarcodeTemplate}
                style={{ width: '100%', padding: '12px', background: 'var(--cream-dark)', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 700, fontSize: 13, color: 'var(--green-dark)', cursor: 'pointer' }}>
                ⬇️ Download Barcode Template
              </button>
            </div>

            <div style={{ background: 'white', borderRadius: 16, padding: '16px', marginBottom: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 12 }}>
                Upload your barcode CSV
              </div>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('barcode-input')?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--green)' : 'var(--border)'}`,
                  borderRadius: 12, padding: '30px 16px', textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? 'var(--cream-dark)' : 'transparent'
                }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-dark)', marginBottom: 4 }}>
                  {file ? file.name : 'Tap to select barcode CSV'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>barcode + price columns only</div>
                <input id="barcode-input" type="file" accept=".csv" style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && handleFileChange(e.target.files[0])} />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: '#fce4ec', color: 'var(--red)', padding: '12px 14px', borderRadius: 12, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Upload button */}
        {file && (
          <button className="btn-primary" onClick={handleUpload} disabled={loading}
            style={{ opacity: loading ? 0.7 : 1, marginBottom: 16 }}>
            {loading ? '⏳ Importing products...' : `⬆️ Import ${activeTab === 'barcode' ? 'via Barcodes' : 'from CSV'}`}
          </button>
        )}

        {/* Loading state */}
        {loading && (
          <div style={{ background: 'white', borderRadius: 16, padding: '20px', textAlign: 'center', border: '1px solid var(--border)', marginBottom: 16 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 4 }}>
              {activeTab === 'barcode' ? 'Looking up products from global database...' : 'Processing your CSV...'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {activeTab === 'barcode' ? 'This may take a moment for large files' : 'Almost done'}
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div>
            <div style={{ background: result.imported_count > 0 ? '#e8f5e9' : '#fce4ec', borderRadius: 16, padding: '16px', marginBottom: 12, border: `1px solid ${result.imported_count > 0 ? '#a5d6a7' : '#ef9a9a'}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: result.imported_count > 0 ? '#2e7d32' : 'var(--red)', marginBottom: 4 }}>
                {result.imported_count > 0 ? `✅ ${result.imported_count} products imported!` : '❌ Import failed'}
              </div>
              {result.error_count > 0 && (
                <div style={{ fontSize: 13, color: '#e65100' }}>{result.error_count} rows had errors</div>
              )}
            </div>

            {result.imported_count > 0 && (
              <div style={{ background: 'white', borderRadius: 16, padding: '16px', marginBottom: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 10, textTransform: 'uppercase' }}>Imported Products</div>
                {result.imported.slice(0, 10).map((name, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--green-dark)', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    ✓ {name}
                  </div>
                ))}
                {result.imported.length > 10 && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                    + {result.imported.length - 10} more products
                  </div>
                )}
              </div>
            )}

            {result.error_count > 0 && (
              <div style={{ background: 'white', borderRadius: 16, padding: '16px', marginBottom: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', marginBottom: 10, textTransform: 'uppercase' }}>Errors</div>
                {result.errors.slice(0, 5).map((e, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--text-2)', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    Row {e.row}: {e.reason}
                  </div>
                ))}
                <button onClick={downloadErrorReport}
                  style={{ marginTop: 10, width: '100%', padding: '10px', background: 'var(--cream-dark)', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 700, fontSize: 12, color: 'var(--green-dark)', cursor: 'pointer' }}>
                  ⬇️ Download Error Report
                </button>
              </div>
            )}

            <button className="btn-primary" onClick={() => { setFile(null); setResult(null) }}>
              Import More Products
            </button>
          </div>
        )}

        {/* Info box */}
        {!result && !loading && (
          <div style={{ background: 'var(--green-dark)', borderRadius: 16, padding: '16px', marginTop: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 8 }}>💡 Tips for best results</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.7 }}>
              • Use the template to avoid formatting errors{'\n'}
              • Price must be a number (e.g. 4.99 not $4.99){'\n'}
              • Leave image_url blank if you don't have images{'\n'}
              • For barcodes — export from your POS system{'\n'}
              • Contact us if you need help: support@apnidukaan.au
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
