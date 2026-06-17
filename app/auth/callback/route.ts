import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SERVICE_MODE } from '@/lib/config'
import { NextRequest, NextResponse } from 'next/server'

/**
 * OAuth(Google) 経由の新規登録に招待コードを強制する。
 * メール登録はフォーム側で /api/invite/verify を通るが、OAuth はそれを
 * バイパスできてしまうため、callback で cookie(myf_invite) のコードを検証・消化する。
 * 戻り値: 'ok'（通過/対象外） | 'rejected'（新規OAuthでコード無効 → アカウント削除済み）
 */
async function enforceInviteForOAuth(
  req: NextRequest,
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; created_at: string; app_metadata?: { provider?: string }; user_metadata?: Record<string, unknown> },
): Promise<'ok' | 'rejected'> {
  if (!SERVICE_MODE.inviteOnly) return 'ok'

  const provider = user.app_metadata?.provider ?? 'email'
  if (provider === 'email') return 'ok'  // メール登録はフォーム側で検証済み

  // 既存ユーザーのログインは対象外。「作成から5分以内 かつ 招待メタ無し」を新規とみなす
  const hasInviteMeta = !!user.user_metadata?.signup_invite_code
  const isNew = Date.now() - new Date(user.created_at).getTime() < 5 * 60_000
  if (hasInviteMeta || !isNew) return 'ok'

  // cookie から招待コードを取得して検証（verify API と同じ判定）
  const cookieCode = (req.cookies.get('myf_invite')?.value ?? '').trim().toUpperCase()
  if (cookieCode && (/^MYF-[A-Z2-9]{6}$/.test(cookieCode) || /^[A-Z0-9]{4,16}$/.test(cookieCode))) {
    const { data: invite } = await supabase
      .from('invite_codes')
      .select('id, max_uses, used_count, expires_at, is_active')
      .eq('code', cookieCode)
      .maybeSingle()
    const valid =
      !!invite
      && invite.is_active
      && invite.used_count < invite.max_uses
      && (!invite.expires_at || new Date(invite.expires_at) >= new Date())
    if (valid) {
      // atomic に消化（v17 RPC・auth.uid() 固定）。成功したらメタに記録し再チェックを回避
      const { data: redeemed } = await supabase.rpc('redeem_invite_code', { p_invite_code_id: invite!.id })
      if (redeemed === true) {
        await supabase.auth.updateUser({ data: { signup_invite_code: cookieCode } })
        return 'ok'
      }
    }
  }

  // 招待コード無し/無効 → 作成されたばかりの OAuth アカウントを削除して弾く
  try {
    const admin = createAdminClient()
    await admin.auth.admin.deleteUser(user.id)
  } catch (e) {
    console.error('[callback] OAuth invite rejection: deleteUser failed:', e)
  }
  await supabase.auth.signOut()
  return 'rejected'
}

/**
 * next パラメータの安全化（オープンリダイレクト対策）。
 * 外部URL・プロトコル相対・schemeへの遷移を全て弾き、内部パスのみ許可する。
 */
function safeNext(raw: string | null): string {
  const fallback = '/contents'
  if (!raw) return fallback
  // / で始まらない / // で始まる(プロトコル相対) / scheme含む は外部誘導の温床
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  // スキーム混入('http:', 'javascript:' 等) や CR/LF を含むものは弾く
  if (/^[a-z][a-z0-9+\-.]*:/i.test(raw) || /[\r\n\t]/.test(raw)) return fallback
  // 長さ制限（DoS/誤入力対策）
  if (raw.length > 256) return fallback
  return raw
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'))
  const errorParam = url.searchParams.get('error_description')

  const origin = url.origin

  if (errorParam) {
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(errorParam)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent('認証コードが取得できませんでした')}`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // アプリ内ブラウザ等で PKCE の code_verifier を引き継げず交換に失敗することがある。
    // メール確認(verify)自体は完了しているケースが多いため、エラーではなく
    // ログインへ優しく誘導する（メール確認OFF運用ではそもそもここをほぼ通らない）。
    return NextResponse.redirect(`${origin}/auth/login?notice=${encodeURIComponent('メールアドレスの確認が完了しました。ログインしてください。')}`)
  }

  // プロフィールが存在しない場合は作成（OAuth初回ログイン時）
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    // 招待制: OAuth 新規登録は招待コード（cookie 経由）必須
    const gate = await enforceInviteForOAuth(req, supabase, user)
    if (gate === 'rejected') {
      const res = NextResponse.redirect(
        `${origin}/auth/signup?error=${encodeURIComponent('登録には招待コードが必要です。招待コードを入力してから「Googleで続ける」を押してください。')}`,
      )
      res.cookies.delete('myf_invite')
      return res
    }

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!existing) {
      const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string; display_name?: string; avatar_url?: string }
      const emailPrefix = user.email?.split('@')[0] ?? 'user'
      const displayName = meta.display_name ?? meta.full_name ?? meta.name ?? emailPrefix
      const avatarUrl = meta.avatar_url ?? null

      // profiles は email/username が NOT NULL。通常は DB トリガー handle_new_user が
      // 先に作成済み（→ existing で skip）だが、トリガー未適用環境でも OAuth 登録が
      // 機能するよう、ここでも全必須列を満たして作成する（フォールバック）。
      await supabase.from('profiles').insert({
        id: user.id,
        email: user.email ?? `${user.id}@no-email.local`,
        username: `${emailPrefix}_${user.id.slice(0, 6)}`,
        display_name: displayName,
        avatar_url: avatarUrl,
        role: 'user',
      })
    }
  }

  const res = NextResponse.redirect(`${origin}${next}`)
  res.cookies.delete('myf_invite')
  return res
}
