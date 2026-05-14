'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Sub {
  id: string
  status: 'active' | 'cancelled' | 'expired'
  started_at: string
  current_period_end: string
  cancelled_at: string | null
  plan: {
    id: string
    name: string
    description: string | null
    monthly_price: number
    benefits: string[]
    badge_emoji: string
    badge_color: string
  } | null
  creator: {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
  } | null
}

export default function SubsList({ subs }: { subs: Sub[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [items, setItems] = useState(subs)

  const cancel = (id: string) => {
    if (!confirm('このサブスクを解約しますか？現在の期間終了まではアクセス可能です')) return
    start(async () => {
      const res = await fetch(`/api/subscribe?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setItems(prev => prev.map(s => s.id === id ? { ...s, status: 'cancelled' as const, cancelled_at: new Date().toISOString() } : s))
        router.refresh()
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {items.map(s => {
        if (!s.plan || !s.creator) return null
        const isActive = s.status === 'active'
        return (
          <div key={s.id} className="mm-card" style={{ padding: 18, borderLeft: `4px solid ${s.plan.badge_color}`, opacity: isActive ? 1 : 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Link href={`/creator/${s.creator.username}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', background: 'var(--mm-primary-light)' }}>
                  {s.creator.avatar_url ? <img src={s.creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700 }}>{s.creator.display_name}</p>
                  <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>@{s.creator.username}</p>
                </div>
              </Link>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: s.plan.badge_color }}>
                  {s.plan.badge_emoji}{s.plan.name}
                </span>
                <p style={{ fontSize: 16, fontWeight: 700 }}>¥{s.plan.monthly_price.toLocaleString()}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--mm-text-muted)' }}>/月</span></p>
              </div>
            </div>
            {s.plan.benefits.length > 0 && (
              <ul style={{ marginTop: 12, paddingLeft: 18, fontSize: 12, color: 'var(--mm-text-sub)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {s.plan.benefits.slice(0, 3).map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            )}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--mm-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>
                {isActive ? `次回更新: ${new Date(s.current_period_end).toLocaleDateString('ja-JP')}` : `解約: ${s.cancelled_at ? new Date(s.cancelled_at).toLocaleDateString('ja-JP') : ''}`}
              </p>
              {isActive ? (
                <button onClick={() => cancel(s.id)} disabled={pending} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 999, fontSize: 11, cursor: 'pointer' }}>解約</button>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>{s.status === 'cancelled' ? '解約済み' : '期限切れ'}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
