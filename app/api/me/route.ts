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

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // email は auth.users が正。profiles.email が古い場合に備え auth 側を優先で補完。
  return NextResponse.json({ profile: { ...profile, email: user.email ?? profile.email } })
}
