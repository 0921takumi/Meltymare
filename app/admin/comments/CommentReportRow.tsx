'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, EyeOff, CheckCircle, XCircle } from 'lucide-react'

interface Report {
  id: string
  reason: string
  detail: string | null
  status: string
  created_at: string
  comment: {
    id: string
    body: string
    is_hidden: boolean
    content_id: string
    user: { id: string; display_name: string; username: string; avatar_url: string | null } | null
  } | null
  reporter: { id: string; display_name: string; username: string } | null
}

export default function CommentReportRow({ report: r, reasonLabel, isLast }: { report: Report; reasonLabel: string; isLast: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  const action = (kind: 'hide' | 'dismiss' | 'resolve') => {
    if (kind === 'hide' && !confirm('このコメントを非表示にしますか？')) return
    start(async () => {
      const res = await fetch('/api/admin-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: r.id, comment_id: r.comment?.id, action: kind }),
      })
      if (res.ok) router.refresh()
    })
  }

  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--mm-border)' }}>
      <button onClick={() => setOpen(!open)} style={{ width: '100%', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#fee2e2', color: '#991b1b' }}>{reasonLabel}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>「{r.comment?.body}」</p>
          <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 2 }}>
            投稿者: {r.comment?.user?.display_name ?? '—'} · 通報者: {r.reporter?.display_name ?? '—'} · {new Date(r.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit' })}
          </p>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
          background: r.status === 'pending' ? '#fee2e2' : r.status === 'resolved' ? '#d1fae5' : '#f3f4f6',
          color: r.status === 'pending' ? '#991b1b' : r.status === 'resolved' ? '#065f46' : '#6b7280',
        }}>{r.status}</span>
        <ChevronRight size={14} style={{ transform: open ? 'rotate(90deg)' : 'none', color: 'var(--mm-text-muted)' }} />
      </button>

      {open && (
        <div style={{ padding: '0 18px 18px 18px', background: 'var(--mm-bg)' }}>
          <div style={{ padding: 14, background: 'white', borderRadius: 8, border: '1px solid var(--mm-border)' }}>
            <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 6 }}>通報されたコメント</p>
            <p style={{ fontSize: 13, color: r.comment?.is_hidden ? 'var(--mm-text-muted)' : 'var(--mm-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', textDecoration: r.comment?.is_hidden ? 'line-through' : 'none' }}>{r.comment?.body}</p>
            {r.comment?.user && (
              <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 8 }}>
                投稿者: <Link href={`/creator/${r.comment.user.username}`} style={{ color: 'var(--mm-primary)' }}>{r.comment.user.display_name}</Link>
                {' · '}
                <Link href={`/contents/${r.comment.content_id}`} style={{ color: 'var(--mm-primary)' }}>コンテンツへ</Link>
              </p>
            )}
            {r.detail && <p style={{ fontSize: 11, color: 'var(--mm-text-sub)', marginTop: 10, padding: 10, background: 'var(--mm-bg)', borderRadius: 6 }}>通報詳細: {r.detail}</p>}
          </div>

          {r.status === 'pending' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button onClick={() => action('hide')} disabled={pending || r.comment?.is_hidden} style={{ padding: '7px 14px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <EyeOff size={11} />コメントを非表示
              </button>
              <button onClick={() => action('resolve')} disabled={pending} style={{ padding: '7px 14px', background: '#059669', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle size={11} />対応済として記録
              </button>
              <button onClick={() => action('dismiss')} disabled={pending} style={{ padding: '7px 14px', background: 'transparent', color: 'var(--mm-text-sub)', border: '1px solid var(--mm-border)', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <XCircle size={11} />却下
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
