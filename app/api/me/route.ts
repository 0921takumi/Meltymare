import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * 本人の profile を「全列（PII 含む）」で返す。
 *
 * v22 で profiles の PII 列を anon/authenticated から REVOKE したため、
 * 本人が自分の email / 銀行口座 / 生年月日 / 本人確認書類URL を見る画面は
 * このエンドポイント経由で取得する。
 *
 * セキュリティ設計（重要）:
 *   1. 認証は RLS スコープのクライアント（cookie セッション）で getUser() を行い、
 *      確実に「呼び出し本人の id」を得る。
 *   2. 取得は service_role で行うが、必ず `.eq('id', user.id)` で本人の 1 行に限定。
 *      → 他人の id を指定する余地は一切無い（パラメータを受け取らない）。
 *   3. パスワードや service_role 鍵など profiles に無い秘匿値は元々返らない。
 *
 * これにより「列権限は role 単位」という制約を回避しつつ、PII の越境参照を防ぐ。
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: profile, error } = await admin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) console.error('[api/me] profile fetch failed:', error.message, 'user:', user.id)

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // email は auth.users が正。profiles.email が古い場合に備え auth 側を優先で補完。
  return NextResponse.json({ profile: { ...profile, email: user.email ?? profile.email } })
}

/**
 * 本人のバースデー公開設定を更新する（クリエイターのみ）。
 *
 * 依頼(2026-10): 「誕生日を設定するところがなく、バースデーキャストの欄が使えない」。
 * /birthdays は「本人確認で登録した生年月日」を、本人が公開に同意した(birthday_public=true)
 * クリエイターだけ月日で表示する設計だったが、同意を切り替える画面がどこにも無く全員 false のままだった。
 *
 * - 受け付けるのは birthday_public / accepts_birthday_messages の2つの真偽値だけ。
 *   生年月日そのもの（本人確認の提出物）はここでは一切変更させない。
 * - 公開をONにするには、本人確認で生年月日が登録済みであること。
 * - 更新は service_role で本人の1行に限定し、0行更新を成功扱いにしない。
 */
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const patch: { birthday_public?: boolean; accepts_birthday_messages?: boolean } = {}
  if (typeof body?.birthday_public === 'boolean') patch.birthday_public = body.birthday_public
  if (typeof body?.accepts_birthday_messages === 'boolean') patch.accepts_birthday_messages = body.accepts_birthday_messages
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: current, error: curErr } = await admin
    .from('profiles')
    .select('role, birthdate, is_suspended, deleted_at')
    .eq('id', user.id)
    .maybeSingle()
  if (curErr || !current) {
    console.error('[api/me PATCH] profile fetch failed:', curErr?.message, 'user:', user.id)
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }
  if (current.is_suspended || current.deleted_at) {
    return NextResponse.json({ error: 'account_suspended' }, { status: 403 })
  }
  if (current.role !== 'creator' && current.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden', detail: 'バースデー設定はクリエイターのみ利用できます' }, { status: 403 })
  }
  if (patch.birthday_public === true && !current.birthdate) {
    return NextResponse.json(
      { error: 'birthdate_missing', detail: '本人確認で生年月日が登録されていないため公開できません。先に本人確認を提出してください' },
      { status: 400 },
    )
  }

  const { data: updated, error: updErr } = await admin
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select('birthday_public, accepts_birthday_messages')
  if (updErr) {
    console.error('[api/me PATCH] update failed:', updErr.message, 'user:', user.id)
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
  }
  if (!updated || updated.length !== 1) {
    return NextResponse.json({ error: '保存に失敗しました（対象が見つかりません）' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, ...updated[0] })
}
