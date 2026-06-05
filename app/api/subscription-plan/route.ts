/**
 * サブスクリプションプラン管理 API（クリエイター用）
 *
 * 注意:
 *   - 関連する /api/subscribe は **Blocker #1（Stripe Subscription 未統合）** が残っているため、
 *     プランを作成しても課金は走らない。リリース前に必ず subscribe 側を修正する。
 *
 * セキュリティ設計:
 *   - requireCreator で認可ゲート（lib/auth.ts 統一）
 *   - id の UUID 検証
 *   - name / description は sanitizeText
 *   - badge_color は #rrggbb の hex のみ許可（CSS injection 防止）
 *   - badge_emoji は短い文字列に制限
 *   - rate limit
 *   - 操作対象は creator_id=本人 に限定（admin 上書きは別経路）
 */

import { NextResponse } from 'next/server'
import { requireCreator } from '@/lib/auth'
import { sanitizeText, sanitizeOptional } from '@/lib/sanitize'
import { rateLimit } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f-]{36}$/i
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/
const DEFAULT_COLOR = '#a855f7'
const DEFAULT_EMOJI = '⭐'

function sanitizeColor(input: unknown): string {
  return typeof input === 'string' && HEX_COLOR_RE.test(input) ? input : DEFAULT_COLOR
}

function sanitizeEmoji(input: unknown): string {
  if (typeof input !== 'string') return DEFAULT_EMOJI
  // 制御文字を除外し、最大8文字（絵文字は1グラフェムで複数codepoint使うため余裕を持たせる）
  const cleaned = sanitizeText(input, { maxLength: 8, allowNewlines: false })
  return cleaned || DEFAULT_EMOJI
}

function sanitizeBenefits(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .slice(0, 10)
    .map((b) => sanitizeText(b, { maxLength: 100, allowNewlines: false }))
    .filter((b) => b.length > 0)
}

export async function POST(req: Request) {
  const ctx = await requireCreator()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, user } = ctx

  const rl = await rateLimit({ key: `sub-plan:${user.id}`, limit: 20, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const { name, description, monthly_price, benefits, badge_emoji, badge_color, is_active } = body

  const cleanName = sanitizeText(name, { maxLength: 40, allowNewlines: false })
  if (!cleanName) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 })
  }
  if (typeof monthly_price !== 'number' || !Number.isFinite(monthly_price) || monthly_price < 500 || monthly_price > 1_000_000) {
    return NextResponse.json({ error: 'invalid_price' }, { status: 400 })
  }

  const { data: inserted, error } = await supabase
    .from('subscription_plans')
    .insert({
      creator_id: user.id,
      name: cleanName,
      description: sanitizeOptional(description, { maxLength: 200, allowNewlines: true }),
      monthly_price,
      benefits: sanitizeBenefits(benefits),
      badge_emoji: sanitizeEmoji(badge_emoji),
      badge_color: sanitizeColor(badge_color),
      is_active: is_active !== false,
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: inserted.id })
}

export async function PATCH(req: Request) {
  const ctx = await requireCreator()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, user } = ctx

  const rl = await rateLimit({ key: `sub-plan:${user.id}`, limit: 20, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const { id, name, description, monthly_price, benefits, badge_emoji, badge_color, is_active } = body
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  // 許可フィールドだけを通す
  const updates: Record<string, unknown> = {}
  if (name !== undefined) {
    const cleanName = sanitizeText(name, { maxLength: 40, allowNewlines: false })
    if (!cleanName) return NextResponse.json({ error: 'invalid_name' }, { status: 400 })
    updates.name = cleanName
  }
  if (description !== undefined) {
    updates.description = sanitizeOptional(description, { maxLength: 200, allowNewlines: true })
  }
  if (monthly_price !== undefined) {
    if (typeof monthly_price !== 'number' || !Number.isFinite(monthly_price) || monthly_price < 500 || monthly_price > 1_000_000) {
      return NextResponse.json({ error: 'invalid_price' }, { status: 400 })
    }
    updates.monthly_price = monthly_price
  }
  if (benefits !== undefined) updates.benefits = sanitizeBenefits(benefits)
  if (badge_emoji !== undefined) updates.badge_emoji = sanitizeEmoji(badge_emoji)
  if (badge_color !== undefined) updates.badge_color = sanitizeColor(badge_color)
  if (is_active !== undefined) updates.is_active = Boolean(is_active)

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 })
  }

  const { error } = await supabase
    .from('subscription_plans')
    .update(updates)
    .eq('id', id)
    .eq('creator_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const ctx = await requireCreator()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, user } = ctx

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const { error } = await supabase
    .from('subscription_plans')
    .delete()
    .eq('id', id)
    .eq('creator_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
