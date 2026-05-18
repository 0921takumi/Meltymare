'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setDone(true)
    }
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--mm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="mm-card" style={{ padding: 40, textAlign: 'center', maxWidth: 400, width: '100%' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>リセットメールを送信しました</h2>
          <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.7 }}>
            {email} に<br />パスワードリセットのリンクを送信しました。<br />
            メール内のリンクをクリックして新しいパスワードを設定してください。
          </p>
          <Link href="/auth/login" style={{ display: 'inline-block', marginTop: 24, color: 'var(--mm-primary)', fontWeight: 600, fontSize: 14 }}>
            ログインページへ
          </Link>
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
          <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginTop: 8 }}>パスワード再設定</p>
        </div>

        <div className="mm-card" style={{ padding: 32 }}>
          <p style={{ fontSize: 13, color: 'var(--mm-text-sub)', lineHeight: 1.7, marginBottom: 20 }}>
            登録時のメールアドレスを入力してください。<br />
            パスワード再設定用のリンクをお送りします。
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--mm-text-sub)' }}>メールアドレス</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                placeholder="mail@example.com" />
            </div>

            {error && <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: 8 }}>{error}</p>}

            <button type="submit" disabled={loading}
              style={{ background: 'var(--mm-primary)', color: 'white', padding: 12, borderRadius: 8, fontWeight: 700, fontSize: 15, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? '送信中...' : 'リセットメールを送信'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--mm-text-muted)' }}>
            <Link href="/auth/login" style={{ color: 'var(--mm-primary)', fontWeight: 600 }}>ログインページに戻る</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
