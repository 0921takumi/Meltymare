'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Play, Square, Trash2, Eye } from 'lucide-react'

interface Stream {
  id: string
  title: string
  thumbnail_url: string | null
  scheduled_at: string
  status: 'scheduled' | 'live' | 'ended' | 'cancelled'
  viewer_peak: number
  is_premium: boolean
  premium_price: number | null
}

const STATUS_LABEL: Record<Stream['status'], { label: string; color: string; bg: string }> = {
  scheduled: { label: '予定', color: 'var(--mm-primary)', bg: '#dbeafe' },
  live:      { label: '配信中', color: '#dc2626',         bg: '#fee2e2' },
  ended:     { label: '終了',   color: 'var(--mm-text-muted)', bg: '#e5e7eb' },
  cancelled: { label: '中止',   color: '#9ca3af',          bg: '#f3f4f6' },
}

export default function StreamManager({ streams: initial }: { streams: Stream[] }) {
  const router = useRouter()
  const [streams, setStreams] = useState(initial)
  const [pending, start] = useTransition()

  const updateStatus = (id: string, status: Stream['status']) => {
    start(async () => {
      const res = await fetch('/api/live-stream', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) {
        setStreams(prev => prev.map(s => s.id === id ? { ...s, status } : s))
        router.refresh()
      }
    })
  }

  const remove = (id: string) => {
    if (!confirm('この配信を削除しますか？')) return
    start(async () => {
      const res = await fetch(`/api/live-stream?id=${id}`, { method: 'DELETE' })
      if (res.ok) setStreams(prev => prev.filter(s => s.id !== id))
    })
  }

  if (streams.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mm-text-muted)' }}>
        <p style={{ fontSize: 36, marginBottom: 10 }}>📡</p>
        <p style={{ fontSize: 13 }}>まだ配信がありません</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {streams.map(s => {
        const cfg = STATUS_LABEL[s.status]
        return (
          <div key={s.id} className="mm-card" style={{ padding: 14, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 100, aspectRatio: '16/9', borderRadius: 6, overflow: 'hidden', background: '#000', flexShrink: 0 }}>
              {s.thumbnail_url ? <img src={s.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>📺</div>}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                {s.is_premium && <span style={{ fontSize: 10, fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: 999 }}>¥{s.premium_price?.toLocaleString()}</span>}
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{s.title}</p>
              <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 2 }}>
                🗓 {new Date(s.scheduled_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}〜
                {s.viewer_peak > 0 && <> · <Eye size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {s.viewer_peak}</>}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {s.status === 'scheduled' && (
                <button onClick={() => updateStatus(s.id, 'live')} disabled={pending} style={{ padding: '6px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Play size={11} />配信開始
                </button>
              )}
              {s.status === 'live' && (
                <button onClick={() => updateStatus(s.id, 'ended')} disabled={pending} style={{ padding: '6px 12px', background: 'var(--mm-text-sub)', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Square size={11} />終了
                </button>
              )}
              <Link href={`/live/${s.id}`} style={{ padding: '6px 12px', background: 'transparent', color: 'var(--mm-primary)', border: '1px solid var(--mm-border)', borderRadius: 6, fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
                プレビュー
              </Link>
              <button onClick={() => remove(s.id)} disabled={pending} style={{ padding: '6px 10px', background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
