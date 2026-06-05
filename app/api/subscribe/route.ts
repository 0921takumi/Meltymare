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

  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'active')  // 楽観ロック: 並列キャンセルで二重デクリメント防止
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // member_count を atomic にデクリメント（v16 RPC、0 未満にならないように clamp 済み）
  const { error: decErr } = await supabase.rpc('decrement_member_count', { plan_id: sub.plan_id })
  if (decErr) console.warn('[subscribe] decrement_member_count failed:', decErr.message)

  // 監査ログ（ユーザー自身のアクションとして記録）
  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'subscription.cancelled',
    target_type: 'subscription',
    target_id: id,
    metadata: { plan_id: sub.plan_id },
  })

  return NextResponse.json({ ok: true })
}
