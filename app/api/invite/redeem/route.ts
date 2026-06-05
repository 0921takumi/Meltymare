/**
 * 招待コード redemption（消化）API
 *
 * 🔴 旧実装の致命的問題:
 *   - 認証チェック無しで誰でも呼べた
 *   - user_id をクライアントから受け取り、任意ユーザーの redemption を作成可能だった
 *   - used_count を「読んで足して書く」3ステップで更新 → race condition で max_uses 超過
 *   - 攻撃ベクトル: 他人になりすまし redemption 作成 → 招待枠を悪意で枯渇させる
 *
 * 修正:
 *   - 認証必須（auth.uid() を user_id に強制）
 *   - レート制限
 *   - invite_code_id の UUID 検証
 *   - DB 側 v17 RPC `redeem_invite_code` で atomic に redemption + カウント増分
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await rateLimit({ key: `invite-redeem:${user.id}`, limit: 5, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const inviteCodeId: unknown = body.invite_code_id
  if (typeof inviteCodeId !== 'string' || !UUID_RE.test(inviteCodeId)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  // v17 RPC: SECURITY DEFINER で auth.uid() を actor に固定 + max_uses CAS
  const { data: ok, error } = await supabase.rpc('redeem_invite_code', { p_invite_code_id: inviteCodeId })
  if (error) {
    console.error('[invite-redeem] rpc error:', error)
    return NextResponse.json({ error: 'redeem_failed' }, { status: 500 })
  }
  if (ok !== true) {
    // 上限到達 / 期限切れ / 無効化 / 存在しない、いずれかでも区別せず統一エラー
    return NextResponse.json({ error: 'invalid_or_exhausted' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
