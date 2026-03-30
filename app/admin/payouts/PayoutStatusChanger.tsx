'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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
    setSaving(true)
    const supabase = createClient()
    const update: any = { status: next }
    if (next === 'completed') update.paid_at = new Date().toISOString()
    await supabase.from('payouts').update(update).eq('id', payoutId)
    setStatus(next)
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
