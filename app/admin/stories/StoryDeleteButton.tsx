'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export default function StoryDeleteButton({ id }: { id: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const remove = () => {
    const reason = prompt('削除理由（クリエイターには通知されません）')
    if (reason === null) return
    start(async () => {
      const res = await fetch('/api/admin-story', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, reason }),
      })
      if (res.ok) router.refresh()
    })
  }

  return (
    <button onClick={remove} disabled={pending} style={{
      width: '100%', marginTop: 8, padding: '5px 8px', background: '#fee2e2',
      color: '#991b1b', border: '1px solid #fecaca', borderRadius: 6,
      fontSize: 10, fontWeight: 700, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    }}>
      <Trash2 size={10} />削除
    </button>
  )
}
