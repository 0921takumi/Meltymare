import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SERVICE_MODE } from '@/lib/config'
import { safeNext } from '@/lib/safe-next'
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

  // 正規の招待コードで既に通過済みなら常に許可（以降の判定より優先）
  const hasInviteMeta = !!user.user_metadata?.signup_invite_code
  if (hasInviteMeta) return 'ok'

  // 🔴 過去に「招待コード無し」で拒否され、かつ deleteUser が何らかの理由（権限/接続エラー等）
  //    で失敗して auth.users 行が残った場合、拒否直後は signOut 済みでも、
  //    「作成から5分以内」だけを新規判定の根拠にしていると、5分経過後の再ログイン
  //    （signup ではなく login 経由）で isNew=false となり招待ゲートを完全に迂回できてしまう。
  //    これを防ぐため、拒否時に user_metadata へ invite_rejected フラグを先に立てておき、
  //    deleteUser の成否に関わらず、経過時間によらず常に再拒否できるようにする。
  const alreadyRejected = user.user_metadata?.invite_rejected === true

  // v49で発覚: 「作成から5分」を経過時間(Date.now() - created_at)で判定していたため、
  // 攻撃者が Google 認証後の code 交換をわざと5分以上遅らせるだけで isNew=false になり、
  // 招待コード無しで登録が成立してしまっていた（created_at 自体は攻撃者が自由に
  // 遅らせられる=攻撃者が完全にコントロールできる値のため、経過時間での判定は無意味）。
  // 「既存の（招待制導入前からいる）アカウントを誤って再ゲートしない」という本来の
  // 目的は、経過時間ではなく「招待制が実際に有効化された固定の過去日時」との比較で
  // 満たす（この日時は攻撃者が新規に作るアカウントのcreated_atより必ず後になるため、
  // 待ち時間による迂回ができない）。日時は Supabase の app_settings.updated_at
  // （invite_only を有効化した実績時刻）に合わせて適宜更新すること。
  const INVITE_ONLY_ENABLED_AT = new Date('2026-07-08T00:00:00Z')
  const isPreInviteAccount = new Date(user.created_at) < INVITE_ONLY_ENABLED_AT
  if (!alreadyRejected && isPreInviteAccount) return 'ok'

  // cookie から招待コードを取得して検証（verify API と同じ判定）
  //
  // 🔴 実地監査で発見: invite_codes は anon/authenticated に RLS で読ませていない
  //   （invite_select_admin ポリシーが role='admin' のみ許可）。ここを session client
  //   (supabase, role='user'の新規OAuthユーザー自身)で読むと常に0件になり、正しい
  //   招待コードでも「無効」と誤判定してアカウントごと削除してしまっていた
  //   （app/api/invite/verify/route.ts が既にservice_role化済みの同じ事故パターン）。
  //   照会のみservice_roleで行う（消化のredeem_invite_code RPCはauth.uid()を内部で
  //   固定して使う設計のため、従来通りsupabase(session client)で呼ぶ）。
  const cookieCode = (req.cookies.get('myf_invite')?.value ?? '').trim().toUpperCase()
  if (cookieCode && (/^MYF-[A-Z2-9]{6}$/.test(cookieCode) || /^[A-Z0-9]{4,16}$/.test(cookieCode))) {
    const admin = createAdminClient()
    const { data: invite, error: inviteErr } = await admin
      .from('invite_codes')
      .select('id, max_uses, used_count, expires_at, is_active')
      .eq('code', cookieCode)
      .maybeSingle()
    if (inviteErr) console.error('[callback] invite lookup error:', inviteErr.message)
    const valid =
      !!invite
      && invite.is_active
      && invite.used_count < invite.max_uses
      && (!invite.expires_at || new Date(invite.expires_at) >= new Date())
    if (valid) {
      // atomic に消化（v17 RPC・auth.uid() 固定）。成功したらメタに記録し再チェックを回避
      const { data: redeemed, error: redeemErr } = await supabase.rpc('redeem_invite_code', { p_invite_code_id: invite!.id })
      if (redeemErr) console.error('[callback] invite redeem error:', redeemErr.message)
      if (redeemed === true) {
        await supabase.auth.updateUser({ data: { signup_invite_code: cookieCode } })
        return 'ok'
      }
    }
  }

  // 招待コード無し/無効 → まず「拒否済み」フラグを永続化してから削除を試みる。
  // deleteUser がここで失敗しても invite_rejected フラグが残るため、次回以降の
  // ログインで isNew が false になっても確実に再拒否される（時限迂回の防止）。
  try {
    const admin = createAdminClient()
    await admin.auth.admin.updateUserById(user.id, { user_metadata: { ...user.user_metadata, invite_rejected: true } })
    await admin.auth.admin.deleteUser(user.id)
  } catch (e) {
    console.error('[callback] OAuth invite rejection: deleteUser failed:', e)
  }
  await supabase.auth.signOut()
  return 'rejected'
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next')) ?? '/contents'
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
    const res = NextResponse.redirect(`${origin}/auth/login?notice=${encodeURIComponent('メールアドレスの確認が完了しました。ログインしてください。')}`)
    res.cookies.delete('myf_invite')  // 他の失敗/成功分岐と揃え、古い招待コードcookieの残存を防ぐ
    return res
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
      const { error: insertErr } = await supabase.from('profiles').insert({
        id: user.id,
        email: user.email ?? `${user.id}@no-email.local`,
        username: `${emailPrefix}_${user.id.slice(0, 6)}`,
        display_name: displayName,
        avatar_url: avatarUrl,
        role: 'user',
      })
      if (insertErr) {
        // profiles 行が無いままログイン済みにすると「プロフィールトリガー事故」（memory:
        // project_myfocus_profile_trigger_incident）と同じ状態を再発させるため、
        // サイレントに進ませずログイン画面へ差し戻す。
        console.error('[callback] profile insert failed:', insertErr.message, 'user:', user.id)
        const res = NextResponse.redirect(
          `${origin}/auth/login?error=${encodeURIComponent('プロフィールの作成に失敗しました。もう一度お試しください。')}`,
        )
        res.cookies.delete('myf_invite')
        return res
      }
    }
  }

  const res = NextResponse.redirect(`${origin}${next}`)
  res.cookies.delete('myf_invite')
  return res
}
