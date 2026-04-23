'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import GoogleLoginButton from '@/components/auth/GoogleLoginButton'

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

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [adult, setAdult] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const strength = passwordStrength(password)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!agreed) {
      setError('利用規約・プライバシーポリシーへの同意が必要です')
      return
    }
    if (!adult) {
      setError('18歳以上であることの確認が必要です')
      return
    }
    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
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
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 600, color: 'var(--mm-primary)' }}>MyFocus</span>
          </Link>
          <p style={{ fontSize: 13, color: 'var(--mm-text-muted)', marginTop: 8 }}>新規登録</p>
        </div>

        <div className="mm-card" style={{ padding: 32 }}>
          <GoogleLoginButton />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 16px' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--mm-border)' }} />
            <span style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>または メールで登録</span>
            <div style={{ flex: 1, height: 1, background: 'var(--mm-border)' }} />
          </div>

          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--mm-text-sub)' }}>ニックネーム</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required maxLength={30}
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
                placeholder="8文字以上（英大小文字・数字・記号を推奨）" />
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--mm-bg)', borderRadius: 8 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, lineHeight: 1.6, cursor: 'pointer' }}>
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>
                  <Link href="/terms" target="_blank" style={{ color: 'var(--mm-primary)' }}>利用規約</Link>・
                  <Link href="/privacy" target="_blank" style={{ color: 'var(--mm-primary)' }}>プライバシーポリシー</Link>
                  に同意します
                </span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, lineHeight: 1.6, cursor: 'pointer' }}>
                <input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>18歳以上です</span>
              </label>
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
