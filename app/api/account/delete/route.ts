/**
 * アカウント削除（退会）API
 *
 * セキュリティ設計:
 *   - 認証必須
 *   - **二重認証**: パスワード再入力を必須化（アカウント乗っ取り時の即時削除を防止）
 *   - レート制限（5req/分）
 *   - 削除前に audit_logs に記録（actor_id は退会する本人）
 *   - 削除範囲を拡大:
 *       - profiles / follows / requests（既存）
 *       - tips / content_comments / comment_likes / live_chat_messages / stories /
 *         poll_votes / subscriptions（追加）
 *       - identity_documents バケットの本人フォルダ（追加、個人情報保護）
 *   - 残存:
 *       - purchases（会計・法令保持、SECURITY.md「未対応」欄に明記）
 *       - contents（クリエイターのコンテンツは購入者保護のため即削除しない）
 *       - audit_logs（actor_id は SET NULL される設計）
 *
 * 仕様メモ:
 *   - クリエイターアカウントの退会には別途「クリエイター退会フロー」が必要
 *     （未払い金、ファンサポートとの整合性）— 別タスクで対応
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
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

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 削除前監査ログ（auth.users 削除後は actor_id が SET NULL になるため事前に記録）
  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'account.delete',
    target_type: 'user',
    target_id: user.id,
    metadata: { email: user.email, deleted_at: new Date().toISOString() },
  })

  // ─── データ削除（順番に。失敗時はログに残しつつ続行） ──────────────
  // 個別失敗を許容する設計: profiles 削除前にユーザー関連データを掃除する。
  // 完全な整合性が必要ならトランザクション化を別途検討（現状はベストエフォート）。
  // Supabase の query builder は thenable（PromiseLike）なので型を緩める。
  const cleanup = async (label: string, run: () => PromiseLike<{ error: unknown }>) => {
    const { error } = await run()
    if (error) console.warn(`[account-delete] ${label} failed:`, error)
  }

  await cleanup('follows', () => admin.from('follows').delete().or(`follower_id.eq.${user.id},creator_id.eq.${user.id}`))
  await cleanup('requests', () => admin.from('requests').delete().eq('user_id', user.id))
  await cleanup('tips', () => admin.from('tips').delete().eq('user_id', user.id))
  await cleanup('content_comments', () => admin.from('content_comments').delete().eq('user_id', user.id))
  await cleanup('comment_likes', () => admin.from('comment_likes').delete().eq('user_id', user.id))
  await cleanup('live_chat_messages', () => admin.from('live_chat_messages').delete().eq('user_id', user.id))
  await cleanup('stories', () => admin.from('stories').delete().eq('creator_id', user.id))
  await cleanup('poll_votes', () => admin.from('poll_votes').delete().eq('user_id', user.id))
  await cleanup('subscriptions', () => admin.from('subscriptions').delete().eq('user_id', user.id))

  // identity_documents バケットの本人フォルダを削除（個人情報保護）
  // ファイル一覧を取得して個別削除（Storage には folder delete API がないため）
  try {
    const { data: files } = await admin.storage
      .from('identity_documents')
      .list(user.id, { limit: 100 })
    if (files && files.length > 0) {
      const paths = files.map((f) => `${user.id}/${f.name}`)
      const { error: delErr } = await admin.storage.from('identity_documents').remove(paths)
      if (delErr) console.warn('[account-delete] identity_documents removal failed:', delErr)
    }
  } catch (e) {
    console.warn('[account-delete] identity_documents cleanup error:', e)
  }

  // profiles は最後（FK 解除の意味）
  await cleanup('profiles', () => admin.from('profiles').delete().eq('id', user.id))

  // 最後に auth.users を削除（成功しないと完全退会にならないので error は返す）
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
