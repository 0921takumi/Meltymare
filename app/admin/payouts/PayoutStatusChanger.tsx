'use client'
import { useState } from 'react'

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: '振込待ち',   color: '#d97706', bg: '#fef3c7' },
  processing: { label: '処理中',     color: '#2563eb', bg: '#dbeafe' },
  completed:  { label: '振込済み',   color: '#059669', bg: '#d1fae5' },
  failed:     { label: '失敗',       color: '#dc2626', bg: '#fee2e2' },
}

export default function PayoutStatusChanger({ payoutId, currentStatus }: { payoutId: string; currentStatus: string }) {
  const [status, setStatus] = useState(currentStatus)
  const [saving, setSaving] = useState(false)

  const onChange = async (next: string) => {
    const prev = status
    setSaving(true)
    setStatus(next) // 楽観的更新
    // payouts には UPDATE の RLS が無いため admin 経由の API で更新する
    const res = await fetch('/api/admin-payout', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payout_id: payoutId, status: next }),
    })
    if (!res.ok) {
      setStatus(prev) // 失敗時はロールバック
      alert('出金ステータスの更新に失敗しました')
    }
    setSaving(false)
  }

  const s = STATUS_LABELS[status] ?? STATUS_LABELS.pending
  return (
    <select
      value={status}
      onChange={e => onChange(e.target.value)}
      disabled={saving}
      style={{ background: s.bg, color: s.color, border: 'none', borderRadius: 6,
        padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
    >
      {Object.entries(STATUS_LABELS).map(([v, { label }]) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  )
}
