'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BarChart3, Check } from 'lucide-react'

export interface PollCardData {
  id: string
  question: string
  options: string[]
  status: 'open' | 'closed'
  creator?: { display_name: string | null; username: string | null; avatar_url: string | null } | null
}

interface Props {
  poll: PollCardData
  /** 選択肢ごとの投票数（サーバー側で集計済み・個別票は含まない） */
  counts: number[]
  /** このユーザーが投票した選択肢index（未投票はnull） */
  userVotedIndex: number | null
  isLoggedIn: boolean
  /** フィードでクリエイター情報を出すか */
  showCreator?: boolean
  /** 結果のみ表示（投票・ログイン導線を出さない。クリエイターの管理ビュー用） */
  readOnly?: boolean
}

export default function PollCard({ poll, counts: initialCounts, userVotedIndex, isLoggedIn, showCreator, readOnly }: Props) {
  const [counts, setCounts] = useState<number[]>(initialCounts)
  const [voted, setVoted] = useState<number | null>(userVotedIndex)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const total = counts.reduce((a, b) => a + b, 0)
  const canVote = !readOnly && isLoggedIn && poll.status === 'open' && voted === null

  const vote = async (idx: number) => {
    if (!canVote || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/poll-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poll_id: poll.id, option_index: idx }),
      })
      if (res.ok) {
        setCounts((prev) => prev.map((c, i) => (i === idx ? c + 1 : c)))
        setVoted(idx)
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? '投票に失敗しました')
        if (res.status === 409) setVoted(idx)
      }
    } catch {
      setError('投票に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ background: 'var(--mm-surface)', border: '1px solid var(--mm-border)', borderRadius: 14, padding: 18 }}>
      {showCreator && poll.creator && (
        <Link href={`/creator/${poll.creator.username}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginBottom: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: 'var(--mm-primary-light)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {poll.creator.avatar_url
              ? <img src={poll.creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 13, color: 'var(--mm-primary)' }}>{(poll.creator.display_name ?? '?').charAt(0)}</span>}
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--mm-text)' }}>{poll.creator.display_name}</span>
        </Link>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 12 }}>
        <BarChart3 size={16} color="var(--mm-primary)" style={{ flexShrink: 0, marginTop: 3 }} />
        <h3 style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.5, wordBreak: 'break-word', minWidth: 0 }}>{poll.question}</h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {poll.options.map((opt, i) => {
          const c = counts[i] ?? 0
          const pct = total > 0 ? Math.round((c / total) * 100) : 0
          const isMine = voted === i

          if (canVote) {
            return (
              <button
                key={i}
                onClick={() => vote(i)}
                disabled={busy}
                style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--mm-border)', background: 'var(--mm-bg)', fontSize: 14, fontWeight: 600, color: 'var(--mm-text)', cursor: busy ? 'wait' : 'pointer', wordBreak: 'break-word' }}
              >
                {opt}
              </button>
            )
          }

          return (
            <div key={i} style={{ position: 'relative', padding: '12px 14px', borderRadius: 10, border: `1px solid ${isMine ? 'var(--mm-primary)' : 'var(--mm-border)'}`, overflow: 'hidden', background: 'var(--mm-bg)' }}>
              <div style={{ position: 'absolute', insetBlock: 0, insetInlineStart: 0, width: `${pct}%`, background: isMine ? 'var(--mm-primary-light)' : 'var(--mm-accent-light)' }} />
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, wordBreak: 'break-word' }}>
                  {isMine && <Check size={14} color="var(--mm-primary)" style={{ flexShrink: 0 }} />}{opt}
                </span>
                <span style={{ fontSize: 13, color: 'var(--mm-text-sub)', fontWeight: 700, flexShrink: 0 }}>{pct}%</span>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>
          {total}票{poll.status === 'closed' ? ' ・ 締め切り' : voted !== null ? ' ・ 投票済み' : ''}
        </span>
        {error
          ? <span style={{ fontSize: 12, color: '#dc2626' }}>{error}</span>
          : (!readOnly && !isLoggedIn && poll.status === 'open' && (
              <Link href="/auth/login" style={{ fontSize: 12, color: 'var(--mm-primary)', fontWeight: 700, textDecoration: 'none' }}>ログインして投票</Link>
            ))}
      </div>
    </div>
  )
}
