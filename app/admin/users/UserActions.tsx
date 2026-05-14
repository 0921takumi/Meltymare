'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'

interface User {
  id: string
  display_name: string
  is_suspended: boolean
  role: string
}

export default function UserActions({ user }: { user: User }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  const toggleSuspend = () => {
    const reason = user.is_suspended ? null : prompt('凍結理由を入力')
    if (!user.is_suspended && !reason) return
    start(async () => {
      const res = await fetch('/api/admin-user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, is_suspended: !user.is_suspended, suspended_reason: reason }),
      })
      if (res.ok) { setOpen(false); router.refresh() }
    })
  }

  const changeRole = (newRole: string) => {
    if (!confirm(`ロールを「${newRole}」に変更しますか？`)) return
    start(async () => {
      const res = await fetch('/api/admin-user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, role: newRole }),
      })
      if (res.ok) { setOpen(false); router.refresh() }
    })
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} disabled={pending} style={{ background: 'transparent', border: '1px solid var(--mm-border)', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'white', border: '1px solid var(--mm-border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 160, zIndex: 10 }}>
          <button onClick={toggleSuspend} style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', textAlign: 'left', fontSize: 12, color: user.is_suspended ? '#059669' : '#dc2626', fontWeight: 600, cursor: 'pointer' }}>
            {user.is_suspended ? '凍結解除' : 'アカウント凍結'}
          </button>
          {user.role !== 'creator' && (
            <button onClick={() => changeRole('creator')} style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', textAlign: 'left', fontSize: 12, cursor: 'pointer' }}>クリエイターに昇格</button>
          )}
          {user.role !== 'user' && user.role !== 'admin' && (
            <button onClick={() => changeRole('user')} style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', textAlign: 'left', fontSize: 12, cursor: 'pointer' }}>一般ユーザーに戻す</button>
          )}
        </div>
      )}
    </div>
  )
}
