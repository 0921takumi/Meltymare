'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Mail, AlertCircle } from 'lucide-react'

interface Inquiry {
  id: string
  name: string
  email: string
  subject: string
  body: string
  category: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  resolution_note: string | null
  resolved_at: string | null
  created_at: string
  user: { display_name: string; avatar_url: string | null } | null
}

export default function InquiryRow({ inquiry: i, statusLabel, priorityPalette, isLast }: {
  inquiry: Inquiry
  statusLabel: string
  priorityPalette: { bg: string; color: string }
  isLast: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState(i.resolution_note ?? '')
  const [pending, start] = useTransition()

  const updateStatus = (status: Inquiry['status']) => {
    start(async () => {
      const res = await fetch('/api/inquiry', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: i.id, status, resolution_note: status === 'resolved' || status === 'closed' ? note : null }),
      })
      if (res.ok) router.refresh()
    })
  }

  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--mm-border)' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12,
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999, ...priorityPalette }}>
          {i.priority === 'urgent' && <AlertCircle size={9} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />}
          {i.priority.toUpperCase()}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#f3f4f6', color: 'var(--mm-text-sub)' }}>
          {i.category}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.subject}</p>
          <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 2 }}>
            {i.name} ({i.email}) · {new Date(i.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
          background: i.status === 'open' ? '#fee2e2' : i.status === 'in_progress' ? '#fef3c7' : i.status === 'resolved' ? '#d1fae5' : '#f3f4f6',
          color: i.status === 'open' ? '#991b1b' : i.status === 'in_progress' ? '#92400e' : i.status === 'resolved' ? '#065f46' : '#6b7280',
        }}>{statusLabel}</span>
        <ChevronRight size={14} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', color: 'var(--mm-text-muted)' }} />
      </button>

      {open && (
        <div style={{ padding: '0 18px 18px 18px', background: 'var(--mm-bg)' }}>
          <div style={{ padding: 14, background: 'white', borderRadius: 8, border: '1px solid var(--mm-border)' }}>
            <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Mail size={11} />本文
            </p>
            <p style={{ fontSize: 13, color: 'var(--mm-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{i.body}</p>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-text-sub)' }}>対応メモ</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="解決時の対応内容を記録"
              style={{ width: '100%', marginTop: 4, padding: '10px 12px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {i.status !== 'in_progress' && (
              <button onClick={() => updateStatus('in_progress')} disabled={pending} style={{ padding: '7px 14px', background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>対応中にする</button>
            )}
            {i.status !== 'resolved' && (
              <button onClick={() => updateStatus('resolved')} disabled={pending} style={{ padding: '7px 14px', background: '#059669', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>解決として記録</button>
            )}
            {i.status !== 'closed' && (
              <button onClick={() => updateStatus('closed')} disabled={pending} style={{ padding: '7px 14px', background: 'transparent', color: 'var(--mm-text-sub)', border: '1px solid var(--mm-border)', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>クローズ</button>
            )}
            <a href={`mailto:${i.email}?subject=Re: ${encodeURIComponent(i.subject)}`} style={{ padding: '7px 14px', background: 'var(--mm-primary)', color: 'white', borderRadius: 6, fontSize: 11, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Mail size={11} />返信メール作成
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
