'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Eye, Clock } from 'lucide-react'

interface Story {
  id: string
  media_url: string
  media_type: 'image' | 'video'
  caption: string | null
  view_count: number
  expires_at: string
  created_at: string
}

export default function StoryList({ stories: initial, expired }: { stories: Story[]; expired?: boolean }) {
  const router = useRouter()
  const [stories, setStories] = useState(initial)
  const [pending, start] = useTransition()

  const remove = (id: string) => {
    if (!confirm('このストーリーを削除しますか？')) return
    start(async () => {
      const res = await fetch(`/api/story?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setStories(prev => prev.filter(s => s.id !== id))
        router.refresh()
      }
    })
  }

  const hoursLeft = (iso: string) => {
    const ms = new Date(iso).getTime() - Date.now()
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60)))
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
      {stories.map(s => (
        <div key={s.id} style={{ position: 'relative', aspectRatio: '9/16', borderRadius: 10, overflow: 'hidden', background: '#000' }}>
          {s.media_type === 'image'
            ? <img src={s.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <video src={s.media_url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 0%, transparent 60%, rgba(0,0,0,0.7) 100%)' }} />
          <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, color: 'white' }}>
            <p style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Eye size={10} />{s.view_count}</p>
            {!expired && (
              <p style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8 }}><Clock size={10} />{hoursLeft(s.expires_at)}h</p>
            )}
            {s.caption && (
              <p style={{ fontSize: 10, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.caption}</p>
            )}
          </div>
          <button onClick={() => remove(s.id)} disabled={pending}
            style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
