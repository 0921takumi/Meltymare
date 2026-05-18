'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import GoogleLoginButton from '@/components/auth/GoogleLoginButton'

function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const initialError = search.get('error') ?? ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)

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
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
      {/* グレイン質感 */}
      <div className="mm-grain" aria-hidden />

      {/* カメラのファインダー枠（4隅、Heroと統一） */}
      <span className="mm-viewfinder-corner tl" aria-hidden />
      <span className="mm-viewfinder-corner tr" aria-hidden />
      <span className="mm-viewfinder-corner bl" aria-hidden />
      <span className="mm-viewfinder-corner br" aria-hidden />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>

        {/* Logo + eyebrow */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 16 }}>
            <Image src="/logo.svg" alt="My Focus" width={60} height={56} priority unoptimized style={{ height: 56, width: 'auto' }} />
          </Link>
          <p className="font-serif-display" style={{
            fontSize: 28, fontWeight: 500, fontStyle: 'italic',
            color: 'var(--mm-ink)', letterSpacing: '0.01em', lineHeight: 1.2,
          }}>Welcome back.</p>
          <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 6, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>
            Sign in to My Focus
          </p>
        </div>

        <div style={{ background: 'white', border: '1px solid var(--mm-border)', borderRadius: 14, padding: '32px 28px', boxShadow: '0 4px 24px -8px rgba(31,26,21,0.08)' }}>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 8, color: 'var(--mm-text-sub)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Email</label>
              <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="mm-auth-input"
                placeholder="you@example.com" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 8, color: 'var(--mm-text-sub)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Password</label>
              <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required
                className="mm-auth-input"
                placeholder="••••••••" />
            </div>

            {error && (
              <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: 8, lineHeight: 1.5 }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading}
              style={{
                background: 'var(--mm-ink)', color: 'white',
                padding: '14px', borderRadius: 999,
                fontWeight: 600, fontSize: 14, letterSpacing: '0.04em',
                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                marginTop: 6,
                transition: 'opacity 0.2s',
              }}>
              {loading ? 'Signing in...' : 'ログイン →'}
            </button>

            <div style={{ textAlign: 'right' }}>
              <Link href="/auth/reset-password" style={{ fontSize: 12, color: 'var(--mm-text-muted)' }}>
                パスワードを忘れた方はこちら
              </Link>
            </div>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 18px' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--mm-border)' }} />
            <span style={{ fontSize: 10, color: 'var(--mm-text-muted)', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600 }}>or</span>
            <span style={{ flex: 1, height: 1, background: 'var(--mm-border)' }} />
          </div>

          <GoogleLoginButton />

          <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--mm-text-sub)' }}>
            アカウントがない方は{' '}
            <Link href="/auth/signup" style={{ color: 'var(--mm-ink)', fontWeight: 600, borderBottom: '1px solid var(--mm-ink)', paddingBottom: 1 }}>
              新規登録 <span style={{ color: 'var(--mm-primary)' }}>→</span>
            </Link>
          </p>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'var(--mm-text-muted)', letterSpacing: '0.1em' }}>
          ✦ Issue 01 — 2026 Spring
        </p>
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
