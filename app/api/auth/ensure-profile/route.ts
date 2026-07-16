import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureProfile } from '@/lib/ensure-profile'

/**
 * メール/パスワード登録（mailer_autoconfirm=true 運用で signUp が即セッションを
 * 返す経路）向けの profiles フォールバック作成。
 *
 * handle_new_user トリガーは profiles insert 失敗を「raise warning」で握りつぶし
 * auth.users の作成自体は成功させる設計のため、ごく稀にセッションはあるのに
 * profiles 行が無い状態になり得る（memory: project_myfocus_profile_trigger_incident）。
 * OAuth 経路(app/auth/callback/route.ts)は元々このフォールバックを持っていたが、
 * signUp() が client 側で直接セッションを返すメール登録には無かった穴を塞ぐ。
 * app/auth/signup/page.tsx から、成功直後のリダイレクト前に呼ぶ。
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ensured = await ensureProfile(supabase, user)
  if (!ensured.ok) {
    console.error('[ensure-profile] failed:', ensured.error, 'user:', user.id)
    return NextResponse.json({ error: ensured.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
