/**
 * サブスクリプション作成 / キャンセル
 *
 * 🚨 SECURITY BLOCKER（本番リリース前に必ず解消）:
 *   現状この API は Stripe Subscription を作成せず、DB レコードを直接 `status='active'` で
 *   挿入している。**つまり有料プランでも無料で active になる**。
 *
 *   本番リリース前に Stripe Subscription Checkout を組み込み、webhook で `status='active'`
 *   に遷移させる流れに改修すること。`/api/purchase` + `/api/webhook` と同じパターン。
 *
 *   参考: SECURITY.md の「公開前に必ず実行する手動ステップ」セクションに記載。
 *
 * セキュリティ設計:
 *   - 認証必須 / レート制限（10req/分）
 *   - plan_id / id の UUID 検証
 *   - 自己購読ブロック
 *   - member_count は atomic RPC（増分時の race condition 対策、v16 で追加）
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f-]{36}$/i

// 機能停止ガード（Phase 2 まで完全封鎖）
function disabledResponse() {
  return NextResponse.json(
    { error: 'subscriptions_disabled', message: 'サブスクリプション機能は現在ご利用いただけません。' },
    { status: 503 },
  )
}

/**
 * 加入処理 — 完全停止中（FEATURES.subscriptions = false）
 *
 * 過去ここには「Stripe を通さず `status='active'` を直 INSERT する」コードがあり、
 * セキュリティBLOCKERとして指摘された。再発防止のため**コード自体を削除**した。
 *
 * Phase 2 で機能を再有効化する際は、`/api/purchase` + `/api/webhook` と同じパターンで
 * 必ず Stripe Subscription Checkout を経由し、webhook で `status='active'` に遷移させる
 * 実装をここに新規に書き起こすこと。既存DBへの直書きで済ませない。
 */
export async function POST() {
  return disabledResponse()
}

export async function DELETE(req: Request) {
  // 既存契約のキャンセル経路は止めない（顧客保護）。ただし機能停止状態でも
  // 既存DBレコードを cancelled に更新できるよう、ガードはしない。
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // レート制限
  const rl = await rateLimit({ key: `subscribe-del:${user.id}`, limit: 10, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const { data: sub } = await supabase.from('subscriptions').select('id, plan_id, user_id, status').eq('id', id).single()
  if (!sub || sub.user_id !== user.id) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // 冪等: 既に cancelled なら no-op
  if (sub.status === 'cancelled') return NextResponse.json({ ok: true })

  // 監査で発覚: この update は session client(authenticated)で行っており、
  // .select()が無いため0行更新（RLSに阻まれた/並行キャンセル）でもerrorがnullで
  // 「解約成功」に見えてしまっていた。行数を明示チェックし、更新できた時だけ
  // デクリメント・監査ログを実行する。
  const { data: updated, error } = await supabase
    .from('subscriptions')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'active')  // 楽観ロック: 並列キャンセルで二重デクリメント防止
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) return NextResponse.json({ ok: true }) // 既に他リクエストでcancelled済み・冪等

  // 監査で発覚: decrement_member_count/increment_member_count は所有権チェックが
  // 一切ないRPCで、authenticatedロールに実行権限が付与されたままだった。
  // 直接 supabase.rpc('decrement_member_count', {plan_id: 任意}) を呼べば、
  // 購読していないユーザーでも任意プランの会員数を荒らせる状態だったため、
  // 実書き込みは admin(service_role) に集約する（対応するREVOKEは別SQLで実行）。
  const admin = createAdminClient()
  const { error: decErr } = await admin.rpc('decrement_member_count', { plan_id: sub.plan_id })
  if (decErr) console.warn('[subscribe] decrement_member_count failed:', decErr.message)

  // 監査ログ（ユーザー自身のアクションとして記録）
  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'subscription.cancelled',
    target_type: 'subscription',
    target_id: id,
    metadata: { plan_id: sub.plan_id },
  })

  // 監査で発覚: 解約がクリエイターに一切通知されず、会員が減ったことに気づく手段が
  // 無かった（decrement_member_countで数字が動くのみ）。
  const { data: plan } = await admin.from('subscription_plans').select('creator_id, name').eq('id', sub.plan_id).maybeSingle()
  if (plan?.creator_id) {
    const { error: cancelNotifErr } = await admin.from('notifications').insert({
      user_id: plan.creator_id,
      type: 'subscription',
      title: '会員が解約しました',
      body: `${plan.name ?? 'プラン'} の会員が解約しました`,
      link: '/creator/dashboard',
    })
    if (cancelNotifErr) console.error('[subscribe] creator cancel notification insert failed:', cancelNotifErr.message)
  }

  return NextResponse.json({ ok: true })
}
