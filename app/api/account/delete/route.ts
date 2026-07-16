/**
 * アカウント削除（退会）API — v43: ソフト削除に変更
 *
 * 決定事項（先方確認済み）: ユーザーデータは1年保持し、その期間内は復元できる。
 * そのため即時のデータ削除・auth.users削除はもう行わない。
 *   1. profiles.deleted_at を打刻するのみ（データは一切消さない）
 *   2. セッションを終了する
 *   3. 1年間ログインしなければ、後続タスクで実装する自動パージ処理が
 *      購入/チップ記録を匿名化し、推し活系データ(follows/comments/poll_votes等)を
 *      完全削除し、auth.usersを削除する（未実装・別タスク）
 *   4. 1年以内にログインすると proxy.ts が /auth/restore へ誘導し、
 *      そこで復元（deleted_at のクリア）ができる
 *
 * セキュリティ設計:
 *   - 認証必須
 *   - **二重認証**: パスワード再入力を必須化（アカウント乗っ取り時の即時削除を防止）
 *   - レート制限（5req/分）
 *   - 監査ログに記録
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const rl = await rateLimit({ key: `account-delete:${user.id}`, limit: 5, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  // 二重認証: 現在のパスワードを必須化
  const body = await req.json().catch(() => ({}))
  const password: unknown = body.password
  if (typeof password !== 'string' || password.length < 1) {
    return NextResponse.json({ error: 'password_required' }, { status: 400 })
  }

  // パスワード再検証（signInWithPassword で失敗すれば乗っ取り防止）
  const verify = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  })
  if (verify.error || verify.data.user?.id !== user.id) {
    return NextResponse.json({ error: 'invalid_password' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { error: updErr } = await admin
    .from('profiles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', user.id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'account.soft_delete',
    target_type: 'user',
    target_id: user.id,
    metadata: { email: user.email, deleted_at: new Date().toISOString() },
  })

  await supabase.auth.signOut()

  return NextResponse.json({ ok: true })
}
