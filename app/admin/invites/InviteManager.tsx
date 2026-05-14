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
      <button onClick={() => setShowForm(!showForm)} disabled={pending} className="admin-btn" style={{ marginBottom: 18 }}>
        <Plus size={14} />招待コードを発行
      </button>

      {showForm && (
        <div style={{ background: 'white', border: '1px solid var(--mm-border)', borderRadius: 12, padding: 24, marginBottom: 22 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--mm-text-sub)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 18, height: 1, background: 'var(--mm-primary)' }} />
            New invite
          </p>
          <div className="invite-form-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
            <div className="admin-field" style={{ marginBottom: 0 }}>
              <label className="admin-label">メモ（誰に渡したか）</label>
              <input value={note} onChange={e => setNote(e.target.value)}
                className="admin-input" placeholder="例: ナオト氏" />
            </div>
            <div className="admin-field" style={{ marginBottom: 0 }}>
              <label className="admin-label">使用回数上限</label>
              <input type="number" value={maxUses} onChange={e => setMaxUses(Number(e.target.value))} min={1} max={100}
                className="admin-input" />
            </div>
            <div className="admin-field" style={{ marginBottom: 0 }}>
              <label className="admin-label">有効期間（日）</label>
              <input type="number" value={days} onChange={e => setDays(Number(e.target.value))} min={1}
                className="admin-input" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={create} disabled={pending} className="admin-btn">発行</button>
            <button onClick={() => setShowForm(false)} className="admin-btn admin-btn-ghost">キャンセル</button>
          </div>
          <style>{`@media (max-width: 700px) { .invite-form-grid { grid-template-columns: 1fr !important; } }`}</style>
        </div>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table admin-table-mobile-card">
          <thead>
            <tr>
              <th>コード</th>
              <th>メモ</th>
              <th className="num">使用</th>
              <th>有効期限</th>
              <th>状態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {invites.map(i => {
              const expired = i.expires_at && new Date(i.expires_at) < new Date()
              const usedUp = i.used_count >= i.max_uses
              return (
                <tr key={i.id} style={{ opacity: i.is_active && !expired && !usedUp ? 1 : 0.55 }}>
                  <td data-label="コード" style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--mm-ink)' }}>
                    {i.code}
                    <button onClick={() => copy(i.code)} style={{ marginLeft: 8, padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: copiedCode === i.code ? '#065f46' : 'var(--mm-text-muted)' }} title="コピー">
                      <Copy size={12} />
                    </button>
                  </td>
                  <td data-label="メモ" style={{ color: 'var(--mm-text-sub)' }}>{i.note ?? '—'}</td>
                  <td data-label="使用" className="num" style={{ fontWeight: 700, color: 'var(--mm-ink)' }}>{i.used_count} / {i.max_uses}</td>
                  <td data-label="有効期限" style={{ fontSize: 11, color: 'var(--mm-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {i.expires_at ? new Date(i.expires_at).toLocaleDateString('ja-JP') : '無期限'}
                  </td>
                  <td data-label="状態">
                    {expired ? <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 700 }}>期限切れ</span>
                      : usedUp ? <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 700 }}>使用済</span>
                      : i.is_active ? <span style={{ fontSize: 10, fontWeight: 700, color: '#065f46', background: '#d1fae5', padding: '3px 9px', borderRadius: 999 }}>有効</span>
                      : <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 700 }}>無効</span>}
                  </td>
                  <td data-label="操作">
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => toggle(i.id, !i.is_active)} disabled={pending} className="admin-btn admin-btn-secondary" style={{ padding: '5px 11px', fontSize: 11 }}>
                        {i.is_active ? '無効化' : '有効化'}
                      </button>
                      <button onClick={() => remove(i.id)} disabled={pending} className="admin-btn admin-btn-secondary" style={{ padding: '5px 9px', color: '#dc2626', borderColor: '#fecaca' }} title="削除">
                        <Trash2 size={12} />
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
