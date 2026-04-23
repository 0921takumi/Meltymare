'use client'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import GoogleLoginButton from '@/components/auth/GoogleLoginButton'

function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const err = search.get('error')
    if (err) setError(err)
  }, [search])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('メールアドレスまたはパスワードが正しくありません')
      setLoading(false)
    } else {
      router.push('/contents')
      router.refresh()
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 600, color: 'var(--mm-primary)' }}>MyFocus</span>
          </Link>
          <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginTop: 8 }}>ログイン</p>
        </div>

        <div className="mm-card" style={{ padding: 32 }}>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--mm-text-sub)' }}>メールアドレス</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                placeholder="mail@example.com" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--mm-text-sub)' }}>パスワード</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--mm-border)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                placeholder="••••••••" />
            </div>

            {error && (
              <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: 8 }}>{error}</p>
            )}

            <button type="submit" disabled={loading}
              style={{ background: 'var(--mm-primary)', color: 'white', padding: '12px', borderRadius: 8, fontWeight: 700, fontSize: 15, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>

            <div style={{ textAlign: 'right' }}>
              <Link href="/auth/reset-password" style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>
                パスワードを忘れた方はこちら
              </Link>
            </div>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 16px' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--mm-border)' }} />
            <span style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>または</span>
            <div style={{ flex: 1, height: 1, background: 'var(--mm-border)' }} />
          </div>

          <GoogleLoginButton />

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--mm-text-muted)' }}>
            アカウントがない方は{' '}
            <Link href="/auth/signup" style={{ color: 'var(--mm-primary)', fontWeight: 600 }}>新規登録</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
      <LoginForm />
    </Suspense>
  )
}
