'use client'

import { useState } from 'react'
import { Ban } from 'lucide-react'
import type { BlockRow } from './page'

export default function BlocksManager({ initialBlocks }: { initialBlocks: BlockRow[] }) {
  const [blocks, setBlocks] = useState<BlockRow[]>(initialBlocks)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const unblock = async (blockedUserId: string) => {
    setBusy(blockedUserId)
    setError('')
    try {
      const res = await fetch('/api/creator-block', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked_user_id: blockedUserId }),
      })
      if (res.ok) {
        setBlocks((prev) => prev.filter((b) => b.blocked_user_id !== blockedUserId))
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? '解除に失敗しました')
      }
    } catch {
      setError('解除に失敗しました')
    } finally {
      setBusy(null)
    }
  }

  if (blocks.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', background: 'var(--mm-surface)', border: '1px solid var(--mm-border)', borderRadius: 14 }}>
        <Ban size={32} color="var(--mm-text-muted)" style={{ marginBottom: 10 }} />
        <p style={{ fontSize: 14, color: 'var(--mm-text-muted)' }}>ブロック中の購入者はいません</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {error && (
        <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: 8 }}>{error}</p>
      )}
      {blocks.map((b) => (
        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'var(--mm-surface)', border: '1px solid var(--mm-border)', borderRadius: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: 'var(--mm-primary-light)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {b.avatar_url
              ? <img src={b.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 16, color: 'var(--mm-primary)' }}>{(b.display_name ?? '?').charAt(0)}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700 }}>{b.display_name ?? '名称未設定'}</p>
            <p style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>
              {b.username ? `@${b.username} ・ ` : ''}{new Date(b.created_at).toLocaleDateString('ja-JP')} ブロック
            </p>
            {b.reason && <p style={{ fontSize: 12, color: 'var(--mm-text-sub)', marginTop: 2 }}>理由: {b.reason}</p>}
          </div>
          <button
            onClick={() => unblock(b.blocked_user_id)}
            disabled={busy === b.blocked_user_id}
            style={{ padding: '8px 14px', fontSize: 13, fontWeight: 700, color: 'var(--mm-text-sub)', background: 'var(--mm-bg)', border: '1px solid var(--mm-border)', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {busy === b.blocked_user_id ? '解除中...' : '解除'}
          </button>
        </div>
      ))}
    </div>
  )
}
