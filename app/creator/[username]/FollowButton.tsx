'use client'
import { useState } from 'react'
import { Heart } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  creatorId: string
  isFollowing: boolean
  isLoggedIn: boolean
  followerCount: number
}

export default function FollowButton({ creatorId, isFollowing: initialFollowing, isLoggedIn, followerCount: initialCount }: Props) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const toggle = async () => {
    if (!isLoggedIn) { router.push('/auth/login'); return }
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/follow', {
        method: isFollowing ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creator_id: creatorId }),
      })
      if (res.ok) {
        const next = !isFollowing
        setIsFollowing(next)
        setCount(c => next ? c + 1 : Math.max(0, c - 1))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '12px 22px',
        borderRadius: 999,
        border: `1.5px solid ${isFollowing ? 'var(--mm-primary)' : 'var(--mm-border)'}`,
        background: isFollowing ? 'var(--mm-primary-light)' : 'white',
        color: isFollowing ? 'var(--mm-primary)' : 'var(--mm-text-sub)',
        fontWeight: 700,
        fontSize: 13,
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s, color 0.2s, border-color 0.2s',
        flexShrink: 0,
      }}
    >
      <Heart size={15} fill={isFollowing ? 'var(--mm-primary)' : 'none'} color={isFollowing ? 'var(--mm-primary)' : 'var(--mm-text-muted)'} />
      {isFollowing ? 'フォロー中' : 'フォロー'}
      <span style={{ fontSize: 12, opacity: 0.7 }}>{count}</span>
    </button>
  )
}
