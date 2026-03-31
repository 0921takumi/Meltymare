'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/layout/Header'
import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send } from 'lucide-react'

function RequestForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const creatorId = searchParams.get('creator_id') ?? ''

  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [creator, setCreator] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [budget, setBudget] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
    })
    if (creatorId) {
      supabase.from('profiles').select('id, display_name, username, avatar_url, bio').eq('id', creatorId).single().then(({ data }) => setCreator(data))
    }
  }, [creatorId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) { setError('メッセージを入力してください'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creator_id: creatorId, message, budget: budget ? parseInt(budget) : null }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'エラーが発生しました'); return }
      setDone(true)
      setTimeout(() => router.push('/requests'), 2000)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <p style={{ fontSize: 40, marginBottom: 12 }}>✅</p>
        <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>リクエストを送りました！</p>
        <p style={{ fontSize: 14, color: 'var(--mm-text-muted)' }}>クリエイターからの返信をお待ちください</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <Link href={creator ? `/creator/${creator.username}` : '/creators'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--mm-text-muted)', textDecoration: 'none', marginBottom: 16 }}>
        <ArrowLeft size={14} /> 戻る
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>カスタムリクエスト</h1>

      {creator && (
        <div className="mm-card" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--mm-primary-light)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
            {creator.avatar_url ? <img src={creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
          </div>
          <div>
            <p style={{ fontWeight: 700 }}>{creator.display_name}</p>
            <p style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>@{creator.username}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mm-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 8, color: 'var(--mm-text-sub)' }}>
              リクエスト内容 *
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={6}
              required
              placeholder="どんな写真・動画が欲しいか、できるだけ具体的に書いてください。&#10;例：〇〇の衣装で、メッセージを書いた写真をお願いします。"
              style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.7 }}
            />
            <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', textAlign: 'right', marginTop: 4 }}>{message.length}文字</p>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 8, color: 'var(--mm-text-sub)' }}>
              希望予算（任意）
            </label>
            <div style={{ position: 'relative', maxWidth: 200 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--mm-text-muted)' }}>¥</span>
              <input
                type="number"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                min={0}
                placeholder="1000"
                style={{ width: '100%', padding: '10px 14px 10px 26px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {error && <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: 8 }}>{error}</p>}

          <button
            type="submit"
            disabled={submitting || !message.trim()}
            style={{ padding: '13px', background: 'var(--mm-primary)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: !message.trim() ? 0.6 : 1 }}
          >
            <Send size={16} />
            {submitting ? '送信中...' : 'リクエストを送る'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function NewRequestPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)' }}>
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--mm-text-muted)' }}>読み込み中...</div>}>
        <RequestFormWithHeader />
      </Suspense>
    </div>
  )
}

function RequestFormWithHeader() {
  return (
    <>
      <div className="mm-page-pad">
        <RequestForm />
      </div>
    </>
  )
}
