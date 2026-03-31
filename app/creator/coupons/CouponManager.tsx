'use client'
import { useState } from 'react'
import { Tag, Plus, Trash2 } from 'lucide-react'

interface Coupon {
  id: string
  code: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  min_amount: number
  max_uses: number | null
  used_count: number
  expires_at: string | null
  is_active: boolean
}

export default function CouponManager({ initialCoupons }: { initialCoupons: Coupon[] }) {
  const [coupons, setCoupons] = useState(initialCoupons)
  const [showForm, setShowForm] = useState(false)
  const [code, setCode] = useState('')
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent')
  const [discountValue, setDiscountValue] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const createCoupon = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, discount_type: discountType, discount_value: discountValue, min_amount: minAmount, max_uses: maxUses, expires_at: expiresAt }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setCoupons(prev => [data, ...prev])
      setCode(''); setDiscountValue(''); setMinAmount(''); setMaxUses(''); setExpiresAt('')
      setShowForm(false)
    } finally {
      setCreating(false)
    }
  }

  const deleteCoupon = async (id: string) => {
    const res = await fetch(`/api/coupon?id=${id}`, { method: 'DELETE' })
    if (res.ok) setCoupons(prev => prev.filter(c => c.id !== id))
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => setShowForm(!showForm)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--mm-primary)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          <Plus size={15} /> 新しいクーポンを作成
        </button>
      </div>

      {showForm && (
        <div className="mm-card" style={{ padding: 24, marginBottom: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>クーポン作成</p>
          <form onSubmit={createCoupon} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>クーポンコード *</label>
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} required placeholder="例: SUMMER20" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>割引タイプ</label>
              <select value={discountType} onChange={e => setDiscountType(e.target.value as any)} style={inputStyle}>
                <option value="percent">割合 (%)</option>
                <option value="fixed">固定金額 (¥)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>割引値 *</label>
              <input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} required min={1} max={discountType === 'percent' ? 100 : undefined} style={inputStyle} placeholder={discountType === 'percent' ? '例: 20' : '例: 500'} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>最低購入金額 (¥)</label>
              <input type="number" value={minAmount} onChange={e => setMinAmount(e.target.value)} min={0} style={inputStyle} placeholder="0" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>最大使用回数</label>
              <input type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} min={1} style={inputStyle} placeholder="無制限" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>有効期限</label>
              <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} style={inputStyle} />
            </div>
            {error && <p style={{ gridColumn: '1/-1', fontSize: 12, color: '#dc2626' }}>{error}</p>}
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
              <button type="submit" disabled={creating} style={{ padding: '9px 20px', background: 'var(--mm-primary)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {creating ? '作成中...' : '作成する'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '9px 16px', background: 'white', color: 'var(--mm-text-muted)', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {coupons.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--mm-text-muted)' }}>
          <Tag size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>まだクーポンがありません</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {coupons.map(c => (
            <div key={c.id} className="mm-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, background: 'var(--mm-primary-light)', color: 'var(--mm-primary)', padding: '2px 10px', borderRadius: 6 }}>{c.code}</span>
                  {!c.is_active && <span style={{ fontSize: 11, color: '#dc2626', background: '#fef2f2', padding: '2px 8px', borderRadius: 10 }}>無効</span>}
                </div>
                <p style={{ fontSize: 13, color: 'var(--mm-text-sub)' }}>
                  {c.discount_type === 'percent' ? `${c.discount_value}%オフ` : `¥${c.discount_value.toLocaleString()}引き`}
                  {c.min_amount > 0 && ` · ¥${c.min_amount.toLocaleString()}以上`}
                  {c.max_uses && ` · 最大${c.max_uses}回`}
                  {c.expires_at && ` · ${new Date(c.expires_at).toLocaleDateString('ja-JP')}まで`}
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--mm-primary)' }}>{c.used_count} 回使用</p>
                {c.max_uses && <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>/ {c.max_uses} 回</p>}
              </div>
              <button onClick={() => deleteCoupon(c.id)} style={{ padding: 8, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Trash2 size={15} color="#dc2626" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
