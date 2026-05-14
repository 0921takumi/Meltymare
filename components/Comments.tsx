'use client'

import { useState, useTransition } from 'react'
import { Heart, MessageCircle, Send, Trash2 } from 'lucide-react'

export interface CommentItem {
  id: string
  body: string
  created_at: string
  user: { id: string; display_name: string; avatar_url: string | null; username: string } | null
  likes: number
  liked_by_me: boolean
  replies?: CommentItem[]
}

interface Props {
  contentId: string
  comments: CommentItem[]
  currentUserId: string | null
}

export default function Comments({ contentId, comments: initial, currentUserId }: Props) {
  const [comments, setComments] = useState<CommentItem[]>(initial)
  const [text, setText] = useState('')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!text.trim() || !currentUserId) return
    start(async () => {
      setError(null)
      const res = await fetch('/api/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_id: contentId, body: text }),
      })
      if (!res.ok) {
        setError('送信に失敗しました')
        return
      }
      const json = await res.json()
      setComments([{
        id: json.comment.id,
        body: json.comment.body,
        created_at: json.comment.created_at,
        user: { id: currentUserId, display_name: 'あなた', avatar_url: null, username: '' },
        likes: 0,
        liked_by_me: false,
      }, ...comments])
      setText('')
    })
  }

  const toggleLike = (id: string) => {
    if (!currentUserId) return
    start(async () => {
      const res = await fetch('/api/comment-like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: id }),
      })
      if (!res.ok) return
      const j = await res.json()
      setComments(prev => prev.map(c => c.id === id ? { ...c, liked_by_me: j.liked, likes: c.likes + (j.liked ? 1 : -1) } : c))
    })
  }

  const remove = (id: string) => {
    if (!confirm('コメントを削除しますか？')) return
    start(async () => {
      const res = await fetch(`/api/comment?id=${id}`, { method: 'DELETE' })
      if (res.ok) setComments(prev => prev.filter(c => c.id !== id))
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <MessageCircle size={18} color="var(--mm-primary)" />
        <h3 style={{ fontSize: 15, fontWeight: 700 }}>コメント</h3>
        <span style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>{comments.length}件</span>
      </div>

      {currentUserId ? (
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="コメントを書く…（500文字まで）"
            maxLength={500}
            rows={2}
            style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 13, resize: 'none', fontFamily: 'inherit' }}
          />
          <button
            onClick={submit}
            disabled={pending || !text.trim()}
            style={{
              padding: '0 18px', background: 'var(--mm-primary)', color: 'white',
              borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700,
              opacity: pending || !text.trim() ? 0.5 : 1, cursor: pending ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Send size={14} />送信
          </button>
        </div>
      ) : (
        <div style={{ padding: '12px 14px', background: 'var(--mm-bg)', borderRadius: 8, fontSize: 12, color: 'var(--mm-text-muted)', marginBottom: 18 }}>
          ログインするとコメントできます
        </div>
      )}

      {error && <div style={{ padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>{error}</div>}

      {comments.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', textAlign: 'center', padding: '40px 0' }}>まだコメントがありません</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--mm-primary-light)', overflow: 'hidden', flexShrink: 0 }}>
                {c.user?.avatar_url ? <img src={c.user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 14, fontWeight: 700 }}>{c.user?.display_name?.[0] ?? '?'}</div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 700 }}>{c.user?.display_name ?? '不明'}</p>
                  <p style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>{new Date(c.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <p style={{ fontSize: 13, marginTop: 4, color: 'var(--mm-text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.body}</p>
                <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                  <button
                    onClick={() => toggleLike(c.id)}
                    disabled={!currentUserId || pending}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', fontSize: 11, color: c.liked_by_me ? '#ec4899' : 'var(--mm-text-muted)', cursor: 'pointer', padding: 0 }}
                  >
                    <Heart size={12} fill={c.liked_by_me ? '#ec4899' : 'none'} />{c.likes}
                  </button>
                  {c.user?.id === currentUserId && (
                    <button onClick={() => remove(c.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', fontSize: 11, color: 'var(--mm-text-muted)', cursor: 'pointer', padding: 0 }}>
                      <Trash2 size={12} />削除
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
