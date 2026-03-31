'use client'
import { useState } from 'react'
import { Star } from 'lucide-react'

interface Review {
  id: string
  rating: number
  comment: string | null
  created_at: string
  user: { display_name: string }
}

interface Props {
  contentId: string
  reviews: Review[]
  canReview: boolean
  existingRating?: number
  existingComment?: string
}

function StarRating({ value, onChange, size = 24 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const [hovered, setHovered] = useState(0)
  const display = onChange ? (hovered || value) : value
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          fill={i <= display ? '#f59e0b' : 'none'}
          color={i <= display ? '#f59e0b' : '#d1d5db'}
          style={{ cursor: onChange ? 'pointer' : 'default', transition: 'all 0.1s' }}
          onMouseEnter={() => onChange && setHovered(i)}
          onMouseLeave={() => onChange && setHovered(0)}
          onClick={() => onChange?.(i)}
        />
      ))}
    </div>
  )
}

export default function ReviewSection({ contentId, reviews, canReview, existingRating = 0, existingComment = '' }: Props) {
  const [rating, setRating] = useState(existingRating)
  const [comment, setComment] = useState(existingComment)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [localReviews, setLocalReviews] = useState(reviews)

  const avgRating = localReviews.length
    ? localReviews.reduce((s, r) => s + r.rating, 0) / localReviews.length
    : 0

  const submit = async () => {
    if (!rating) { setError('星の評価を選択してください'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_id: contentId, rating, comment }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'エラーが発生しました'); return }
      setSubmitted(true)
      // ローカル更新
      setLocalReviews(prev => {
        const existing = prev.findIndex(r => r.id === data.id)
        if (existing >= 0) {
          const next = [...prev]
          next[existing] = { ...next[existing], rating, comment: comment || null }
          return next
        }
        return [data, ...prev]
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ marginTop: 48 }}>
      {/* 評価サマリー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>レビュー ({localReviews.length}件)</h2>
        {localReviews.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StarRating value={Math.round(avgRating)} size={18} />
            <span style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b' }}>{avgRating.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* レビュー投稿フォーム */}
      {canReview && (
        <div className="mm-card" style={{ padding: 20, marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
            {existingRating ? 'レビューを編集' : 'レビューを書く'}
          </p>
          {submitted ? (
            <p style={{ fontSize: 14, color: '#059669', fontWeight: 600 }}>✓ レビューを投稿しました</p>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <StarRating value={rating} onChange={setRating} size={28} />
              </div>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="コメント（任意）"
                rows={3}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 }}
              />
              {error && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 6 }}>{error}</p>}
              <button
                onClick={submit}
                disabled={submitting || !rating}
                style={{ marginTop: 10, padding: '9px 20px', background: 'var(--mm-primary)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: submitting ? 'not-allowed' : 'pointer', opacity: !rating ? 0.5 : 1 }}
              >
                {submitting ? '投稿中...' : '投稿する'}
              </button>
            </>
          )}
        </div>
      )}

      {/* レビュー一覧 */}
      {localReviews.length === 0 ? (
        <p style={{ color: 'var(--mm-text-muted)', fontSize: 14 }}>まだレビューがありません</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {localReviews.map(r => (
            <div key={r.id} className="mm-card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--mm-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--mm-primary)' }}>
                    {r.user?.display_name?.[0] ?? '?'}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{r.user?.display_name}</span>
                </div>
                <StarRating value={r.rating} size={14} />
              </div>
              {r.comment && <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.6 }}>{r.comment}</p>}
              <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 6 }}>
                {new Date(r.created_at).toLocaleDateString('ja-JP')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
