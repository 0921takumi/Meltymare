'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Check, Trash2, ShoppingBag, Package, Heart, Gift, MessageSquare, Info } from 'lucide-react'

const TYPE_ICONS: Record<string, any> = {
  purchase: ShoppingBag,
  delivery: Package,
  follow: Heart,
  tip: Gift,
  request: MessageSquare,
  system: Info,
}
const TYPE_COLORS: Record<string, string> = {
  purchase: '#059669',
  delivery: '#2563eb',
  follow: '#db2777',
  tip: '#d97706',
  request: '#7c3aed',
  system: '#6b7280',
}

export default function NotificationsList({ initial }: { initial: any[] }) {
  const [items, setItems] = useState(initial)
  const [busy, setBusy] = useState(false)

  const markAllRead = async () => {
    setBusy(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
      setItems(items.map(n => ({ ...n, read: true })))
    }
    setBusy(false)
  }

  const markOne = async (id: string) => {
    const supabase = createClient()
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setItems(items.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const deleteOne = async (id: string) => {
    const supabase = createClient()
    await supabase.from('notifications').delete().eq('id', id)
    setItems(items.filter(n => n.id !== id))
  }

  const unreadCount = items.filter(n => !n.read).length

  if (items.length === 0) {
    return (
      <div className="mm-card" style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
        <p style={{ color: 'var(--mm-text-muted)' }}>通知はまだありません</p>
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--mm-text-muted)' }}>未読 {unreadCount} 件 / 全 {items.length} 件</p>
        {unreadCount > 0 && (
          <button onClick={markAllRead} disabled={busy}
            style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: 'white', border: '1px solid var(--mm-border)', borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Check size={13} /> すべて既読
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(n => {
          const Icon = TYPE_ICONS[n.type] ?? Info
          const color = TYPE_COLORS[n.type] ?? '#6b7280'
          const Body = (
            <div className="mm-card" style={{
              padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
              background: n.read ? 'white' : '#fef3c7',
              borderLeft: `3px solid ${color}`,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{n.title}</p>
                {n.body && <p style={{ fontSize: 12, color: 'var(--mm-text-sub)', lineHeight: 1.6 }}>{n.body}</p>}
                <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 4 }}>{new Date(n.created_at).toLocaleString('ja-JP')}</p>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {!n.read && (
                  <button onClick={e => { e.preventDefault(); e.stopPropagation(); markOne(n.id) }}
                    title="既読にする"
                    style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mm-text-muted)' }}>
                    <Check size={14} />
                  </button>
                )}
                <button onClick={e => { e.preventDefault(); e.stopPropagation(); deleteOne(n.id) }}
                  title="削除"
                  style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mm-text-muted)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )
          return n.link ? (
            <Link key={n.id} href={n.link} onClick={() => !n.read && markOne(n.id)} style={{ textDecoration: 'none', color: 'inherit' }}>{Body}</Link>
          ) : (
            <div key={n.id}>{Body}</div>
          )
        })}
      </div>
    </>
  )
}
