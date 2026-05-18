'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function passwordStrength(pw: string): { label: string; color: string; score: number } {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { label: '弱い', color: '#ef4444', score: 1 }
  if (score <= 3) return { label: '普通', color: '#f59e0b', score: 3 }
  return { label: '強い', color: '#10b981', score: 5 }
}

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)

  const strength = passwordStrength(password)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
      else setError('リンクの有効期限が切れています。パスワード再設定を再度お試しください。')
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      return
    }
    if (password !== confirm) {
      setError('パスワードが一致しません')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setDone(true)
      setTimeout(() => router.push('/auth/login'), 2500)
    }
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--mm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="mm-card" style={{ padding: 40, textAlign: 'center', maxWidth: 400, width: '100%' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>パスワードを更新しました</h2>
          <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.7 }}>
            新しいパスワードでログインしてください。<br />自動的にログインページへ移動します。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 600, color: 'var(--mm-primary)' }}>MyFocus</span>
          </Link>
          <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginTop: 8 }}>新しいパスワードを設定</p>
        </div>

        <div className="mm-card" style={{ padding: 32 }}>
          {!ready && !error ? (
            <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', textAlign: 'center' }}>読み込み中...</p>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--mm-text-sub)' }}>新しいパスワード</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} disabled={!ready}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  placeholder="8文字以上" />
                {password && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                      {[1,2,3,4,5].map(i => (
                        <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= strength.score ? strength.color : '#e5e7eb' }} />
                      ))}
                    </div>
                    <p style={{ fontSize: 11, color: strength.color, fontWeight: 600 }}>強度: {strength.label}</p>
                  </div>
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--mm-text-sub)' }}>確認のため再入力</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required disabled={!ready}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  placeholder="もう一度入力" />
              </div>

              {error && <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: 8 }}>{error}</p>}

              <button type="submit" disabled={loading || !ready}
                style={{ background: 'var(--mm-primary)', color: 'white', padding: 12, borderRadius: 8, fontWeight: 700, fontSize: 15, border: 'none', cursor: (loading || !ready) ? 'not-allowed' : 'pointer', opacity: (loading || !ready) ? 0.7 : 1 }}>
                {loading ? '更新中...' : 'パスワードを更新'}
              </button>
            </form>
          )}

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--mm-text-muted)' }}>
            <Link href="/auth/login" style={{ color: 'var(--mm-primary)', fontWeight: 600 }}>ログインページに戻る</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
