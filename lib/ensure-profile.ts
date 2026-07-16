import type { SupabaseClient, User } from '@supabase/supabase-js'
import { randomUsername } from '@/lib/username'

/**
 * profiles 行が無ければ作成するフォールバック（session client でも
 * profiles_insert RLS(auth.uid() = id) により本人自身の行は挿入できる）。
 *
 * 背景（project_myfocus_profile_trigger_incident の再発防止）:
 *   handle_new_user トリガーは profiles insert が何らかの理由で失敗しても
 *   例外を「raise warning」で握りつぶし、auth.users の作成自体は成功させる設計
 *   （signup全体を巻き込んで失敗させないための意図的な設計）。そのため、ごく稀に
 *   セッションはあるのに profiles 行が無い「ログアウト表示」状態になり得る。
 *   OAuth 経路(app/auth/callback/route.ts)は元々このフォールバックを持っていたが、
 *   メール/パスワード登録（signUp が即セッションを返す＝mailer_autoconfirm=true運用）
 *   には同等のフォールバックが無かった。両経路で共通のこの関数を使う。
 */
export async function ensureProfile(
  supabase: SupabaseClient,
  user: Pick<User, 'id' | 'email' | 'user_metadata'>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (existing) return { ok: true }

  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string; display_name?: string; avatar_url?: string }
  // v52: display_name/username を email のローカル部から作ると、そのまま公開プロフィール
  // に個人情報が出てしまう。OAuth等で本名/表示名が取れた場合のみそれを使い、
  // 取れない場合は非PIIな汎用名にする（display_nameは本人がすぐ変更できる）。
  const displayName = meta.display_name ?? meta.full_name ?? meta.name ?? '新規ユーザー'
  const avatarUrl = meta.avatar_url ?? null

  const { error: insertErr } = await supabase.from('profiles').insert({
    id: user.id,
    email: user.email ?? `${user.id}@no-email.local`,
    username: randomUsername(),
    display_name: displayName,
    avatar_url: avatarUrl,
    role: 'user',
  })

  if (insertErr) return { ok: false, error: insertErr.message }
  return { ok: true }
}
