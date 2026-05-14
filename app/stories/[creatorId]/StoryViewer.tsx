'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface Story {
  id: string
  media_url: string
  media_type: 'image' | 'video'
  caption: string | null
  created_at: string
  view_count: number
}

interface Creator {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
}

const STORY_DURATION = 5000 // 5秒

export default function StoryViewer({ creator, stories, viewerId }: { creator: Creator; stories: Story[]; viewerId: string | null }) {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const startRef = useRef(0)
  const pausedRef = useRef(false)

  // 既読登録
  useEffect(() => {
    if (!viewerId) return
    fetch('/api/story-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ story_id: stories[index].id }),
    }).catch(() => {})
  }, [index, stories, viewerId])

  // プログレスバー
  useEffect(() => {
    startRef.current = Date.now()
    let firstTick = true
    const interval = setInterval(() => {
      if (firstTick) { setProgress(0); firstTick = false; return }
      if (pausedRef.current) return
      const elapsed = Date.now() - startRef.current
      const pct = Math.min(100, (elapsed / STORY_DURATION) * 100)
      setProgress(pct)
      if (pct >= 100) {
        clearInterval(interval)
        if (index < stories.length - 1) setIndex(index + 1)
        else router.push('/stories')
      }
    }, 50)
    return () => clearInterval(interval)
  }, [index, stories.length, router])

  const story = stories[index]

  const next = () => index < stories.length - 1 ? setIndex(index + 1) : router.push('/stories')
  const prev = () => index > 0 && setIndex(index - 1)

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 420, height: '100%', maxHeight: 800, background: '#000', overflow: 'hidden' }}>
        {/* プログレスバー */}
        <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', gap: 4, zIndex: 10 }}>
          {stories.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: i < index ? '100%' : i === index ? `${progress}%` : '0%',
                background: 'white',
                transition: i === index ? 'none' : 'width 0.2s',
              }} />
            </div>
          ))}
        </div>

        {/* ヘッダー */}
        <div style={{ position: 'absolute', top: 28, left: 12, right: 12, display: 'flex', alignItems: 'center', gap: 10, zIndex: 10 }}>
          <Link href={`/creator/${creator.username}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: '2px solid white' }}>
              {creator.avatar_url ? <img src={creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ background: 'var(--mm-primary)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>{creator.display_name[0]}</div>}
            </div>
            <div>
              <p style={{ fontSize: 12, color: 'white', fontWeight: 700 }}>{creator.display_name}</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{new Date(story.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </Link>
          <Link href="/stories" style={{ marginLeft: 'auto', color: 'white', display: 'inline-flex' }}><X size={20} /></Link>
        </div>

        {/* メディア */}
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseDown={() => { pausedRef.current = true }}
          onMouseUp={() => { pausedRef.current = false; startRef.current = Date.now() - (progress / 100) * STORY_DURATION }}
          onTouchStart={() => { pausedRef.current = true }}
          onTouchEnd={() => { pausedRef.current = false; startRef.current = Date.now() - (progress / 100) * STORY_DURATION }}
        >
          {story.media_type === 'image' ? (
            <img src={story.media_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          ) : (
            <video src={story.media_url} autoPlay muted playsInline style={{ maxWidth: '100%', maxHeight: '100%' }} />
          )}
        </div>

        {/* キャプション */}
        {story.caption && (
          <div style={{ position: 'absolute', bottom: 60, left: 16, right: 16, padding: '10px 14px', background: 'rgba(0,0,0,0.6)', borderRadius: 12, color: 'white', fontSize: 13, lineHeight: 1.5 }}>
            {story.caption}
          </div>
        )}

        {/* 左右ナビゲーション */}
        <button onClick={prev} disabled={index === 0} style={{ position: 'absolute', left: 0, top: 60, bottom: 60, width: '30%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', paddingLeft: 4, color: index === 0 ? 'transparent' : 'rgba(255,255,255,0.6)' }} aria-label="前へ">
          <ChevronLeft size={28} />
        </button>
        <button onClick={next} style={{ position: 'absolute', right: 0, top: 60, bottom: 60, width: '30%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4, color: 'rgba(255,255,255,0.6)' }} aria-label="次へ">
          <ChevronRight size={28} />
        </button>
      </div>
    </div>
  )
}
