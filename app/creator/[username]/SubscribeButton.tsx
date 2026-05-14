'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function SubscribeButton({ planId, color }: { planId: string; color: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const subscribe = () => {
    if (!confirm('このプランに加入しますか？※ 現在は実決済なし、デモ加入のみ')) return
    start(async () => {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId }),
      })
      if (res.ok) router.refresh()
      else {
        const j = await res.json().catch(() => ({}))
        alert(j.error === 'already_subscribed' ? '既に加入中です' : '加入に失敗しました')
      }
    })
  }

  return (
    <button
      type="button"
      onClick={subscribe}
      disabled={pending}
      style={{
        width: '100%', padding: '8px 12px', background: color, color: 'white',
        border: 'none', borderRadius: 999, fontSize: 12, fontWeight: 700,
        cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? '加入中...' : 'プランに加入'}
    </button>
  )
}
