'use client'

import { useTransition } from 'react'
import { moderateContent, type ModerationAction } from './actions'

export default function ModerationButtons({ contentId, currentStatus, isPublished }: { contentId: string; currentStatus: string; isPublished: boolean }) {
  const [pending, start] = useTransition()

  const go = (action: ModerationAction, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return
    start(async () => {
      const res = await moderateContent(contentId, action)
      if ((res as { error?: string }).error) alert((res as { error: string }).error)
    })
  }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {currentStatus !== 'approved' && (
        <button
          onClick={() => go('approve')}
          disabled={pending}
          style={{ background: '#059669', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: pending ? 'wait' : 'pointer' }}
        >✓ 承認・公開</button>
      )}
      {currentStatus !== 'rejected' && (
        <button
          onClick={() => go('reject', '却下して非公開にします。よろしいですか？')}
          disabled={pending}
          style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: pending ? 'wait' : 'pointer' }}
        >✗ 却下</button>
      )}
      {isPublished && currentStatus === 'approved' && (
        <button
          onClick={() => go('unpublish', '公開を停止します。よろしいですか？')}
          disabled={pending}
          style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: pending ? 'wait' : 'pointer' }}
        >⏸ 非公開化</button>
      )}
    </div>
  )
}
