'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import GoogleLoginButton from '@/components/auth/GoogleLoginButton'
import { SERVICE_MODE } from '@/lib/config'
import { Eye, EyeOff } from 'lucide-react'

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

/** Supabase の生英語エラーを、ユーザーに伝わる日本語へ変換する */
function signupErrorMessage(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'このメールアドレスはすでに登録されています。ログインをお試しください。'
  }
  if (m.includes('invalid') && m.includes('email')) {
    return 'メールアドレスの形式をご確認ください。'
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'しばらく時間をおいてから、もう一度お試しください。'
  }
  if (m.includes('password')) {
    return 'パスワードの条件を満たしていません。8文字以上で設定してください。'
  }
  return '登録できませんでした。お手数ですが、もう一度お試しください。'
}

function SignupForm() {
  const search = useSearchParams()
  // ?next= はメール確認後の復帰先（open redirect 防止のため相対パスのみ許可）
  const rawNext = search.get('next')
  const validNext = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  // OAuth 招待制リジェクト等、リダイレクトで戻された際のエラーを表示
  const [error, setError] = useState(search.get('error') ?? '')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [age18, setAge18] = useState(false)

  const strength = passwordStrength(password)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!agreed || !age18) { setError('利用規約と18歳以上の確認に同意してください'); return }
    if (password.length < 8) { setError('パスワードは8文字以上で入力してください'); return }
    setLoading(true)

    // 招待コード検証 (招待制ON時)
    const verifyRes = await fetch('/api/invite/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: inviteCode }),
    })
    const verify = await verifyRes.json()
    if (!verify.ok) {
      setError(verify.error ?? '登録できません')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, signup_invite_code: inviteCode || null },
        emailRedirectTo: `${window.location.origin}/auth/callback${validNext ? `?next=${encodeURIComponent(validNext)}` : ''}`,
      },
    })
    if (error) {
      setError(signupErrorMessage(error.message))
      setLoading(false)
    } else {
      // 招待コード使用記録
      if (verify.invite_code_id && data.user?.id) {
        await fetch('/api/invite/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invite_code_id: verify.invite_code_id, user_id: data.user.id }),
        })
      }
      setDone(true)
    }
  }

  // ─── 確認メール送信後の done 画面 ───────────────────────
  if (done) return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
      <div className="mm-grain" aria-hidden />
      <span className="mm-viewfinder-corner tl" aria-hidden />
      <span className="mm-viewfinder-corner tr" aria-hidden />
      <span className="mm-viewfinder-corner bl" aria-hidden />
      <span className="mm-viewfinder-corner br" aria-hidden />
      <div style={{ background: 'white', border: '1px solid var(--mm-border)', borderRadius: 16, padding: '48px 32px', textAlign: 'center', maxWidth: 440, width: '100%', position: 'relative', zIndex: 1, boxShadow: '0 4px 24px -8px rgba(31,26,21,0.08)' }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>📩</div>
        <h2 className="font-serif-display" style={{ fontSize: 28, fontWeight: 500, fontStyle: 'italic', color: 'var(--mm-ink)', marginBottom: 12 }}>
          メールを確認してください。
        </h2>
        <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.8 }}>
          <strong style={{ color: 'var(--mm-ink)' }}>{email}</strong> 宛に確認メールを送りました。<br />
          メール内のリンクをクリックして登録を完了してください。
        </p>
        <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', lineHeight: 1.8, marginTop: 14 }}>
          数分たっても届かない場合は、迷惑メールフォルダをご確認ください。<br />
          それでも見つからないときは <Link href="/contact" style={{ color: 'var(--mm-primary)' }}>お問い合わせ</Link> からご連絡ください。
        </p>
        <Link href="/auth/login" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          marginTop: 28, color: 'var(--mm-ink)', fontWeight: 600, fontSize: 13,
          textDecoration: 'none', borderBottom: '1px solid var(--mm-ink)', paddingBottom: 2,
        }}>
          ログインページへ <span style={{ color: 'var(--mm-primary)' }}>→</span>
        </Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
      <div className="mm-grain" aria-hidden />
      <span className="mm-viewfinder-corner tl" aria-hidden />
      <span className="mm-viewfinder-corner tr" aria-hidden />
      <span className="mm-viewfinder-corner bl" aria-hidden />
      <span className="mm-viewfinder-corner br" aria-hidden />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1, padding: '40px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 16 }}>
            <Image src="/logo.svg" alt="My Focus" width={60} height={56} priority unoptimized style={{ height: 56, width: 'auto' }} />
          </Link>
          <p className="font-serif-display" style={{
            fontSize: 28, fontWeight: 500, fontStyle: 'italic',
            color: 'var(--mm-ink)', letterSpacing: '0.01em', lineHeight: 1.2,
          }}>Start your story.</p>
          <p style={{ fontSize: 12, color: 'var(--mm-text-muted)', marginTop: 6, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>
            Create your account
          </p>
        </div>

        <div style={{ background: 'white', border: '1px solid var(--mm-border)', borderRadius: 14, padding: '32px 28px', boxShadow: '0 4px 24px -8px rgba(31,26,21,0.08)' }}>
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={authLabelStyle}>ニックネーム</label>
              <input type="text" autoComplete="nickname" value={displayName} onChange={e => setDisplayName(e.target.value)} required maxLength={30}
                className="mm-auth-input" placeholder="あなたの名前" />
            </div>
            <div>
              <label style={authLabelStyle}>Email</label>
              <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="mm-auth-input" placeholder="you@example.com" />
            </div>
            <div>
              <label style={authLabelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                  className="mm-auth-input" style={{ paddingRight: 48 }} placeholder="8文字以上" />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                  style={{ position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mm-text-muted)' }}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {password && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= strength.score ? strength.color : '#e5e7eb' }} />
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: strength.color, fontWeight: 600 }}>強度: {strength.label}</p>
                </div>
              )}
            </div>
            <div>
              <label style={authLabelStyle}>
                Invite code <span style={{ fontSize: 10, color: 'var(--mm-text-muted)', fontWeight: 500, textTransform: 'none', letterSpacing: 0, marginLeft: 6 }}>（β期間中は必須）</span>
              </label>
              <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} required
                className="mm-auth-input"
                style={{ fontFamily: 'monospace', letterSpacing: '0.12em' }}
                placeholder="招待コード" />
              <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 6, lineHeight: 1.6 }}>
                招待コードはクリエイターの SNS や運営からのご案内に記載されています。
              </p>
            </div>

            {/* 同意チェック */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 0 4px', borderTop: '1px solid var(--mm-border)', marginTop: 4 }}>
              <label style={checkLabelStyle}>
                <input type="checkbox" checked={age18} onChange={e => setAge18(e.target.checked)} style={{ marginTop: 2, accentColor: 'var(--mm-primary)' }} />
                <span>私は<strong style={{ color: 'var(--mm-ink)' }}>18歳以上</strong>であり、虚偽がないことを確認しました</span>
              </label>
              <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', lineHeight: 1.7, paddingLeft: 24 }}>
                ※ My Focus は18歳以上の方にご利用いただけます。過度な露出を含むコンテンツの出品はガイドラインで禁止しています。
              </p>
              <label style={checkLabelStyle}>
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 2, accentColor: 'var(--mm-primary)' }} />
                <span>
                  <Link href="/terms" target="_blank" style={authLinkStyle}>利用規約</Link>・
                  <Link href="/privacy" target="_blank" style={authLinkStyle}>プライバシーポリシー</Link>・
                  <Link href="/guidelines" target="_blank" style={authLinkStyle}>コンテンツガイドライン</Link>に同意します
                </span>
              </label>
            </div>

            {error && (
              <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: 8, lineHeight: 1.5 }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="mm-auth-submit"
              style={{
                background: 'var(--mm-ink)', color: 'white',
                padding: '14px', borderRadius: 999,
                fontWeight: 600, fontSize: 14, letterSpacing: '0.04em',
                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                marginTop: 4,
              }}>
              {loading ? '登録中...' : '無料登録（30秒）→'}
            </button>
            <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
              登録は無料です。クレジットカードの入力は購入時まで必要ありません。
            </p>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 18px' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--mm-border)' }} />
            <span style={{ fontSize: 10, color: 'var(--mm-text-muted)', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600 }}>or</span>
            <span style={{ flex: 1, height: 1, background: 'var(--mm-border)' }} />
          </div>

          <GoogleLoginButton next={validNext ?? undefined} inviteCode={inviteCode} requireInvite={SERVICE_MODE.inviteOnly} />

          <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--mm-text-sub)' }}>
            すでにアカウントをお持ちの方は{' '}
            <Link href={validNext ? `/auth/login?next=${encodeURIComponent(validNext)}` : '/auth/login'} style={{ color: 'var(--mm-ink)', fontWeight: 600, borderBottom: '1px solid var(--mm-ink)', paddingBottom: 1 }}>
              ログイン <span style={{ color: 'var(--mm-primary)' }}>→</span>
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

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
      <SignupForm />
    </Suspense>
  )
}

const authLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 8,
  color: 'var(--mm-text-sub)', letterSpacing: '0.16em', textTransform: 'uppercase',
}

const checkLabelStyle: React.CSSProperties = {
  display: 'flex', gap: 10, fontSize: 12, color: 'var(--mm-text-sub)',
  cursor: 'pointer', lineHeight: 1.5, alignItems: 'flex-start',
}

const authLinkStyle: React.CSSProperties = {
  color: 'var(--mm-ink)', fontWeight: 600,
  borderBottom: '1px solid var(--mm-border)', paddingBottom: 1,
}
