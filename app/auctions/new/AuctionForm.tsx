'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['チェキ', '動画', 'ボイス', 'コスプレ', 'バースデー', 'その他']

export default function AuctionForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [budgetMin, setBudgetMin] = useState(1000)
  const [budgetMax, setBudgetMax] = useState(10000)
  const [days, setDays] = useState(7)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const submit = () => {
    if (!title.trim() || !description.trim()) {
      setError('タイトルと内容は必須です')
      return
    }
    if (budgetMin > budgetMax) {
      setError('予算の最小が最大を上回っています')
      return
    }
    start(async () => {
      setError(null)
      const deadline = new Date()
      deadline.setDate(deadline.getDate() + days)
      const res = await fetch('/api/auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description, category: category || null,
          budget_min: budgetMin, budget_max: budgetMax,
          deadline: deadline.toISOString(),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? '投稿に失敗しました')
        return
      }
      const j = await res.json()
      router.push(`/auctions/${j.id}`)
    })
  }

  return (
    <div className="mm-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      {error && <div style={{ padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 6, fontSize: 12 }}>{error}</div>}

      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--mm-text-sub)' }}>タイトル *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100}
          style={{ width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14 }}
          placeholder="例: 私の誕生日に動画メッセージが欲しい" />
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--mm-text-sub)' }}>カテゴリ</label>
        <select value={category} onChange={e => setCategory(e.target.value)}
          style={{ width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, background: 'white' }}>
          <option value="">選択しない</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--mm-text-sub)' }}>内容 *</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={6} maxLength={1000}
          style={{ width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
          placeholder="どんなコンテンツが欲しいか具体的に..." />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--mm-text-sub)' }}>予算 最小 (¥)</label>
          <input type="number" value={budgetMin} onChange={e => setBudgetMin(Number(e.target.value))} min={500} step={500}
            style={{ width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--mm-text-sub)' }}>予算 最大 (¥)</label>
          <input type="number" value={budgetMax} onChange={e => setBudgetMax(Number(e.target.value))} min={500} step={500}
            style={{ width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14 }} />
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--mm-text-sub)' }}>受付期間</label>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          style={{ width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, background: 'white' }}>
          <option value={3}>3日間</option>
          <option value={7}>7日間</option>
          <option value={14}>14日間</option>
          <option value={30}>30日間</option>
        </select>
      </div>

      <button onClick={submit} disabled={pending} style={{
        padding: '12px 24px', background: '#7c3aed', color: 'white',
        border: 'none', borderRadius: 999, fontSize: 14, fontWeight: 700,
        cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.6 : 1,
      }}>
        {pending ? '投稿中...' : 'リクエストを投稿'}
      </button>
    </div>
  )
}
