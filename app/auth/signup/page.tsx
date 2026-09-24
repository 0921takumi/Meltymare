'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import GoogleLoginButton from '@/components/auth/GoogleLoginButton'
import { SERVICE_MODE, FEATURES } from '@/lib/config'
import { safeNext } from '@/lib/safe-next'
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

/**
 * パスワードが Supabase 側の要件を満たすか事前検証する。
 * Supabase Auth のデフォルトは緩い(6文字以上)が、本番では強化設定が入ることが多く、
 * その場合フォームは通ったのにサーバー到達時に「Password should contain...」で
 * 弾かれてユーザーが「何がダメか分からない」体験になる。事前に同じ要件で止めて、
 * 何が足りないかを具体的に伝える。
 */
function passwordRequirementMessage(pw: string): string | null {
  if (pw.length < 8) return 'パスワードは8文字以上で入力してください。'
  const missing: string[] = []
  if (!/[a-z]/.test(pw)) missing.push('小文字')
  if (!/[A-Z]/.test(pw)) missing.push('大文字')
  if (!/[0-9]/.test(pw)) missing.push('数字')
  if (!/[^A-Za-z0-9]/.test(pw)) missing.push('記号(例: ! @ # $)')
  if (missing.length > 0) return `パスワードに「${missing.join('・')}」を含めてください。`
  return null
}

/** 招待コードが最低限の形式(空でない・許容文字のみ)を満たすか、フォーム側で早期に判定する */
function inviteCodeFormatError(codeRaw: string): string | null {
  const code = codeRaw.trim().toUpperCase()
  if (!code) return '招待コードを入力してください。'
  // API 側の regex と揃える: MYF-XXXXXX 形式 or 単独の英数4-16文字
  const ok = /^MYF-[A-Z2-9]{6}$/.test(code) || /^[A-Z0-9]{4,16}$/.test(code)
  if (!ok) return '招待コードの形式が違います。半角英数字で、ハイフン以外の記号は使えません。'
  return null
}

/** Supabase の生英語エラーを、ユーザーに伝わる日本語へ変換する */
function signupErrorMessage(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already registered')) {
    return 'このメールアドレスはすでに登録されています。ログインをお試しください。'
  }
  if (m.includes('invalid') && m.includes('email')) {
    return 'メールアドレスの形式をご確認ください。'
  }
  if (m.includes('email') && (m.includes('bounce') || m.includes('undeliverable'))) {
    return 'このメールアドレスにメールを送れませんでした。別のアドレスをお試しください。'
  }
  if (m.includes('rate limit') || m.includes('too many') || m.includes('for security purposes')) {
    return '短時間に登録が集中しています。少し(3〜5分)時間をおいてから、もう一度お試しください。'
  }
  if (m.includes('password')) {
    return 'パスワードは「大文字・小文字・数字・記号」をそれぞれ1つ以上含む8文字以上で設定してください。'
  }
  if (m.includes('signups') && m.includes('disabled')) {
    return '現在、新規登録は一時的に停止しています。運営までお問い合わせください。'
  }
  return '登録できませんでした。お手数ですが、もう一度お試しください。'
}

function SignupForm() {
  const search = useSearchParams()
  // ?next= はメール確認後の復帰先。open redirect 防止のため
  // lib/safe-next の共通チェック（callback/route.ts と同一ロジック）を使う
  const validNext = safeNext(search.get('next'))
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
    // パスワード要件をフォーム側で先に確認（Supabase 到達前に「何が足りないか」を具体表示）
    const pwErr = passwordRequirementMessage(password)
    if (pwErr) { setError(pwErr); return }
    // 招待コード（招待制ON時）の形式チェックもここで。fetch 前に弾く。
    if (SERVICE_MODE.inviteOnly) {
      const codeErr = inviteCodeFormatError(inviteCode)
      if (codeErr) { setError(codeErr); return }
    }
    setLoading(true)

    // 招待コード検証 (招待制ON時)。API 側はセキュリティのためエラー詳細を返さないが、
    // フロントでは 429/500/その他をユーザー向けに区別する。
    const verifyRes = await fetch('/api/invite/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: inviteCode }),
    })
    const verify = await verifyRes.json().catch(() => ({ ok: false }))
    if (!verify.ok) {
      if (verifyRes.status === 429) {
        setError('招待コードの確認が短時間に集中しました。1分ほど時間をおいてお試しください。')
      } else if (verifyRes.status >= 500) {
        setError('サーバーで問題が発生しました。少し時間をおいて再度お試しください。')
      } else {
        setError(verify.error ?? 'この招待コードは使用できません（無効・期限切れ・利用上限のいずれか）。運営までご連絡ください。')
      }
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
      // 招待コード使用記録（メール確認OFF時は signUp で session 済み＝認証が通る）
      if (verify.invite_code_id && data.user?.id) {
        await fetch('/api/invite/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invite_code_id: verify.invite_code_id, user_id: data.user.id }),
        })
      }
      // メール確認OFF時は signUp が即セッションを返す → そのままログイン状態で遷移。
      // 確認ON時（session=null）は従来どおり確認メール待ち画面を出す。
      if (data.session) {
        // v49: handle_new_user トリガーは profiles insert 失敗を握りつぶして
        // auth.users 作成自体は成功させる設計のため、ごく稀に「セッションはあるのに
        // profiles 行が無い」状態になり得た（OAuth経路には元々あったフォールバックが
        // メール登録には無かった＝project_myfocus_profile_trigger_incidentの再発リスク）。
        // 遷移前に一度だけ確認・補完する。
        await fetch('/api/auth/ensure-profile', { method: 'POST' }).catch(() => {})
        window.location.href = validNext ?? '/contents'
        return
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
              <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                大文字・小文字・数字・記号（! @ # $ 等）を<strong style={{ color: 'var(--mm-text-sub)' }}>すべて</strong>含む<strong style={{ color: 'var(--mm-text-sub)' }}>8文字以上</strong>で設定してください。<br />
                例: <code style={{ background: 'var(--mm-bg)', padding: '1px 4px', borderRadius: 3, fontFamily: 'monospace' }}>MyFocus2026!</code>
              </p>
            </div>
            {/* 招待コード欄は招待制のときだけ出す。以前は SERVICE_MODE.inviteOnly と無関係に
                required で常に表示していたため、招待制を OFF にしても入力必須のままだった。 */}
            {SERVICE_MODE.inviteOnly && (
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
            )}

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

          {FEATURES.googleAuth && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 18px' }}>
                <span style={{ flex: 1, height: 1, background: 'var(--mm-border)' }} />
                <span style={{ fontSize: 10, color: 'var(--mm-text-muted)', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600 }}>or</span>
                <span style={{ flex: 1, height: 1, background: 'var(--mm-border)' }} />
              </div>

              <GoogleLoginButton next={validNext ?? undefined} inviteCode={inviteCode} requireInvite={SERVICE_MODE.inviteOnly} />
            </>
          )}

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
