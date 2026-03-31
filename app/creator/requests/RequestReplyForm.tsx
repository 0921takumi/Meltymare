'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RequestReplyForm({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [status, setStatus] = useState<'accepted' | 'rejected'>('accepted')
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/request', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: requestId, status, creator_reply: reply }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'エラー'); return }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ borderTop: '1px solid var(--mm-border)', paddingTop: 14 }}>
      <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>返信する</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {(['accepted', 'rejected'] as const).map(s => (
          <button key={s} onClick={() => setStatus(s)}
            style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: status === s ? (s === 'accepted' ? '#eff6ff' : '#fef2f2') : 'white',
              borderColor: status === s ? (s === 'accepted' ? '#2563eb' : '#dc2626') : 'var(--mm-border)',
              color: status === s ? (s === 'accepted' ? '#2563eb' : '#dc2626') : 'var(--mm-text-muted)',
            }}>
            {s === 'accepted' ? '✓ 承認' : '✕ 見送り'}
          </button>
        ))}
      </div>
      <textarea
        value={reply}
        onChange={e => setReply(e.target.value)}
        rows={3}
        placeholder="返信メッセージ（任意）"
        style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6, marginBottom: 10 }}
      />
      {error && <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>{error}</p>}
      <button onClick={submit} disabled={loading}
        style={{ padding: '9px 20px', background: status === 'accepted' ? '#2563eb' : '#dc2626', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer' }}>
        {loading ? '送信中...' : '返信を送る'}
      </button>
    </div>
  )
}
