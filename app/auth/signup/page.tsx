'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } }
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setDone(true)
    }
  }

  if (done) return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="mm-card" style={{ padding: 40, textAlign: 'center', maxWidth: 400, width: '100%' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📩</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>確認メールを送りました</h2>
        <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.7 }}>
          {email} に確認メールを送りました。<br />リンクをクリックして登録を完了してください。
        </p>
        <Link href="/auth/login" style={{ display: 'inline-block', marginTop: 24, color: 'var(--mm-primary)', fontWeight: 600, fontSize: 14 }}>
          ログインページへ
        </Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 600, color: 'var(--mm-primary)' }}>Meltymare</span>
          </Link>
          <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginTop: 8 }}>新規登録</p>
        </div>
        <div className="mm-card" style={{ padding: 32 }}>
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--mm-text-sub)' }}>ニックネーム</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                placeholder="あなたの名前" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--mm-text-sub)' }}>メールアドレス</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                placeholder="mail@example.com" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--mm-text-sub)' }}>パスワード</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                placeholder="8文字以上" />
            </div>
            {error && <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: 8 }}>{error}</p>}
            <button type="submit" disabled={loading}
              style={{ background: 'var(--mm-primary)', color: 'white', padding: 12, borderRadius: 8, fontWeight: 700, fontSize: 15, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? '登録中...' : '無料登録'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--mm-text-muted)' }}>
            すでにアカウントをお持ちの方は{' '}
            <Link href="/auth/login" style={{ color: 'var(--mm-primary)', fontWeight: 600 }}>ログイン</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
