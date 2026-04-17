'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, ShoppingCart, Lock, Clock, Tag, Heart } from 'lucide-react'

type TipPercent = 0 | 5 | 10 | 15
const TIP_OPTIONS: { value: TipPercent; label: string }[] = [
  { value: 0, label: 'なし' },
  { value: 5, label: '5%' },
  { value: 10, label: '10%' },
  { value: 15, label: '15%' },
]

interface Props {
  contentId: string
  price: number
  isPurchased: boolean
  deliveryStatus: 'pending' | 'delivered' | null
  isSoldOut: boolean
  isLoggedIn: boolean
  downloadUrl: string | null
}

export default function PurchaseButton({ contentId, price, isPurchased, deliveryStatus, isSoldOut, isLoggedIn, downloadUrl }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponData, setCouponData] = useState<{ discount_amount: number; final_price: number; code: string } | null>(null)
  const [couponError, setCouponError] = useState('')
  const [tipPercent, setTipPercent] = useState<TipPercent>(0)

  // 購入済み・納品済み → ダウンロード
  if (isPurchased && deliveryStatus === 'delivered' && downloadUrl) {
    return (
      <a href={downloadUrl} download
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#059669', color: 'white', padding: '14px 24px', borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
        <Download size={18} />
        ダウンロード
      </a>
    )
  }

  // 購入済み・納品待ち
  if (isPurchased && deliveryStatus === 'pending') {
    return (
      <div style={{ padding: '16px 20px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#d97706', fontWeight: 700, fontSize: 14 }}>
          <Clock size={16} /> 納品待ち
        </div>
        <p style={{ fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
          ご注文ありがとうございます。クリエイターが写真にメッセージを書き込んで納品します。しばらくお待ちください。
        </p>
        <a href="/mypage" style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: '#d97706', fontWeight: 600 }}>
          マイページで確認 →
        </a>
      </div>
    )
  }

  if (isPurchased) {
    return (
      <div style={{ textAlign: 'center', padding: '14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, color: '#059669', fontWeight: 600, fontSize: 14 }}>
        ✓ 購入済み
      </div>
    )
  }

  if (isSoldOut) {
    return (
      <div style={{ textAlign: 'center', padding: '14px', background: 'var(--mm-bg)', border: '1px solid var(--mm-border)', borderRadius: 10, color: 'var(--mm-text-muted)', fontWeight: 600, fontSize: 14 }}>
        SOLD OUT
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <button onClick={() => router.push('/auth/login')}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: 'var(--mm-primary)', color: 'white', padding: '14px 24px', borderRadius: 10, fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer' }}>
        <Lock size={17} />
        ログインして購入 ¥{price.toLocaleString()}
      </button>
    )
  }

  const applyCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    setCouponError('')
    setCouponData(null)
    try {
      const res = await fetch(`/api/coupon?code=${encodeURIComponent(couponCode.trim())}&price=${price}`)
      const data = await res.json()
      if (!res.ok) { setCouponError(data.error); return }
      setCouponData(data)
    } finally {
      setCouponLoading(false)
    }
  }

  const contentPriceAfterCoupon = couponData ? couponData.final_price : price
  const tipAmount = Math.floor(contentPriceAfterCoupon * tipPercent / 100)
  const finalPrice = contentPriceAfterCoupon + tipAmount

  const handlePurchase = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId, couponCode: couponData?.code, tipPercent }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.href = data.checkoutUrl
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '購入処理に失敗しました'
      alert(msg)
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* クーポン入力 */}
      <div className="mm-card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Tag size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--mm-text-muted)', pointerEvents: 'none' }} />
            <input
              value={couponCode}
              onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponData(null); setCouponError('') }}
              placeholder="クーポンコード"
              style={{ width: '100%', padding: '9px 12px 9px 30px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: '0.05em' }}
            />
          </div>
          <button onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()}
            style={{ padding: '9px 14px', background: 'var(--mm-primary-light)', color: 'var(--mm-primary)', border: '1px solid var(--mm-primary)', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {couponLoading ? '...' : '適用'}
          </button>
        </div>
        {couponError && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 6 }}>{couponError}</p>}
        {couponData && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#f0fdf4', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#059669', fontWeight: 700 }}>¥{couponData.discount_amount.toLocaleString()} 割引</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>→ ¥{couponData.final_price.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* 応援チップ選択 */}
      <div className="mm-card" style={{ padding: '14px 16px', background: 'linear-gradient(135deg, #fefaf3 0%, #ffffff 100%)', border: '1px solid #e8d7b4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Heart size={14} style={{ color: '#b8956a' }} fill="#b8956a" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#8a6a3f' }}>応援チップ（任意）</span>
        </div>
        <p style={{ fontSize: 11, color: '#a78968', marginBottom: 10, lineHeight: 1.5 }}>
          商品代金への上乗せで、推しのクリエイターに応援を届けられます。
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {TIP_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTipPercent(opt.value)}
              style={{
                padding: '10px 4px',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 8,
                border: tipPercent === opt.value ? '2px solid #b8956a' : '1px solid var(--mm-border)',
                background: tipPercent === opt.value ? '#b8956a' : 'white',
                color: tipPercent === opt.value ? 'white' : 'var(--mm-text-sub)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {tipAmount > 0 && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(184, 149, 106, 0.1)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#8a6a3f', fontWeight: 600 }}>チップ ({tipPercent}%)</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#8a6a3f' }}>+¥{tipAmount.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* 合計 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 4px' }}>
        <span style={{ fontSize: 13, color: 'var(--mm-text-muted)', fontWeight: 600 }}>合計</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--mm-text)' }}>¥{finalPrice.toLocaleString()}</span>
      </div>

      <button onClick={handlePurchase} disabled={loading}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: 'var(--mm-primary)', color: 'white', padding: '14px 24px', borderRadius: 10, fontWeight: 700, fontSize: 15, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
        <ShoppingCart size={17} />
        {loading ? '処理中...' : `購入する ¥${finalPrice.toLocaleString()}`}
      </button>
    </div>
  )
}
