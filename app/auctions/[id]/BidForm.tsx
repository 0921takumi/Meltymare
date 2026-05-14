'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function BidForm({ auctionId, budgetMin, budgetMax }: { auctionId: string; budgetMin: number; budgetMax: number }) {
  const router = useRouter()
  const [amount, setAmount] = useState(Math.round((budgetMin + budgetMax) / 2))
  const [message, setMessage] = useState('')
  const [days, setDays] = useState(7)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const submit = () => {
    if (!message.trim()) { setError('提案メッセージを入力してください'); return }
    start(async () => {
      setError(null)
      const res = await fetch('/api/auction-bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auction_id: auctionId, bid_amount: amount, message, estimated_days: days }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? '入札に失敗しました')
        return
      }
      router.refresh()
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {error && <div style={{ padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 6, fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-text-sub)' }}>入札額 (¥)</label>
          <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} min={500} step={100}
            style={{ width: '100%', marginTop: 4, padding: '10px 12px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14 }} />
          <p style={{ fontSize: 10, color: 'var(--mm-text-muted)', marginTop: 4 }}>予算範囲: ¥{budgetMin.toLocaleString()}〜¥{budgetMax.toLocaleString()}</p>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-text-sub)' }}>納期 (日)</label>
          <input type="number" value={days} onChange={e => setDays(Number(e.target.value))} min={1} max={90}
            style={{ width: '100%', marginTop: 4, padding: '10px 12px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14 }} />
        </div>
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-text-sub)' }}>提案メッセージ</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} maxLength={500}
          style={{ width: '100%', marginTop: 4, padding: '10px 12px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
          placeholder="どう実現するかを伝えると採用されやすくなります" />
      </div>
      <button onClick={submit} disabled={pending} style={{
        padding: '11px 22px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 999,
        fontSize: 13, fontWeight: 700, cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.6 : 1,
      }}>
        {pending ? '送信中...' : '入札する'}
      </button>
    </div>
  )
}
