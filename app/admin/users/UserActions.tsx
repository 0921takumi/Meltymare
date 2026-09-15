'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MoreHorizontal } from 'lucide-react'
import { apiErrorMessage, NETWORK_ERROR_MESSAGE } from '@/lib/api-error'

interface User {
  id: string
  display_name: string
  is_suspended: boolean
  role: string
  identity_status?: string | null
}

const IDENTITY_LABEL: Record<string, string> = {
  approved: '承認済み',
  pending: '審査待ち',
  rejected: '却下',
  unsubmitted: '未提出',
}

export default function UserActions({ user }: { user: User }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  // 結果は画面内に出す。以前は失敗時に何も表示せず「押しても反応しない」状態だった。
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const send = (body: Record<string, unknown>, okText: string) => {
    setMessage(null)
    start(async () => {
      try {
        const res = await fetch('/api/admin-user', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: user.id, ...body }),
        })
        if (!res.ok) {
          setMessage({ kind: 'error', text: await apiErrorMessage(res, '更新に失敗しました') })
          return
        }
        setMessage({ kind: 'ok', text: okText })
        setOpen(false)
        router.refresh()
      } catch {
        setMessage({ kind: 'error', text: NETWORK_ERROR_MESSAGE })
      }
    })
  }

  const toggleSuspend = () => {
    if (user.is_suspended) {
      if (!confirm(`「${user.display_name}」の凍結を解除しますか？`)) return
      send({ is_suspended: false, suspended_reason: null }, '凍結を解除しました')
      return
    }
    const reason = prompt(`「${user.display_name}」を凍結します。凍結理由を入力してください`)
    if (reason === null) return
    if (!reason.trim()) { setMessage({ kind: 'error', text: '凍結理由を入力してください' }); return }
    send({ is_suspended: true, suspended_reason: reason }, 'アカウントを凍結しました')
  }

  const changeRole = (newRole: 'creator' | 'user') => {
    const label = newRole === 'creator' ? 'クリエイター' : '一般ユーザー'
    if (!confirm(`「${user.display_name}」を${label}に変更しますか？`)) return
    send({ role: newRole }, `${label}に変更しました`)
  }

  const identity = user.identity_status ?? 'unsubmitted'
  const canPromote = identity === 'approved'

  const itemStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', background: 'transparent', border: 'none',
    textAlign: 'left', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setMessage(null) }}
        disabled={pending}
        aria-expanded={open}
        aria-label="操作メニュー"
        style={{ background: 'white', border: '1px solid var(--mm-border)', borderRadius: 6, padding: '6px 8px', cursor: pending ? 'wait' : 'pointer', display: 'flex', alignItems: 'center' }}
      >
        <MoreHorizontal size={16} />
      </button>

      {/* 表の枠(.admin-table-wrap)は横スクロールのため overflow が効いており、浮かせたメニューは
          下の行やスマホのカードの外にはみ出した部分が切れて押せなくなる。行の中に展開する。 */}
      {open && (
        <div role="menu" style={{ background: 'white', border: '1px solid var(--mm-border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', minWidth: 220, overflow: 'hidden' }}>
          <button type="button" role="menuitem" onClick={toggleSuspend} disabled={pending}
            style={{ ...itemStyle, color: user.is_suspended ? '#065f46' : '#b91c1c', fontWeight: 700 }}>
            {user.is_suspended ? '凍結解除' : 'アカウント凍結'}
          </button>

          {user.role === 'user' && (
            canPromote ? (
              <button type="button" role="menuitem" onClick={() => changeRole('creator')} disabled={pending}
                style={{ ...itemStyle, color: 'var(--mm-ink)', borderTop: '1px solid var(--mm-border)' }}>
                クリエイターに昇格
              </button>
            ) : (
              // 本人確認が承認されていないと API が拒否する（年齢・身元確認のため）。
              // 押せるのに失敗するボタンは置かず、理由と次の手順を先に見せる。
              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--mm-border)', fontSize: 12, lineHeight: 1.6, color: '#334155', whiteSpace: 'normal', maxWidth: 260 }}>
                <p style={{ fontWeight: 700, color: 'var(--mm-ink)', marginBottom: 2 }}>クリエイターに昇格できません</p>
                <p>本人確認が「{IDENTITY_LABEL[identity] ?? identity}」です。本人確認が承認されると、自動でクリエイターになります。</p>
                {identity === 'pending' && (
                  <Link href="/admin/verifications" style={{ display: 'inline-block', marginTop: 4, color: 'var(--mm-primary)', fontWeight: 700 }}>本人確認の審査へ →</Link>
                )}
              </div>
            )
          )}

          {user.role === 'creator' && (
            <button type="button" role="menuitem" onClick={() => changeRole('user')} disabled={pending}
              style={{ ...itemStyle, color: 'var(--mm-ink)', borderTop: '1px solid var(--mm-border)' }}>
              一般ユーザーに戻す
            </button>
          )}
        </div>
      )}

      {pending && <p style={{ fontSize: 12, color: '#334155' }}>処理中…</p>}
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} style={{
          fontSize: 12, lineHeight: 1.6, maxWidth: 260, textAlign: 'left', padding: '8px 10px', borderRadius: 6,
          background: message.kind === 'error' ? '#fef2f2' : '#ecfdf5',
          color: message.kind === 'error' ? '#991b1b' : '#065f46',
          border: `1px solid ${message.kind === 'error' ? '#fecaca' : '#a7f3d0'}`,
        }}>{message.text}</p>
      )}
    </div>
  )
}
