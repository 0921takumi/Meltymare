'use client'

import { useState } from 'react'
import PollCard, { type PollCardData } from './PollCard'

export interface ManagedPoll extends PollCardData {
  counts: number[]
}

export default function CreatorPollList({ initialPolls }: { initialPolls: ManagedPoll[] }) {
  const [polls, setPolls] = useState<ManagedPoll[]>(initialPolls)
  const [busy, setBusy] = useState<string | null>(null)

  const setStatus = async (id: string, status: 'open' | 'closed') => {
    setBusy(id)
    try {
      const res = await fetch('/api/poll', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) setPolls((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)))
    } finally {
      setBusy(null)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm('このアンケートを削除しますか？投票結果も削除されます。')) return
    setBusy(id)
    try {
      const res = await fetch('/api/poll', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) setPolls((prev) => prev.filter((p) => p.id !== id))
    } finally {
      setBusy(null)
    }
  }

  if (polls.length === 0) {
    return (
      <p style={{ fontSize: 14, color: 'var(--mm-text-muted)', textAlign: 'center', padding: '32px 0' }}>
        まだアンケートはありません。上のフォームから作成できます。
      </p>
    )
  }

  const btn = {
    padding: '7px 14px', fontSize: 12.5, fontWeight: 700, borderRadius: 8,
    border: '1px solid var(--mm-border)', background: 'var(--mm-bg)', cursor: 'pointer',
  } as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {polls.map((p) => (
        <div key={p.id}>
          <PollCard poll={p} counts={p.counts} userVotedIndex={null} isLoggedIn={false} readOnly />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            {p.status === 'open' ? (
              <button style={btn} disabled={busy === p.id} onClick={() => setStatus(p.id, 'closed')}>締め切る</button>
            ) : (
              <button style={btn} disabled={busy === p.id} onClick={() => setStatus(p.id, 'open')}>再開する</button>
            )}
            <button style={{ ...btn, color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2' }} disabled={busy === p.id} onClick={() => remove(p.id)}>
              削除
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
