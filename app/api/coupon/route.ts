import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireCreator } from '@/lib/auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { sanitizeText } from '@/lib/sanitize'

// GET /api/coupon?code=XXX&price=NNN  → クーポン検証 + 割引額返却
export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit({ key: `coupon-get:${ip}`, limit: 30, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const rawCode = req.nextUrl.searchParams.get('code') ?? ''
  const code = sanitizeText(rawCode, { maxLength: 40, allowNewlines: false }).toUpperCase()
  const price = parseInt(req.nextUrl.searchParams.get('price') ?? '0', 10)
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000) {
    return NextResponse.json({ error: 'invalid price' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: coupon } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .single()

  if (!coupon) return NextResponse.json({ error: '有効なクーポンが見つかりません' }, { status: 404 })
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return NextResponse.json({ error: 'クーポンの有効期限が切れています' }, { status: 400 })
  }
  if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) {
    return NextResponse.json({ error: 'このクーポンは使用上限に達しています' }, { status: 400 })
  }
  if (price < (coupon.min_amount ?? 0)) {
    return NextResponse.json({ error: `¥${coupon.min_amount?.toLocaleString()}以上のご購入から使用できます` }, { status: 400 })
  }

  const discount = coupon.discount_type === 'percent'
    ? Math.floor(price * coupon.discount_value / 100)
    : coupon.discount_value

  return NextResponse.json({
    id: coupon.id,
    code: coupon.code,
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
    discount_amount: Math.min(discount, price),
    final_price: Math.max(0, price - discount),
  })
}

// POST /api/coupon  → クリエイターがクーポン作成
export async function POST(req: NextRequest) {
  const ctx = await requireCreator()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, user } = ctx

  const rl = rateLimit({ key: `coupon-post:${user.id}`, limit: 10, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const body = await req.json()
  const code = sanitizeText(body.code, { maxLength: 40, allowNewlines: false }).toUpperCase()
  const discount_type = body.discount_type
  const discount_value = parseInt(body.discount_value, 10)
  const min_amount = body.min_amount ? parseInt(body.min_amount, 10) : 0
  const max_uses = body.max_uses ? parseInt(body.max_uses, 10) : null
  const expires_at = body.expires_at || null

  if (!code || !/^[A-Z0-9_-]{3,40}$/.test(code)) {
    return NextResponse.json({ error: 'コードは英数字3〜40文字' }, { status: 400 })
  }
  if (discount_type !== 'percent' && discount_type !== 'fixed') {
    return NextResponse.json({ error: 'Invalid discount_type' }, { status: 400 })
  }
  if (!Number.isFinite(discount_value) || discount_value <= 0) {
    return NextResponse.json({ error: 'Invalid discount_value' }, { status: 400 })
  }
  if (discount_type === 'percent' && discount_value > 100) {
    return NextResponse.json({ error: '割引率は100以下' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('coupons')
    .insert({
      code,
      discount_type,
      discount_value,
      min_amount,
      max_uses,
      expires_at,
      creator_id: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// DELETE /api/coupon?id=XXX
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('coupons')
    .update({ is_active: false })
    .eq('id', id)
    .eq('creator_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
