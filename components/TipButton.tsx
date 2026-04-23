'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, X, Sparkles } from 'lucide-react'

const PRESETS = [300, 500, 1000, 3000, 5000, 10000]

export default function TipButton({
  creatorId,
  creatorName,
  isLoggedIn,
}: {
  creatorId: string
  creatorName: string
  isLoggedIn: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState<number>(500)
  const [custom, setCustom] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleOpen = () => {
    if (!isLoggedIn) {
      router.push('/auth/login')
      return
    }
    setOpen(true)
  }

  const handleTip = async () => {
    const finalAmount = custom ? parseInt(custom, 10) : amount
    if (!finalAmount || finalAmount < 100) {
      alert('¥100以上の金額を指定してください')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, amount: finalAmount, message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'error')
      if (data.checkoutUrl) window.location.href = data.checkoutUrl
    } catch (e: any) {
      alert(e.message ?? 'エラーが発生しました')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px',
          background: 'linear-gradient(90deg, #ec4899, #f97316)', color: 'white',
          border: 0, borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(236,72,153,0.3)',
        }}
      >
        <Heart size={14} fill="white" /> チップを贈る
      </button>

      {open && (
        <div
          onClick={() => !loading && setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 16, padding: 24, maxWidth: 420,
              width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative',
            }}
          >
            <button
              onClick={() => !loading && setOpen(false)}
              style={{
                position: 'absolute', top: 12, right: 12, background: 'transparent',
                border: 0, cursor: 'pointer', padding: 4,
              }}
            >
              <X size={20} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <Sparkles size={28} color="#ec4899" style={{ marginBottom: 8 }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{creatorName} にチップを贈る</h3>
              <p style={{ fontSize: 12, color: '#888' }}>応援メッセージとチップでクリエイターを支援できます</p>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>金額を選択</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => { setAmount(p); setCustom('') }}
                    style={{
                      padding: '10px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                      border: amount === p && !custom ? '2px solid #ec4899' : '1px solid #e5e7eb',
                      borderRadius: 10, background: amount === p && !custom ? '#fdf2f8' : 'white',
                      color: amount === p && !custom ? '#ec4899' : '#333',
                    }}
                  >
                    ¥{p.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>または金額を入力</p>
              <input
                type="number"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="例: 2000"
                min={100}
                max={100000}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 14,
                  border: '1px solid #e5e7eb', borderRadius: 10,
                }}
              />
              <p style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>¥100〜¥100,000</p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>メッセージ（任意）</p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 200))}
                placeholder="いつも応援しています！"
                rows={3}
                style={{
                  width: '100%', padding: 10, fontSize: 14, border: '1px solid #e5e7eb',
                  borderRadius: 10, resize: 'vertical',
                }}
              />
              <p style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{message.length}/200</p>
            </div>

            <button
              onClick={handleTip}
              disabled={loading}
              style={{
                width: '100%', padding: 14, fontSize: 15, fontWeight: 700,
                color: 'white', border: 0, borderRadius: 12, cursor: loading ? 'wait' : 'pointer',
                background: loading ? '#ccc' : 'linear-gradient(90deg, #ec4899, #f97316)',
              }}
            >
              {loading ? '処理中...' : `¥${(custom ? parseInt(custom, 10) || 0 : amount).toLocaleString()} を贈る`}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
