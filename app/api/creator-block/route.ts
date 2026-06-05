/**
 * クリエイター→購入者ブロック / 解除
 *
 * セキュリティ設計:
 *   - requireCreator で認可ゲート（lib/auth.ts 統一）
 *   - blocked_user_id の UUID 検証
 *   - self-block 防止
 *   - reason を sanitizeText
 *   - rate limit
 */

import { NextResponse } from 'next/server'
import { requireCreator } from '@/lib/auth'
import { sanitizeOptional } from '@/lib/sanitize'
import { rateLimit } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function POST(req: Request) {
  const ctx = await requireCreator()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, user } = ctx

  const rl = await rateLimit({ key: `creator-block:${user.id}`, limit: 30, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const blockedUserId = body?.blocked_user_id

  if (typeof blockedUserId !== 'string' || !UUID_RE.test(blockedUserId)) {
    return NextResponse.json({ error: 'invalid_user' }, { status: 400 })
  }
  if (blockedUserId === user.id) {
    return NextResponse.json({ error: 'cannot_block_self' }, { status: 400 })
  }

  const cleanReason = sanitizeOptional(body?.reason, { maxLength: 500, allowNewlines: true })

  const { error } = await supabase
    .from('creator_blocks')
    .upsert(
      { creator_id: user.id, blocked_user_id: blockedUserId, reason: cleanReason },
      { onConflict: 'creator_id,blocked_user_id' },
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const ctx = await requireCreator()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, user } = ctx

  const rl = await rateLimit({ key: `creator-block:${user.id}`, limit: 30, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const blockedUserId = body?.blocked_user_id
  if (typeof blockedUserId !== 'string' || !UUID_RE.test(blockedUserId)) {
    return NextResponse.json({ error: 'invalid_user' }, { status: 400 })
  }

  const { error } = await supabase
    .from('creator_blocks')
    .delete()
    .eq('creator_id', user.id)
    .eq('blocked_user_id', blockedUserId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
