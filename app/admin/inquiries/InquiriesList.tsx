'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const CATEGORY_LABELS: Record<string, string> = {
  general: '一般',
  bug: '不具合',
  payment: '決済',
  account: 'アカウント',
  creator: 'クリエイター',
  other: 'その他',
}
const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: '未対応', color: '#dc2626', bg: '#fef2f2' },
  in_progress: { label: '対応中', color: '#d97706', bg: '#fffbeb' },
  resolved: { label: '解決', color: '#059669', bg: '#ecfdf5' },
}

export default function InquiriesList({ messages, currentStatus }: { messages: any[]; currentStatus: string }) {
  const router = useRouter()
  const [selected, setSelected] = useState<any | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [saving, setSaving] = useState(false)

  const open = (m: any) => {
    setSelected(m)
    setAdminNote(m.admin_note ?? '')
  }

  const updateStatus = async (id: string, newStatus: string) => {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('contact_messages').update({ status: newStatus, admin_note: adminNote }).eq('id', id)
    setSaving(false)
    setSelected(null)
    router.refresh()
  }

  const tabs = [
    { key: 'all', label: 'すべて' },
    { key: 'new', label: '未対応' },
    { key: 'in_progress', label: '対応中' },
    { key: 'resolved', label: '解決' },
  ]

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <Link key={t.key} href={t.key === 'all' ? '/admin/inquiries' : `/admin/inquiries?status=${t.key}`}
            style={{
              padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
              background: currentStatus === t.key ? 'var(--mm-primary)' : 'white',
              color: currentStatus === t.key ? 'white' : 'var(--mm-text-sub)',
              border: '1px solid var(--mm-border)', textDecoration: 'none',
            }}>{t.label}</Link>
        ))}
      </div>

      <div className="mm-card" style={{ padding: 0, overflow: 'hidden' }}>
        {messages.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--mm-text-muted)' }}>該当する問い合わせはありません</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '1px solid var(--mm-border)' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>状態</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>カテゴリ</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>件名</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>送信者</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>日時</th>
              </tr>
            </thead>
            <tbody>
              {messages.map(m => {
                const s = STATUS_LABELS[m.status] ?? STATUS_LABELS.new
                return (
                  <tr key={m.id} onClick={() => open(m)}
                    style={{ borderBottom: '1px solid var(--mm-border)', cursor: 'pointer' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: s.color, background: s.bg }}>{s.label}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--mm-text-sub)' }}>{CATEGORY_LABELS[m.category] ?? m.category}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{m.subject}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--mm-text-sub)' }}>{m.name}<br /><span style={{ fontSize: 11 }}>{m.email}</span></td>
                    <td style={{ padding: '10px 14px', color: 'var(--mm-text-muted)', fontSize: 12 }}>{new Date(m.created_at).toLocaleString('ja-JP')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 詳細モーダル */}
      {selected && (
        <div onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'white', borderRadius: 12, maxWidth: 640, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700 }}>{selected.subject}</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 8, fontSize: 13, marginBottom: 16 }}>
              <div style={{ color: 'var(--mm-text-muted)' }}>カテゴリ</div><div>{CATEGORY_LABELS[selected.category]}</div>
              <div style={{ color: 'var(--mm-text-muted)' }}>送信者</div><div>{selected.name}</div>
              <div style={{ color: 'var(--mm-text-muted)' }}>メール</div><div><a href={`mailto:${selected.email}`} style={{ color: 'var(--mm-primary)' }}>{selected.email}</a></div>
              <div style={{ color: 'var(--mm-text-muted)' }}>日時</div><div>{new Date(selected.created_at).toLocaleString('ja-JP')}</div>
            </div>
            <div style={{ background: '#fafafa', padding: 16, borderRadius: 8, fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.7, marginBottom: 18 }}>
              {selected.message}
            </div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--mm-text-sub)' }}>管理メモ</label>
            <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={3}
              style={{ width: '100%', padding: 10, border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 13, marginBottom: 12, boxSizing: 'border-box', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => updateStatus(selected.id, 'new')} disabled={saving}
                style={{ padding: '8px 16px', border: '1px solid var(--mm-border)', borderRadius: 8, background: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>未対応に戻す</button>
              <button onClick={() => updateStatus(selected.id, 'in_progress')} disabled={saving}
                style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#d97706', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>対応中にする</button>
              <button onClick={() => updateStatus(selected.id, 'resolved')} disabled={saving}
                style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#059669', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>解決済みにする</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
