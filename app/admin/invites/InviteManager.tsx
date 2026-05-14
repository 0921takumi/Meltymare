'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Copy, Trash2 } from 'lucide-react'

interface Invite {
  id: string
  code: string
  note: string | null
  max_uses: number
  used_count: number
  expires_at: string | null
  is_active: boolean
  created_at: string
}

export default function InviteManager({ initialInvites }: { initialInvites: Invite[] }) {
  const router = useRouter()
  const [invites, setInvites] = useState(initialInvites)
  const [showForm, setShowForm] = useState(false)
  const [note, setNote] = useState('')
  const [maxUses, setMaxUses] = useState(1)
  const [days, setDays] = useState(30)
  const [pending, start] = useTransition()
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const create = () => {
    start(async () => {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, max_uses: maxUses, days }),
      })
      if (res.ok) {
        const j = await res.json()
        setInvites(prev => [j.invite, ...prev])
        setShowForm(false)
        setNote('')
      }
    })
  }

  const toggle = (id: string, active: boolean) => {
    start(async () => {
      const res = await fetch('/api/invite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: active }),
      })
      if (res.ok) setInvites(prev => prev.map(i => i.id === id ? { ...i, is_active: active } : i))
    })
  }

  const remove = (id: string) => {
    if (!confirm('この招待コードを削除しますか？')) return
    start(async () => {
      const res = await fetch(`/api/invite?id=${id}`, { method: 'DELETE' })
      if (res.ok) setInvites(prev => prev.filter(i => i.id !== id))
    })
  }

  const copy = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <>
      <button onClick={() => setShowForm(!showForm)} disabled={pending} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px',
        background: 'var(--mm-primary)', color: 'white', border: 'none',
        borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 18,
      }}>
        <Plus size={14} />招待コードを発行
      </button>

      {showForm && (
        <div className="mm-card" style={{ padding: 22, marginBottom: 22 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>新規発行</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-text-sub)' }}>メモ（誰に渡したか）</label>
              <input value={note} onChange={e => setNote(e.target.value)}
                style={{ width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid var(--mm-border)', borderRadius: 6, fontSize: 13 }}
                placeholder="例: ナオト氏" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-text-sub)' }}>使用回数上限</label>
              <input type="number" value={maxUses} onChange={e => setMaxUses(Number(e.target.value))} min={1} max={100}
                style={{ width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid var(--mm-border)', borderRadius: 6, fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-text-sub)' }}>有効期間（日）</label>
              <input type="number" value={days} onChange={e => setDays(Number(e.target.value))} min={1}
                style={{ width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid var(--mm-border)', borderRadius: 6, fontSize: 13 }} />
            </div>
          </div>
          <button onClick={create} disabled={pending} style={{ padding: '8px 18px', background: 'var(--mm-primary)', color: 'white', border: 'none', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>発行</button>
        </div>
      )}

      <div className="mm-card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--mm-bg)' }}>
              {['コード', 'メモ', '使用', '有効期限', '状態', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--mm-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--mm-border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invites.map(i => {
              const expired = i.expires_at && new Date(i.expires_at) < new Date()
              const usedUp = i.used_count >= i.max_uses
              return (
                <tr key={i.id} style={{ borderBottom: '1px solid var(--mm-border)', opacity: i.is_active && !expired && !usedUp ? 1 : 0.5 }}>
                  <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.05em' }}>
                    {i.code}
                    <button onClick={() => copy(i.code)} style={{ marginLeft: 6, padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: copiedCode === i.code ? '#059669' : 'var(--mm-text-muted)' }}>
                      <Copy size={11} />
                    </button>
                  </td>
                  <td style={{ padding: '11px 14px', color: 'var(--mm-text-sub)' }}>{i.note ?? '—'}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 700 }}>{i.used_count} / {i.max_uses}</td>
                  <td style={{ padding: '11px 14px', fontSize: 11, color: 'var(--mm-text-muted)' }}>
                    {i.expires_at ? new Date(i.expires_at).toLocaleDateString('ja-JP') : '無期限'}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    {expired ? <span style={{ fontSize: 10, color: '#6b7280' }}>期限切れ</span>
                      : usedUp ? <span style={{ fontSize: 10, color: '#6b7280' }}>使用済</span>
                      : i.is_active ? <span style={{ fontSize: 10, fontWeight: 700, color: '#065f46', background: '#d1fae5', padding: '2px 8px', borderRadius: 999 }}>有効</span>
                      : <span style={{ fontSize: 10, color: '#6b7280' }}>無効</span>}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => toggle(i.id, !i.is_active)} disabled={pending} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--mm-border)', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                        {i.is_active ? '無効化' : '有効化'}
                      </button>
                      <button onClick={() => remove(i.id)} disabled={pending} style={{ padding: '4px 8px', background: 'transparent', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 6, cursor: 'pointer' }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
