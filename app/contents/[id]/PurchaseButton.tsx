'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, ShoppingCart, Lock, Clock } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

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

  const handlePurchase = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Stripe Checkout URLへリダイレクト
      window.location.href = data.checkoutUrl
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '購入処理に失敗しました'
      alert(msg)
      setLoading(false)
    }
  }

  return (
    <button onClick={handlePurchase} disabled={loading}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: 'var(--mm-primary)', color: 'white', padding: '14px 24px', borderRadius: 10, fontWeight: 700, fontSize: 15, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
      <ShoppingCart size={17} />
      {loading ? '処理中...' : `購入する ¥${price.toLocaleString()}`}
    </button>
  )
}
