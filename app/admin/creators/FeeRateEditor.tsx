'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function FeeRateEditor({ creatorId, currentRate }: { creatorId: string; currentRate: number }) {
  const [rate, setRate] = useState(currentRate)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ fee_rate: rate }).eq('id', creatorId)
    setSaving(false)
    setEditing(false)
  }

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'var(--mm-primary-light)', color: 'var(--mm-primary)',
        border: 'none', borderRadius: 6, padding: '4px 10px',
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
      }}>
        {rate}%
        <span style={{ fontSize: 10, opacity: 0.7 }}>編集</span>
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        type="number" min={0} max={100} value={rate}
        onChange={e => setRate(Number(e.target.value))}
        style={{ width: 56, padding: '4px 8px', border: '1px solid var(--mm-border)', borderRadius: 6, fontSize: 13, fontWeight: 700 }}
      />
      <span style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>%</span>
      <button onClick={save} disabled={saving} style={{
        background: 'var(--mm-primary)', color: 'white', border: 'none',
        borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
      }}>
        {saving ? '...' : '保存'}
      </button>
      <button onClick={() => { setRate(currentRate); setEditing(false) }} style={{
        background: 'none', border: 'none', color: 'var(--mm-text-muted)', fontSize: 12, cursor: 'pointer',
      }}>
        取消
      </button>
    </div>
  )
}
